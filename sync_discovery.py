"""Sync to the protected project endpoint using GitHub's short-lived OIDC identity."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
from urllib.error import HTTPError
from matching import evaluate

ENDPOINT='https://izpzsfiqvransehvmuzn.supabase.co/functions/v1/discovery-sync'
AUDIENCE='eu-property-discovery:izpzsfiqvransehvmuzn'

def request_token(audience=AUDIENCE):
    url=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']+'&audience='+quote(audience,safe='')
    req=Request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urlopen(req,timeout=30) as response:return json.load(response)['value']

def call(token,payload):
    req=Request(ENDPOINT,data=json.dumps(payload,ensure_ascii=False).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='POST')
    with urlopen(req,timeout=90) as response:return json.load(response)

def main():
    # Negative authorization check: an identity for another audience must be rejected.
    try:call(request_token(AUDIENCE+':invalid'),{'action':'state'})
    except HTTPError as error:
        if error.code not in (401,403):raise
    else:raise RuntimeError('Endpoint accepted an incorrect audience.')
    snapshot=json.loads(Path('data/discovered_candidates.json').read_text())
    result=call(request_token(),{'action':'sync','snapshot':snapshot})
    print('Spremljeno kandidata u zajedničku bazu:',result['candidates'])
    for attempt in range(2):
        state=call(request_token(),{'action':'state'})
        matches=[dict(property_id=p['id'],investor_id=i['id'],result=evaluate(p,i)) for p in state['properties'] for i in state['investors']]
        try:result=call(request_token(),{'action':'matches','matches':matches,'state_hash':state['state_hash']})
        except HTTPError as error:
            if error.code==409 and attempt==0:continue
            raise
        print('Osvježeno parova za uparivanje:',result['pairs']);break

if __name__=='__main__':main()
