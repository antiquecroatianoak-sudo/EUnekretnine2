"""Shared, conservative JSON-LD property connector; no automatic activation."""
import hashlib
import html
import json
import math
import re
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, urlencode,parse_qs
from urllib.error import HTTPError, URLError

EU=set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split())
COUNTRIES={'Austria':'AT','Belgium':'BE','Bulgaria':'BG','Croatia':'HR','Cyprus':'CY','Czech Republic':'CZ','Denmark':'DK','Estonia':'EE','Finland':'FI','France':'FR','Germany':'DE','Greece':'GR','Hungary':'HU','Ireland':'IE','Italy':'IT','Latvia':'LV','Lithuania':'LT','Luxembourg':'LU','Malta':'MT','Netherlands':'NL','Poland':'PL','Portugal':'PT','Romania':'RO','Slovakia':'SK','Slovenia':'SI','Spain':'ES','Sweden':'SE'}
TYPES={'Apartment':'Stan','House':'Kuća','SingleFamilyResidence':'Kuća','Residence':None,'RealEstateListing':None}
SALE=re.compile(r'\b(?:for sale|zu verkaufen|te koop|à vendre|en venta|in vendita|na prodaju|na prodaj|na predaj)\b',re.I)
RENT=re.compile(r'\b(?:for rent|to rent|zu vermieten|te huur|à louer|en alquiler|in affitto|najam|oddaja)\b',re.I)

def timed_out(error):
    if isinstance(error,HTTPError):return False
    return isinstance(error,TimeoutError) or isinstance(error,URLError) and (isinstance(error.reason,TimeoutError) or 'timed out' in str(error.reason).lower())

def retry_pending(state,now):
    value=state.get('retry_after')
    if not value:return False
    try:
        after=datetime.fromisoformat(value)
        if after.tzinfo is None:return True
        if after<=now:return False
    except (TypeError,ValueError):return True
    # Recover only the known old shared-connector timeout policy, after one
    # existing six-hour interval; preserve access, robots and unknown holds.
    legacy=state.get('scope')=='Shared primary JSON-LD connector; discovered pages only' and not state.get('error_kind') and str(state.get('error','')).startswith('TimeoutError:')
    if legacy:
        try:
            checked=datetime.fromisoformat(state.get('checked_at',''))
            if checked.tzinfo is not None and now-checked>=timedelta(hours=6):return False
        except (TypeError,ValueError):pass
    return True

def canonical(u):
    p=urlsplit(u)
    return urlunsplit((p.scheme,p.netloc.lower(),p.path.rstrip('/'),p.query,''))

def types(node):
    v=node.get('@type',[])
    return {v} if isinstance(v,str) else set(v) if isinstance(v,list) and all(isinstance(x,str) for x in v) else set()

def entity(value,nodes,url):
    """Resolve an explicit JSON-LD reference within this response only.

    No network lookup and no fallback to an unrelated page organisation. A
    conflicting definition is evidence to review, not permission to pick one.
    """
    if isinstance(value,str):value={'@id':value}
    if not isinstance(value,dict):return value
    identity=value.get('@id')
    if not isinstance(identity,str) or not identity:return value
    identity=urljoin(url,identity)
    definitions=[]
    for node in nodes:
        if (isinstance(node,dict) and isinstance(node.get('@id'),str)
                and urljoin(url,node['@id'])==identity and set(node)-{'@id'}):
            if node not in definitions:definitions.append(node)
    if len(definitions)>1:raise ValueError('ambiguous_linked_entity')
    if not definitions:
        if set(value)=={'@id'}:raise ValueError('unresolved_linked_entity')
        return value
    if set(value)-{'@id'} and value!=definitions[0]:raise ValueError('ambiguous_linked_entity')
    return definitions[0]

def category_url(url):
    path=urlsplit(url).path
    if re.search(r'/\d{3,}(?:[/-]|$)|[A-Z]{1,3}\d{4,}',path):return False
    return bool(re.search(r'for-sale|/search(?:/|$)|/properties/?$|/properties-title/|/aticos-en-venta\.html$|/venta/[^/]+/[^/]+/[^/]+/?$',path,re.I))

