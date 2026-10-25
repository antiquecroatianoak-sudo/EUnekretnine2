"""Shared, conservative JSON-LD property connector; no automatic activation."""
import hashlib
import json
import math
import re
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

EU=set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split())
COUNTRIES={'Austria':'AT','Belgium':'BE','Bulgaria':'BG','Croatia':'HR','Cyprus':'CY','Czech Republic':'CZ','Denmark':'DK','Estonia':'EE','Finland':'FI','France':'FR','Germany':'DE','Greece':'GR','Hungary':'HU','Ireland':'IE','Italy':'IT','Latvia':'LV','Lithuania':'LT','Luxembourg':'LU','Malta':'MT','Netherlands':'NL','Poland':'PL','Portugal':'PT','Romania':'RO','Slovakia':'SK','Slovenia':'SI','Spain':'ES','Sweden':'SE'}
TYPES={'Apartment':'Stan','House':'Kuća','SingleFamilyResidence':'Kuća','Residence':None,'RealEstateListing':None}
SALE=re.compile(r'\b(?:for sale|zu verkaufen|te koop|à vendre|en venta|in vendita|na prodaju|na prodaj|na predaj)\b',re.I)
RENT=re.compile(r'\b(?:for rent|to rent|zu vermieten|te huur|à louer|en alquiler|in affitto|najam|oddaja)\b',re.I)

def canonical(u):
    p=urlsplit(u)
    return urlunsplit((p.scheme,p.netloc.lower(),p.path.rstrip('/'),p.query,''))

def types(node):
    v=node.get('@type',[])
    return {v} if isinstance(v,str) else set(v) if isinstance(v,list) and all(isinstance(x,str) for x in v) else set()

def number(v):
    if isinstance(v,bool):return None
    try:n=float(v)
    except (ValueError,TypeError):return None
    return n if math.isfinite(n) and n>0 else None

def primary_record(source,url,nodes,stamp):
    matching=[n for n in nodes if types(n)&TYPES.keys() and isinstance(n.get('url'),str) and canonical(urljoin(url,n['url']))==canonical(url)]
    if len(matching)!=1:raise ValueError('primary_identity_missing_or_ambiguous')
    n=matching[0];title=n.get('name');description=n.get('description','')
    if not isinstance(title,str) or len(title.strip())<8:raise ValueError('primary_title_missing')
    offers=n.get('offers');offers=offers if isinstance(offers,list) else [offers]
    if len(offers)!=1 or not isinstance(offers[0],dict):raise ValueError('single_offer_required')
    offer=offers[0];item=offer.get('itemOffered') or n.get('mainEntity') or n
    if not isinstance(item,dict):raise ValueError('property_object_required')
    if item is not n and not types(item)&TYPES.keys():raise ValueError('property_type_required')
    words=title+' '+(description if isinstance(description,str) else '')
    explicit='OfferForPurchase' in types(offer) or str(offer.get('businessFunction','')).rsplit('/',1)[-1]=='Sell' or bool(SALE.search(words))
    if not explicit or RENT.search(words):raise ValueError('unambiguous_sale_required')
    address=item.get('address') or n.get('address')
    if not isinstance(address,dict):raise ValueError('property_address_country_required')
    country=address.get('addressCountry')
    if isinstance(country,dict):country=country.get('identifier') or country.get('name')
    country=COUNTRIES.get(country,country)
    if country not in EU:raise ValueError('explicit_eu_property_country_required')
    seller=offer.get('seller') or offer.get('offeredBy') or n.get('provider')
    if not isinstance(seller,dict) or not isinstance(seller.get('name'),str) or not seller['name'].strip():raise ValueError('record_bound_seller_required')
    point=seller.get('contactPoint') or seller
    if isinstance(point,list):point=point[0] if len(point)==1 else {}
    if not isinstance(point,dict):raise ValueError('record_bound_contact_required')
    email=point.get('email') or seller.get('email');phone=point.get('telephone') or seller.get('telephone')
    email=email if isinstance(email,str) and re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) else None
    phone=phone if isinstance(phone,str) and re.fullmatch(r'\+?[0-9 ()/.-]{7,30}',phone) and len(re.sub(r'\D','',phone))>=7 else None
    if not email and not phone:raise ValueError('record_bound_contact_required')
    raw_price=offer.get('price');currency=offer.get('priceCurrency');price=number(raw_price)
    if raw_price is not None and price is None:raise ValueError('invalid_price')
    if price is not None and (not isinstance(currency,str) or not re.fullmatch('[A-Z]{3}',currency)):raise ValueError('price_currency_required')
    facts={'transaction_type':'sale','evidence_excerpt':words[:1600],'advertised_location':address,'country_basis':'Primary property addressCountry','asking_price':price if currency=='EUR' else None,'advertised_price':price,'currency':currency,'contact_evidence_url':url,'agency_evidence_url':url,'source_contact':{'name':seller['name'],'email':email,'phone':phone,'evidence_url':url,'record_reference':url,'permitted':False},'availability':'Izvorni oglas opažen; aktualna dostupnost i pravna urednost nisu potvrđene.'}
    mapped={TYPES[t] for t in types(item) if t in TYPES and TYPES[t]}
    if len(mapped)==1:facts['property_type']=mapped.pop()
    area=item.get('floorSize')
    if isinstance(area,dict) and area.get('unitCode')=='MTK' and number(area.get('value')):facts['advertised_area']={'value':number(area['value']),'unitCode':'MTK'}
    availability=str(offer.get('availability','')).rsplit('/',1)[-1]
    if availability in ('SoldOut','Discontinued'):facts.update(source_listing_state='removed',source_status_evidence='Primary offer availability: '+availability)
    url=canonical(url)
    return {'id':'registry:property:'+hashlib.sha256(url.encode()).hexdigest()[:32],'source_id':'registry-'+str(source['id']),'kind':'property','title':title.strip()[:240],'country':country,'url':url,'first_seen':stamp,'last_seen':stamp,'verified':False,'status':'Za provjeru','facts':facts}

