import time
import unittest
from unittest.mock import patch
from registry_discovery import process, Page, canonical, safe_url, in_scope

ROOT='https://www.nepremicnine.net/oglasi-prodaja/'
SOURCE={'id':40,'url':ROOT,'country':'SI','category':'Oglasnik','name':'Portal'}
FIRST=ROOT+'ljubljana-stan_1234567/'
SECOND=ROOT+'maribor-hisa_1234568/'

class Fetch:
    def __init__(self,pages):self.pages=pages;self.visited=[]
    def get(self,url):
        self.visited.append(url)
        value=self.pages[url]
        if isinstance(value,Exception):raise value
        return value

class RegistryTests(unittest.TestCase):
    def run_source(self,source,state,fetcher,max_pages=25):
        with patch('registry_discovery.safe_url',side_effect=lambda u,r:canonical(u)):
            return process(source,state,fetcher,time.monotonic()+10,max_pages)
    def test_pagination_resumes_without_losing_details(self):
        second=ROOT+'?page=2'
        fetch=Fetch({ROOT:f'<a href="{FIRST}">Stan</a><a rel="next" href="{second}">Next</a>',FIRST:'<h1>Stan u Ljubljani</h1>',second:f'<a href="{SECOND}">Kuća</a>',SECOND:'<h1>Kuća u Mariboru</h1>'})
        rows,state=self.run_source(SOURCE,None,fetch,1)
        self.assertEqual(rows,[]);self.assertTrue(state['pending']);self.assertFalse(state['exhausted'])
        rows,state=self.run_source(SOURCE,state,fetch)
        self.assertEqual({r['url'] for r in rows},{FIRST,SECOND})
        self.assertTrue(state['queue_exhausted']);self.assertFalse(state['coverage_complete']);self.assertEqual(fetch.visited.count(ROOT),1)
    def test_completed_source_is_refreshed_on_next_cycle(self):
        fetch=Fetch({ROOT:f'<a href="{FIRST}">Stan</a>',FIRST:'<h1>Stan u Ljubljani</h1>'})
        rows,state=self.run_source(SOURCE,None,fetch)
        again,new=self.run_source(SOURCE,state,fetch)
        self.assertEqual(len(again),1);self.assertEqual(fetch.visited.count(ROOT),2)
    def test_blocked_page_keeps_checkpoint_and_does_not_invent_records(self):
        fetch=Fetch({ROOT:TimeoutError('blocked')})
        rows,state=self.run_source(SOURCE,None,fetch)
        self.assertEqual(rows,[]);self.assertEqual(state['status'],'Pogreška')
        self.assertEqual(state['next_url'],ROOT);self.assertFalse(state['exhausted'])
    def test_unknown_adapter_is_explicit_not_success(self):
        rows,state=self.run_source(dict(SOURCE,url='https://unknown.example/'),None,Fetch({}))
        self.assertEqual(rows,[]);self.assertEqual(state['status'],'Nepodržano')
    def test_missing_price_does_not_exclude_listing(self):
        fetch=Fetch({ROOT:f'<a href="{FIRST}">Stan</a><a href="{FIRST}">Duplikat</a>',FIRST:'<h1>Stan bez javne cijene</h1>'})
        rows,state=self.run_source(SOURCE,None,fetch)
        self.assertEqual(len(rows),1);self.assertIsNone(rows[0]['facts']['asking_price']);self.assertFalse(rows[0]['verified'])
    def test_no_listing_links_is_not_claimed_as_exhaustive_success(self):
        rows,state=self.run_source(SOURCE,None,Fetch({ROOT:'<h1>Portal homepage</h1>'}))
        self.assertEqual(state['status'],'Pogreška');self.assertFalse(state['exhausted'])
    def test_buyer_profile_never_invents_mandate_or_budget(self):
        source=dict(SOURCE,id=5,category='Investitor - javna akvizicija')
        rows,state=self.run_source(source,None,Fetch({ROOT:'<h1>Tvrtka i poslovne informacije</h1>'}))
        self.assertEqual(rows[0]['kind'],'buyer');self.assertIsNone(rows[0]['facts']['budget'])
        self.assertEqual(rows[0]['facts']['transaction_type'],'unconfirmed_acquisition_profile')
    def test_native_currency_is_preserved(self):
        html='<h1>Stan s navedenom cijenom</h1><script type="application/ld+json">{"@type":"Apartment","offers":{"price":"123456","priceCurrency":"CZK"}}</script>'
        fetch=Fetch({ROOT:f'<a href="{FIRST}">Stan</a>',FIRST:html})
        rows,_=self.run_source(SOURCE,None,fetch)
        self.assertEqual(rows[0]['facts']['currency'],'CZK');self.assertEqual(rows[0]['facts']['advertised_price'],123456)
        self.assertIsNone(rows[0]['facts']['asking_price'])
    def test_buyer_category_is_not_imported_as_a_person(self):
        root='https://www.nepremicnine.net/oglasi-nakup/posest/'
        detail='https://www.nepremicnine.net/oglasi-nakup/ljubljana-posest_1234567/'
        source=dict(SOURCE,url=root,category='Javna potražnja kupaca')
        rows,state=self.run_source(source,None,Fetch({root:f'<a href="{detail}">Potražnja</a>',detail:'<h1>Kupujemo zemljište u Ljubljani</h1>'}))
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['url'],detail)
        self.assertEqual(rows[0]['facts']['transaction_type'],'buy_request')
    def test_url_boundaries_and_private_addresses(self):
        for u in ('http://www.nepremicnine.net/','https://evil.example/','https://user:pass@www.nepremicnine.net/'):
            with self.assertRaises(ValueError):safe_url(u,ROOT)
        with patch('socket.getaddrinfo',return_value=[(None,None,None,None,('127.0.0.1',443))]):
            with self.assertRaises(ValueError):safe_url(ROOT,ROOT)
    def test_tracking_parameters_do_not_create_new_ids(self):
        self.assertEqual(canonical(FIRST+'?utm_source=x&gclid=123'),FIRST)
    def test_willhaben_does_not_crawl_general_marketplace(self):
        root='https://www.willhaben.at/iad/immobilien'
        self.assertFalse(in_scope('https://www.willhaben.at/iad/kaufen-und-verkaufen/marktplatz/mode',root))
        self.assertTrue(in_scope('https://www.willhaben.at/iad/immobilien/haus-kaufen/',root))
    def test_backlog_prioritizes_details_and_supports_more_than_25(self):
        details=[ROOT+f'ljubljana-stan_{1234567+n}/' for n in range(45)]
        state={'pending':[{'url':ROOT+'?page=2','mode':'index','sale':True}]+[{'url':u,'mode':'detail','sale':True} for u in details]}
        fetch=Fetch({u:'<h1>Stan u Ljubljani</h1>' for u in details})
        rows,new=self.run_source(SOURCE,state,fetch,max_pages=40)
        self.assertEqual(len(rows),40);self.assertEqual(fetch.visited[0],details[0])
        self.assertFalse(new['coverage_complete']);self.assertTrue(new['pending'])
    def test_one_malformed_detail_does_not_stop_valid_records(self):
        state={'pending':[{'url':FIRST,'mode':'detail','sale':True},{'url':SECOND,'mode':'detail','sale':True}]}
        rows,new=self.run_source(SOURCE,state,Fetch({FIRST:'<p>Missing title</p>',SECOND:'<h1>Kuća u Mariboru</h1>'}))
        self.assertEqual(len(rows),1);self.assertEqual(len(new['failed_urls']),1)
    def test_agency_address_is_not_property_location(self):
        html='<h1>Stan s javnim oglasom</h1><script type="application/ld+json">{"@type":"Organization","address":"Ured agencije u Zagrebu"}</script>'
        rows,_=self.run_source(SOURCE,{'pending':[{'url':FIRST,'mode':'detail','sale':True}]},Fetch({FIRST:html}))
        self.assertNotIn('advertised_location',rows[0]['facts'])
    def test_new_source_can_use_validated_registry_configuration(self):
        root='https://new-agency.example/sale/'
        detail='https://new-agency.example/listings/123'
        source=dict(SOURCE,url=root,import_config={'detail_path_prefixes':['/listings/'],'index_path_prefixes':['/sale/'],'require_structured_listing':True,'sale_scope':True})
        html='<h1>Kuća u Zagrebu</h1><script type="application/ld+json">{"@type":"House","address":"Zagreb"}</script>'
        rows,_=self.run_source(source,None,Fetch({root:f'<a href="{detail}">Kuća</a>',detail:html}))
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['facts']['advertised_location'],'Zagreb')
    def test_missing_listing_is_recorded_without_claiming_sale(self):
        from urllib.error import HTTPError
        state={'pending':[{'url':FIRST,'mode':'detail','sale':True},{'url':SECOND,'mode':'detail','sale':True}]}
        rows,new=self.run_source(SOURCE,state,Fetch({FIRST:HTTPError(FIRST,404,'Missing',{},None),SECOND:'<h1>Kuća u Mariboru</h1>'}))
        self.assertEqual(len(rows),1);self.assertEqual(new['unavailable_urls'][0]['http_status'],404)
        self.assertFalse(new['coverage_complete'])

if __name__=='__main__':unittest.main()
