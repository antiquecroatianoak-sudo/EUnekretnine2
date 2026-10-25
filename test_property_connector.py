import copy
import unittest
from property_connector import primary_record

class PrimaryListingTests(unittest.TestCase):
    def setUp(self):
        self.url='https://agency.example/property/123'
        self.n={'@type':'RealEstateListing','url':self.url,'name':'House for sale in Split','offers':{'@type':'OfferForPurchase','price':100000,'priceCurrency':'EUR','itemOffered':{'@type':'House','address':{'addressCountry':'HR','addressLocality':'Split'},'floorSize':{'value':80,'unitCode':'MTK'}},'seller':{'name':'Agency A','email':'info@agency.example'}}}
    def parse(self):return primary_record({'id':66,'country':'AT'},self.url,[self.n],'2026-10-25T20:00:00+00:00')
    def test_country_is_property_country(self):self.assertEqual(self.parse()['country'],'HR')
    def test_seller_contact_is_record_bound(self):self.assertEqual(self.parse()['facts']['source_contact']['email'],'info@agency.example')
    def test_missing_country_rejected(self):
        self.n['offers']['itemOffered']['address'].pop('addressCountry')
        with self.assertRaises(ValueError):self.parse()
    def test_related_listing_rejected(self):
        self.n['url']='https://agency.example/property/456'
        with self.assertRaises(ValueError):self.parse()
    def test_rental_rejected(self):
        self.n['name']='House for rent in Split'
        with self.assertRaises(ValueError):self.parse()
    def test_generic_product_rejected(self):
        self.n['@type']='Product'
        with self.assertRaises(ValueError):self.parse()
    def test_unrelated_organisation_not_contact(self):
        del self.n['offers']['seller']
        with self.assertRaises(ValueError):primary_record({'id':66},self.url,[self.n,{'@type':'Organization','name':'Unrelated','email':'unrelated@example.com'}],'2026-10-25T20:00:00+00:00')
    def test_local_currency_never_eur(self):
        self.n['offers']['priceCurrency']='CZK';self.assertIsNone(self.parse()['facts']['asking_price'])
    def test_unknown_price_preserved(self):
        del self.n['offers']['price'];self.assertIsNone(self.parse()['facts']['asking_price'])
    def test_zero_price_rejected(self):
        self.n['offers']['price']=0
        with self.assertRaises(ValueError):self.parse()
    def test_nonfinite_price_rejected(self):
        self.n['offers']['price']='NaN'
        with self.assertRaises(ValueError):self.parse()
    def test_sold_preserved(self):
        self.n['offers']['availability']='https://schema.org/SoldOut';self.assertEqual(self.parse()['facts']['source_listing_state'],'removed')
    def test_multiple_primary_nodes_rejected(self):
        with self.assertRaises(ValueError):primary_record({'id':66},self.url,[self.n,copy.deepcopy(self.n)],'2026-10-25T20:00:00+00:00')
    def test_unknown_units_not_m2(self):
        self.n['offers']['itemOffered']['floorSize']['unitCode']='FTK';self.assertNotIn('advertised_area',self.parse()['facts'])
    def test_canonical_stable_id(self):self.assertEqual(self.parse()['id'],self.parse()['id'])