def number(v):
    if isinstance(v,bool):return None
    try:n=float(v)
    except (ValueError,TypeError):return None
    return n if math.isfinite(n) and n>0 else None

def latio_record(source,url,page,stamp):
    """Reviewed primary Riga detail; no images or advertisement text copied."""
    if page is None or not re.fullmatch(r'/en/properties/\d+',urlsplit(url).path):raise ValueError('latio_primary_detail_required')
    if canonical(page.meta.get('og:url',''))!=canonical(url):raise ValueError('latio_canonical_mismatch')
    title=page.meta.get('og:title','').strip()
    if not re.match(r'^For sale (?:house|apartment|land|commercial)',title,re.I) or not re.search(r'\bin Riga\b',title,re.I):raise ValueError('latio_sale_or_reviewed_location_missing')
    text=' '.join(' '.join(page.text).split())
    match=re.search(r'\bID:\s*([A-Z0-9]+)\s+',text)
    if not match:raise ValueError('latio_reference_required')
    body=text[match.start():].split('Full-service real estate company',1)[0]
    header=body.split('Description',1)[0]
    agents=re.findall(r'Send e-mail\s+([^\s@]+@[^\s@]+\.[^\s@]+)\s+(.+?)\s+Real Estate Agent',body,re.I)
    agents=list(dict.fromkeys((email,name.strip()) for email,name in agents))
    if len(agents)!=1:raise ValueError('latio_record_bound_agent_required')
    prices={float(v.replace(' ','')) for v in re.findall(r'Apply for a visit Price\s+([\d ]+)\s*€',body)}
    if len(prices)!=1 or min(prices)<=0:raise ValueError('latio_primary_price_required')
    price=prices.pop();area=re.search(r'\bArea\s+(\d+(?:[.,]\d+)?)\s*m²',header)
    land=re.search(r'\bLand\s+(\d+(?:[.,]\d+)?)\s*m²',header)
    description=html.unescape(re.sub('<[^>]+>',' ',page.meta.get('og:description','')))
    described_land=re.findall(r'Land plot\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*m²',description,re.I)
    facts={'transaction_type':'sale','reference':match[1],'currency':'EUR','asking_price':price,'advertised_price':price,'advertised_location':{'addressLocality':'Riga','addressCountry':'LV'},'country_basis':'Primary listing explicitly says in Riga; reviewed Riga, Latvia','availability':'Prodajni oglas opažen; dostupnost i pravna urednost nisu potvrđene','source_contact':{'mode':'agency','name':agents[0][1],'agency_name':'Latio','email':agents[0][0],'evidence_url':url,'record_reference':url,'represents_record':True,'permitted':False},'reuse_constraint':'Latio prohibits republication without written permission; internal factual record only, no copied advertisement description or images.'}
    facts['evidence_excerpt']='Primary sale detail; reference '+match[1]+'; Riga; price '+str(price)+' EUR; named Latio agent.'
    facts['property_type']='Kuća' if re.match('For sale house',title,re.I) else 'Stan' if re.match('For sale apartment',title,re.I) else 'Zemljište' if re.match('For sale land',title,re.I) else 'Poslovni prostor'
    if area:facts['advertised_area']={'value':float(area[1].replace(',','.')),'unitCode':'MTK'}
    described_building=[float(v.replace(',','.')) for v in re.findall(r'Total building area\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*m²',description,re.I)]
    if area and any(abs(v-facts['advertised_area']['value'])>0.01 for v in described_building):
        facts['area_conflict']={'table_building_m2':facts['advertised_area']['value'],'description_building_m2':described_building}
        facts['advertised_area']=None
    if land:
        amount=float(land[1].replace(',','.'))
        values=[float(v.replace(',','.')) for v in described_land]
        if any(abs(v-amount)>0.01 for v in values):facts.setdefault('area_conflict',{}).update(table_land_m2=amount,description_land_m2=values)
        else:facts['land_area_m2']=amount
    return {'id':'registry:property:'+hashlib.sha256(canonical(url).encode()).hexdigest()[:32],'source_id':'registry-'+str(source['id']),'kind':'property','title':title[:240],'country':'LV','url':canonical(url),'first_seen':stamp,'last_seen':stamp,'verified':False,'status':'Za provjeru','facts':facts}

