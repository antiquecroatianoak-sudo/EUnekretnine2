"""Read-only continuation of the reviewed active Emporia source, no activation.

Visits the discovered land index pages, skips known record URLs, and prepares
the existing registry candidate contract with fresh, exact inquiry evidence.
Output is checkpointed after every result. It never writes to a database.
"""
import json
import sys
import re
import importlib.util
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor,as_completed
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from registry_discovery import Page,emporia_record
spec=importlib.util.spec_from_file_location('inquiry_recheck',Path(__file__).with_name('recheck-inquiry-contacts.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def collect(known, output):
    fetcher=module.EmporiaFetcher('https://www.emporia-realestate.com/')
    pending=['https://www.emporia-realestate.com/lands/'];seen=set();details=set();errors=[]
    result=dict(candidates=[],errors=errors,index_pages=0)
    def save():
        tmp=output.with_suffix('.tmp');tmp.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');tmp.replace(output)
    while pending:
        url=pending.pop(0)
        if url in seen:continue
        seen.add(url)
        try:
            page=Page(fetcher.get(url));result['index_pages']+=1
            for href,_ in page.links:
                if re.fullmatch(r'https://www\.emporia-realestate\.com/property/urbanized-land-[a-z0-9-]+/',href):details.add(href)
                elif re.fullmatch(r'https://www\.emporia-realestate\.com/lands/page/[1-9][0-9]*/',href) and href not in seen:pending.append(href)
        except Exception as error:errors.append(dict(url=url,reason=str(error)))
        print('index pages',result['index_pages'],'new detail URLs',len(details-known),flush=True);save()
    def one(url):
        stamp=datetime.now(timezone.utc).isoformat()
        row=emporia_record({'id':115},url,Page(fetcher.get(url)),[],stamp)
        if row['facts'].get('source_listing_state')=='removed':raise ValueError('Primary listing sold')
        if not row['facts'].get('source_contact'):raise ValueError('Exact inquiry form not present')
        return row
    with ThreadPoolExecutor(max_workers=3) as pool:
        jobs={pool.submit(one,u):u for u in sorted(details-known)}
        for job in as_completed(jobs):
            try:result['candidates'].append(job.result())
            except Exception as error:errors.append(dict(url=jobs[job],reason=str(error)))
            print('prepared',len(result['candidates']),'errors',len(errors),flush=True);save()
    return result

if __name__=='__main__':
    collect(set(json.loads(Path(sys.argv[1]).read_text())),Path(sys.argv[2]))
