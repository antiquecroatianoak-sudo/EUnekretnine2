import json
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from property_connector import collect
from test_property_connector import PrimaryListingTests


class SharedRefreshTests(unittest.TestCase):
    def setUp(self):
        fixture=PrimaryListingTests();fixture.setUp()
        self.url=fixture.url;self.node=fixture.n
        self.source={'id':66,'url':'https://agency.example/','recheck_urls':[self.url]}
        self.previous={'pending':[{'url':self.url,'mode':'detail'},
                                  {'url':self.source['url'],'mode':'index'}],
                       'cycle_seen':[self.url]}

    def run_collect(self, response, max_pages=1):
        calls=[]
        class Fetch:
            def get(inner,url):
                calls.append(url)
                if isinstance(response,Exception):raise response
                return response
        with patch('registry_discovery.safe_url',side_effect=lambda u,r:u):
            rows,state=collect(self.source,self.previous,Fetch(),time.monotonic()+10,max_pages)
        return rows,state,calls

    def test_rechecks_seen_record_once_before_backlog_and_keeps_sold_evidence(self):
        self.node['offers']['availability']='https://schema.org/SoldOut'
        rows,state,calls=self.run_collect('<script type="application/ld+json">'+json.dumps(self.node)+'</script>')
        self.assertEqual(calls,[self.url])
        self.assertEqual(rows[0]['facts']['source_listing_state'],'removed')
        self.assertEqual(state['pending'],[{'url':self.source['url'],'mode':'index'}])
        self.assertEqual(state['detail_pages'],1)
        self.assertTrue(state['partial'])

    def test_explicit_gone_reported_without_dropping_backlog(self):
        rows,state,_=self.run_collect(HTTPError(self.url,410,'Gone',{},None))
        self.assertEqual(rows,[])
        self.assertEqual(state['unavailable_urls'][0]['http_status'],410)
        self.assertEqual(len(state['pending']),1)
        self.assertFalse(state['coverage_complete'])

    def test_denial_preserves_retry_url_and_reports_no_removal(self):
        rows,state,_=self.run_collect(HTTPError(self.url,403,'Forbidden',{},None))
        self.assertEqual(state['pending'][0]['url'],self.url)
        self.assertEqual(state['unavailable_urls'],[])
        self.assertIsNotNone(state['retry_after'])
        self.assertEqual(rows,[])

    def test_changed_format_is_not_a_removed_record(self):
        rows,state,_=self.run_collect('<h1>Changed layout</h1>')
        self.assertEqual(state['unavailable_urls'],[])
        self.assertEqual(state['failed_urls'][0]['url'],self.url)
        self.assertTrue(state['partial'])

    def test_zero_page_budget_keeps_recheck(self):
        rows,state,calls=self.run_collect('',0)
        self.assertEqual(calls,[])
        self.assertEqual(state['pending'][0]['url'],self.url)
        self.assertEqual(state['pages_processed'],0)


if __name__=='__main__':unittest.main()
