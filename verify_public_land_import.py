"""Run an authenticated, bounded public-land import and verify persistence."""
import time
from registry_discovery import api, process, Fetcher, save_rows
from public_land_sources import PUBLIC_LAND_CALLS, load_registry
from sync_discovery import main as sync_and_refresh

def main():
    config=api({'action':'registry'})
    sources=[s for s in config['sources'] if s['url'].rstrip('/') in PUBLIC_LAND_CALLS]
    registered={s['url'].rstrip('/') for s in sources}
    imported={s['url'].rstrip('/') for c in load_registry()['countries'].values() for s in c['sources'] if s['support_status']=='uvoz_testiran'}
    # Already imported sources must stay registered; new ones wait for a reviewed registration.
    if not imported<=registered:
        raise RuntimeError('Previously imported public sources are no longer registered: '+', '.join(sorted(imported-registered)))
    for url in sorted(set(PUBLIC_LAND_CALLS)-registered):
        print('Configured, not registered in the database; not imported:',url,flush=True)
    failures=[]
    for source in sources:
        sid='registry-'+str(source['id'])
        rows,state=process(source,None,Fetcher(source['url']),time.monotonic()+90,max_pages=1)
        if rows:save_rows(sid,rows,state)
        result=api({'action':'checkpoint','source_id':sid,'state':state})
        print(sid,state['status'],'imported',len(rows),'call',state.get('call_state'),'checkpoint',result.get('saved'),state.get('error') or '',flush=True)
        if state['status']!='Uspješno' or len(rows)!=1 or not result.get('saved'):
            failures.append(sid)
    # The ordinary secured endpoint must also complete its real database refresh.
    sync_and_refresh()
    if failures:raise RuntimeError('Public-source import needs attention: '+', '.join(failures))
    print('PASS: all reviewed public sources imported; database matching refresh completed.',flush=True)

if __name__=='__main__':main()
