import unittest
from public_land_sources import PUBLIC_LAND_CALLS, public_land_record

class PublicLandTests(unittest.TestCase):
    def test_official_calls_are_unverified_buy_requests(self):
        phrases=['The ongoing land acquisition programme supports housing.',
                 'We invite landowners to sell residential zoned lands.',
                 'Javni poziv za nakup stanovanj in zemljišč za gradnjo stanovanj v letih 2026 in 2027']
        for (url,config),text in zip(PUBLIC_LAND_CALLS.items(),phrases):
            source={'id':101,'url':url,'country':config['country']}
            row=public_land_record(source,text)
            self.assertFalse(row['verified'])
            self.assertEqual(row['facts']['transaction_type'],'buy_request')
            self.assertIsNone(row['facts']['budget'])
            self.assertIsNone(row['facts']['deadline'])
            self.assertEqual(row['facts']['buyer_type'],'public_authority')
            self.assertEqual(row['id'],public_land_record(source,text)['id'])
    def test_government_sales_and_generic_pages_are_rejected(self):
        url=next(iter(PUBLIC_LAND_CALLS));source={'id':101,'url':url,'country':'IE'}
        for text in ['Government land for sale','Welcome to the council','This acquisition call has been removed']:
            with self.assertRaises(ValueError):public_land_record(source,text)
    def test_unreviewed_host_and_wrong_country_rejected(self):
        with self.assertRaises(ValueError):public_land_record({'id':1,'url':'https://example.com','country':'IE'},'ongoing land acquisition programme')
        with self.assertRaises(ValueError):public_land_record({'id':1,'url':next(iter(PUBLIC_LAND_CALLS)),'country':'HR'},'ongoing land acquisition programme')

if __name__=='__main__':unittest.main()