class NotairesCheckpointTests(unittest.TestCase):
    def test_published_api_representation_is_requested(self):
        from registry_discovery import content_accept
        self.assertEqual(content_accept('https://www.immobilier.notaires.fr/pub-services/inotr-www-annonces/v1/annonces?page=1'),'application/json')
        self.assertEqual(content_accept('https://www.biddit.be/api/eco/biddit-bff/lot/42'),'application/json')
        self.assertEqual(content_accept('https://www.biddit.be/fr/landing'),'text/html,application/xhtml+xml')
        self.assertEqual(content_accept('https://example.org/robots.txt'),'text/plain')
        self.assertIn('application/xml',content_accept('https://example.org/sitemap.xml'))
    def test_public_auction_preserves_contact_area_and_checkpoint_contract(self):
        import json,time
        from registry_discovery import process_notaires
        item={'annonceId':42,'typeTransaction':'VAE','statut':'LIGNE','publiable':'OUI','bienVendu':'NON','bienRetire':'NON','venteReportee':'NON','seanceDate':'2099-01-01T12:00:00Z','urlDetailAnnonceFr':'https://www.immobilier.notaires.fr/fr/annonce-immo/adjudication/maison/paris/42','typeBien':'MAI','communeNom':'Paris','surface':80,'prixAffiche':100000,'telephone':'0761761899','crpcen':'23002'}
        class Fetcher:
            def get(self,u):return json.dumps({'annonceResumeDto':[item],'nbPages':1})
        rows,state=process_notaires({'id':28,'country':'FR'},None,Fetcher(),time.monotonic()+10,1)
        self.assertEqual(state['cycle_seen'],[])
        self.assertEqual(rows[0]['facts']['advertised_area'],{'value':80,'unitCode':'MTK'})
        self.assertEqual(rows[0]['facts']['source_contact']['record_reference'],item['urlDetailAnnonceFr'])
        self.assertFalse(rows[0]['verified'])
        item['descriptionFr']='Maison (74.44 m²)';item['surface']=77.44
        rows,_=process_notaires({'id':28,'country':'FR'},None,Fetcher(),time.monotonic()+10,1)
        self.assertIsNone(rows[0]['facts']['advertised_area'])
        self.assertEqual(rows[0]['facts']['area_conflict']['structured_area_m2'],77.44)

class DiscoveryAndLatioTests(unittest.TestCase):
    def page(self,title='For sale house in Riga',agent=True,canonical=True):
        from registry_discovery import Page
        u='https://latio.lv/en/properties/139627'
        h='<meta property="og:title" content="'+title+'"><meta property="og:url" content="'+(u if canonical else u+'0')+'"><meta property="og:description" content="Total building area – 572 m². Land plot – 846 m².">'
        h+='<h1>'+title+'</h1>from 0 € ID: SM26139627 Riga Area 572 m² Land 850 m² Description Facts Apply for a visit Price 440 000 € '
        if agent:h+='Send e-mail agent@latio.lv Named Agent Real Estate Agent '
        return Page(h)
    def parse(self,p):
        from property_connector import primary_record
        return primary_record({'id':84},'https://latio.lv/en/properties/139627',[],'2026-10-25T21:00:00Z',p)
    def test_primary_price_ignores_zero_navigation_price(self):self.assertEqual(self.parse(self.page())['facts']['asking_price'],440000)
    def test_latio_does_not_copy_advertisement(self):self.assertNotIn('Total building area',self.parse(self.page())['facts']['evidence_excerpt'])
    def test_land_conflict_retained(self):
        f=self.parse(self.page())['facts'];self.assertNotIn('land_area_m2',f);self.assertEqual(f['area_conflict']['table_land_m2'],850)
    def test_latio_rental_rejected(self):
        with self.assertRaises(ValueError):self.parse(self.page(title='For rent house in Riga'))
    def test_missing_primary_agent_rejected(self):
        with self.assertRaises(ValueError):self.parse(self.page(agent=False))
    def test_canonical_mismatch_rejected(self):
        with self.assertRaises(ValueError):self.parse(self.page(canonical=False))
    def test_unreviewed_country_not_inferred_from_agency(self):
        with self.assertRaises(ValueError):self.parse(self.page(title='For sale house in Madrid'))
    def test_primary_detail_precedes_categories_and_services(self):
        from property_connector import links
        from registry_discovery import Page,objects
        p=Page('<a href="/en/services/property-management/">Property management</a><a href="/en/properties-title/exclusive-offers">Offers</a><a href="/en/properties/139627">House</a>')
        found=links(p,'https://latio.lv/en/properties',objects,lambda u,r:u,'https://latio.lv/en/properties')
        self.assertEqual(found[0],'https://latio.lv/en/properties/139627');self.assertFalse(any('/services/' in u for u in found))

if __name__=='__main__':unittest.main()
