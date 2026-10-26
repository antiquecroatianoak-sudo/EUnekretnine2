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

class LinkedAgencyTests(unittest.TestCase):
    """The offer's agency reference is sufficient; no client contact needed."""
    def setUp(self):
        fixture=PrimaryListingTests();fixture.setUp()
        self.url=fixture.url;self.n=fixture.n
        self.n['offers']['seller']={'@id':'#agency'}
        self.agency={'@id':self.url+'#agency','@type':'RealEstateAgent',
                     'name':'Partner Agency','contactPoint':{'@id':'#contact'}}
        self.contact={'@id':self.url+'#contact','@type':'ContactPoint',
                      'email':'offers@agency.example'}
    def parse(self):
        return primary_record({'id':66,'country':'AT'},self.url,
                              [self.n,self.agency,self.contact],
                              '2026-10-26T06:00:00Z')
    def test_seller_contact_is_record_bound(self):
        f=self.parse()['facts'];c=f['source_contact']
        self.assertEqual(c['email'],'offers@agency.example')
        self.assertEqual(c['mode'],'agency')
        self.assertEqual(c['agency_name'],'Partner Agency')
        self.assertTrue(c['represents_record'])
        self.assertFalse(c['permitted'])
        self.assertFalse(self.parse()['verified'])
    def test_missing_agency_reference_does_not_use_unrelated_page_agency(self):
        self.n['offers']['seller']={'@id':'#other'}
        with self.assertRaisesRegex(ValueError,'unresolved_linked_entity'):self.parse()
    def test_conflicting_agency_definitions_rejected(self):
        other=dict(self.agency,name='Other Agency')
        with self.assertRaisesRegex(ValueError,'ambiguous_linked_entity'):
            primary_record({'id':66},self.url,[self.n,self.agency,self.contact,other],'2026-10-26T06:00:00Z')
    def test_conflicting_contact_definitions_rejected(self):
        other=dict(self.contact,email='different@agency.example')
        with self.assertRaisesRegex(ValueError,'ambiguous_linked_entity'):
            primary_record({'id':66},self.url,[self.n,self.agency,self.contact,other],'2026-10-26T06:00:00Z')
    def test_reference_outside_page_is_never_fetched(self):
        self.n['offers']['seller']={'@id':'https://other.example/agency'}
        with self.assertRaisesRegex(ValueError,'unresolved_linked_entity'):self.parse()
    def test_full_linked_offer_and_property_keep_property_country_and_area(self):
        from registry_discovery import objects
        original=copy.deepcopy(self.n['offers']);item=original['itemOffered']
        item['@id']='#house';item['address']['@id']='#address'
        original.update({'@id':'#offer','itemOffered':{'@id':'#house'}})
        address=item['address'];item['address']={'@id':'#address'}
        self.n['offers']={'@id':'#offer'}
        nodes=list(objects({'@graph':[self.n,original,item,address,self.agency,self.contact]}))
        r=primary_record({'id':66,'country':'AT'},self.url,nodes,'2026-10-26T06:00:00Z')
        self.assertEqual(r['country'],'HR')
        self.assertEqual(r['facts']['advertised_area']['value'],80)
    def test_linked_organisation_is_not_automatically_agency(self):
        self.agency['@type']='Organization'
        self.assertNotIn('mode',self.parse()['facts']['source_contact'])
    def test_linked_agency_does_not_make_rental_a_sale(self):
        self.n['name']='House for rent in Split'
        with self.assertRaisesRegex(ValueError,'unambiguous_sale_required'):self.parse()

