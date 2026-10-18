import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from registry_discovery import process,listing_record,Page
from test_registry_discovery import Fetch,SOURCE,ROOT,FIRST

class RefreshTests(unittest.TestCase):
    def test_revisits_seen_listing_and_reports_removed_source(self):
        source=dict(SOURCE,recheck_urls=[FIRST])
        fetch=Fetch({FIRST:HTTPError(FIRST,410,'Gone',{},None)})
        rows,state=process(source,{'pending':[{'url':ROOT,'mode':'index','sale':True}],'cycle_seen':[FIRST]},fetch,time.monotonic()+10,max_pages=0)
        self.assertEqual(state['pending'][0]['url'],FIRST)
        with patch('registry_discovery.safe_url',side_effect=lambda url,root:url):
            rows,state=process(source,{'pending':[{'url':FIRST,'mode':'detail','sale':True}],'cycle_seen':[FIRST]},fetch,time.monotonic()+10)
        self.assertEqual(rows,[])
        self.assertEqual(state['unavailable_urls'][0]['http_status'],410)
    def test_structured_sale_data_and_explicit_sold_evidence(self):
        html='<title>Individual apartment for sale</title><script type="application/ld+json">{"@type":"Apartment","address":{"addressLocality":"Zagreb"},"floorSize":{"value":50,"unitCode":"MTK"},"offers":{"price":100000,"priceCurrency":"EUR","availability":"https://schema.org/SoldOut"}}</script>'
        row=listing_record(SOURCE,FIRST,Page(html),'property','2026-10-18T18:00:00+00:00')
        self.assertEqual(row['facts']['property_type'],'Stan')
        self.assertEqual(row['facts']['source_listing_state'],'removed')
        self.assertEqual(row['facts']['asking_price'],100000)
        self.assertFalse(row['verified'])

if __name__=='__main__':unittest.main()
