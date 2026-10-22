"""Optional integration checks on an isolated schema in an explicitly supplied test DB."""
import json
import os
import unittest
import uuid
from datetime import datetime, timezone

from storage import connect
from import_verified import run
from matching import MATCH, REJECT, ranked_matches, refresh_matches

@unittest.skipUnless(os.environ.get('TEST_POSTGRES_URL'), 'TEST_POSTGRES_URL nije postavljen')
class PostgresIntegrationTests(unittest.TestCase):
    def setUp(self):
        import psycopg
        from psycopg import sql
        from psycopg.conninfo import make_conninfo
        self.schema='matching_test_'+uuid.uuid4().hex
        self.admin=psycopg.connect(os.environ['TEST_POSTGRES_URL'],autocommit=True)
        self.admin.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(self.schema)))
        self.url=make_conninfo(os.environ['TEST_POSTGRES_URL'],options='-csearch_path='+self.schema+' -clock_timeout=5000 -cstatement_timeout=15000')
        self.c=connect(url=self.url)
    def tearDown(self):
        from psycopg import sql
        self.c.close()
        self.admin.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(self.schema)))
        self.admin.close()
    def test_import_match_budget_change_and_repeatable_upgrade(self):
        criteria=dict(property_types=['Kuća'],conditions=['Za obnovu'],source_url='https://example.org/mandate',checked_at=datetime.now(timezone.utc).isoformat())
        self.c.execute('INSERT INTO investors(name,min_budget,max_budget,preferred_countries,verified,criteria_json) VALUES(?,?,?,?,?,?)',('TEST',0,200,'Hrvatska',1,json.dumps(criteria)))
        self.c.commit()
        item=dict(country='Hrvatska',city='Zagreb',title='TEST',source='https://example.org/property',evidence_url='https://example.org/evidence',checked_at=datetime.now(timezone.utc).isoformat(),source_verified=True,listing_active=True,legal='Uredno',legal_evidence_url='https://example.org/legal',price=100.,area=100.,renovation=50.,other_costs=20.,estimated_value=250.,valuation_evidence_url='https://example.org/value',property_type='Kuća',condition='Za obnovu')
        self.assertEqual(run(self.c,[item]),1)
        self.assertEqual(run(self.c,[item]),0)
        self.assertEqual(ranked_matches(self.c)[0]['status'],MATCH)
        self.assertTrue(self.c.raw.pgconn.ssl_in_use)
        # A known budget below the cost is informative only (owner correction 6344490047).
        self.c.execute('UPDATE investors SET max_budget=120'); refresh_matches(self.c); self.c.commit()
        self.assertEqual(ranked_matches(self.c)[0]['status'],MATCH)
        self.c.execute('UPDATE investors SET criteria_json=?',(json.dumps(dict(criteria,conditions=['Useljivo'])),)); refresh_matches(self.c); self.c.commit()
        self.assertEqual(ranked_matches(self.c)[0]['status'],REJECT)
        self.assertEqual(self.c.execute('SELECT status FROM notification_outbox').fetchone()['status'],'Potrebna ponovna provjera')
        second=connect(url=self.url)
        self.assertEqual(second.execute('SELECT COUNT(*) AS n FROM properties').fetchone()['n'],1)
        self.assertTrue(second.execute("SELECT relrowsecurity FROM pg_class WHERE oid='match_results'::regclass").fetchone()['relrowsecurity'])
        second.close()
    def test_discovery_candidates_are_separate_and_drafts_are_idempotent(self):
        from source_store import sync_snapshot, prepare_for_review
        stamp=datetime.now(timezone.utc).isoformat()
        candidate=dict(id='test:buyer',source_id='test',kind='buyer',country='Hrvatska',title='TEST javni zahtjev',url='https://example.org/mandate',verified=False,facts={'property_types':['Zemljište']},first_seen=stamp,last_seen=stamp)
        snapshot=dict(schema_version=1,candidates=[candidate],runs=[])
        sync_snapshot(self.c,snapshot);sync_snapshot(self.c,snapshot)
        self.assertEqual(prepare_for_review(self.c,'test:buyer'),prepare_for_review(self.c,'test:buyer'))
        self.c.commit()
        self.assertEqual(self.c.execute('SELECT COUNT(*) AS n FROM source_candidates').fetchone()['n'],1)
        buyer=dict(self.c.execute('SELECT * FROM investors').fetchone())
        self.assertEqual(buyer['verified'],0);self.assertIsNone(buyer['max_budget'])
        self.assertEqual(self.c.execute('SELECT COUNT(*) AS n FROM notification_outbox').fetchone()['n'],0)
        for name in ('source_candidates','discovery_runs'):
            self.assertTrue(self.c.execute('SELECT relrowsecurity FROM pg_class WHERE oid=?::regclass',(name,)).fetchone()['relrowsecurity'])

    def test_import_rolls_back_all_rows_after_database_error(self):
        # A rejecting database constraint must roll back the earlier property insert.
        self.c.execute("ALTER TABLE imports ADD CONSTRAINT reject_test CHECK (source_url <> 'https://example.org/rejected')")
        self.c.commit()
        item=dict(country='Hrvatska',city='Zagreb',title='TEST',source='https://example.org/rejected',evidence_url='https://example.org/evidence',checked_at=datetime.now(timezone.utc).isoformat(),source_verified=True,listing_active=True,legal='Nepoznato',price=100.,area=100.,renovation=0.,other_costs=0.)
        with self.assertRaises(Exception): run(self.c,[item])
        self.assertEqual(self.c.execute('SELECT COUNT(*) AS n FROM properties').fetchone()['n'],0)
        self.assertEqual(self.c.execute('SELECT COUNT(*) AS n FROM activity').fetchone()['n'],0)

if __name__=='__main__': unittest.main()