def links(page,url,objects,safe_url,root):
    candidates=list(page.links)
    for script in page.scripts:
        for n in objects(script):
            if 'ListItem' in types(n):
                item=n.get('item');target=n.get('url') or (item.get('url') if isinstance(item,dict) else item)
                if isinstance(target,str):candidates.insert(0,(target,'structured listing'))
    found=[]
    for href,label in candidates:
        if not isinstance(href,str) or not (label=='structured listing' or SALE.search(label+' '+href) or re.search(r'/(?:property|properties|immobilien|immobile|nemovitost|nepremicnine|expose|listing|objekt|offer|detail)[/-]',href,re.I)):continue
        try:target=safe_url(urljoin(url,href),root)
        except (ValueError,OSError):continue
        if canonical(target)!=canonical(root) and target not in found:found.append(target)
    return found[:200]

def run_source(source,api,Fetcher,Page,objects,safe_url,stamp,deadline=float('inf')):
    result={'source_id':'registry-'+str(source['id']),'id':source['id'],'name':source['name'],'url':source['url'],'checked_at':stamp,'inserted':0,'updated':0,'rejections':[]}
    try:
        if time.monotonic()>=deadline:result['status']='runtime_deferred';return result
        f=Fetcher(source['url']);page=Page(f.get(source['url']))
        urls=links(page,source['url'],objects,safe_url,source['url'])[:2]
        if not urls:result.update(status='no_structured_detail_links');return result
        for url in urls:
            if time.monotonic()>=deadline:result['rejections'].append({'url':url,'reason':'runtime_deferred'});break
            try:
                p=Page(f.get(url));nodes=[n for script in p.scripts for n in objects(script)]
                row=primary_record(source,url,nodes,stamp)
                saved=api({'action':'batch','source_id':result['source_id'],'candidates':[row]})
                if saved.get('candidates')!=1 or saved.get('inserted',0)+saved.get('updated',0)!=1:raise RuntimeError('write_not_confirmed')
                result['inserted']+=saved.get('inserted',0);result['updated']+=saved.get('updated',0)
            except ValueError as e:result['rejections'].append({'url':url,'reason':str(e)[:240]})
        result['status']='batch_confirmed' if result['inserted']+result['updated'] else 'format_or_evidence_required'
    except Exception as e:
        result.update(status='failed',error=type(e).__name__+': '+str(e)[:240],retry_after=(datetime.fromisoformat(stamp)+timedelta(days=1)).isoformat())
    return result

