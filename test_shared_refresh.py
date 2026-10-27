import json
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from datetime import datetime,timezone,timedelta
from property_connector import collect,retry_pending
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
        for error in [HTTPError(self.url,403,'Forbidden',{},None),HTTPError(self.url,403,'timed out',{},None),HTTPError(self.url,429,'Too Many Requests',{},None),ValueError('robots.txt disallows this URL')]:
            rows,state,_=self.run_collect(error)
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

    def test_timeout_keeps_queue_without_a_day_long_access_cooldown(self):
        for error in [TimeoutError('read timed out'),URLError(TimeoutError('read timed out'))]:
            rows,state,calls=self.run_collect(error)
            self.assertEqual(rows,[]);self.assertEqual(calls,[self.url])
            self.assertEqual(state['pending'][0]['url'],self.url)
            self.assertEqual(state['unavailable_urls'],[])
            self.assertEqual(state['error_kind'],'timeout')
            self.assertNotIn('retry_after',state)

    def test_legacy_timeout_waits_six_hours_and_preserves_access_cooldowns(self):
        now=datetime(2026,10,27,12,tzinfo=timezone.utc)
        old=dict(scope='Shared primary JSON-LD connector; discovered pages only',error='TimeoutError: The read operation timed out',retry_after=(now+timedelta(hours=12)).isoformat())
        for hours,pending in [(5.999,True),(6,False),(12,False)]:
            self.assertEqual(retry_pending(dict(old,checked_at=(now-timedelta(hours=hours)).isoformat()),now),pending)
        for error in ['HTTPError: HTTP Error 403: Forbidden','HTTPError: HTTP Error 429: Too Many Requests','ValueError: robots.txt disallows this URL','Unknown manual hold']:
            self.assertTrue(retry_pending(dict(old,error=error,checked_at=(now-timedelta(days=2)).isoformat()),now))
        self.assertTrue(retry_pending(dict(old,checked_at=(now+timedelta(hours=1)).isoformat()),now))
        for checked in ['',None,'invalid','2026-10-25T00:00:00']:
            self.assertTrue(retry_pending(dict(old,checked_at=checked),now))
        self.assertFalse(retry_pending(dict(old,retry_after=now.isoformat()),now))
        self.assertFalse(retry_pending({},now))


if __name__=='__main__':unittest.main()
