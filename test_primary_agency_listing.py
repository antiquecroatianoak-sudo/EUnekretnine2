import json,unittest
from registry_discovery import Page,listing_record
class PrimaryAgencyListingTests(unittest.TestCase):
 def test_recommended_price_cannot_replace_primary(self):
  url='https://www.immonestor.at/objekt/7582406?from=482954'
  main={'@type':'RealEstateListing','url':url.split('?')[0],'name':'Primary property','offers':{'@type':'OfferForPurchase','price':'8500000','priceCurrency':'EUR','itemOffered':{'@type':'Apartment','address':{'addressCountry':'AT','addressLocality':'Wien'}}}}
  related={'@type':'RealEstateListing','url':'https://www.immonestor.at/objekt/16582510','name':'Other property','offers':{'@type':'OfferForPurchase','price':'381000','priceCurrency':'EUR','itemOffered':{'@type':'Apartment','address':{'addressCountry':'AT','addressLocality':'Wien'}}}}
  def page(nodes):return Page('<title>Property example</title><script type="application/ld+json">'+json.dumps(nodes)+'</script>')
  source={'id':999,'country':'AT','category':'Agencija'}
  for nodes in ([main,related],[related,main]):
   row=listing_record(source,url,page(nodes),'property','2026-10-24')
   self.assertEqual(row['facts']['asking_price'],8500000)
   self.assertEqual(row['title'],'Primary property')
  with self.assertRaises(ValueError):listing_record(source,url,page([related]),'property','2026-10-24')
  main['offers']['@type']='OfferForLease'
  with self.assertRaises(ValueError):listing_record(source,url,page([main,related]),'property','2026-10-24')

