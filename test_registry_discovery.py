import time
import io
import http.client
import unittest
import json
from unittest.mock import patch
from registry_discovery import process, Page, canonical, safe_url, in_scope, InterimResponse, save_rows, invimit_rows, source_page_budget, main
from datetime import datetime,timezone

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
    def test_biddit_public_json_imports_active_lot_without_javascript(self):
        root='https://www.biddit.be';url=root+'/fr/catalog/detail/301194'
        source=dict(SOURCE,id=27,url=root+'/fr/landing')
        data={'referenceCode':'301194','publicSaleStatus':'CURRENT','biddingEndDateTime':'2099-10-20T07:30:00Z','startingPrice':109000,'currentPrice':124000,'properties':[{'title':{'nl':'Woning met tuin'},'address':{'countryCode':'BE'}}]}
        rows,state=self.run_source(source,{'pending':[{'url':url}]},Fetch({root+'/api/eco/biddit-bff/lot/301194':json.dumps(data)}))
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['facts']['asking_price'],109000)
        self.assertFalse(rows[0]['verified']);self.assertEqual(rows[0]['url'],url)
    def test_biddit_closed_lot_is_not_imported(self):
        root='https://www.biddit.be';url=root+'/fr/catalog/detail/301194'
        source=dict(SOURCE,id=27,url=root+'/fr/landing')
        data={'referenceCode':'301194','publicSaleStatus':'CLOSED','biddingEndDateTime':'2020-10-20T07:30:00Z'}
        rows,state=self.run_source(source,{'pending':[{'url':url}]},Fetch({root+'/api/eco/biddit-bff/lot/301194':json.dumps(data)}))
        self.assertEqual(rows,[]);self.assertEqual(state['pending'],[])
    def test_biddit_denial_preserves_detail_for_retry(self):
        root='https://www.biddit.be';url=root+'/fr/catalog/detail/301194'
        source=dict(SOURCE,id=27,url=root+'/fr/landing')
        rows,state=self.run_source(source,{'pending':[{'url':url}]},Fetch({root+'/api/eco/biddit-bff/lot/301194':TimeoutError('unavailable')}))
        self.assertEqual(rows,[]);self.assertEqual(state['pending'][0]['url'],url);self.assertEqual(state['status'],'Pogreška')
    def test_persistence_failure_keeps_checkpoint_and_continues_other_sources(self):
        config={'sources':[dict(SOURCE,id=1),dict(SOURCE,id=2)],'states':{}}
        checkpoints=[]
        def api_call(body):
            if body['action']=='registry':return config
            checkpoints.append(body['source_id']);return {'saved':True}
        state={'checked_at':'2026-10-19','status':'Djelomično','pages_processed':0}
        with patch('registry_discovery.api',side_effect=api_call),patch('registry_discovery.process',return_value=([],state)),patch('registry_discovery.save_rows',side_effect=[TimeoutError(),(0,0)]),patch('builtins.print'):
            with self.assertRaisesRegex(RuntimeError,'registry-1'):main()
        self.assertEqual(checkpoints,['registry-2'])
    def test_persistence_auth_failure_stops_without_advancing_checkpoint(self):
        from urllib.error import HTTPError
        config={'sources':[dict(SOURCE,id=1),dict(SOURCE,id=2)],'states':{}}
        with patch('registry_discovery.api',return_value=config) as api_mock,patch('registry_discovery.process',return_value=([],{})),patch('registry_discovery.save_rows',side_effect=HTTPError(ROOT,401,'Unauthorized',{},None)):
            with self.assertRaises(HTTPError):main()
        self.assertEqual(api_mock.call_count,1)
    def test_larger_batch_requires_successful_detail_import(self):
        state={'pending':[{'url':FIRST,'mode':'detail'}],'detail_pages':25,'imported_count':25,'error':None}
        self.assertEqual(source_page_budget(SOURCE,state),150)
        self.assertEqual(source_page_budget(SOURCE,dict(state,error='blocked')),25)
        self.assertEqual(source_page_budget(SOURCE,dict(state,imported_count=0)),25)
        self.assertEqual(source_page_budget(SOURCE,{}),25)
    def test_oldest_sources_are_not_starved_by_working_backlogs(self):
        config={'sources':[dict(SOURCE,id=1),dict(SOURCE,id=2),dict(SOURCE,id=3)],'states':{
            'registry-1':{'pending':[{'url':ROOT,'mode':'index'}],'checked_at':'2026-10-17','detail_pages':0},
            'registry-2':{'pending':[{'url':FIRST,'mode':'detail'}],'checked_at':'2026-10-18','detail_pages':25,'imported_count':25},
            'registry-3':{'pending':[{'url':SECOND,'mode':'detail'}],'checked_at':'2026-10-19','detail_pages':25,'imported_count':25}}}
        turns=[]
        def run(source,state,fetcher,deadline,max_pages):
            turns.append((source['id'],deadline,max_pages))
            return [],{'checked_at':'2026-10-18','status':'Djelomično','pages_processed':0}
        with patch('registry_discovery.api',side_effect=lambda b:config if b['action']=='registry' else {'saved':True}),patch('registry_discovery.process',side_effect=run),patch('registry_discovery.time.monotonic',return_value=100),patch('builtins.print'):
            main()
        self.assertEqual([t[0] for t in turns],[1,2,3])
        self.assertEqual(turns[0][1:],(460,25))
        self.assertEqual(turns[1][1:],(220,150))
    def test_dutch_auction_import_excludes_boats_and_auction_premium(self):
        root='https://www.openbareverkoop.nl/';house=root+'kavel/4516/house';boat=root+'kavel/4517/boat'
        source=dict(SOURCE,url=root,id=2)
        rows,state=self.run_source(source,None,Fetch({root:f'<a href="{house}">Tolstraat</a><a href="{boat}">Danimar</a>',house:'<h1>Tolstraat 142, AMSTERDAM</h1><p>Type registergoed Woonhuis. Inzetpremie: € 20.000.</p>',boat:'<h1>Danimar motorjacht</h1><p>Motorschip</p>'}))
        self.assertEqual(len(rows),1);self.assertIsNone(rows[0]['facts']['asking_price']);self.assertEqual(state['skipped_non_sale'],1)
    def test_lithuanian_real_estate_filter_and_initial_price(self):
        root='https://www.evarzytynes.lt/evs/pages/auctions.do';land='https://www.evarzytynes.lt/evs/pages/auction.do?id=1&number=2';car='https://www.evarzytynes.lt/evs/pages/auction.do?id=3&number=4'
        source=dict(SOURCE,url=root,id=24)
        html='<h1>Aukciono informacija</h1><p>Parduodamas turtas: Žemės sklypas Bendras turto plotas: 220 a. Pradinė pardavimo kaina: 13 600 Eur Pabaigos data: 2099-10-19 09:00:59</p>'
        rows,state=self.run_source(source,None,Fetch({root:f'<a href="{land}">Nr. 2</a><a href="{car}">Nr. 4</a>',land:html,car:'<h1>Aukciono informacija</h1><p>Parduodamas turtas: Automobilis Pradinė pardavimo kaina: 4 000 Eur</p>'}))
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['facts']['asking_price'],13600);self.assertEqual(state['skipped_non_sale'],1)
    def test_invimit_ignores_closed_and_expired_sales_and_preserves_unknown_costs(self):
        header='<tr><th>Procedura</th><th>Stato</th></tr>'
        def row(date,code):
            values=['Vendita','',date,code,'Napoli','Via Marechiaro 93','Unità collabente','666,28 mq','€ 600.000','<a href="/docs/'+code+'.pdf">Scheda</a>']
            return '<tr>'+''.join('<td>'+v+'</td>' for v in values)+'</tr>'
        s={'id':63,'country':'Italija','url':'https://vetrinaimmobili.invimit.it/'}
        html='<table>'+header+row('07-12-2026 12:00','ACTIVE')+row('Chiuso','CLOSED')+row('01-01-2020 12:00','EXPIRED')+'</table>'
        rows=invimit_rows(s,html,datetime(2026,10,18,tzinfo=timezone.utc))
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['facts']['asking_price'],600000)
        self.assertEqual(rows[0]['url'],s['url']+'docs/ACTIVE.pdf');self.assertNotIn('renovation',rows[0]['facts'])
    def test_changed_invimit_format_is_an_error_not_empty_success(self):
        with self.assertRaises(ValueError):invimit_rows({'id':63,'country':'Italija','url':'https://vetrinaimmobili.invimit.it/'},'<p>New format</p>',datetime.now(timezone.utc))
    def test_early_hints_read_final_status_and_body(self):
        class Socket:
            def makefile(self,*args):return io.BytesIO(b'HTTP/1.1 103 Early Hints\r\nLink: </a.css>; rel=preload\r\n\r\nHTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK')
        response=InterimResponse(Socket());response.begin()
        self.assertEqual(response.status,200);self.assertEqual(response.read(),b'OK')
    def test_early_hints_never_turns_denial_into_success(self):
        class Socket:
            def makefile(self,*args):return io.BytesIO(b'HTTP/1.1 103 Early Hints\r\n\r\nHTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n')
        response=InterimResponse(Socket());response.begin();self.assertEqual(response.status,403)
    def test_canonical_duplicate_in_old_checkpoint_is_not_fetched_twice(self):
        root='https://www.propertymarket.com.mt/'
        detail=root+'view/sale-123'
        source=dict(SOURCE,url=root)
        state={'pending':[{'url':detail+'/','mode':'detail','sale':True},{'url':detail,'mode':'detail','sale':True}]}
        rows,new=self.run_source(source,state,Fetch({detail:'<h1>House for sale in Malta</h1>'}))
        self.assertEqual(len(rows),1)
    def test_one_rejected_candidate_does_not_drop_the_rest(self):
        from urllib.error import HTTPError
        good={'kind':'property','url':FIRST,'id':'good'};bad={'kind':'property','url':SECOND,'id':'bad'}
        def api(body):
            if any(r['id']=='bad' for r in body['candidates']):raise HTTPError('https://db.example/',400,'Invalid',{},io.BytesIO(b'{"detail":"Invalid candidate"}'))
            return {'inserted':len(body['candidates'])}
        state={'checked_at':'2026-10-18T14:00:00+00:00'}
        inserted,updated=save_rows('registry-40',[good,bad],state,api)
        self.assertEqual(inserted,1);self.assertEqual(len(state['failed_urls']),1);self.assertEqual(state['status'],'Djelomično')
    def test_auth_failure_is_not_swallowed(self):
        from urllib.error import HTTPError
        def api(body):raise HTTPError('https://db.example/',401,'Unauthorized',{},None)
        with self.assertRaises(HTTPError):save_rows('registry-40',[{'kind':'property','url':FIRST}],{},api)
    def test_slovak_homepage_imports_sales_without_importing_rentals(self):
        root='https://www.nehnutelnosti.sk/';sale=root+'detail/salehash/pekny-byt';rent=root+'detail/renthash/pekny-byt'
        source=dict(SOURCE,url=root)
        pages={root:f'<a href="{sale}">Pekný byt</a><a href="{rent}">Iný byt</a>',sale:'<h1>Pekný byt s balkónom</h1><h2>1 izbový byt na predaj</h2>',rent:'<h1>Pekný byt s balkónom</h1><h2>Byt na prenájom</h2>'}
        rows,state=self.run_source(source,None,Fetch(pages))
        self.assertEqual([r['url'] for r in rows],[sale]);self.assertEqual(state['skipped_non_sale'],1)
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
        self.assertEqual(rows,[])
        self.assertEqual(state['status'],'Pogreška')
        self.assertIn('No explicit public acquisition demand',state['error'])
    def test_explicit_demand_preserves_evidence_without_confirming_buyer(self):
        source=dict(SOURCE,id=5,category='Investitor - javna akvizicija')
        rows,state=self.run_source(source,None,Fetch({ROOT:'<h1>Kupujemo građevinska zemljišta u Zagrebu</h1>'}))
        self.assertEqual(rows[0]['kind'],'buyer');self.assertIsNone(rows[0]['facts']['budget'])
        self.assertEqual(rows[0]['facts']['transaction_type'],'unconfirmed_acquisition_profile')
        self.assertIn('Kupujemo građevinska zemljišta',rows[0]['facts']['demand_excerpt'])
        self.assertFalse(rows[0]['verified'])
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

