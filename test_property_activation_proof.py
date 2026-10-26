import json
import unittest
from property_connector import run_source
from registry_discovery import Page,objects
from test_property_connector import PrimaryListingTests


class ActivationProofTests(unittest.TestCase):
    def test_changed_normal_fetch_cannot_support_activation(self):
        fixture=PrimaryListingTests();fixture.setUp();url=fixture.url;calls=[]
        class Fetch:
            def __init__(self,root):self.n=0
            def get(self,u):
                self.n+=1
                return '<script type="application/ld+json">'+json.dumps(fixture.n)+'</script>' if self.n==1 else '<h1>Format changed</h1>'
        def api(body):calls.append(body);return {'candidates':1,'inserted':1,'updated':0}
        result=run_source({'id':68,'name':'Agency','url':url},api,Fetch,Page,objects,lambda u,r:u,'2026-10-26T08:00:00Z')
        self.assertEqual(result['status'],'failed')
        self.assertEqual(result['inserted'],1)
        self.assertNotIn('normal_refresh_confirmed',result)
        self.assertEqual(len(calls),1)


if __name__=='__main__':unittest.main()