def bulgarian_record(source,url,page,stamp):
    """Reviewed single-price English sale detail; never a development price range."""
    reference=re.fullmatch(r'/[^/]+/AD(\d+)BG_[^/]+\.html',urlsplit(url).path)
    if not reference or page is None:raise ValueError('bulgarian_primary_detail_required')
    if canonical(page.meta.get('og:url',''))!=canonical(url):raise ValueError('bulgarian_canonical_mismatch')
    heading=' '.join(' '.join(page.title).split())
    location=re.match(r'^(House|Villa|Studio|(?:\d-bedroom )?apartment|Land|Regulated plot) for sale in ([^,]{2,80}), Bulgaria\.',heading,re.I)
    if not location:raise ValueError('bulgarian_single_sale_and_country_required')
    title=page.meta.get('og:title','').strip()
    if len(title)<8:raise ValueError('bulgarian_primary_title_required')
    text=' '.join(' '.join(page.text).split())
    # The primary enquiry card precedes the related-property cards. Require a
    # single EUR amount and explicit Area label; ranges/from prices fail closed.
    prices=list(re.finditer(r'REQUEST DETAILS\s+€\s*([\d ]+)\s*(\([^)]*\))?\s*Area:\s*(\d+(?:[.,]\d+)?)\s*m\s*[²2]',text))
    values={(number(m[1].replace(' ','')),number(m[3].replace(',','.')),m[2] or '') for m in prices}
    if len(values)!=1 or any(v[0] is None or v[1] is None for v in values):raise ValueError('bulgarian_single_primary_price_required')
    price,area,note=values.pop()
    contacts=list(re.finditer(r'Property ref:\s*([A-Za-z0-9 -]*\b'+reference[1]+r')\s+When calling, please quote the property reference number\.\s*(\+\d[\d ()-]{6,30})',text))
    if len(contacts)!=1:raise ValueError('bulgarian_reference_bound_contact_required')
    ref=contacts[0][1].strip();phone=contacts[0][2].strip()
    if len(re.sub(r'\D','',phone))<7:raise ValueError('bulgarian_reference_bound_contact_required')
    kind=location[1].casefold()
    mapped='Kuća' if kind in ('house','villa') else 'Zemljište' if kind in ('land','regulated plot') else 'Stan'
    facts={'transaction_type':'sale','reference':ref,'property_type':mapped,'currency':'EUR','asking_price':price,'advertised_price':price,
           'advertised_area':{'value':area,'unitCode':'MTK'},
           'advertised_location':{'addressLocality':location[2],'addressCountry':'BG'},
           'country_basis':'Primary HTML title explicitly names Bulgaria and property locality',
           'price_basis':'Advertised net asking price; VAT additional' if 'without VAT' in note else 'asking_price',
           'price_note':note,'source_contact':{'mode':'agency','name':'Bulgarian Properties','agency_name':'Bulgarian Properties','phone':phone,'record_reference':url,'evidence_url':url,'represents_record':True,'permitted':False},
           'evidence_excerpt':'Primary single-price sale '+ref+'; '+location[2]+'; '+str(price)+' EUR; reference-bound agency phone.',
           'availability':'Prodajni oglas opažen; aktualnost i pravna urednost nisu potvrđene.'}
    described=[float(v.replace(',','.')) for v in re.findall(r'house with an area of\s*[\u200b\u200c\u200d\s]*(\d+(?:[.,]\d+)?)\s*sq\.m',text,re.I)]
    if any(abs(v-area)>0.01 for v in described):
        facts['area_conflict']={'primary_card_m2':area,'description_building_m2':described}
        facts.pop('advertised_area')
    url=canonical(url)
    return {'id':'registry:property:'+hashlib.sha256(url.encode()).hexdigest()[:32],'source_id':'registry-'+str(source['id']),'kind':'property','title':title[:240],'country':'BG','url':url,'first_seen':stamp,'last_seen':stamp,'verified':False,'status':'Za provjeru','facts':facts}

