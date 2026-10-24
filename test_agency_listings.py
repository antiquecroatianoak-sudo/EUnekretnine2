import json
import time
import unittest
from unittest.mock import patch
from registry_discovery import Page,listing_record,canonical,process
from agency_listings import RejectedListing,JUSTIMMO

class AgencyTests(unittest.TestCase):
 def row(self,node,url='https://www.immonestor.at/objekt/123',text='',source_country='DE'):
  page=Page('<title>Example property</title>'+text+'<script type="application/ld+json">'+json.dumps(node)+'</script>')
  return listing_record({'id':999,'country':source_country,'category':'Agencija'},url,page,'property','2026-10-24T16:00:00+00:00')
 def node(self,url='https://www.immonestor.at/objekt/123',c='AT'):
  return {'@type':'RealEstateListing','url':url,'name':'Property in Vienna','offers':{'@type':'OfferForPurchase','price':'250000','priceCurrency':'EUR','itemOffered':{'@type':'Apartment','address':{'addressCountry':c,'addressLocality':'Wien'}}}}
 def test_all_three_agencies_use_property_country_and_canonical_id(self):
  for host in JUSTIMMO:
   url='https://www.'+host+'/objekt/123';n=self.node(url)
   a=self.row(n,url+'?from=1');b=self.row(n,url+'?from=2')
   self.assertEqual(a['country'],'AT');self.assertEqual(a['id'],b['id'])
   self.assertEqual(a['facts']['asking_price'],250000);self.assertEqual(a['facts']['property_type'],'Stan')
 def test_rent_missing_country_and_non_eu_are_deferred(self):
  for c in (None,'US'):
   with self.assertRaises(RejectedListing):self.row(self.node(c=c))
  n=self.node();n['offers']['@type']='OfferForLease'
  with self.assertRaises(RejectedListing):self.row(n)
 def test_nonfinite_negative_and_zero_prices_rejected(self):
  for v in ('NaN','Infinity','-1','0'):
   n=self.node();n['offers']['price']=v
   with self.assertRaises(RejectedListing):self.row(n)
 def test_zweitwohnsitze_seller_country_is_not_property_country(self):
  url='https://zweitwohnsitze.com/objekte/chalet.html'
  n={'@type':'Product','url':url,'name':'Chalet in Austria','description':'Chalet kaufen; Kaufpreis 397000 Euro','additionalProperty':[{'name':'Lage','value':'Murau, Steiermark, Oesterreich'}],'offers':{'@type':'Offer','price':'397000','priceCurrency':'EUR','seller':{'address':{'addressCountry':'DE'}}}}
  a=self.row(n,url,'397000 Euro netto')
  self.assertEqual(a['country'],'AT');self.assertEqual(a['facts']['asking_price'],397000)
  self.assertIn('VAT',a['facts']['price_basis'])
  n['additionalProperty']=[]
  with self.assertRaises(RejectedListing):self.row(n,url)
 def test_raiffeisen_price_ignores_footer_and_rental_occupancy(self):
  url='https://www.raiffeisen-immobilien.at/de/immobilien/kauf/7000/eisenstadt/wohnung.0001011757'
  n={'@type':'RealEstateListing','url':url,'name':'Anlegerwohnung im Herzen von Eisenstadt'}
  a=self.row(n,url,'<header>Kaufpreis 999,00 €</header><main>7000 Eisenstadt Kaufpreis 175.000,00 € Wohnfläche 69,08 m² Beschreibung Derzeit vermietet.</main><footer>Kaufpreis 888,00 €</footer>')
  self.assertEqual(a['facts']['asking_price'],175000);self.assertEqual(a['country'],'AT')
  self.assertEqual(a['facts']['advertised_area']['value'],69.08)
 def test_catalogue_is_not_primary_property(self):
  with self.assertRaises(RejectedListing):self.row(self.node(),url='https://www.immonestor.at/immobilien')
 def test_skip_lease_and_continue_to_valid_purchase(self):
  root='https://www.immonestor.at/immobilien';buy=self.node();rent=self.node('https://www.immonestor.at/objekt/124');rent['offers']['@type']='OfferForLease'
  pages={root:'<a href="/objekt/124">Rent</a><a href="/objekt/123?from=9">Buy</a>'}
  for node in (buy,rent):pages[node['url']]='<script type="application/ld+json">'+json.dumps(node)+'</script>'
  class Fetch:
   def get(self,url):return pages[url]
  source={'id':999,'url':root,'country':'DE','category':'Agencija','import_config':{'sale_scope':True}}
  with patch('registry_discovery.safe_url',side_effect=lambda u,r:canonical(u)):
   rows,state=process(source,{},Fetch(),time.monotonic()+10)
  self.assertEqual(len(rows),1);self.assertEqual(rows[0]['country'],'AT')
  self.assertEqual(len(state['failed_urls']),1);self.assertIsNone(state['error'])
