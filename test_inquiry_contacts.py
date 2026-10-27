import unittest
from registry_discovery import Page,emporia_record
from inquiry_contacts import emporia_inquiry
from buyer_profiles import profile_facts

URL='https://www.emporia-realestate.com/property/urbanized-land-l600-zadar/'
TITLE='Urbanized land L600 - Zadar'
STAMP='2026-10-27T08:00:00Z'

def detail(form_url=URL,form_title=TITLE,action=None,submit=True):
    return (f'<meta property="og:title" content="{TITLE}"><meta property="og:url" content="{URL}">'
            f'<h1>{TITLE}</h1> Print 100.000 € L600 For Sale Land in Zadar Plot Size 500 m² Additional features '
            f'<form action="{action or URL}"><input name="listing_url" value="{form_url}">'
            f'<input name="listing_title" value="{form_title}"><input name="your-email">'
            '<textarea name="your-message"></textarea>'
            + ('<input type="submit" value="Send">' if submit else '')+'</form>')

class InquiryTests(unittest.TestCase):
    def test_exact_listing_form_produces_scoped_agency_contact(self):
        row=emporia_record({'id':115},URL,Page(detail()),[],STAMP)
        c=row['facts']['source_contact']
        self.assertTrue(c['permitted']);self.assertEqual(c['contact_url'],URL)
        self.assertEqual(c['permission_scope'],'property_enquiry_only')
        self.assertEqual(c['checked_at'],STAMP)
        self.assertFalse(row['verified'])
        self.assertEqual(row['facts']['advertised_area'],{'value':500.,'unitCode':'MTK'})
        self.assertNotIn('partnership',c)
    def test_generic_or_related_form_and_cross_source_action_do_not_count(self):
        for kwargs in [dict(form_url=URL+'other'),dict(form_title='Another land'),
                       dict(action='https://other.org/'),dict(submit=False)]:
            with self.subTest(kwargs=kwargs):
                self.assertIsNone(emporia_inquiry(URL,TITLE,Page(detail(**kwargs)),STAMP))
        self.assertIsNone(emporia_inquiry(URL,TITLE,Page('<a href="tel:+38523300000">Call</a>'),STAMP))
    def test_buyer_invitation_must_be_reviewed_observed_and_timestamped(self):
        url='https://buyer.example/acquisitions/'
        intent='We buy residential and commercial real estate'
        invite='Present your real estate offer'
        config=dict(url=url,entity_name='Example Buyer',contact_email='deals@buyer.example',
                    intent_evidence=intent,fields=[
                    dict(field='preferred_countries',value=['DE'],evidence='Locations Germany'),
                    dict(field='property_types',value=['Zgrada'],evidence='Residential buildings')])
        page=Page('Example Buyer '+intent+' '+invite+' deals@buyer.example Locations Germany Residential buildings')
        self.assertFalse(profile_facts(url,page,config,STAMP)['source_contact']['permitted'])
        reviewed=dict(config,inquiry_evidence=invite)
        c=profile_facts(url,page,reviewed,STAMP)['source_contact']
        self.assertTrue(c['permitted']);self.assertEqual(c['permission_scope'],'property_enquiry_only')
        with self.assertRaises(ValueError):profile_facts(url,Page('Example Buyer '+intent+' deals@buyer.example'),reviewed,STAMP)
        with self.assertRaises(ValueError):profile_facts(url,page,reviewed,'2026-10-27T08:00:00')

if __name__=='__main__':unittest.main()