class PrimarySourceProbeTests(unittest.TestCase):
    def test_source_detail_is_imported_without_following_related_listing(self):
        import json
        from property_connector import run_source
        from registry_discovery import Page,objects
        n=PrimaryListingTests();n.setUp();url=n.url;calls=[];fetched=[]
        class Fetch:
            def __init__(self,u):pass
            def get(self,u):
                fetched.append(u)
                return '<script type="application/ld+json">'+json.dumps(n.n)+'</script><a href="/property/456">Other house for sale</a>'
        def api(body):calls.append(body);return {'candidates':1,'inserted':1,'updated':0}
        r=run_source({'id':66,'name':'Agency','url':url},api,Fetch,Page,objects,lambda u,r:u,'2026-10-26T06:00:00Z')
        self.assertEqual(r['status'],'batch_confirmed');self.assertEqual(fetched,[url])
        self.assertEqual(calls[0]['candidates'][0]['url'],url)
    def test_source_detail_requires_confirmed_write(self):
        import json
        from property_connector import run_source
        from registry_discovery import Page,objects
        n=PrimaryListingTests();n.setUp()
        class Fetch:
            def __init__(self,u):pass
            def get(self,u):return '<script type="application/ld+json">'+json.dumps(n.n)+'</script>'
        r=run_source({'id':66,'name':'Agency','url':n.url},lambda body:{'candidates':1,'inserted':0,'updated':0},Fetch,Page,objects,lambda u,r:u,'2026-10-26T06:00:00Z')
        self.assertEqual(r['status'],'failed');self.assertIn('write_not_confirmed',r['error'])

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
    def test_hyphenated_sale_categories_are_discovered(self):
        from property_connector import links,category_url
        from registry_discovery import Page,objects
        p=Page('<a href="/en/apartments-for-sale/">Residential properties</a>')
        found=links(p,'https://agency.example/',objects,lambda u,r:u,'https://agency.example/')
        self.assertEqual(found,['https://agency.example/en/apartments-for-sale/'])
        self.assertTrue(category_url(found[0]));self.assertFalse(category_url('https://agency.example/property/12345'))
    def test_probe_follows_category_and_saves_only_individual_record(self):
        import json
        from property_connector import run_source
        from registry_discovery import Page,objects
        root='https://agency.example/';category=root+'en/houses-for-sale/';detail=root+'property/12345'
        n=PrimaryListingTests();n.setUp();n.n['url']=detail
        pages={root:'<a href="'+category+'">Houses</a>',category:'<a href="'+detail+'">House</a>',detail:'<script type="application/ld+json">'+json.dumps(n.n)+'</script>'}
        calls=[]
        class Fetch:
            def __init__(self,u):pass
            def get(self,u):return pages[u]
        def api(body):calls.append(body);return {'candidates':1,'inserted':1,'updated':0}
        r=run_source({'id':99,'name':'Agency','url':root},api,Fetch,Page,objects,lambda u,r:u,'2026-10-25T21:00:00Z')
        self.assertEqual(r['status'],'batch_confirmed');self.assertEqual(r['inserted'],1);self.assertEqual(calls[0]['candidates'][0]['url'],detail)
    def test_real_listing_with_category_like_url_is_not_discarded(self):
        import json
        from property_connector import run_source
        from registry_discovery import Page,objects
        root='https://agency.example/';detail=root+'house-for-sale-nice'
        n=PrimaryListingTests();n.setUp();n.n['url']=detail
        pages={root:'<a href="'+detail+'">House for sale</a>',detail:'<script type="application/ld+json">'+json.dumps(n.n)+'</script>'}
        class Fetch:
            def __init__(self,u):pass
            def get(self,u):return pages[u]
        r=run_source({'id':99,'name':'Agency','url':root},lambda body:{'candidates':1,'inserted':1,'updated':0},Fetch,Page,objects,lambda u,r:u,'2026-10-25T21:00:00Z')
        self.assertEqual(r['inserted'],1)

class OberCatalogueTests(unittest.TestCase):
    def page(self,rental=False,agent=True,area='96.00'):
        from registry_discovery import Page
        kind='Nuomojamas butas' if rental else 'Parduodamas butas'
        u='https://www.ober-haus.lt/butas-pardavimas-kauno,12816768'
        h='<meta property="og:url" content="'+u+'"><meta property="og:title" content="'+kind+': Kauno m. sav., Street">'
        h+='Atgal į paiešką '+kind+' 300 000 € Visas plotas '+area+' m² Nuoroda https://www.ober-haus.lt/OH507136 Apie šį turtą Plotas - 95,52 kv. m '
        if agent:h+='<a href="/darbuotoju-kontaktai/agent/">Named Agent</a> agent@ober-haus.lt '
        h+='Panašūs objektai 999 000 € info@ober-haus.lt'
        return Page(h)
    def parse(self,p):
        from property_connector import primary_record
        return primary_record({'id':82},'https://www.ober-haus.lt/butas-pardavimas-kauno,12816768',[],'2026-10-25T21:00:00Z',p)
    def test_agent_and_price_are_primary(self):
        f=self.parse(self.page())['facts'];self.assertEqual(f['asking_price'],300000);self.assertEqual(f['source_contact']['email'],'agent@ober-haus.lt')
    def test_conflicting_area_not_selected(self):
        f=self.parse(self.page())['facts'];self.assertNotIn('advertised_area',f);self.assertEqual(f['area_conflict']['description_building_m2'],[95.52])
    def test_rental_rejected(self):
        with self.assertRaises(ValueError):self.parse(self.page(rental=True))
    def test_generic_footer_contact_not_used(self):
        with self.assertRaises(ValueError):self.parse(self.page(agent=False))
    def test_public_json_and_next_page_are_preserved(self):
        import json
        from property_connector import catalogue_page
        from registry_discovery import Page
        class Fetch:
            def get(self,u):
                self.url=u
                return json.dumps({'objects':[{'id':'12816768','html':'<a href="https://www.ober-haus.lt/butas-pardavimas-kauno,12816768">Sale</a>'}],'totalObjects':13,'pagination':'<a data-page="2">next</a>'})
        fetch=Fetch();p=catalogue_page({'url':'https://www.ober-haus.lt/en/'},'https://www.ober-haus.lt/en/',fetch,Page)
        self.assertIn('type=Apartment+for+sale',fetch.url);self.assertIn('page=2',p.next[0]);self.assertEqual(len(p.links),1)

if __name__=='__main__':unittest.main()

