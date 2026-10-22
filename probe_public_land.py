"""Read-only real fetch of every configured public land call. No tokens, no database writes."""
import json
import os
import sys
from datetime import datetime, timezone
from registry_discovery import Fetcher, Page, failure_type
from public_land_sources import PUBLIC_LAND_CALLS, public_land_record, load_registry

def registry_entries(registry):
    return {s['url'].rstrip('/'):(code,s) for code,country in registry['countries'].items() for s in country['sources']}

def probe(registry,fetcher=Fetcher,now=None):
    entries=registry_entries(registry);results=[]
    for url,config in PUBLIC_LAND_CALLS.items():
        code,entry=entries.get(url,(config['country'],{}))
        source={'id':entry.get('registry_id') or 0,'url':entry.get('url',url),'country':config['country']}
        stamp=now or datetime.now(timezone.utc).isoformat()
        result={'url':source['url'],'country':code,'institution':config['entity'],'checked_at':stamp,'support_status':entry.get('support_status')}
        try:
            # Fetcher enforces robots.txt, crawl delay, public HTTPS and same-host redirects.
            page=Page(fetcher(source['url']).get(source['url']))
            text=' '.join(' '.join(page.text).split())
            facts=public_land_record(source,text,stamp)['facts']
            result.update(result='zatvoren' if facts.get('source_listing_state')=='expired' else 'aktivan',
                          title=' '.join(' '.join(page.title).split())[:200],
                          **{k:facts.get(k) for k in ('deadline','programme_budget','min_area','source_status_evidence','deadline_evidence','budget_evidence','area_evidence')})
        except Exception as error:
            result.update(result='pogreška',error=type(error).__name__+': '+str(error)[:240],error_kind=failure_type(error))
        results.append(result)
    return results

def summary(results):
    lines=['| Država | Institucija | Rezultat | Rok | Programski iznos EUR | Min. površina m² | Napomena |','|---|---|---|---|---|---|---|']
    for r in results:
        lines.append('| {} | {} | {} | {} | {} | {} | {} |'.format(r['country'],r['institution'],r['result'],r.get('deadline') or '—',
            r.get('programme_budget') or '—',r.get('min_area') or '—',(r.get('error') or r.get('source_status_evidence') or '').replace('|','/')[:160]))
    return '\n'.join(lines)

def main(out='public_land_probe.json'):
    registry=load_registry();results=probe(registry)
    with open(out,'w',encoding='utf-8') as f:json.dump({'checked_at':datetime.now(timezone.utc).isoformat(),'results':results},f,ensure_ascii=False,indent=1)
    table=summary(results);print(table,flush=True)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf-8') as f:f.write('## Stvarni dohvat javnih poziva (bez upisa u bazu)\n\n'+table+'\n')
    # A regression on an already imported source must be visible; new sources only report.
    broken=[r['url'] for r in results if r['support_status']=='uvoz_testiran' and r['result']=='pogreška']
    if broken:
        print('Previously imported sources failed:',', '.join(broken),flush=True);sys.exit(1)

if __name__=='__main__':main(*sys.argv[1:])