def collect(source,previous,fetcher,deadline,max_pages=25):
    """Normal registry path only after the source's sample has been reviewed."""
    from registry_discovery import Page,objects,safe_url
    stamp=datetime.now(timezone.utc).isoformat();previous=previous or {}
    pending=list(previous.get('pending') or [{'url':source['url'],'mode':'index'}])
    seen=set(previous.get('cycle_seen',[])) if previous.get('pending') else set()
    rows=[];failed=[];pages=0;error=None
    while pending and pages<max_pages and time.monotonic()<deadline:
        entry=pending.pop(0);url=entry['url']
        if canonical(url) in seen:continue
        try:
            url=safe_url(url,source['url']);page=Page(fetcher.get(url));pages+=1
            nodes=[n for script in page.scripts for n in objects(script)]
            if entry['mode']=='detail':
                try:rows.append(primary_record(source,url,nodes,stamp))
                except ValueError as exc:failed.append({'url':url,'reason':str(exc)})
            else:
                queued={canonical(x['url']) for x in pending}
                for target in links(page,url,objects,safe_url,source['url']):
                    if canonical(target) not in seen|queued:
                        pending.append({'url':target,'mode':'detail'});queued.add(canonical(target))
                for href in page.next:
                    target=safe_url(urljoin(url,href),source['url'])
                    if canonical(target) not in seen|queued:pending.append({'url':target,'mode':'index'});queued.add(canonical(target))
            seen.add(canonical(url))
        except Exception as exc:
            pending.insert(0,entry);error=type(exc).__name__+': '+str(exc)[:240];break
    state={'source_id':'registry-'+str(source['id']),'status':'Pogreška' if error else 'Djelomično' if pending or failed else 'Uspješno','checked_at':stamp,'pending':pending,'cycle_seen':sorted(seen),'pages_processed':pages,'imported_count':len(rows),'failed_urls':failed,'error':error,'coverage_complete':False,'scope':'Shared primary JSON-LD connector; discovered pages only'}
    if error:state['retry_after']=(datetime.fromisoformat(stamp)+timedelta(days=1)).isoformat()
    return rows,state

def main():
    from registry_discovery import api,Fetcher,Page,objects,safe_url
    from source_batches import classify
    config=api({'action':'registry'});path=Path('data/property_imports.json');previous=json.loads(path.read_text()) if path.exists() else {}
    now=datetime.now(timezone.utc);stamp=now.isoformat();prior={x['id']:x for x in previous.get('results',[])};results=[];selected=[];deadline=time.monotonic()+240
    for s in config.get('diagnostic_sources',[]):
        s=dict(s,body_json=config.get('states',{}).get('registry-'+str(s['id']),{}))
        if classify(s)['group']!='structured_property_adapter':continue
        old=prior.get(s['id'],{});retry=old.get('retry_after') or s['body_json'].get('retry_after')
        if retry and datetime.fromisoformat(retry)>now:results.append(dict(id=s['id'],source_id='registry-'+str(s['id']),status='cooldown',retry_after=retry));continue
        # Acquisition profiles are not property catalogues, even if old categories are wrong.
        if re.search(r'acquisition.profile|purchase.profile',s['url'],re.I):results.append(dict(id=s['id'],source_id='registry-'+str(s['id']),status='buyer_profile_not_property_catalogue'));continue
        selected.append(s)
    hosts={}
    for s in selected:hosts.setdefault(urlsplit(s['url']).hostname,[]).append(s)
    def host_batch(rows):return [run_source(s,api,Fetcher,Page,objects,safe_url,stamp,deadline) for s in rows]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for batch in pool.map(host_batch,hosts.values()):results.extend(batch)
    report={'checked_at':stamp,'results':sorted(results,key=lambda x:x['id']),'counts':dict(Counter(x['status'] for x in results)),'activation_performed':False,'coverage_complete':False}
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(report,ensure_ascii=False,indent=1)+'\n');temp.replace(path)
    print('PROPERTY_IMPORT_REPORT '+json.dumps(report,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
