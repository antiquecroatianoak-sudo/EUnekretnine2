import json
import unittest
from datetime import datetime, timezone
from public_land_sources import PUBLIC_LAND_CALLS, public_land_record, load_registry
from probe_public_land import probe, summary
from source_store import sync_snapshot, prepare_for_review
from storage import connect
from matching import ranked_matches, refresh_matches, CANDIDATE, REJECT

EU={'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'}
NOW='2026-10-22T12:00:00+00:00'
PHRASES={'https://lda.ie/projects/private-land-acquisition':'The ongoing land acquisition programme supports housing.',
         'https://www.galway.ie/en/housing/housing-delivery/land-property-acquisition':'We invite landowners to sell residential zoned lands.',
         'https://ssrs.si/razpisi/javni-pozivi-in-razpisi/javni-poziv-za-nakup-stanovanj-in-zemljisc-za-gradnjo-stanovanj-v-letih-2026-in-2027':'Javni poziv za nakup stanovanj in zemljišč za gradnjo stanovanj v letih 2026 in 2027',
         'https://www.kerrycoco.ie/expression-of-interest-in-turnkey-units-land-with-development-potential':'Expression of Interest in Turnkey Units / Land with Development Potential'}
KERRY='https://www.kerrycoco.ie/expression-of-interest-in-turnkey-units-land-with-development-potential/'

def record(url,text):
    return public_land_record({'id':101,'url':url,'country':PUBLIC_LAND_CALLS[url.rstrip('/')]['country']},text,NOW)

