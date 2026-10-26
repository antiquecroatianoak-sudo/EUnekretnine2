import unittest
from datetime import datetime, timezone, timedelta
from active_listings import activity_valid, candidate_active, checked_activity, property_active

class ActivityTests(unittest.TestCase):
    def setUp(self):
        self.now=datetime(2026,10,26,12,tzinfo=timezone.utc)
        self.url='https://example.com/listing/123'
        self.f=checked_activity(self.url,self.url,'Explicit primary status: active',self.now.isoformat())
    def valid(self, f=None, when=None):
        return activity_valid(self.url,self.f if f is None else f,when or self.now.isoformat(),self.now)
    def test_positive_and_exact_age_boundaries(self):
        self.assertTrue(self.valid())
        self.assertTrue(self.valid(when=(self.now-timedelta(hours=24)).isoformat()))
        self.assertFalse(self.valid(when=(self.now-timedelta(hours=24,seconds=1)).isoformat()))
        self.assertFalse(self.valid(when=(self.now+timedelta(seconds=1)).isoformat()))
    def test_fetch_or_unknown_is_not_positive(self):
        for state in (None,'observed','unknown','removed','expired','sold','withdrawn'):
            self.assertFalse(self.valid(dict(self.f,source_listing_state=state)))
        self.assertFalse(self.valid({}))
    def test_wrong_record_or_source_is_rejected(self):
        self.assertFalse(self.valid(dict(self.f,activity_record_url=self.url+'4')))
        self.assertFalse(self.valid(dict(self.f,activity_evidence_url='https://other.com/listing/123')))
        self.assertFalse(self.valid(dict(self.f,source_status_evidence='')))
    def test_deadlines_conflicts_and_equality(self):
        for delta in (-1,0):
            self.assertFalse(self.valid(dict(self.f,deadline=(self.now+timedelta(seconds=delta)).isoformat())))
        self.assertTrue(self.valid(dict(self.f,deadline=(self.now+timedelta(seconds=1)).isoformat())))
        self.assertFalse(self.valid(dict(self.f,deadline='bad')))
        self.assertFalse(self.valid(dict(self.f,deadline=(self.now+timedelta(days=1)).isoformat(),available_until=(self.now-timedelta(days=1)).isoformat())))
    def test_missing_timezone_and_malformed_payload(self):
        self.assertFalse(self.valid(when='2026-10-26T12:00:00'))
        self.assertFalse(self.valid(f=[]))
    def test_buyer_unchanged_and_property_requires_proof(self):
        self.assertTrue(candidate_active({'kind':'buyer'}))
        self.assertFalse(candidate_active({'kind':'property','url':self.url,'last_seen':self.now.isoformat(),'facts':{}}))
        self.assertTrue(property_active({'source':self.url,'activity_evidence':self.f},self.now))
        self.assertFalse(property_active({'source':self.url,'activity_evidence':'bad'},self.now))

if __name__=='__main__':unittest.main()