def ober_record(source,url,page,stamp):
    if page is None or not re.search(r'-pardavimas-[^/]+,\d+$',urlsplit(url).path):raise ValueError('ober_sale_detail_required')
    if canonical(page.meta.get('og:url',''))!=canonical(url):raise ValueError('ober_canonical_mismatch')
    title=page.meta.get('og:title','')
    kind=re.match(r'^(Parduodamas butas|Parduodamas namas|Parduodamos patalpos|Parduodamas sklypas):',title)
    cities={'Kauno m. sav.':'Kaunas','Vilniaus m. sav.':'Vilnius','Klaipėdos m. sav.':'Klaipėda','Šiaulių m. sav.':'Šiauliai','Panevėžio m. sav.':'Panevėžys'}
    city=next((v for k,v in cities.items() if k in title),None)
    if not kind or not city:raise ValueError('ober_sale_or_reviewed_country_missing')
    text=' '.join(' '.join(page.text).split())
    if 'Atgal į paiešką' not in text:raise ValueError('ober_primary_body_required')
    body=text.split('Atgal į paiešką',1)[1].split('Panašūs objektai',1)[0]
    prices={float(re.sub(r'\s','',v)) for v in re.findall(re.escape(kind[1])+r'\s+([\d\s]+)\s*€',body)}
    if len(prices)!=1 or min(prices)<=0:raise ValueError('ober_primary_price_required')
    names=list(dict.fromkeys(label.strip() for href,label in page.links if '/darbuotoju-kontaktai/' in href and label.strip() and label.strip() in body))
    emails=list(dict.fromkeys(re.findall(r'\b[^\s@<>]+@ober-haus\.lt\b',body)))
    if len(names)!=1 or len(emails)!=1:raise ValueError('ober_primary_agent_required')
    reference=re.search(r'Nuoroda\s+https://www\.ober-haus\.lt/(OH\d+)',body)
    area=re.search(r'Visas plotas\s+(\d+(?:[.,]\d+)?)\s*m²',body)
    if not reference:raise ValueError('ober_reference_required')
    price=prices.pop()
    facts={'transaction_type':'sale','reference':reference[1],'currency':'EUR','asking_price':price,'advertised_price':price,'property_type':{'Parduodamas butas':'Stan','Parduodamas namas':'Kuća','Parduodamos patalpos':'Poslovni prostor','Parduodamas sklypas':'Zemljište'}[kind[1]],'advertised_location':{'addressLocality':city,'addressCountry':'LT'},'country_basis':'Primary property title names a reviewed Lithuanian city municipality','source_contact':{'mode':'agency','name':names[0],'agency_name':'Ober-Haus','email':emails[0],'record_reference':url,'evidence_url':url,'represents_record':True,'permitted':False},'evidence_excerpt':'Primary sale record '+reference[1]+'; '+city+'; '+str(price)+' EUR; named Ober-Haus agent.','availability':'Prodajni oglas opažen; dostupnost i pravna urednost nisu potvrđene.'}
    if area:
        amount=float(area[1].replace(',','.'));described=[float(v.replace(',','.')) for v in re.findall(r'\bPlotas\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*kv\.\s*m',body)]
        if any(abs(v-amount)>0.01 for v in described):facts['area_conflict']={'table_building_m2':amount,'description_building_m2':described}
        else:facts['advertised_area']={'value':amount,'unitCode':'MTK'}
    url=canonical(url)
    return {'id':'registry:property:'+hashlib.sha256(url.encode()).hexdigest()[:32],'source_id':'registry-'+str(source['id']),'kind':'property','title':title[:240],'country':'LT','url':url,'first_seen':stamp,'last_seen':stamp,'verified':False,'status':'Za provjeru','facts':facts}

