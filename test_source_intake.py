import copy,unittest,json,time
from datetime import datetime,timezone
from unittest.mock import patch
from source_intake import select_new,review_new_source,register_discovered
from test_property_connector import PrimaryListingTests
class IntakeTests(unittest.TestCase):
 def test_existing_host_and_duplicate_paths_never_rechecked(self):
  items=[{'url':'https://www.agency.example/a','status':'research'},{'url':'https://new.example/a','status':'research'},{'url':'https://new.example/b','status':'research'},{'url':'https://blocked.example','status':'access_required'}]
  self.assertEqual([s['url'] for s in select_new(items,[{'url':'https://agency.example/b'}])],['https://new.example/a'])
 def fixture(self):
  n=PrimaryListingTests();n.setUp();self.n=n
  source={'id':999,'name':'New Agency','url':n.url,'is_active':False}
  return source
 def test_activation_requires_trial_normal_write_and_checkpoint(self):
  source=self.fixture();calls=[]
  class Fetch:
   def __init__(inner,url):pass
   def get(inner,url):return '<script type="application/ld+json">'+json.dumps(self.n.n)+'</script>'
  def api(body):
   calls.append(body)
   return {'batch':{'candidates':1,'inserted':0,'updated':1},'checkpoint':{'saved':True},'intake-activate':{'activated':True}}[body['action']]
  r=review_new_source(source,{'kind':'property','status':'registered'},api,time.monotonic()+10,Fetch,url_validator=lambda u,r:u)
  self.assertTrue(r['activated']);self.assertEqual([x['action'] for x in calls],['batch','batch','checkpoint','intake-activate'])
 def test_failed_normal_refresh_never_activates(self):
  source=self.fixture();calls=[]
  class Fetch:
   def __init__(inner,url):inner.n=0
   def get(inner,url):
    inner.n+=1
    return '<script type="application/ld+json">'+json.dumps(self.n.n)+'</script>' if inner.n<=2 else '<title>No primary identity</title>'
  def api(body):calls.append(body);return {'candidates':1,'inserted':1,'updated':0,'saved':True}
  r=review_new_source(source,{'kind':'property','status':'registered'},api,time.monotonic()+10,Fetch,url_validator=lambda u,r:u)
  self.assertFalse(r['activated']);self.assertNotIn('intake-activate',[x['action'] for x in calls]);self.assertEqual(r['status'],'fetch_failed')
 def test_access_required_never_fetches(self):
  source=self.fixture()
  def forbidden(*a):raise AssertionError('must not fetch')
  r=review_new_source(source,{'kind':'property','status':'access_required'},forbidden,time.monotonic()+10,forbidden)
  self.assertEqual(r['status'],'access_required')
 def test_buyer_lead_is_not_a_mandate_or_automatic_property_import(self):
  source=self.fixture();calls=[]
  r=review_new_source(source,{'kind':'buyer','status':'registered'},lambda b:calls.append(b) or {'saved':True},time.monotonic()+10)
  self.assertEqual(r['status'],'format_required');self.assertEqual([x['action'] for x in calls],['intake-status'])
 def test_discovered_source_is_registered_once_not_activated(self):
  now=datetime.now(timezone.utc);calls=[]
  lead={'host':'new.example','status':'kandidat_nekretnine','checked_at':now.isoformat(),'title':'New Agency','evidence':[{'url':'https://new.example/properties','found_on':'https://portal.example/property/1'}]}
  config={'diagnostic_sources':[{'url':'https://existing.example'}]}
  with patch('source_leads.load',return_value={'leads':[lead,copy.deepcopy(lead)]}):
   result=register_discovered(config,lambda b:calls.append(b) or {'source':{'id':999}},now)
  self.assertEqual(len(result),1);self.assertEqual(calls[0]['action'],'intake-register')
