import copy
import unittest
from unittest.mock import patch
from datetime import datetime, timezone
from profile_imports import run
from registry_discovery import Page, listing_record
from test_buyer_profiles import CONFIG, TEXT, URL


class ProfileImportTests(unittest.TestCase):
    def config(self, active=False):
        return {'diagnostic_sources':[{'id':110,'country':'CH','url':URL,'is_active':active}],
                'states':{'registry-config-110':{'buyer_profile':copy.deepcopy(CONFIG)}}}

    def trial(self, config, response):
        calls=[]
        class Fetch:
            def __init__(self,url):pass
            def get(self,url):return '<h1>Acquisition profile</h1>'+TEXT
        def api(body):calls.append(body);return response
        with patch('registry_discovery.safe_url',side_effect=lambda u,r:u):
            result=run(config,api,Fetch,Page,listing_record,datetime(2026,10,26,tzinfo=timezone.utc))
        return result,calls

    def test_unconfirmed_write_cannot_report_success(self):
        result,_=self.trial(self.config(),{'candidates':1,'inserted':0,'updated':0})
        self.assertEqual(result['results'][0]['status'],'failed')
        self.assertFalse(result['activation_performed'])

    def test_existing_active_source_is_not_probed_twice(self):
        result,calls=self.trial(self.config(True),{})
        self.assertEqual(calls,[])
        self.assertEqual(result['results'],[])

    def test_demand_country_does_not_come_from_foreign_seat(self):
        result,calls=self.trial(self.config(),{'candidates':1,'inserted':0,'updated':1})
        row=calls[0]['candidates'][0]
        self.assertEqual(row['facts']['preferred_countries'],['HR'])
        self.assertEqual(row['country'],'CH')
        self.assertFalse(row['verified'])
        self.assertFalse(row['facts']['source_contact']['permitted'])
        self.assertEqual(result['results'][0]['status'],'batch_confirmed')
        self.assertTrue(result['results'][0]['normal_refresh_confirmed'])
        self.assertEqual(len(calls),2)

    def test_changed_normal_refresh_cannot_recommend_activation(self):
        calls=[]
        class Fetch:
            def __init__(self,url):self.count=0
            def get(self,url):
                self.count+=1
                return '<h1>Acquisition profile</h1>'+TEXT if self.count==1 else '<h1>Page changed</h1>'
        def api(body):calls.append(body);return {'candidates':1,'inserted':0,'updated':1}
        with patch('registry_discovery.safe_url',side_effect=lambda u,r:u):
            result=run(self.config(),api,Fetch,Page,listing_record)
        self.assertEqual(result['results'][0]['status'],'failed')
        self.assertEqual(len(calls),1)
        self.assertFalse(result['activation_performed'])


if __name__=='__main__':unittest.main()