def catalogue_page(source,url,fetcher,Page):
    """Public catalogue JSON used by Ober-Haus's own published frontend."""
    if urlsplit(source['url']).hostname=='www.ober-haus.lt' and (canonical(url)==canonical(source['url']) or urlsplit(url).path=='/api/object.php'):
        page=int(parse_qs(urlsplit(url).query).get('page',['1'])[0])
        if page<1 or page>100000:raise ValueError('Invalid public catalogue page')
        base='https://www.ober-haus.lt/api/object.php?'
        params={'type':'Apartment for sale','sorting':'newest','page':page,'use_pagination':1}
        data=json.loads(fetcher.get(base+urlencode(params)))
        rows=data.get('objects');total=data.get('totalObjects')
        if not isinstance(rows,list) or not isinstance(total,int) or total<0:raise ValueError('Ober public catalogue format changed')
        chunks=[]
        for row in rows:
            if not isinstance(row,dict) or not str(row.get('id','')).isdigit() or not isinstance(row.get('html'),str):raise ValueError('Ober public card format changed')
            chunks.append(row['html'])
        pagination=data.get('pagination','')
        if not isinstance(pagination,str):raise ValueError('Ober pagination format changed')
        if re.search(r'data-page=[\"\x27]'+str(page+1)+r'[\"\x27]',pagination):
            params['page']=page+1;chunks.append('<link rel="next" href="'+html.escape(base+urlencode(params),quote=True)+'">')
        if not rows and total>0:raise ValueError('Ober returned empty page with nonempty catalogue')
        return Page(''.join(chunks))
    return Page(fetcher.get(url))

