import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from matching import evaluate, refresh_matches, ranked_matches, MATCH, REJECT, CANDIDATE
from storage import connect

class MatchingTests(unittest.TestCase):
    def setUp(self):
        self.prop = dict(country='Hrvatska', city='Zagreb', region='Grad Zagreb', property_type='Zgrada', condition='Za rušenje', price=100., renovation=50., other_costs=20., area=1000., estimated_value=250., source='https://example.org/property', legal='Uredno', legal_evidence_url='https://example.org/legal', valuation_evidence_url='https://example.org/valuation', buildable='Da', planning_evidence_url='https://example.org/planning', status='Novo')
        self.criteria = dict(property_types=['Zgrada'], conditions=['Za rušenje'], cities=['zagreb'], regions=['Grad Zagreb'], min_area=500., max_area=1500., requires_buildable=True, min_roi=20., source_url='https://example.org/mandate', checked_at=datetime.now(timezone.utc).isoformat())
        self.buyer = dict(preferred_countries='Hrvatska', min_budget=0., max_budget=200., verified=1)
    def result(self):
        return evaluate(self.prop, dict(self.buyer, criteria_json=json.dumps(self.criteria)))
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
    def test_null_evidence_date_is_candidate(self):
        self.criteria['checked_at']=None
        self.assertEqual(self.result()['status'],CANDIDATE)
    def test_complete_mandate_matches(self):
        result = self.result()
        self.assertEqual(result['status'], MATCH)
        self.assertEqual(result['total_cost'], 170)
        self.assertEqual(result['score'], 100)
    def test_budget_uses_all_costs_not_asking_price(self):
        self.buyer['max_budget'] = 120
        self.assertEqual(self.result()['status'], REJECT)
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
        c.execute('UPDATE investors SET max_budget=10')
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
