"""Send verified-format source snapshots using GitHub's short-lived OIDC identity."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
from urllib.error import HTTPError

ENDPOINT='https://izpzsfiqvransehvmuzn.supabase.co/functions/v1/discovery-sync'
AUDIENCE='eu-property-discovery:izpzsfiqvransehvmuzn'

def request_token(audience=AUDIENCE):
    url=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']+'&audience='+quote(audience,safe='')
    req=Request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urlopen(req,timeout=30) as response:
        return json.load(response)['value']

def call(token,payload):
    req=Request(ENDPOINT,data=json.dumps(payload,ensure_ascii=False).encode(),
                headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='POST')
    try:
        with urlopen(req,timeout=90) as response:
            return json.load(response)
    except HTTPError as error:
        try:
            body=json.load(error)
        except (ValueError,TypeError):
            body={}
        print('Sync endpoint HTTP:',error.code,'check:',body.get('checks',[]),'error:',body.get('error',''),'subject:',body.get('subject',''))
        raise

def main():
    # Check that a genuine GitHub identity with the wrong audience is rejected.
    try:
        call(request_token(AUDIENCE+':invalid'),{'action':'sync'})
    except HTTPError as error:
        if error.code not in (401,403):
            raise
        print('Provjera pogresne publike: odbijeno.')
    else:
        raise RuntimeError('Endpoint accepted an incorrect audience.')
    snapshot=json.loads(Path('data/discovered_candidates.json').read_text(encoding='utf-8'))
    result=call(request_token(),{'action':'sync','snapshot':snapshot})
    print('Spremljeno kandidata u zajednicku bazu:',result['candidates'])
    print('Broj pracenih izvora:',result['sources'])
    print('Osvjezeno parova za uparivanje:',result['pairs'])
    print('Vrijeme sinkronizacije:',result['synced_at'])

if __name__=='__main__':
    main()