def primary_record(source,url,nodes,stamp,page=None):
    if urlsplit(url).hostname=='latio.lv':return latio_record(source,url,page,stamp)
    if urlsplit(url).hostname=='www.ober-haus.lt':return ober_record(source,url,page,stamp)
    if urlsplit(url).hostname=='www.bulgarianproperties.com':return bulgarian_record(source,url,page,stamp)
    matching=[n for n in nodes if types(n)&TYPES.keys() and isinstance(n.get('url'),str) and canonical(urljoin(url,n['url']))==canonical(url)]
    if len(matching)!=1:raise ValueError('primary_identity_missing_or_ambiguous')
    n=matching[0];title=n.get('name');description=n.get('description','')
    if not isinstance(title,str) or len(title.strip())<8:raise ValueError('primary_title_missing')
    offers=n.get('offers');offers=offers if isinstance(offers,list) else [offers]
    if len(offers)!=1 or not isinstance(offers[0],dict):raise ValueError('single_offer_required')
    offer=entity(offers[0],nodes,url)
    item=entity(offer.get('itemOffered') or n.get('mainEntity') or n,nodes,url)
    if not isinstance(item,dict):raise ValueError('property_object_required')
    if item is not n and not types(item)&TYPES.keys():raise ValueError('property_type_required')
    words=title+' '+(description if isinstance(description,str) else '')
    explicit='OfferForPurchase' in types(offer) or str(offer.get('businessFunction','')).rsplit('/',1)[-1]=='Sell' or bool(SALE.search(words))
    if not explicit or RENT.search(words):raise ValueError('unambiguous_sale_required')
    address=entity(item.get('address') or n.get('address'),nodes,url)
    if not isinstance(address,dict):raise ValueError('property_address_country_required')
    country=address.get('addressCountry')
    if isinstance(country,dict):country=country.get('identifier') or country.get('name')
    country=COUNTRIES.get(country,country)
    if country not in EU:raise ValueError('explicit_eu_property_country_required')
    seller=entity(offer.get('seller') or offer.get('offeredBy') or n.get('provider'),nodes,url)
    if not isinstance(seller,dict) or not isinstance(seller.get('name'),str) or not seller['name'].strip():raise ValueError('record_bound_seller_required')
    point=seller.get('contactPoint') or seller
    if isinstance(point,list):point=point[0] if len(point)==1 else {}
    point=entity(point,nodes,url)
    if not isinstance(point,dict):raise ValueError('record_bound_contact_required')
    email=point.get('email') or seller.get('email');phone=point.get('telephone') or seller.get('telephone')
    email=email if isinstance(email,str) and re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) else None
    phone=phone if isinstance(phone,str) and re.fullmatch(r'\+?[0-9 ()/.-]{7,30}',phone) and len(re.sub(r'\D','',phone))>=7 else None
    if not email and not phone:raise ValueError('record_bound_contact_required')
    raw_price=offer.get('price');currency=offer.get('priceCurrency');price=number(raw_price)
    if raw_price is not None and price is None:raise ValueError('invalid_price')
    if price is not None and (not isinstance(currency,str) or not re.fullmatch('[A-Z]{3}',currency)):raise ValueError('price_currency_required')
    facts={'transaction_type':'sale','evidence_excerpt':words[:1600],'advertised_location':address,'country_basis':'Primary property addressCountry','asking_price':price if currency=='EUR' else None,'advertised_price':price,'currency':currency,'contact_evidence_url':url,'agency_evidence_url':url,'source_contact':{'name':seller['name'],'email':email,'phone':phone,'evidence_url':url,'record_reference':url,'permitted':False},'availability':'Izvorni oglas opažen; aktualna dostupnost i pravna urednost nisu potvrđene.'}
    facts['source_contact']['represents_record']=True
    if 'RealEstateAgent' in types(seller):
        facts['source_contact'].update(mode='agency',agency_name=seller['name'])
        facts['agency_name']=seller['name']
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
            # Breadcrumb ListItems identify navigation, not catalogue records.
            if 'ItemList' in types(n):
                entries=n.get('itemListElement',[])
                if not isinstance(entries,list):continue
                for entry in entries:
                    if not isinstance(entry,dict):continue
                    item=entry.get('item')
                    target=entry.get('url') or (item.get('url') if isinstance(item,dict) else item)
                    if isinstance(target,str):candidates.insert(0,(target,'structured listing'))
            elif types(n)&TYPES.keys() and isinstance(n.get('url'),str):
                candidates.insert(0,(n['url'],'structured listing'))
    found=[]
    for href,label in candidates:
        if not isinstance(href,str) or not (label=='structured listing' or SALE.search(label+' '+href.replace('-',' ')) or '-pardavimas-' in href or re.search(r'/(?:property|properties|immobilien|immobile|nemovitost|nepremicnin[ae]|expose|listing|objekt|offer|detail)[/-]',href,re.I)):continue
        try:target=safe_url(urljoin(url,href),root)
        except (ValueError,OSError):continue
        path=urlsplit(target).path
        if (re.search(r'/(?:services?|news|research|about-us|careers?|vacancies|privacy|contact)(?:/|$)',path,re.I)
                or re.search(r'property-management|facility-management|required-documents|stegastiko-daneio|times-akiniton',path,re.I)
                or re.search(r'(?:^|[/-])(?:rent|rental|oddaja)(?:[/-]|$)',path,re.I)
                or RENT.search(label+' '+href.replace('-',' '))):continue
        if canonical(target)!=canonical(root) and target not in found:found.append(target)
    # Individual numeric references outrank category/search/navigation pages.
    def priority(u):
        p=urlsplit(u).path
        category=category_url(u) or bool(re.search(r'/(?:search|property-types|properties-title)(?:/|$)',p,re.I))
        detail=bool(re.search(r'(?:/\d{3,}(?:[/-]|$)|[A-Z]{1,3}\d{4,}|[-_]\d{4,}(?:[./-]|$)|,\d{4,}$)',p))
        return (category,not detail)
    return sorted(found,key=priority)[:200]

