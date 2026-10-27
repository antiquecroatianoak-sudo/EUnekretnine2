"""Review new sources only; respect access restrictions and never infer buyer mandates."""
import json,time,re,sys
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit,urljoin
from registry_discovery import Fetcher,Page,objects,safe_url
from property_connector import links,primary_record

ADAPTER_REVISION='2026-10-27-intake-v2'
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
        targets=item.get('probe_urls') or links(page,item['url'],objects,safe_url,item['url'])
        out['details']=[]
        for target in targets[:2]:
            if time.monotonic()>=deadline:break
            p=Page(fetcher.get(target));ns=[n for s in p.scripts for n in objects(s)]
            ev={'url':target,'title':' '.join(p.title)[:200],'types':sorted({str(n['@type']) for n in ns if n.get('@type')})}
            try:
                row=primary_record({'id':0,'url':item['url']},target,ns,datetime.now(timezone.utc).isoformat(),p)
                ev.update(parser='accepted_unverified',country=row['country'],contact_present=bool(row['facts'].get('source_contact')))
            except ValueError as e:ev['parser']=str(e)
            ev['header']=' '.join(' '.join(p.main_text or p.text).split())[:4500]
            ev['forms']=[{'action':f['action'],'fields':{k:v for k,v in f['fields'].items() if any(x in k.lower() for x in ('property','listing','refer','id','subject','title','url','message'))},'submit':f['submit']} for f in p.forms]
            ev['end_text']=' '.join(' '.join(p.main_text or p.text).split())[-1600:]
            ev['contact_links']=[(h,l[:80]) for h,l in p.links if h.startswith(('mailto:','tel:')) or any(x in l.lower() for x in ('original','agent','contact','terms'))][:20]
            ev['structured']=[{k:v for k,v in n.items() if k not in ('description','image','photo','logo','review','aggregateRating')} for n in ns if n.get('@type')][:8]
            out['details'].append(ev)
    except Exception as e:out.update(status='blocked_or_unavailable',error=type(e).__name__+': '+str(e)[:260])
    print('INTAKE_PROBE '+json.dumps(out,ensure_ascii=False),flush=True)
    return out

def main():
    manifest=json.loads(MANIFEST.read_text())
    # Read-only PR evidence: known sources are explicit exclusions in the manifest.
    items=select_new(manifest['sources'],[]);items=[s for s in items if s.get('probe_urls')] if any(s.get('probe_urls') for s in items) else items;deadline=time.monotonic()+240
    with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda x:probe(x,deadline),items))
    print('INTAKE_SUMMARY '+json.dumps({'sources':len(results),'writes':0,'activation_performed':False}),flush=True)




def register_discovered(config,api_call,now):
    """Promote newly observed source links to the registry, never to verified buyers."""
    import source_leads
    known={host(s['url']) for s in config['diagnostic_sources']}
    candidates=source_leads.load().get('leads',[])
    results=[]
    for lead in sorted(candidates,key=lambda x:(x.get('first_seen',''),x['host'])):
        if len(results)>=10:break
        if lead['host'] in known or lead.get('status') not in ('kandidat_nekretnine','kandidat_kupci'):continue
        evidence=lead.get('evidence') or []
        if not evidence:continue
        e=evidence[-1]
        checked=lead.get('checked_at')
        try:
            if not checked or (now-datetime.fromisoformat(checked)).total_seconds()>7*86400:continue
        except (TypeError,ValueError):continue
        # Evidence is a prior robot-aware source review; registration is allowed
        # without asserting that the content can already be imported.
        payload={'name':lead.get('title') or lead['host'],'url':e['url'],
                 'kind':'buyer' if lead['status']=='kandidat_kupci' else 'property',
                 'found_on':e['found_on'],'checked_at':now.isoformat()}
        saved=api_call({'action':'intake-register','source':payload})
        if not saved.get('source'):raise RuntimeError('Source registration not acknowledged')
        known.add(lead['host']);results.append(saved)
    return results


def check_access_page(source,fetcher):
    """Inspect visible access walls and published terms before a trial import."""
    from urllib.parse import urljoin
    page=Page(fetcher.get(source['url']))
    title=' '.join(page.title);text=' '.join(page.text)
    if re.search(r'one moment|just a moment|access denied|verify.*human|security verification|captcha',title+' '+text[:300],re.I):
        raise ValueError('Access challenge; no import')
    for href,label in page.links:
        if not re.search(r'terms|conditions|algemene voorwaarden|uvjeti kori',label,re.I):continue
        target=urljoin(source['url'],href)
        if host(target)!=host(source['url']) or not urlsplit(target).path or urlsplit(target).path=='/':continue
        terms=Page(fetcher.get(target));words=' '.join(terms.text)
        if re.search(r'\b(?:scrap\w*|crawler\w*|automated program|data.extraction|robot)\b|(?:store|copy|reproduc\w*).{0,180}(?:written consent|prior permission)',words,re.I):
            raise ValueError('Published access/reuse terms require permission review: '+target)
        break
    return page

