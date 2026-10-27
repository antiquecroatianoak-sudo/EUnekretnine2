"""Review new sources only; respect access restrictions and never infer buyer mandates."""
import json,time
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit,urljoin
from registry_discovery import Fetcher,Page,objects,safe_url
from property_connector import links,primary_record

MANIFEST=Path(__file__).with_name('data')/'source_intake.json'

def host(url):
    return (urlsplit(url).hostname or '').lower().removeprefix('www.').removeprefix('en.')

def select_new(items,known):
    """A source already present on any path must not be probed or modified."""
    known={host(s['url']) for s in known}
    seen=set();result=[]
    for item in items:
        h=host(item['url'])
        if not h or h in known or h in seen or item.get('status')!='research':continue
        seen.add(h);result.append(item)
    return result

def probe(item,deadline):
    out={k:item[k] for k in ('key','name','url','kind')};out['writes']=0
    try:
        fetcher=Fetcher(item['url']);page=Page(fetcher.get(item['url']))
        nodes=[n for s in page.scripts for n in objects(s)]
        out.update(status='observed',title=' '.join(page.title)[:180],structured_types=sorted({str(n['@type']) for n in nodes if n.get('@type')}))
        # Small facts-only format evidence for connector work; not an advertisement copy.
        out['links']=[(urljoin(item['url'],h),label[:90]) for h,label in page.links if h and not h.startswith(('mailto:','tel:'))][:100]
        targets=links(page,item['url'],objects,safe_url,item['url'])
        out['details']=[]
        for target in targets[:2]:
            if time.monotonic()>=deadline:break
            p=Page(fetcher.get(target));ns=[n for s in p.scripts for n in objects(s)]
            ev={'url':target,'title':' '.join(p.title)[:200],'types':sorted({str(n['@type']) for n in ns if n.get('@type')})}
            try:
                row=primary_record({'id':0,'url':item['url']},target,ns,datetime.now(timezone.utc).isoformat(),p)
                ev.update(parser='accepted_unverified',country=row['country'],contact_present=bool(row['facts'].get('source_contact')))
            except ValueError as e:ev['parser']=str(e)
            ev['header']=' '.join(' '.join(p.main_text or p.text).split())[:1600]
            ev['structured']=[{k:v for k,v in n.items() if k not in ('description','image','logo','review','aggregateRating')} for n in ns if n.get('@type')][:8]
            out['details'].append(ev)
    except Exception as e:out.update(status='blocked_or_unavailable',error=type(e).__name__+': '+str(e)[:260])
    print('INTAKE_PROBE '+json.dumps(out,ensure_ascii=False),flush=True)
    return out

def main():
    manifest=json.loads(MANIFEST.read_text())
    # Read-only PR evidence: known sources are explicit exclusions in the manifest.
    items=select_new(manifest['sources'],[]);deadline=time.monotonic()+240
    with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda x:probe(x,deadline),items))
    print('INTAKE_SUMMARY '+json.dumps({'sources':len(results),'writes':0,'activation_performed':False}),flush=True)

if __name__=='__main__':main()
