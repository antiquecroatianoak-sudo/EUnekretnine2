import unittest
from registry_discovery import Page
from new_property_sources import interfarms_record
class InterfarmsTests(unittest.TestCase):
 def setUp(self):
  self.url='https://interfarms.com/nl/object/21891'
  self.text='<title>Landbouwgrond in Weerdinge</title> 4,63 Hectare | Prijs op aanvraag | Te koop | Losse grond | ID 21891 Drenthe, Nederland Alle fotos Beschrijving Ontvang meer informatie over dit object. Makelaar Koomans Makelaardij info@koomansmakelaardij.nl 0599 - 512 799 Lees meer Verkocht Nederland related listing'
 def parse(self):return interfarms_record({'id':136},self.url,Page(self.text),'2026-10-27T12:00:00Z')
 def test_country_contact_and_hectares(self):
  r=self.parse();self.assertEqual(r['country'],'NL');self.assertEqual(r['facts']['land_area_m2'],46300);self.assertIsNone(r['facts']['asking_price']);self.assertTrue(r['facts']['source_contact']['permitted']);self.assertNotIn('source_listing_state',r['facts'])
 def test_non_eu_property_not_agency_country(self):
  self.text=self.text.replace('Drenthe, Nederland','Canada, Canada')
  with self.assertRaises(ValueError):self.parse()
 def test_mismatched_reference_rejected(self):
  self.text=self.text.replace('ID 21891','ID 21892')
  with self.assertRaises(ValueError):self.parse()
 def test_closed_label_wins_and_related_sold_does_not(self):
  self.text=self.text.replace('| Te koop |','| Verkocht |');self.assertEqual(self.parse()['facts']['source_listing_state'],'removed')
 def test_missing_bound_broker_not_footer_contact(self):
  self.text=self.text.replace('Makelaar Koomans Makelaardij','Contact Interfarms')
  with self.assertRaises(ValueError):self.parse()
 def test_no_enquiry_invitation(self):
  self.text=self.text.replace('Ontvang meer informatie over dit object.','')
  with self.assertRaises(ValueError):self.parse()
 def test_native_currency_never_eur(self):
  self.text=self.text.replace('Prijs op aanvraag','DKK 1.234.567,-');r=self.parse();self.assertIsNone(r['facts']['asking_price']);self.assertEqual(r['facts']['advertised_price'],1234567)
 def test_primary_state_overrides_old_sale_header(self):
  self.text=self.text.replace('Beschrijving','Kenmerken Staat Verkocht Beschrijving');self.assertEqual(self.parse()['facts']['source_listing_state'],'removed')
 def test_price_keeps_cents(self):
  self.text=self.text.replace('Prijs op aanvraag','EUR 123.456,78');self.assertEqual(self.parse()['facts']['asking_price'],123456.78)
 def test_index_not_detail(self):
  self.url='https://interfarms.com/nl/aanbod'
  with self.assertRaises(ValueError):self.parse()
