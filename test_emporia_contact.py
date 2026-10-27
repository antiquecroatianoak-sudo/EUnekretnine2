import unittest
from registry_discovery import Page, emporia_record

class EmporiaContactTests(unittest.TestCase):
 def record(self, extra='', cta=True, state='For Sale', price='79.000', plot='545', path='urbanized-land-l586-zadar/'):
  url='https://www.emporia-realestate.com/property/'+path
  title='Urbanized land L586 - Zadar'
  html=f'<meta property="og:title" content="{title}"><meta property="og:url" content="{url}">'
  if cta: html+='CALL US TODAY <a href="tel:+38523300000">+385 23 300 000</a>'
  html+=f'<h1>{title}</h1> Print {price} € L586 {state} Land in Zadar {extra} Plot Size {plot} m² Additional features'
  return emporia_record({'id':115},url,Page(html),[],'2026-10-27T08:00:00Z')['facts']
 def test_listing_bound_agency_enquiry(self):
  f=self.record(); c=f['source_contact']
  self.assertTrue(c['permitted']); self.assertTrue(c['represents_record'])
  self.assertEqual(c['permission_scope'],'property_enquiry_only')
  self.assertEqual(c['record_reference'],c['evidence_url'])
  self.assertEqual(f['source_listing_state'],'observed')
 def test_no_inferred_permission_without_observed_call(self):
  self.assertNotIn('source_contact',self.record(cta=False))
 def test_closure_preserved_despite_contact(self):
  self.assertEqual(self.record(state='Sold')['source_listing_state'],'removed')
 def test_land_area_reaches_standard_draft(self):
  self.assertEqual(self.record()['advertised_area']['value'],545)
 def test_unit_price_total(self):
  f=self.record(extra='The price of 200 €/m2',price='200',plot='2329')
  self.assertEqual(f['unit_price'],200); self.assertEqual(f['asking_price'],465800)
 def test_conflicting_unit_prices_do_not_invent_total(self):
  self.assertIsNone(self.record(extra='200 €/m2 and 250 €/m²')['asking_price'])
 def test_decimal_and_grouped_areas(self):
  self.assertEqual(self.record(plot='146.40')['advertised_area']['value'],146.4)
  self.assertEqual(self.record(plot='2.329')['advertised_area']['value'],2329)
  self.assertEqual(self.record(plot='146,40')['advertised_area']['value'],146.4)

if __name__=='__main__':unittest.main()
