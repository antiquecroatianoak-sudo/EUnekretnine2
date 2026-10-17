import unittest
import json
from datetime import datetime, timezone
from storage import connect
from import_verified import run

class ImportTests(unittest.TestCase):
    def setUp(self):
        self.c = connect(path=':memory:')
        self.item = dict(country='Francuska',city='Test',title='TESTNI ZAPIS',source='https://example.org/test',evidence_url='https://example.org/evidence',checked_at='2026-10-15T12:00:00Z',source_verified=True,listing_active=True,legal='Uredno',legal_evidence_url='https://example.org/legal',price=100.,area=10.,renovation=20.,other_costs=10.,estimated_value=200.,valuation_evidence_url='https://example.org/valuation')
    def tearDown(self): self.c.close()
    def count(self, table): return self.c.execute('SELECT COUNT(*) AS n FROM '+table).fetchone()['n']
    def test_integrate_then_outbox_and_deduplicate(self):
        self.c.execute('INSERT INTO investors(name,min_budget,max_budget,preferred_countries,verified) VALUES(?,?,?,?,?)', ('TEST',0,200,'Francuska',1)); self.c.commit()
        criteria = dict(property_types=['Zemljište'], conditions=['Neizgrađeno'], source_url='https://example.org/mandate', checked_at=datetime.now(timezone.utc).isoformat())
        self.c.execute('UPDATE investors SET criteria_json=?', (json.dumps(criteria),)); self.c.commit()
        self.item.update(property_type='Zemljište', condition='Neizgrađeno')
        self.assertEqual(run(self.c,[self.item]),1)
        self.assertEqual(self.count('notification_outbox'),1)
        self.assertEqual(run(self.c,[self.item]),0)
        self.assertEqual(self.count('properties'),1)
    def test_unknown_legal_never_notifies(self):
        self.item['legal']='Nepoznato'
        run(self.c,[self.item])
        self.assertEqual(self.count('notification_outbox'),0)
    def test_invalid_batch_writes_nothing(self):
        bad = dict(self.item, source='invalid')
        with self.assertRaises(ValueError): run(self.c,[self.item,bad])
        self.assertEqual(self.count('properties'),0)
    def test_transaction_rolls_back_on_failure(self):
        self.c.execute("CREATE TRIGGER fail_import BEFORE INSERT ON imports BEGIN SELECT RAISE(ABORT, 'test'); END;")
        self.c.commit()
        with self.assertRaises(Exception): run(self.c,[self.item])
        self.assertEqual(self.count('properties'),0)
        self.assertEqual(self.count('notification_outbox'),0)

if __name__=='__main__': unittest.main()

