import copy
import unittest
from buyer_profiles import profile_facts
from registry_discovery import Page, listing_record

URL="https://example.org/acquisition/"
QUOTE="We are looking for residential development land in Croatia."
TEXT="ACME Development Ltd. "+QUOTE+" Contact: land@example.org"
CONFIG=dict(url=URL,entity_name="ACME Development Ltd.",intent_evidence=QUOTE,contact_email="land@example.org",
 fields=[dict(field="preferred_countries",value=["HR"],evidence=QUOTE),
         dict(field="property_types",value=["Zemljište"],evidence="residential development land")])

class BuyerProfileTests(unittest.TestCase):
 def parse(self,text=TEXT,config=None,url=URL):
  return profile_facts(url,Page("<h1>Land acquisition criteria</h1><p>"+text+"</p>"),config or CONFIG)
 def test_complete_profile(self):
  f=self.parse();self.assertEqual(f["preferred_countries"],["HR"])
  self.assertIsNone(f["budget"]);self.assertEqual(f["contact_email"],"land@example.org")
  self.assertEqual(f["transaction_type"],"unconfirmed_acquisition_profile")
  self.assertFalse(f['source_contact']['permitted'])
 def test_agency_role_requires_observed_evidence(self):
  c=copy.deepcopy(CONFIG);c['contact_mode']='agency'
  with self.assertRaisesRegex(ValueError,'role evidence'):self.parse(config=c)
  c['role_evidence']='We represent investors seeking properties.'
  f=self.parse(TEXT+' '+c['role_evidence'],c)
  self.assertEqual(f['source_contact']['mode'],'agency')
  self.assertEqual(f['source_contact']['agency_name'],c['entity_name'])
  self.assertTrue(f['source_contact']['represents_record'])
  self.assertFalse(f['source_contact']['permitted'])
 def test_invalid_contact_mode_rejected(self):
  c=copy.deepcopy(CONFIG);c['contact_mode']='partner_confirmed'
  with self.assertRaises(ValueError):self.parse(config=c)
 def test_reviewed_buyer_configuration_overrides_generic_source_category(self):
  from registry_discovery import buyer_source
  self.assertTrue(buyer_source(dict(category='Službena objava',import_config={'buyer_profile':CONFIG})))
  self.assertFalse(buyer_source(dict(category='Službena objava')))
 def test_changed_intent_rejected(self):
  with self.assertRaises(ValueError):self.parse(TEXT.replace(QUOTE,"We sell homes."))
 def test_contact_missing_rejected(self):
  with self.assertRaises(ValueError):self.parse(TEXT.replace("land@example.org",""))
 def test_identity_missing_rejected(self):
  with self.assertRaises(ValueError):self.parse(TEXT.replace("ACME Development Ltd.",""))
 def test_scope_mismatch_rejected(self):
  with self.assertRaises(ValueError):self.parse(url="https://example.org/another/")
 def test_missing_field_evidence_rejected(self):
  c=copy.deepcopy(CONFIG);c["fields"][1]["evidence"]="office buildings"
  with self.assertRaises(ValueError):self.parse(config=c)
 def test_unsupported_country_rejected(self):
  c=copy.deepcopy(CONFIG);c["fields"][0]["value"]=["ZZ"]
  with self.assertRaises(ValueError):self.parse(config=c)
 def test_duplicate_field_rejected(self):
  c=copy.deepcopy(CONFIG);c["fields"].append(c["fields"][0])
  with self.assertRaises(ValueError):self.parse(config=c)
 def test_mailto_is_valid_contact_evidence(self):
  page=Page("<h1>Acquisition profile</h1>"+TEXT.replace("land@example.org","")+'<a href="mailto:land@example.org">Contact us</a>')
  self.assertEqual(profile_facts(URL,page,CONFIG)["contact_email"],"land@example.org")
 def test_integration_keeps_candidate_unverified(self):
  page=Page("<h1>Land acquisition criteria</h1>"+TEXT)
  source=dict(id=113,country="HR",import_config={"buyer_profile":CONFIG})
  row=listing_record(source,URL,page,"buyer","2026-10-25T19:00:00Z")
  self.assertFalse(row["verified"]);self.assertEqual(row["facts"]["property_types"],["Zemljište"])
 def test_rules_cannot_inject_arbitrary_fields(self):
  c=copy.deepcopy(CONFIG);c["fields"].append(dict(field="verified",value=True,evidence=QUOTE))
  with self.assertRaises(ValueError):self.parse(config=c)
 def test_normal_import_uses_reviewed_profile_evidence(self):
  import time
  from unittest.mock import patch
  from registry_discovery import process
  quote='We acquire residential development land in Croatia.'
  c=copy.deepcopy(CONFIG);c['intent_evidence']=quote;c['fields'][0]['evidence']=quote
  html='<h1>Acquisition profile</h1>'+TEXT.replace(QUOTE,quote)
  class Fetch:
   def get(self,url):return html
  source=dict(id=113,country='HR',url=URL,category='Investitor',import_config={'buyer_profile':c})
  with patch('registry_discovery.safe_url',side_effect=lambda u,r:u):
   rows,state=process(source,None,Fetch(),time.monotonic()+5,1)
  self.assertIsNone(state['error']);self.assertEqual(len(rows),1);self.assertFalse(rows[0]['verified'])

class ResumedBuyerProfileTests(unittest.TestCase):
 def test_old_catalog_checkpoint_uses_reviewed_buyer_parser(self):
  import time
  from unittest.mock import patch
  from registry_discovery import process
  html='<h1>Acquisition profile</h1>'+TEXT+'<a href="/sale/">For sale</a>'
  class Fetch:
   def get(self,url):
    self_url=url
    assert self_url==URL
    return html
  source=dict(id=107,country='HR',url=URL,category='Investitor',import_config={'buyer_profile':CONFIG})
  old={'pending':[{'url':URL,'mode':'index','sale':False}],'cycle_seen':[URL]}
  with patch('registry_discovery.safe_url',side_effect=lambda u,r:u):
   rows,state=process(source,old,Fetch(),time.monotonic()+5,1)
  self.assertIsNone(state['error']);self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]['kind'],'buyer');self.assertFalse(rows[0]['verified'])
  self.assertFalse(rows[0]['facts']['source_contact']['permitted'])
  self.assertEqual(state['pending'],[])

if __name__=="__main__":unittest.main()


