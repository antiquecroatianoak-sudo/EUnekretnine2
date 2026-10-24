import json
import unittest
from sync_discovery import snapshot_batches


class SnapshotBatchTests(unittest.TestCase):
    def test_all_records_beyond_10000_are_preserved_in_safe_requests(self):
        snapshot={'schema_version':1,'generated_at':'2026-10-24T10:00:00Z','runs':[{'id':n} for n in range(6)],'candidates':[{'id':n,'title':'TEST Čćž'} for n in range(10125)]}
        batches=list(snapshot_batches(snapshot,max_bytes=4000,max_rows=137))
        self.assertGreater(len(batches),1)
        self.assertEqual([r for b in batches for r in b['candidates']],snapshot['candidates'])
        for batch in batches:
            self.assertLessEqual(len(batch['candidates']),137)
            self.assertLessEqual(len(json.dumps({'action':'sync','snapshot':batch},ensure_ascii=False).encode()),4000)
            self.assertEqual(batch['runs'],snapshot['runs'])
        self.assertEqual(list(snapshot_batches(snapshot,max_rows=137,max_bytes=4000)),batches,'retry has identical batches; upsert identity is preserved')

    def test_status_only_snapshot_and_oversized_record_are_explicit(self):
        self.assertEqual(len(list(snapshot_batches({'candidates':[],'runs':[]}))),1)
        with self.assertRaisesRegex(ValueError,'One candidate'):
            list(snapshot_batches({'candidates':[{'body':'x'*5000}],'runs':[]},max_bytes=1000))
        with self.assertRaisesRegex(ValueError,'metadata'):
            list(snapshot_batches({'candidates':[],'runs':['x'*5000]},max_bytes=1000))


if __name__=='__main__':
    unittest.main()
