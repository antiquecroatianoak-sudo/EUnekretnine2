import unittest
from property_connector import primary_record
from registry_discovery import Page

URL='https://www.bulgarianproperties.com/Houses_in_Bulgaria/AD79003BG_House_for_sale_in_Sunny_Beach.html'

class BulgarianTests(unittest.TestCase):
    def page(self, price='€ 480 000', title='House for sale in Sunny Beach, Bulgaria.', ref='79003', phone=True, canonical=URL):
        text='<title>'+title+'</title><meta property="og:title" content="Primary house sale"><meta property="og:url" content="'+canonical+'">'
        text+='For sale Home REQUEST DETAILS '+price+' (without VAT) Area: 155.60 m 2 Garden: 752 m 2 '
        if phone:text+='Property ref: Snb '+ref+' When calling, please quote the property reference number. +359 882 817 478 +44 20 8816 8118 Close '
        text+='More properties € 84 500 Area: 70.61 m 2'
        return Page(text)
    def parse(self,**kwargs):return primary_record({'id':68,'country':'AT'},URL,[],'2026-10-26T08:00:00Z',self.page(**kwargs))
    def test_primary_price_contact_country_and_net_basis(self):
        r=self.parse();f=r['facts']
        self.assertEqual(r['country'],'BG');self.assertEqual(f['asking_price'],480000)
        self.assertEqual(f['advertised_area']['value'],155.6)
        self.assertEqual(f['source_contact']['phone'],'+359 882 817 478')
        self.assertIn('VAT additional',f['price_basis'])
        self.assertFalse(r['verified']);self.assertFalse(f['source_contact']['permitted'])
    def test_range_and_from_price_not_selected(self):
        for price in ['590 000 - 900 000 €','from € 480 000','€ 480 000 - 900 000','€ 0']:
            with self.subTest(price=price),self.assertRaises(ValueError):self.parse(price=price)
    def test_rental_or_unconfirmed_property_country_rejected(self):
        for title in ['House for rent in Sunny Beach, Bulgaria.','House for sale in Sunny Beach.']:
            with self.assertRaises(ValueError):self.parse(title=title)
    def test_wrong_reference_or_generic_only_contact_rejected(self):
        with self.assertRaises(ValueError):self.parse(ref='79004')
        with self.assertRaises(ValueError):self.parse(phone=False)
    def test_canonical_mismatch_rejected(self):
        with self.assertRaises(ValueError):self.parse(canonical=URL+'0')
    def test_building_area_conflict_is_preserved(self):
        p=self.page();p.text.append('The house with an area of 160 sq.m.')
        r=primary_record({'id':68},URL,[],'2026-10-26T08:00:00Z',p)
        self.assertNotIn('advertised_area',r['facts'])
        self.assertEqual(r['facts']['area_conflict']['description_building_m2'],[160])

if __name__=='__main__':unittest.main()