def run_source(source,api,Fetcher,Page,objects,safe_url,stamp,deadline=float('inf')):
    result={'source_id':'registry-'+str(source['id']),'id':source['id'],'name':source['name'],'url':source['url'],'checked_at':stamp,'inserted':0,'updated':0,'rejections':[]}
    try:
        if time.monotonic()>=deadline:result['status']='runtime_deferred';return result
        if urlsplit(source['url']).hostname=='www.immobilier.notaires.fr':
            from registry_discovery import process
            rows,state=process(source,None,Fetcher(source['url']),deadline,max_pages=1)
            if state.get('error'):raise ValueError(state['error'])
            for row in rows:
                saved=api({'action':'batch','source_id':result['source_id'],'candidates':[row]})
                if saved.get('candidates')!=1 or saved.get('inserted',0)+saved.get('updated',0)!=1:raise RuntimeError('write_not_confirmed')
                result['inserted']+=saved.get('inserted',0);result['updated']+=saved.get('updated',0)
            result.update(status='batch_confirmed' if rows else 'no_current_auction_records',adapter='existing_notaires_public_api',pages_processed=state['pages_processed'])
            return result
        f=Fetcher(source['url']);page=catalogue_page(source,source['url'],f,Page)
        # Some registry sources already point to one primary sale detail.
        # Try its evidence before following related cards or navigation links.
        nodes=[n for script in page.scripts for n in objects(script)]
        try:root_row=primary_record(source,source['url'],nodes,stamp,page)
        except ValueError:root_row=None
        if root_row is not None:
            saved=api({'action':'batch','source_id':result['source_id'],'candidates':[root_row]})
            if saved.get('candidates')!=1 or saved.get('inserted',0)+saved.get('updated',0)!=1:raise RuntimeError('write_not_confirmed')
            result.update(inserted=saved.get('inserted',0),updated=saved.get('updated',0),status='batch_confirmed',pages_processed=1)
            result.update(confirm_normal_refresh(source,f,api,safe_url,deadline))
            return result
        urls=links(page,source['url'],objects,safe_url,source['url'])[:2]
        if not urls:result.update(status='no_structured_detail_links');return result
        queue=[(url,1) for url in urls];seen={canonical(source['url'])};pages=0
        while queue and pages<6:
            url,depth=queue.pop(0)
            if canonical(url) in seen:continue
            if time.monotonic()>=deadline:result['rejections'].append({'url':url,'reason':'runtime_deferred'});break
            seen.add(canonical(url))
            try:
                p=Page(f.get(url));pages+=1;nodes=[n for script in p.scripts for n in objects(script)]
                if category_url(url) and depth<2:
                    try:row=primary_record(source,url,nodes,stamp,p)
                    except ValueError:
                        children=[u for u in links(p,url,objects,safe_url,source['url']) if canonical(u) not in seen]
                        queue.extend((u,depth+1) for u in children[:2]);continue
                else:row=primary_record(source,url,nodes,stamp,p)
                saved=api({'action':'batch','source_id':result['source_id'],'candidates':[row]})
                if saved.get('candidates')!=1 or saved.get('inserted',0)+saved.get('updated',0)!=1:raise RuntimeError('write_not_confirmed')
                result['inserted']+=saved.get('inserted',0);result['updated']+=saved.get('updated',0)
            except ValueError as e:result['rejections'].append({'url':url,'reason':str(e)[:240]})
        result['pages_processed']=pages
        result['status']='batch_confirmed' if result['inserted']+result['updated'] else 'format_or_evidence_required'
        if result['status']=='batch_confirmed':
            result.update(confirm_normal_refresh(source,f,api,safe_url,deadline))
    except Exception as e:
        result.update(status='failed',error=type(e).__name__+': '+str(e)[:240])
        if not timed_out(e):result['retry_after']=(datetime.fromisoformat(stamp)+timedelta(days=1)).isoformat()
    return result

def confirm_normal_refresh(source,fetcher,api,url_validator,deadline):
    """Require a fresh normal-path batch before this trial can support activation."""
    rows,state=collect(source,None,fetcher,deadline,max_pages=3,url_validator=url_validator)
    if state.get('error') or not rows:
        raise RuntimeError('Normal shared refresh did not confirm records: '+str(state.get('error')))
    inserted=updated=0
    for row in rows:
        saved=api({'action':'batch','source_id':'registry-'+str(source['id']),'candidates':[row]})
        if saved.get('candidates')!=1 or saved.get('inserted',0)+saved.get('updated',0)!=1:
            raise RuntimeError('Normal shared refresh write not confirmed')
        inserted+=saved.get('inserted',0);updated+=saved.get('updated',0)
    return {'normal_refresh_confirmed':True,'refresh_inserted':inserted,'refresh_updated':updated,
            'refresh_pages':state['pages_processed'],'coverage_complete':False}

