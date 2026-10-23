"""New-source leads: evidence, deduplication, respectful checks, no automatic enabling."""
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError

import source_leads as sl

NOW = datetime(2026, 10, 23, 12, 0, tzinfo=timezone.utc)
LISTING = ('<title>Kuće na prodaju</title><script type="application/ld+json">{"@type":"RealEstateListing"}</script>'
           '<p>Kuća 120 m2, 185.000 €</p><p>Stan 60 m², 99.000 €</p><p>Zemljište 900 m2 45.000 EUR</p><p>nekretnine prodaja</p>')
DEMAND = '<title>Land acquisition</title><p>The council invites expressions of interest. We buy development land.</p>'

class FakeFetcher:
    def __init__(self, result): self.result = result
    def get(self, url):
        if isinstance(self.result, Exception): raise self.result
        return self.result

class SourceLeadTests(unittest.TestCase):
    def setUp(self):
        sl.take_observed()
        self.tmp = tempfile.TemporaryDirectory(); self.path = Path(self.tmp.name) / 'leads.json'
    def tearDown(self): self.tmp.cleanup()

    def test_only_offsite_https_links_naming_sales_or_demand(self):
        links = [('https://www.novi-portal.hr/nekretnine/prodaja', 'Nekretnine na prodaju'), ('/oglasi/1', 'Interni oglas'),
                 ('http://insecure.hr/prodaja', 'Prodaja'), ('https://www.facebook.com/nekretnine', 'Prodaja'),
                 ('https://vijesti.hr/sport', 'Sport'), ('https://council.ie/land-acquisition', 'Land acquisition'),
                 ('https://sub.portal-a.hr/prodaja', 'Prodaja'), ('javascript:void(0)', 'Prodaja')]
        found = sl.observe('https://portal-a.hr/oglasi', links)
        self.assertEqual([(f['host'], f['kind']) for f in found], [('novi-portal.hr', 'property'), ('council.ie', 'buyer')])
        self.assertEqual(found[0]['found_on'], 'https://portal-a.hr/oglasi')

    def test_merge_deduplicates_keeps_review_and_skips_known_sources(self):
        sl.observe('https://a.hr/x', [('https://novi.hr/prodaja', 'Prodaja'), ('https://novi.hr/prodaja/kuce', 'Kuće prodaja'), ('https://known.hr/prodaja', 'Prodaja')])
        leads = sl.merge([], sl.take_observed(), ['www.known.hr'], NOW)
        self.assertEqual([l['host'] for l in leads], ['novi.hr'])
        self.assertEqual(len(leads[0]['evidence']), 2); self.assertEqual(leads[0]['status'], 'novo'); self.assertEqual(leads[0]['country_hint'], 'HR')
        leads[0].update(status='kandidat_nekretnine', review_note='Ručno pregledano')
        later = NOW + timedelta(days=1)
        sl.observe('https://b.hr/y', [('https://novi.hr/prodaja', 'Prodaja')] + [(f'https://novi.hr/p/{n}', 'Prodaja') for n in range(10)])
        again = sl.merge(leads, sl.take_observed(), [], later)
        self.assertEqual(again[0]['status'], 'kandidat_nekretnine'); self.assertEqual(again[0]['review_note'], 'Ručno pregledano')
        self.assertEqual(again[0]['first_seen'], NOW.isoformat()); self.assertEqual(again[0]['last_seen'], later.isoformat())
        self.assertEqual(len(again[0]['evidence']), sl.MAX_EVIDENCE)

    def test_verify_classifies_and_respects_refusals(self):
        lead = dict(host='novi.hr', kinds=['property'], first_seen=NOW.isoformat(), status='novo', evidence=[dict(url='https://novi.hr/prodaja')])
        cases = [(LISTING, 'kandidat_nekretnine'), (DEMAND, 'kandidat_kupci'), ('<title>Vijesti</title><p>Sport i kultura</p>', 'nije_relevantno'),
                 (HTTPError('u', 403, 'Forbidden', {}, None), 'blokirano'), (HTTPError('u', 503, 'Down', {}, None), 'nedostupno'),
                 (ValueError('robots.txt disallows this URL'), 'robots_zabrana'), (OSError('timeout'), 'nedostupno'),
                 ('<title>Prijava</title><form><input type=password></form>', 'blokirano')]
        for result, status in cases:
            with self.subTest(status=status, result=str(result)[:30]):
                checked = sl.verify(lead, NOW, lambda url: FakeFetcher(result))
                self.assertEqual(checked['status'], status); self.assertEqual(checked['checked_at'], NOW.isoformat())
        self.assertEqual(sl.verify(lead, NOW, lambda url: FakeFetcher(LISTING))['signals']['listing_types'], 1)

    def test_verify_due_is_bounded_checkpointed_and_never_enables_a_source(self):
        leads = [dict(host=f'h{n}.hr', kinds=['property'], first_seen=(NOW - timedelta(minutes=n)).isoformat(), status='novo', evidence=[dict(url=f'https://h{n}.hr/prodaja')]) for n in range(5)]
        leads.append(dict(host='old.hr', kinds=['property'], first_seen=NOW.isoformat(), status='nedostupno', checked_at=(NOW - timedelta(days=8)).isoformat(), evidence=[dict(url='https://old.hr/')]))
        leads.append(dict(host='recent.hr', kinds=['property'], first_seen=NOW.isoformat(), status='nedostupno', checked_at=(NOW - timedelta(days=1)).isoformat(), evidence=[dict(url='https://recent.hr/')]))
        sl.save(dict(schema_version=1, leads=leads), self.path)
        calls = []
        def fetcher_for(url): calls.append(url); return FakeFetcher(LISTING)
        data = sl.verify_due(3, NOW, self.path, fetcher_for)
        self.assertEqual(len(calls), 3, 'bounded per run')
        self.assertEqual(calls, ['https://old.hr/', 'https://h4.hr/prodaja', 'https://h3.hr/prodaja'], 'retry due first, then oldest new leads')
        self.assertNotIn('https://recent.hr/', calls)
        self.assertEqual(json.loads(self.path.read_text())['counts'], data['counts'])
        self.assertEqual(sorted(l['status'] for l in data['leads']).count('novo'), 3, 'unchecked leads keep their checkpoint')
        self.assertFalse(any('source_id' in l or l['status'] == 'uključeno' for l in data['leads']), 'a lead is never enabled automatically')

    def test_record_observed_persists_a_registry_pass(self):
        sl.observe('https://a.hr/x', [('https://novi.hr/prodaja', 'Prodaja')])
        data = sl.record_observed(['a.hr'], NOW, self.path)
        self.assertEqual([l['host'] for l in data['leads']], ['novi.hr'])
        self.assertEqual(sl.take_observed(), [], 'observations are consumed once')

if __name__ == '__main__':
    unittest.main()
