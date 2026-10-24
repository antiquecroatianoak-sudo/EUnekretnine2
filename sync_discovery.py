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

def snapshot_batches(snapshot, max_bytes=1_800_000, max_rows=500):
    """Bound individual requests, never the total snapshot. Replays are idempotent upserts."""
    if not isinstance(snapshot.get('candidates'), list):
        raise ValueError('Snapshot candidates must be a list.')
    if max_rows < 1 or max_bytes < 1:
        raise ValueError('Batch limits must be positive.')
    def size(rows):
        return len(json.dumps({'action':'sync','snapshot':dict(snapshot,candidates=rows)},ensure_ascii=False).encode())
    if size([]) > max_bytes:
        raise ValueError('Snapshot metadata exceeds the per-request byte limit.')
    batch=[]
    for row in snapshot['candidates']:
        if len(batch) >= max_rows or size([*batch,row]) > max_bytes:
            if not batch:
                raise ValueError('One candidate exceeds the per-request byte limit; nothing was truncated.')
            yield dict(snapshot,candidates=batch)
            batch=[]
        if size([row]) > max_bytes:
            raise ValueError('One candidate exceeds the per-request byte limit; nothing was truncated.')
        batch.append(row)
    if batch or not snapshot['candidates']:
        yield dict(snapshot,candidates=batch)

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
    count=0
    for batch in snapshot_batches(snapshot):
        result=call(request_token(),{'action':'sync','snapshot':batch})
        count+=result['candidates']
        print('Potvrdeno spremljeno u ovom prolazu:',count,'od',len(snapshot['candidates']))
    print('Spremljeno kandidata u zajednicku bazu:',count)
    print('Broj pracenih izvora:',result['sources'])
    print('Osvjezeno parova za uparivanje:',result['pairs'])
    print('Vrijeme sinkronizacije:',result['synced_at'])

if __name__=='__main__':
    main()