def collect(source,previous,fetcher,deadline,max_pages=25,url_validator=None):
    """Normal registry path only after the source's sample has been reviewed."""
    from registry_discovery import Page,objects,safe_url
    safe_url=url_validator or safe_url
    stamp=datetime.now(timezone.utc).isoformat();previous=previous or {}
    pending=list(previous.get('pending') or [{'url':source['url'],'mode':'index'}])
    seen=set(previous.get('cycle_seen',[])) if previous.get('pending') else set()
    # Recheck known records even while a catalogue still has a pagination backlog.
    # Only explicitly unavailable URLs are reported as removed; absence from an
    # incomplete catalogue never proves removal.
    for revisit in reversed(source.get('recheck_urls',[])[:10]):
        revisit=safe_url(revisit,source['url'])
        key=canonical(revisit)
        seen.discard(key)
        pending=[entry for entry in pending if canonical(entry['url'])!=key]
        pending.insert(0,{'url':revisit,'mode':'detail'})
    rows=[];failed=[];unavailable=[];pages=0;details=0;error=None;timeout=False
    while pending and pages<max_pages and time.monotonic()<deadline:
        entry=pending.pop(0);url=entry['url']
        if canonical(url) in seen:continue
        try:
            url=safe_url(url,source['url']);pages+=1
            page=catalogue_page(source,url,fetcher,Page)
            nodes=[n for script in page.scripts for n in objects(script)]
            if entry['mode']=='detail':
                details+=1
                try:rows.append(primary_record(source,url,nodes,stamp,page))
                except ValueError as exc:failed.append({'url':url,'mode':'detail','checked_at':stamp,'reason':str(exc)})
            else:
                try:
                    rows.append(primary_record(source,url,nodes,stamp,page))
                    seen.add(canonical(url));continue
                except ValueError:pass
                queued={canonical(x['url']) for x in pending}
                for target in links(page,url,objects,safe_url,source['url']):
                    if canonical(target) not in seen|queued:
                        pending.append({'url':target,'mode':'index' if category_url(target) else 'detail'});queued.add(canonical(target))
                for href in page.next:
                    target=safe_url(urljoin(url,href),source['url'])
                    if canonical(target) not in seen|queued:pending.append({'url':target,'mode':'index'});queued.add(canonical(target))
            seen.add(canonical(url))
        except HTTPError as exc:
            if exc.code in (404,410) and entry['mode']=='detail':
                unavailable.append({'url':url,'http_status':exc.code,'checked_at':stamp})
                seen.add(canonical(url));continue
            pending.insert(0,entry);error=type(exc).__name__+': '+str(exc)[:240];break
        except Exception as exc:
            pending.insert(0,entry);error=type(exc).__name__+': '+str(exc)[:240];timeout=timed_out(exc);break
    state={'source_id':'registry-'+str(source['id']),'status':'Pogreška' if error else 'Djelomično' if pending or failed else 'Uspješno','checked_at':stamp,'pending':pending,'cycle_seen':sorted(seen),'pages_processed':pages,'detail_pages':details,'imported_count':len(rows),'failed_urls':failed,'unavailable_urls':unavailable,'error':error,'coverage_complete':False,'partial':bool(error or pending or failed),'next_url':pending[0]['url'] if pending else None,'stop_reason':'error' if error else 'runtime_or_page_budget' if pending else 'discovered_queue_empty','scope':'Shared primary JSON-LD connector; discovered pages only'}
    if timeout:state['error_kind']='timeout'
    elif error:state['retry_after']=(datetime.fromisoformat(stamp)+timedelta(days=1)).isoformat()
    return rows,state

def main():
    from registry_discovery import api,Fetcher,Page,objects,safe_url
    from source_batches import classify
    config=api({'action':'registry'});path=Path('data/property_imports.json');previous=json.loads(path.read_text()) if path.exists() else {}
    now=datetime.now(timezone.utc);stamp=now.isoformat();prior={x['id']:x for x in previous.get('results',[])};results=[];selected=[];deadline=time.monotonic()+240
    for s in config.get('diagnostic_sources',[]):
        s=dict(s,body_json=config.get('states',{}).get('registry-'+str(s['id']),{}))
        if classify(s)['group']!='structured_property_adapter' and urlsplit(s['url']).hostname!='www.immobilier.notaires.fr':continue
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