def review_new_source(source,intake,api_call,deadline,fetcher_factory=Fetcher,url_validator=None):
    from datetime import timedelta
    from property_connector import collect,timed_out
    from registry_discovery import save_rows,save_checkpoint
    import source_leads
    sid='registry-'+str(source['id']);now=datetime.now(timezone.utc)
    result={'source_id':sid,'name':source['name'],'activated':False}
    if source.get('is_active'):return dict(result,status='already_active')
    if intake.get('status') in ('access_required','reference_only') and intake.get('kind')!='reference':
        return dict(result,status=intake['status'])
    if intake.get('retry_after') and intake.get('adapter_revision')==ADAPTER_REVISION:
        try:
            if datetime.fromisoformat(intake['retry_after'])>now:return dict(result,status='cooldown')
        except (TypeError,ValueError):return dict(result,status='invalid_retry_requires_review')
    try:
        source={**source,'import_config':{'entry_urls':intake.get('entry_urls') or [source['url']]}}
        fetcher=fetcher_factory(source['url'])
        if intake.get('kind')=='reference':
            page=Page(fetcher.get(source['url']));source_leads.observe(source['url'],page.links)
            result.update(status='reference_only',note='Public source links inspected; members are not buyer requests.')
        elif intake.get('kind')=='buyer':
            result.update(status='format_required',note='Documented buyer identity, acquisition criteria and record-bound channel require a reviewed profile; no automatic invented mandate.')
        else:
            page=check_access_page(source,fetcher)
            source_leads.observe(source['url'],page.links)
            # The same strict primary-record parser is used by trial and normal
            # scheduled refresh. A root success or generic product is insufficient.
            probe_pages=2 if intake.get('entry_urls') else 4
            rows,state=collect(source,None,fetcher,deadline,max_pages=probe_pages,url_validator=url_validator)
            if state.get('error'):raise RuntimeError(state['error'])
            if not rows:
                result.update(status='format_required',note='No primary EU sale with a record-bound contact; '+str(state.get('failed_urls',[])[:2])[:500])
            else:
                n,u=save_rows(sid,rows,state,api_call)
                if n+u<=0:raise RuntimeError('Trial persisted no admissible records: '+str(state.get('failed_urls',[])[:1])[:450])
                # Repeat through the real refresh path before enabling this source.
                refresh,normal=collect(source,None,fetcher,deadline,max_pages=probe_pages,url_validator=url_validator)
                if normal.get('error') or not refresh:raise RuntimeError('Normal refresh did not confirm primary records: '+str(normal.get('error')))
                n2,u2=save_rows(sid,refresh,normal,api_call)
                if n2+u2<=0:raise RuntimeError('Normal refresh write not confirmed')
                if not save_checkpoint(sid,normal,api_call).get('saved'):raise RuntimeError('Checkpoint not acknowledged')
                receipt=api_call({'action':'intake-activate','source_id':sid})
                if receipt.get('activated') is not True:raise RuntimeError('Activation not acknowledged')
                return dict(result,status='active',activated=True,trial_inserted=n,trial_updated=u,refresh_inserted=n2,refresh_updated=u2,coverage_complete=False)
    except Exception as error:
        message=type(error).__name__+': '+str(error)[:650]
        blocked=bool(re.search(r'403|401|405|429|robots|captcha|access challenge|permission review',message,re.I))
        result.update(status='access_required' if blocked else 'fetch_failed',note=message)
    # Healthy format reviews wait a week; transient failures retry next schedule.
    hours=168 if result['status'] in ('format_required','reference_only') else 24 if result['status']=='access_required' else 6
    state={'status':result['status'],'note':result['note'][:800],'checked_at':datetime.now(timezone.utc).isoformat(),'retry_after':(datetime.now(timezone.utc)+timedelta(hours=hours)).isoformat(),'adapter_revision':ADAPTER_REVISION}
    if not api_call({'action':'intake-status','source_id':sid,'state':state}).get('saved'):raise RuntimeError('Intake status not acknowledged')
    return result


def sync():
    from registry_discovery import api
    import source_leads
    config=api({'action':'registry'});now=datetime.now(timezone.utc)
    registered=register_discovered(config,api,now)
    if registered:config=api({'action':'registry'})
    selected=[]
    for source in config['diagnostic_sources']:
        intake=config['states'].get('registry-intake-'+str(source['id']))
        # Original sources lack an intake marker and are completely untouched.
        if intake and not source['is_active']:selected.append((source,intake))
    selected.sort(key=lambda x:(x[1].get('kind')!='property' or x[1].get('status') not in ('registered','fetch_failed'),x[1].get('checked_at',''),x[0]['id']))
    deadline=time.monotonic()+240;results=[]
    # Serial turns keep bounded requests fair; unfinished sources keep their states.
    for source,intake in selected:
        if time.monotonic()>=deadline:break
        result=review_new_source(source,intake,api,deadline)
        results.append(result);print('INTAKE_RESULT '+json.dumps(result,ensure_ascii=False),flush=True)
    source_leads.record_observed([host(s['url']) for s in config['diagnostic_sources']])
    print('INTAKE_SYNC '+json.dumps({'registered':len([r for r in registered if not r.get('existing')]),'checked':len(results),'activated':sum(r.get('activated',False) for r in results),'coverage_complete':False}),flush=True)

if __name__=='__main__':
    sync() if '--sync' in sys.argv else main()
