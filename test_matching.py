import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from matching import evaluate, refresh_matches, ranked_matches, digest, pair_text, MATCH, REJECT, CANDIDATE, PHASE, PAIR_CONDITION, SOURCE_FRESH, ACTIVE_CHECK, ACTIVE_STATUSES, BUYER_RECORD, area_fit
from storage import connect

class MatchingTests(unittest.TestCase):
    def setUp(self):
        self.prop = dict(country='Hrvatska', city='Zagreb', region='Grad Zagreb', property_type='Zgrada', condition='Za rušenje', price=100., renovation=50., other_costs=20., area=1000., estimated_value=250., source='https://example.org/property', legal='Uredno', legal_evidence_url='https://example.org/legal', valuation_evidence_url='https://example.org/valuation', buildable='Da', planning_evidence_url='https://example.org/planning', status='Aktivno', source_checked_on=datetime.now(timezone.utc).date().isoformat())
        self.criteria = dict(property_types=['Zgrada'], conditions=['Za rušenje'], cities=['zagreb'], regions=['Grad Zagreb'], min_area=500., max_area=1500., requires_buildable=True, min_roi=20., source_url='https://example.org/mandate', checked_at=datetime.now(timezone.utc).isoformat())
        self.buyer = dict(preferred_countries='Hrvatska', min_budget=0., max_budget=200., verified=1)
        self.prop['contact_json']=json.dumps(dict(mode='direct',name='TEST seller',email='seller@example.org',evidence_url=self.prop['source'],record_reference=self.prop['source'],permitted=True))
        self.buyer['contact_json']=json.dumps(dict(mode='agency',name='TEST agency',agency_name='TEST agency',email='buyer@example.org',evidence_url=self.criteria['source_url'],record_reference=self.criteria['source_url'],permitted=True,represents_record=True))
    def result(self, pair_checks=None):
        return evaluate(self.prop, dict(self.buyer, criteria_json=json.dumps(self.criteria)), pair_checks)
    def test_buyer_seat_does_not_replace_countries_of_demand(self):
        self.buyer['country']='Njemačka'
        self.assertEqual(self.result()['status'],MATCH)
        self.buyer['preferred_countries']='Italija'
        self.assertIn('Država',self.result()['rejected'])
        self.buyer['country']='Hrvatska'
        self.buyer['preferred_countries']=''
        self.assertIn('Država',self.result()['gaps']['buyer'])
    def test_country_codes_match_existing_database_without_rewriting_rows(self):
        self.prop['country']='HR'
        self.assertEqual(self.result()['status'],MATCH)
        self.prop['country']='Hrvatska';self.buyer['preferred_countries']='HR'
        self.assertEqual(self.result()['status'],MATCH)
    def test_existing_database_deadline_and_status_are_respected(self):
        self.prop['bid_deadline_at']=(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat()
        self.assertEqual(self.result()['status'],REJECT)
        self.prop.pop('bid_deadline_at');self.prop['status']='Rok istekao - potrebna provjera ishoda'
        self.assertEqual(self.result()['status'],REJECT)
    def test_property_and_buyer_rules_match_the_database_guard(self):
        # Review 6361220363: what site_private.property_eligible refuses is an open item, never a computed match.
        today = datetime.now(timezone.utc).date()
        for field, value, label in [('source_checked_on', None, SOURCE_FRESH), ('source_checked_on', (today - timedelta(days=31)).isoformat(), SOURCE_FRESH),
                                    ('source_checked_on', (today + timedelta(days=1)).isoformat(), SOURCE_FRESH), ('status', 'Novo', ACTIVE_CHECK),
                                    ('status', 'Provjera', ACTIVE_CHECK), ('city', None, 'Grad nekretnine')]:
            with self.subTest(field=field, value=value):
                old = self.prop[field]; self.prop[field] = value
                result = self.result()
                self.assertEqual(result['status'], CANDIDATE)
                self.assertIn(label, result['gaps']['property'])
                self.assertEqual(result['phase'], PHASE['PROPERTY'])
                self.prop[field] = old
        self.prop['source_checked_on'] = (today - timedelta(days=29)).isoformat()
        self.assertEqual(self.result()['status'], MATCH)
        for status in ACTIVE_STATUSES:
            self.prop['status'] = status
            self.assertEqual(self.result()['status'], MATCH, status)
        # Mirrors investor_eligible on the stored criteria.
        self.criteria['checked_at'] = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        self.assertIn(BUYER_RECORD, self.result()['gaps']['buyer'])
    def test_area_tolerance_minus_15_plus_25_and_hard_limit(self):
        # 6366561469: target 1000 m² accepts 850–1250 m² inclusive; equal to areaFit() in domain.mjs.
        target = dict(min_area=1000, max_area=1000)
        for area in (850, 850.0000001, 1000, 1250, 1249.999): self.assertTrue(area_fit(area, target)['fits'], area)
        for area in (849, 849.99, 1251, 1250.0001, 10.): self.assertFalse(area_fit(area, target)['fits'], area)
        self.assertEqual(area_fit(850, target)['deviation'], -15); self.assertEqual(area_fit(1250, target)['deviation'], 25)
        for unknown in (None, 0, -5, '900', True): self.assertIsNone(area_fit(unknown, target))
        self.assertTrue(area_fit(425, dict(min_area=500, max_area=1500))['fits']); self.assertFalse(area_fit(424, dict(min_area=500, max_area=1500))['fits'])
        self.assertTrue(area_fit(1875, dict(min_area=500, max_area=1500))['fits']); self.assertFalse(area_fit(1876, dict(min_area=500, max_area=1500))['fits'])
        self.assertTrue(area_fit(1e7, dict(min_area=1000))['fits']); self.assertTrue(area_fit(1, dict(max_area=1000))['fits'])
        self.assertFalse(area_fit(999, dict(target, area_hard=True))['fits']); self.assertTrue(area_fit(1000, dict(target, area_hard=True))['fits'])
        self.assertTrue(area_fit(283.3305, dict(min_area=333.33))['fits']); self.assertFalse(area_fit(283.33, dict(min_area=333.33))['fits'])
        self.criteria.update(min_area=1000., max_area=1000.)
        self.prop['area'] = 880.
        result = self.result()
        self.assertEqual(result['status'], MATCH); self.assertEqual(result['area_deviation'], -12)
        self.assertIn('Površina −12 % od tražene granice, unutar tolerancije −15 %/+25 %', result['info'])
        self.prop['area'] = 800.
        self.assertEqual(self.result()['rejected'], ['Površina'])
        self.prop['area'] = 880.; self.criteria['area_hard'] = True
        self.assertEqual(self.result()['rejected'], ['Površina'])
        self.criteria['area_hard'] = 'da'
        self.assertIn('Ispravni strukturirani kriteriji kupca', self.result()['missing'])
    def test_null_evidence_date_is_candidate(self):
        self.criteria['checked_at']=None
        self.assertEqual(self.result()['status'],CANDIDATE)
    def test_complete_mandate_matches(self):
        result = self.result()
        self.assertEqual(result['status'], MATCH)
        self.assertEqual(result['total_cost'], 170)
        self.assertEqual(result['score'], 100)
    def test_note_needs_dated_check_of_exact_text_not_deletion(self):
        # Audit 6342938279 point 2, reproduced: valid criteria and evidence + a note => candidate.
        self.buyer['notes']='Uvjeti provjereni'
        self.assertEqual(self.result()['status'],CANDIDATE)
        self.assertIn('Dodatni uvjeti iz napomena za ručnu provjeru',self.result()['missing'])
        stamp=(datetime.now(timezone.utc)-timedelta(days=1)).isoformat()
        self.criteria['notes_check']=dict(digest=digest('Uvjeti provjereni'),checked_at=stamp,evidence='Potvrđeno e-poštom 21.10.')
        # Review 6344298344 point 1: the wording check does not show that this property meets the condition.
        self.assertEqual(self.result()['missing'],[PAIR_CONDITION])
        self.assertEqual(self.result()['phase'],PHASE['BUYER'])
        self.prop['id']=7
        pair={PAIR_CONDITION:dict(digest=digest(pair_text('Uvjeti provjereni',self.prop)),checked_at=stamp,outcome='zadovoljava',evidence='Situacijski nacrt prodavatelja 22.10.')}
        self.assertEqual(self.result(pair)['status'],MATCH)
        self.assertEqual(self.result(dict(pair))['phase'],PHASE['REAL'])
        self.prop['area']=900.
        self.assertEqual(self.result(pair)['status'],CANDIDATE,'a property change invalidates the pair evidence')
        self.prop['area']=1000.
        self.assertEqual(digest('  Uvjeti\nprovjereni '),digest('Uvjeti provjereni'))
        self.buyer['notes']='Uvjeti provjereni; samo uz prugu'
        self.assertEqual(self.result()['status'],CANDIDATE,'changed note invalidates the check')
        self.buyer['notes']='Uvjeti provjereni'
        self.criteria['notes_check']['checked_at']=(datetime.now(timezone.utc)-timedelta(days=91)).isoformat()
        self.assertEqual(self.result()['status'],CANDIDATE,'check older than 90 days')
        self.criteria['notes_check'].update(checked_at=stamp,evidence=' ')
        self.assertEqual(self.result()['status'],CANDIDATE,'no evidence, no check')
        # Same fingerprints as digest() in domain.mjs.
        for text,value in [('','811c9dc5'),('Uvjeti provjereni','aa411872'),('Šibenik – zemljište ≥ 1.000 m²','72db6e92')]:
            self.assertEqual(digest(text),value)
        # pair_text() serialises like pairText() in domain.mjs (float 6120.0 as 6120).
        prop=dict(id=7,country='Irska',region='Galway',area=6120.,price=90000.5,title='Šuma – 1 ha',legal='Uredno',auction_at=None)
        self.assertEqual(digest(pair_text('Samo uz prugu',prop)),'4e3b120b')
    def test_budget_uses_all_costs_not_asking_price(self):
        # Owner correction 6344490047: a known budget is informative, never a rejection or a gap.
        self.buyer['max_budget'] = 120
        result = self.result()
        self.assertEqual(result['status'], MATCH)
        self.assertEqual(result['info'], ['Ukupni trošak iznad navedenog budžeta kupca (informativno)'], 'all costs, not only the asking price')
        self.buyer.update(min_budget=None, max_budget=None)
        self.assertEqual(self.result()['status'], MATCH, 'an undisclosed budget does not block a complete pair')
        self.prop['price'] = None
        self.assertIn('Cijena nekretnine', self.result()['gaps']['property'], 'the property price stays a core fact')
    def test_wrong_type_or_condition_rejects(self):
        for field, value in [('property_type','Kuća'), ('condition','Useljivo'), ('country','Slovenija'), ('city','Split'), ('region','Istarska'), ('area',100.)]:
            with self.subTest(field=field):
                old = self.prop[field]; self.prop[field] = value
                self.assertEqual(self.result()['status'], REJECT)
                self.prop[field] = old
    def test_missing_cost_type_condition_or_area_is_candidate(self):
        for field in ('price','renovation','other_costs','property_type','condition','area'):
            with self.subTest(field=field):
                old=self.prop[field]; self.prop[field]=None
                self.assertEqual(self.result()['status'], CANDIDATE)
                self.prop[field]=old
    def test_unverified_stale_or_unsupported_mandate_is_candidate(self):
        self.buyer['verified']=0
        self.assertEqual(self.result()['status'], CANDIDATE)
        self.buyer['verified']=1
        self.criteria['checked_at']=(datetime.now(timezone.utc)-timedelta(days=91)).isoformat()
        self.assertEqual(self.result()['status'], CANDIDATE)
        self.criteria['checked_at']=datetime.now(timezone.utc).isoformat()
        self.criteria['source_url']=''
        self.assertEqual(self.result()['status'], CANDIDATE)
    def test_legacy_investor_cannot_be_confirmed_match(self):
        self.assertEqual(evaluate(self.prop,self.buyer)['status'], CANDIDATE)
    def test_illegal_or_inactive_never_matches(self):
        for field,value in [('legal','Komplikacije'),('status','Prodano'),('available_until','2000-01-01')]:
            with self.subTest(field=field):
                prop=dict(self.prop,**{field:value})
                self.assertEqual(evaluate(prop,dict(self.buyer,criteria_json=json.dumps(self.criteria)))['status'],REJECT)
    def test_missing_planning_or_legal_evidence_requires_check(self):
        self.prop['planning_evidence_url']=None
        self.assertEqual(self.result()['status'],CANDIDATE)
        self.prop['planning_evidence_url']='https://example.org/planning'
        self.prop['legal_evidence_url']=None
        self.assertEqual(self.result()['status'],CANDIDATE)
    def test_invalid_or_future_criteria_never_matches(self):
        for raw in ('bad json', '[]', '{"property_types":"Zgrada"}'):
            self.assertEqual(evaluate(self.prop,dict(self.buyer,criteria_json=raw))['status'],CANDIDATE)
        self.criteria['checked_at']=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()
        self.assertEqual(self.result()['status'],CANDIDATE)
    def test_refresh_updates_same_pair_after_criteria_change(self):
        c=connect(path=':memory:')
        prop=dict(self.prop,title='TEST')
        c.execute('INSERT INTO properties('+','.join(prop)+') VALUES('+','.join('?' for _ in prop)+')',tuple(prop.values()))
        buyer=dict(self.buyer,name='TEST',criteria_json=json.dumps(self.criteria))
        c.execute('INSERT INTO investors('+','.join(buyer)+') VALUES('+','.join('?' for _ in buyer)+')',tuple(buyer.values()))
        refresh_matches(c)
        self.assertEqual(ranked_matches(c)[0]['status'],MATCH)
        c.execute("INSERT INTO notification_outbox(property_id,created_at,message) VALUES(1,'test','test')")
        c.execute('UPDATE investors SET criteria_json=?',(json.dumps(dict(self.criteria,conditions=['Useljivo'])),))
        refresh_matches(c); refresh_matches(c)
        self.assertEqual(len(ranked_matches(c)),1)
        self.assertEqual(ranked_matches(c)[0]['status'],REJECT)
        self.assertEqual(c.execute('SELECT status FROM notification_outbox').fetchone()['status'],'Potrebna ponovna provjera')
        c.close()
    def test_additive_upgrade_preserves_old_rows_and_is_repeatable(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=str(Path(tmp)/'old.db')
            c=sqlite3.connect(path)
            c.execute('CREATE TABLE properties(id INTEGER PRIMARY KEY,country TEXT,city TEXT,title TEXT,price REAL,area REAL,source TEXT,legal TEXT,status TEXT,renovation REAL,other_costs REAL,estimated_value REAL,updated TEXT)')
            c.execute("INSERT INTO properties(id,title) VALUES(1,'existing')"); c.commit(); c.close()
            for _ in range(2):
                c=connect(path=path)
                p=dict(c.execute('SELECT * FROM properties').fetchone())
                self.assertEqual(p['title'],'existing'); self.assertIsNone(p['property_type']); c.close()

if __name__=='__main__': unittest.main()


