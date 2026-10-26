import unittest
from datetime import datetime, timezone, timedelta
from source_batches import build_report, due, run_probes, classify

NOW = datetime(2026,10,25,19,tzinfo=timezone.utc)
def row(i=1, **kw):
    return dict(id=i,name="Source",url="https://example.org/",is_active=False,**kw)

class BatchTests(unittest.TestCase):
    def test_blocked_source_is_not_probed(self):
        r = build_report([row(body_json={"error":"HTTP Error 403: Forbidden"})],now=NOW)
        self.assertEqual(r["sources"][0]["group"],"approved_access_required")
        self.assertFalse(due(r["sources"][0],NOW))
    def test_active_source_is_not_probed_twice(self):
        r = row();r["is_active"]=True
        self.assertFalse(due(classify(r),NOW))
    def test_latest_denial_is_not_hidden_by_old_unsupported_state(self):
        r=classify(row(body_json={'status':'Nepodržano','error':'No validated detail URL adapter'},
                       inactive_reason='Detail fetch HTTP 403: Forbidden'))
        self.assertEqual(r['group'],'approved_access_required')
        self.assertFalse(due(r,NOW))
    def test_preserved_denied_probe_stays_blocked_after_cooldown(self):
        previous={'sources':[dict(id=1,url='https://example.org/',
            probe_at=(NOW-timedelta(days=2)).isoformat(),probe={'status':'access_blocked'})]}
        report=build_report([row(body_json={'status':'Nepodržano'})],previous,NOW)
        self.assertEqual(report['sources'][0]['group'],'approved_access_required')
        self.assertFalse(due(report['sources'][0],NOW))
    def test_pdf_separated_from_html(self):
        r = row();r["url"]="https://example.org/criteria.pdf"
        self.assertEqual(classify(r)["group"],"pdf_acquisition_profiles")
    def test_cooldown(self):
        item=classify(row(body_json={"retry_after":(NOW+timedelta(hours=1)).isoformat()}))
        self.assertFalse(due(item,NOW))
    def test_report_preserves_probe_but_not_on_url_change(self):
        previous={"sources":[dict(id=1,url="https://example.org/",probe_at=NOW.isoformat(),probe={"status":"observed"})]}
        r=build_report([row()],previous,NOW)
        self.assertFalse(due(r["sources"][0],NOW))
        source=row();source["url"]="https://example.org/new/"
        self.assertNotIn("probe_at",build_report([source],previous,NOW)["sources"][0])
    def test_error_does_not_activate_or_import(self):
        class Fetch:
            def __init__(self,url):pass
            def get(self,url):raise ValueError("robots.txt disallows this URL")
        r=run_probes(build_report([row()],now=NOW),Fetch,None,None,NOW)
        self.assertEqual(r["sources"][0]["probe"]["status"],"access_blocked")
        self.assertFalse(r["sources"][0]["is_active"])
        self.assertEqual(r["probed_count"],1)
    def test_counts_include_inactive_sources(self):
        r=build_report([row(1),row(2,category="Investitor — potražnja")],now=NOW)
        self.assertEqual(r["inactive_count"],2)
        self.assertEqual(r["groups"]["buyer_acquisition_pages"],1)

if __name__=="__main__":unittest.main()

