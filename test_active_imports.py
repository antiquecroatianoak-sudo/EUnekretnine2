import json, unittest
from datetime import datetime, timezone, timedelta
from active_listings import checked_activity
from registry_discovery import save_rows
from source_store import sync_snapshot, prepare_for_review
from storage import connect
from matching import refresh_matches, ranked_matches

class ActiveImportTests(unittest.TestCase):
    def row(self):
        stamp=datetime.now(timezone.utc).isoformat(); url='https://example.org/listing/123'
        return dict(id='registry:property:'+'a'*32,source_id='registry-1',kind='property',country='HR',title='Primary property listing',url=url,first_seen=stamp,last_seen=stamp,verified=False,facts=checked_activity(url,url,'Primary source explicitly says active',stamp))
    def test_unknown_not_sent_to_database(self):
        row=self.row();row['facts']={};calls=[];state={}
        self.assertEqual(save_rows('registry-1',[row],state,lambda b:calls.append(b)),(0,0))
        self.assertEqual(calls,[]);self.assertEqual(state['activity_rejected_count'],1)
    def test_active_is_saved_and_inactive_in_same_batch_is_filtered(self):
        row=self.row();bad=dict(row,url=row['url']+'4',facts={});calls=[];state={}
        def api(body):calls.extend(body['candidates']);return dict(inserted=len(body['candidates']))
        self.assertEqual(save_rows('registry-1',[row,bad],state,api),(1,0))
        self.assertEqual(len(calls),1)
    def test_legacy_snapshot_cannot_persist_unknown_property(self):
        c=connect(path=':memory:');row=self.row();row['facts']={}
        sync_snapshot(c,dict(schema_version=1,candidates=[row]))
        self.assertEqual(c.execute('select count(*) as n from source_candidates').fetchone()['n'],0)
        c.close()
    def test_active_can_be_prepared_immediately_but_stale_cannot(self):
        c=connect(path=':memory:');row=self.row();sync_snapshot(c,dict(schema_version=1,candidates=[row]))
        kind,pid=prepare_for_review(c,row['id']);self.assertEqual(kind,'property')
        p=dict(c.execute('select * from properties where id=?',(pid,)).fetchone())
        self.assertEqual(p['status'],'Aktivno');self.assertTrue(p['activity_evidence'])
        stale=dict(row,facts=dict(row['facts'],checked_at=(datetime.now(timezone.utc)-timedelta(days=2)).isoformat()))
        c.execute('update source_candidates set body_json=? where id=?',(json.dumps(stale),row['id']))
        with self.assertRaises(ValueError):prepare_for_review(c,row['id'])
        c.close()

if __name__=='__main__':unittest.main()
