"""Read-only probe of the registered EU agency sources from a server runner."""
import sys,json,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from registry_discovery import Fetcher,Page,process,failure_type
sources=json.loads(Path('data/agency_sources.json').read_text())
def probe(source):
    result={k:source[k] for k in ('id','country','name','url')}
    try:
        fetcher=Fetcher(source['url'])
        if source.get('import_config'):
            rows,state=process(source,None,fetcher,time.monotonic()+75,max_pages=3)
            result.update(status=state['status'],error=state.get('error'),pages=state.get('pages_processed'),sample_candidates=len(rows),pending=len(state.get('pending',[])),coverage_complete=False)
        else:
            page=Page(fetcher.get(source['url']))
            result.update(status='Dostupno — prilagodba dohvata potrebna',links=len(page.links),sample_candidates=0,coverage_complete=False)
    except Exception as error:
        result.update(status='Nedostupno pri provjeri',error=type(error).__name__+': '+str(error)[:240],error_kind=failure_type(error),sample_candidates=0)
    print('AGENCY_RESULT '+json.dumps(result,ensure_ascii=False),flush=True)
    return result
with ThreadPoolExecutor(max_workers=3) as pool:
    results=list(pool.map(probe,sources))
print('AGENCY_SUMMARY '+json.dumps({'checked':len(results),'countries':len({r['country'] for r in results}),'note':'Read-only access/parser probe; candidates not saved and no complete portal coverage claimed.'}),flush=True)
