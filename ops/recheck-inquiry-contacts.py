"""Prepare an evidence-only contact backfill; never write to a database or send a form.

Input: JSON rows containing id/source/contact_json. Output: reviewed per-record
contact proposals and rejection reasons. Network access uses the regular robots-
checked, rate-limited registry fetcher. Operators must compare-and-set proposals.
"""
import json
import sys
import time
import re
from urllib.parse import urlsplit
from urllib.request import Request,build_opener,HTTPRedirectHandler
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from registry_discovery import Page,Fetcher,emporia_record

class EmporiaFetcher(Fetcher):
    """Fixed public origin for this operator tool, including proxy-only hosts.

    No arbitrary URL/DNS input and no cross-origin redirects. The inherited get
    method still checks robots.txt and rate limits; forms are never submitted.
    """
    def raw(self,url):
        def check(value):
            p=urlsplit(value)
            if p.scheme!='https' or p.netloc!='www.emporia-realestate.com' or p.query or p.fragment:
                raise ValueError('Outside reviewed Emporia origin')
            if p.path!='/robots.txt' and not re.fullmatch(r'/property/[a-z0-9-]+/',p.path):
                raise ValueError('Outside reviewed listing paths')
        check(url)
        class Redirect(HTTPRedirectHandler):
            def redirect_request(self,req,fp,code,msg,headers,newurl):
                check(newurl)
                return super().redirect_request(req,fp,code,msg,headers,newurl)
        delay=self.minimum_interval-(time.monotonic()-self.last)
        if delay>0:time.sleep(delay)
        self.last=time.monotonic()
        with build_opener(Redirect()).open(Request(url,headers={'User-Agent':'EUPropertyResearch/0.2'}),timeout=25) as response:
            check(response.url);data=response.read(4_000_001)
            if len(data)>4_000_000:raise ValueError('Page exceeds transfer budget')
            return data.decode('utf-8',errors='replace')

def prepare(rows, fetcher):
    accepted=[];rejected=[]
    for row in rows:
        if row.get('contact_json') is not None:
            rejected.append(dict(id=row['id'],reason='Existing contact preserved'));continue
        try:
            stamp=datetime.now(timezone.utc).isoformat()
            record=emporia_record({'id':115},row['source'],Page(fetcher.get(row['source'])),[],stamp)
            if record['facts'].get('source_listing_state')=='removed':raise ValueError('Primary listing says sold')
            contact=record['facts'].get('source_contact')
            if not contact:raise ValueError('No exact record-bound inquiry form')
            accepted.append(dict(id=row['id'],source=row['source'],contact=contact))
        except Exception as error:
            rejected.append(dict(id=row['id'],reason=str(error)))
        print('checked',row['id'],file=sys.stderr,flush=True)
    return dict(accepted=accepted,rejected=rejected)

if __name__=='__main__':
    rows=json.loads(Path(sys.argv[1]).read_text())
    result=prepare(rows,EmporiaFetcher('https://www.emporia-realestate.com/'))
    Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(accepted=len(result['accepted']),rejected=len(result['rejected']))))