class PublicLandTests(unittest.TestCase):
    def test_official_calls_are_unverified_buy_requests(self):
        self.assertEqual(set(PHRASES),set(PUBLIC_LAND_CALLS))
        for url,text in PHRASES.items():
            row=record(url,text)
            self.assertFalse(row['verified'])
            self.assertEqual(row['facts']['transaction_type'],'buy_request')
            self.assertIsNone(row['facts']['budget'])
            self.assertIsNone(row['facts']['deadline'])
            self.assertEqual(row['facts']['buyer_type'],'public_authority')
            self.assertIsNone(row['facts']['source_listing_state'])
            self.assertEqual(row['facts']['call_currency'],'Program objavljen; aktualnost konkretnog poziva nepoznata')
            self.assertEqual(row['id'],record(url,text)['id'])
    def test_government_sales_and_generic_pages_are_rejected(self):
        url=next(iter(PUBLIC_LAND_CALLS));source={'id':101,'url':url,'country':'IE'}
        for text in ['Government land for sale','Welcome to the council','This acquisition call has been removed']:
            with self.assertRaises(ValueError):public_land_record(source,text)
    def test_unreviewed_host_and_wrong_country_rejected(self):
        with self.assertRaises(ValueError):public_land_record({'id':1,'url':'https://example.com','country':'IE'},'ongoing land acquisition programme')
        with self.assertRaises(ValueError):public_land_record({'id':1,'url':next(iter(PUBLIC_LAND_CALLS)),'country':'HR'},'ongoing land acquisition programme')
    def test_sale_of_public_land_near_the_call_is_not_demand(self):
        url='https://www.galway.ie/en/housing/housing-delivery/land-property-acquisition'
        with self.assertRaisesRegex(ValueError,'sale or disposal'):
            record(url,'Council land for sale: we invite landowners to sell residential zoned lands at auction.')
        # Site navigation far from the call does not turn a purchase into a sale.
        self.assertEqual(record(url,'Homes for Sale '+'x '*200+'We invite landowners to sell residential zoned lands.')['facts']['transaction_type'],'buy_request')
    def test_closed_or_expired_call_is_recorded_as_expired_not_active_demand(self):
        facts=record(KERRY,PHRASES[KERRY.rstrip('/')]+' Completed forms must be returned by 5pm on Friday 10th July 2026.')['facts']
        self.assertEqual(facts['deadline'],'2026-07-10')
        self.assertEqual(facts['source_listing_state'],'expired')
        self.assertIn('10th July 2026',facts['source_status_evidence'])
        self.assertNotIn('Rok i otvorenost poziva',facts['review_required'])
        url='https://lda.ie/projects/private-land-acquisition'
        facts=record(url,PHRASES[url]+' This call is now closed.')['facts']
        self.assertEqual(facts['source_listing_state'],'expired');self.assertIsNone(facts['deadline'])
        # An old deadline next to a later open one keeps the call open.
        facts=record(url,PHRASES[url]+' Closing date: 25 August 2023. Next round closing date: 30 January 2027.')['facts']
        self.assertEqual((facts['deadline'],facts['source_listing_state']),('2027-01-30','active'))
    def test_publication_dates_are_not_deadlines_and_unknown_terms_stay_unknown(self):
        url='https://ssrs.si/razpisi/javni-pozivi-in-razpisi/javni-poziv-za-nakup-stanovanj-in-zemljisc-za-gradnjo-stanovanj-v-letih-2026-in-2027'
        facts=record(url,'Objavljeno 3. 3. 2026. '+PHRASES[url])['facts']
        self.assertIsNone(facts['deadline']);self.assertIsNone(facts['budget'])
        self.assertNotIn('min_area',facts);self.assertNotIn('programme_budget',facts)
        self.assertIn('Budžet po lokaciji nije objavljen',facts['review_required'])
    def test_year_ranges_and_blocked_pages_do_not_create_facts(self):
        url='https://ssrs.si/razpisi/javni-pozivi-in-razpisi/javni-poziv-za-nakup-stanovanj-in-zemljisc-za-gradnjo-stanovanj-v-letih-2026-in-2027'
        # Observed page wording: a year range is not a date, and no deadline is published.
        facts=record(url,PHRASES[url]+' Program v letih 2024 in 2025 je zaključen. Rok je v letih 2026 in 2027.')['facts']
        self.assertIsNone(facts['deadline'])
        # A page that served a login interstitial instead of content is not configured.
        registry=load_registry()
        donegal=next(s for s in registry['countries']['IE']['sources'] if 'donegalcoco' in s['url'])
        self.assertEqual(donegal['support_status'],'blokiran');self.assertNotIn(donegal['url'],PUBLIC_LAND_CALLS)
    def test_published_terms_are_kept_with_evidence(self):
        url='https://ssrs.si/razpisi/javni-pozivi-in-razpisi/javni-poziv-za-nakup-stanovanj-in-zemljisc-za-gradnjo-stanovanj-v-letih-2026-in-2027'
        facts=record(url,PHRASES[url]+'. Višina sredstev: 13,3 milijonov EUR. Zemljišča najmanj 0,5 ha. Ponudbe najkasneje do 31. 12. 2027.')['facts']
        self.assertEqual(facts['deadline'],'2027-12-31');self.assertEqual(facts['source_listing_state'],'active')
        self.assertEqual(facts['programme_budget'],13_300_000);self.assertEqual(facts['min_area'],5000)
        # A programme total is never the buyer's per-site budget.
        self.assertIsNone(facts['budget'])
        for key in ('deadline_evidence','budget_evidence','area_evidence'):self.assertTrue(facts[key])
    def test_closed_call_needs_new_evidence_to_become_demand_again(self):
        """Regression (review on 8caa88a): a fetch without a deadline is not evidence of reopening."""
        c=connect(path=':memory:')
        c.execute("INSERT INTO properties(country,region,title,source,price,renovation,other_costs,property_type,status) VALUES('Irska','Kerry','Zemljište Tralee','https://example.ie/l/1',90000,0,0,'Zemljište','Novo')")
        call=PHRASES[KERRY.rstrip('/')]
        def fetch(text):
            row=record(KERRY,text);row['country']='Irska'
            row['last_seen']=datetime.now(timezone.utc).isoformat()
            sync_snapshot(c,{'schema_version':1,'candidates':[row],'runs':[]});refresh_matches(c)
            stored=json.loads(c.execute('SELECT body_json FROM source_candidates WHERE id=?',(row['id'],)).fetchone()['body_json'])['facts']
            return row['id'],stored
        cid,facts=fetch(call)
        self.assertIsNone(facts['source_listing_state'])
        _,buyer=prepare_for_review(c,cid)
        status=lambda:next(m for m in ranked_matches(c) if m['investor_id']==buyer)
        self.assertEqual(status()['status'],CANDIDATE)
        # Manual review on the draft must survive every later fetch.
        c.execute("UPDATE investors SET notes='Ručno provjereno 22.10.' WHERE id=?",(buyer,))
        _,facts=fetch(call+' Completed forms must be returned by 5pm on Friday 10th July 2026.')
        self.assertEqual((facts['source_listing_state'],facts['deadline']),('expired','2026-07-10'))
        self.assertEqual(status()['status'],REJECT)
        # The deadline disappears from the page: still closed, deadline evidence kept.
        _,facts=fetch(call)
        self.assertEqual(facts['source_listing_state'],'expired')
        self.assertEqual(facts['call_currency'],'Poziv zatvoren ili istekao')
        self.assertEqual(facts['deadline'],'2026-07-10')
        self.assertEqual(status()['status'],REJECT)
        self.assertIn('Javni poziv kupca je zatvoren ili istekao',status()['rejected'])
        # Only a newly published future deadline reopens it.
        _,facts=fetch(call+' Completed forms must be returned by 5pm on Friday 30th April 2027.')
        self.assertEqual((facts['source_listing_state'],facts['deadline']),('active','2027-04-30'))
        self.assertTrue(facts['reopen_evidence'])
        self.assertEqual(status()['status'],CANDIDATE)
        self.assertEqual(c.execute('SELECT notes FROM investors WHERE id=?',(buyer,)).fetchone()['notes'],'Ručno provjereno 22.10.')
        c.close()
    def test_registry_covers_all_27_members_without_claiming_untested_imports(self):
        registry=load_registry()
        self.assertEqual(set(registry['countries']),EU)
        urls={}
        for code,country in registry['countries'].items():
            self.assertTrue(country['summary'] and country['searched_at'])
            for s in country['sources']:
                self.assertIn(s['support_status'],registry['statuses'])
                self.assertTrue(s['url'].startswith('https://'))
                urls[s['url'].rstrip('/')]=(code,s)
                if s['support_status']=='uvoz_testiran':
                    self.assertTrue(s['configured'] and s['registry_id'])
                    self.assertTrue(s['last_import_check']['run_id'] and s['last_import_check']['at'])
                if s['support_status']=='dohvat_testiran':
                    self.assertTrue(s['last_fetch_check']['run_id'])
                if not s['configured']:self.assertNotIn(s['url'].rstrip('/'),PUBLIC_LAND_CALLS)
        for url,config in PUBLIC_LAND_CALLS.items():
            code,entry=urls[url]
            self.assertTrue(entry['configured']);self.assertEqual(code,config['country'])
    def test_probe_reads_without_writing_and_reports_each_outcome(self):
        pages={'https://www.galway.ie/en/housing/housing-delivery/land-property-acquisition':'<h1>Land</h1><p>We invite landowners to sell residential zoned lands.</p>',
               KERRY:'<h1>EOI</h1><p>'+PHRASES[KERRY.rstrip('/')]+' Completed forms must be returned by 5pm on Friday 10th July 2026.</p>'}
        class Fake:
            def __init__(self,root):self.root=root
            def get(self,url):
                if url in pages:return pages[url]
                raise ValueError('robots.txt disallows this URL')
        results={r['url'].rstrip('/'):r for r in probe(load_registry(),fetcher=Fake,now=NOW)}
        self.assertEqual(set(results),set(PUBLIC_LAND_CALLS))
        self.assertEqual(results['https://www.galway.ie/en/housing/housing-delivery/land-property-acquisition']['result'],'nepoznata aktualnost')
        self.assertEqual(results[KERRY.rstrip('/')]['result'],'zatvoren')
        blocked=results['https://lda.ie/projects/private-land-acquisition']
        self.assertEqual((blocked['result'],blocked['error_kind']),('pogreška','robots_disallowed'))
        self.assertIn('| IE | Kerry County Council | zatvoren | 2026-07-10 |',summary(list(results.values())))
    def test_local_draft_keeps_unknown_budget_and_expired_call_rejects_pair(self):
        c=connect(path=':memory:')
        c.execute("INSERT INTO properties(country,region,title,source,price,renovation,other_costs,property_type,status) VALUES('Irska','Kerry','Zemljište Tralee','https://example.ie/l/1',90000,0,0,'Zemljište','Novo')")
        def snapshot(row):
            return {'schema_version':1,'candidates':[row],'runs':[]}
        url='https://lda.ie/projects/private-land-acquisition'
        open_row=record(url,PHRASES[url]+' The programme has a budget of €25 million.');open_row['country']='Irska'
        closed_row=record(KERRY,PHRASES[KERRY.rstrip('/')]+' Completed forms must be returned by 5pm on Friday 10th July 2026.');closed_row['country']='Irska'
        sync_snapshot(c,snapshot(open_row));sync_snapshot(c,snapshot(closed_row))
        open_kind,open_id=prepare_for_review(c,open_row['id']);closed_kind,closed_id=prepare_for_review(c,closed_row['id'])
        self.assertEqual(prepare_for_review(c,open_row['id']),(open_kind,open_id))
        self.assertEqual(c.execute('SELECT COUNT(*) AS n FROM investors').fetchone()['n'],2)
        open_buyer=dict(c.execute('SELECT * FROM investors WHERE id=?',(open_id,)).fetchone())
        self.assertIsNone(open_buyer['max_budget'],'programme total is not a site budget')
        self.assertEqual(open_buyer['verified'],0)
        pairs={m['investor_id']:m for m in ranked_matches(c)}
        self.assertEqual(pairs[open_id]['status'],CANDIDATE)
        self.assertFalse([v for v in pairs[open_id]['missing'] if 'budžet' in v],'an unknown budget is never a gap')
        self.assertEqual(pairs[closed_id]['status'],REJECT)
        self.assertIn('Javni poziv kupca je zatvoren ili istekao',pairs[closed_id]['rejected'])
        self.assertEqual(json.loads(open_buyer['criteria_json'])['property_types'],['Zemljište'])
        # A manual edit of the draft survives a new snapshot of the same call.
        c.execute("UPDATE investors SET notes='Ručno: samo uz prugu' WHERE id=?",(open_id,))
        open_row['last_seen']=open_row['first_seen']=datetime.now(timezone.utc).isoformat()
        sync_snapshot(c,snapshot(open_row));prepare_for_review(c,open_row['id'])
        self.assertEqual(c.execute('SELECT notes FROM investors WHERE id=?',(open_id,)).fetchone()['notes'],'Ručno: samo uz prugu')
        c.close()

if __name__=='__main__':unittest.main()
