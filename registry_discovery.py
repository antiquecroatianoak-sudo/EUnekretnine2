"""Resumable registry import. No API keys; GitHub OIDC authenticates database writes."""
import hashlib
import http.client
import ipaddress
import json
import re
import socket
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler, HTTPSHandler
from urllib.error import HTTPError
from urllib.robotparser import RobotFileParser
from sync_discovery import request_token, call as legacy_call

ENDPOINT='https://izpzsfiqvransehvmuzn.supabase.co/functions/v1/registry-discovery'
AGENT='EUPropertyResearch/0.2'
SALE=re.compile(r'prodaja|prodaju|nakup|for-sale|for_sale|sale|verkauf|kaufen|koop|vente|vendre|vendita|vendesi|venta|comprar|imoveis|prodej|predaj|elado|vanzare|prodava|parduo|myyt|sprzedaz|mieszkania|müü|muua|til-salg|till-salu|πωλη|продава|продаж',re.I)
RENT=re.compile(r'najam|iznajm|oddaja|for-rent|to-rent|rentals|mieten|vermiet|location/|affitto|alquiler|arrendar|pronajem|prenajom',re.I)
DETAIL={
 'njuskalo.hr':r'-oglas-\d+', 'nepremicnine.net':r'/oglasi-(?:prodaja|nakup)/.+_\d+',
 'immobiliare.it':r'/annunci/\d+', 'idealista.com':r'/inmueble/\d+', 'idealista.pt':r'/imovel/\d+',
 'pap.fr':r'/annonces/.+-r\d+', 'aruodas.lt':r'-\d+-\d+/?$', 'funda.nl':r'/detail/koop/',
 'immoweb.be':r'/classified/.+/for-sale/', 'willhaben.at':r'/iad/immobilien/d/',
 'immobilienscout24.de':r'/expose/\d+', 'otodom.pl':r'/pl/oferta/', 'sreality.cz':r'/detail/prodej/',
 'nehnutelnosti.sk':r'/detail/', 'ingatlan.com':r'/\d{6,}/?$', 'imobiliare.ro':r'/oferta/',
 'imot.bg':r'/obiava-', 'spitogatos.gr':r'/property/', 'bazaraki.com':r'/adv/\d+',
 'propertymarket.com.mt':r'/view/', 'daft.ie':r'/(?:for-sale|commercial-property-for-sale|new-home-for-sale)/',
 'athome.lu':r'/vente/.+\d+', 'immotop.lu':r'/annonces/\d+', 'boligsiden.dk':r'/adresse/',
 'hemnet.se':r'/bostad/', 'etuovi.com':r'/kohde/', 'kv.ee':r'-\d{6,}',
 'city24.lv':r'/real-estate/.+\d+', 'nieruchomosci-online.pl':r'/[^/]+/\d+\.html',
 'xe.gr':r'/property/d/poliseis-',
 'openbareverkoop.nl':r'^/kavel/\d+/',
 'evarzytynes.lt':r'^/evs/pages/auction\.do$',
}

# Scope rules are separate from property price/type filters. They prevent crawling
# unrelated classifieds, editorial articles, agent directories and rental pages.
SCOPES={
 'openbareverkoop.nl':r'^/(?:kavel/\d+/|kavels(?:/|$))',
 'evarzytynes.lt':r'^/evs/pages/auctions?\.do$',
 'willhaben.at':r'^/iad/immobilien(?:/|$)',
 'otodom.pl':r'^/pl/(?:wyniki/sprzedaz/|oferta/)',
 'immoweb.be':r'^/(?:en|fr|nl)/(?:classified/|search/)',
 'athome.lu':r'^/(?:vente|annonces-immobilieres)(?:/|$)',
 'funda.nl':r'^/(?:en/)?(?:zoeken/koop|detail/koop)',
 'daft.ie':r'^/(?:property-for-sale|commercial-properties-for-sale|for-sale|commercial-property-for-sale|new-home-for-sale|new-homes-for-sale)(?:/|$)',
 'nepremicnine.net':r'^/oglasi-(?:prodaja|nakup)/',
}
LARGE_BATCH_HOSTS={'immoweb.be','athome.lu','propertymarket.com.mt','imot.bg'}

class InterimResponse(http.client.HTTPResponse):
    """Consume informational headers before reading the final HTTP response."""
    def _read_status(self):
        for _ in range(10):
            version,status,reason=super()._read_status()
            if status not in (102,103):return version,status,reason
            # parse_headers has the standard library's line/count limits.
            http.client.parse_headers(self.fp)
        raise http.client.HTTPException('Too many informational responses')

class InterimHTTPSConnection(http.client.HTTPSConnection):
    response_class=InterimResponse

class InterimHTTPSHandler(HTTPSHandler):
    def https_open(self,req):
        return self.do_open(InterimHTTPSConnection,req,context=self._context)

def failure_type(error):
    if isinstance(error,HTTPError) and error.code in (401,403):return 'access_blocked'
    if isinstance(error,HTTPError) and error.code==429:return 'rate_limited'
    message=str(error).lower()
    if 'robots.txt' in message:return 'robots_disallowed'
    if 'access challenge' in message:return 'access_blocked'
    if 'cross-source' in message:return 'redirect_outside_source'
    if 'no supported listing' in message:return 'adapter_required'
    return 'fetch_failed'

def in_scope(url,root,config=None):
    p=urlsplit(url);base=urlsplit(root)
    if canonical(url)==canonical(root):return True
    prefixes=(config or {}).get('index_path_prefixes',[])+(config or {}).get('detail_path_prefixes',[])
    if prefixes:return any(p.path.startswith(prefix) for prefix in prefixes)
    rule=SCOPES.get(hostkey(base.hostname))
    return not rule or bool(re.search(rule,p.path))

def canonical(url):
    p=urlsplit(url)
    path=p.path.rstrip('/') if hostkey(p.hostname or '')=='propertymarket.com.mt' and p.path.startswith('/view/') else p.path
    return urlunsplit((p.scheme,p.netloc.lower(),path,urlencode([(k,v) for k,v in parse_qsl(p.query,keep_blank_values=True) if not k.lower().startswith(('utm_','fbclid','gclid'))]),''))

def hostkey(host):
    return host.removeprefix('www.').removeprefix('en.')

def safe_url(url,root):
    p=urlsplit(url); base=urlsplit(root)
    if p.scheme!='https' or p.username or p.password or p.port not in (None,443) or not p.hostname:
        raise ValueError('Only public HTTPS URLs are supported')
    if hostkey(p.hostname)!=hostkey(base.hostname):
        # Listing subdomains are used by the Polish and Bulgarian portals.
        domain=hostkey(base.hostname)
        if domain not in ('nieruchomosci-online.pl','imot.bg') or not p.hostname.endswith('.'+domain):
            raise ValueError('Cross-source URL rejected')
    for item in socket.getaddrinfo(p.hostname,443,type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(item[4][0]).is_global: raise ValueError('Non-public destination rejected')
    return canonical(url)

class Page(HTMLParser):
    def __init__(self,content):
        super().__init__(convert_charrefs=True)
        self.links=[]; self.next=[]; self.meta={}; self.scripts=[]; self.text=[]
        self.anchor=None; self.ld=None; self.ignore=0; self.heading=None; self.title=[]
        self.feed(content)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='a': self.anchor=[a.get('href',''),[],a.get('rel','')]
        if tag in ('title','h1'):self.heading=tag
        if tag=='link' and 'next' in a.get('rel','').split(): self.next.append(a.get('href',''))
        if tag=='meta': self.meta[a.get('property',a.get('name',''))]=a.get('content','')
        if tag=='script':
            self.ignore+=1
            if a.get('type','').lower()=='application/ld+json': self.ld=[]
        if tag=='style': self.ignore+=1
    def handle_data(self,data):
        if self.ld is not None: self.ld.append(data)
        if not self.ignore:
            self.text.append(data)
            if self.heading:self.title.append(data)
            if self.anchor is not None: self.anchor[1].append(data)
    def handle_endtag(self,tag):
        if tag==self.heading:self.heading=None
        if tag=='script' and self.ld is not None:
            try:self.scripts.append(json.loads(''.join(self.ld)))
            except ValueError:pass
            self.ld=None
        if tag in ('script','style'):self.ignore=max(0,self.ignore-1)
        if tag=='a' and self.anchor:
            href,words,rel=self.anchor; self.links.append((href,' '.join(' '.join(words).split())))
            if 'next' in rel.split():self.next.append(href)
            self.anchor=None

class SaleTable(HTMLParser):
    def __init__(self,content):
        super().__init__(convert_charrefs=True);self.rows=[];self.row=None;self.cell=None
        self.feed(content)
    def handle_starttag(self,tag,attrs):
        if tag=='tr':self.row=[]
        if tag in ('td','th') and self.row is not None:self.cell={'text':[],'links':[]}
        if tag=='a' and self.cell is not None:self.cell['links'].append(dict(attrs).get('href',''))
    def handle_data(self,data):
        if self.cell is not None:self.cell['text'].append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None:
            self.cell['text']=' '.join(' '.join(self.cell['text']).split())
            self.row.append(self.cell);self.cell=None
        if tag=='tr' and self.row is not None:
            self.rows.append(self.row);self.row=None

def invimit_rows(source,content,now):
    table=SaleTable(content);records=[];recognized=False
    for cells in table.rows:
        values=[c['text'] for c in cells]
        if values[:1]==['Procedura']:
            recognized=True;continue
        if len(values)<10 or values[0].casefold()!='vendita':continue
        if 'chiuso' in (values[1]+' '+values[2]).casefold():continue
        try:deadline=datetime.strptime(values[2],'%d-%m-%Y %H:%M').replace(tzinfo=ZoneInfo('Europe/Rome'))
        except ValueError:continue
        if deadline<=now:continue
        code,city,address=values[3:6]
        if not code or not city or not address:continue
        # The technical sheet is an individual source URL, whereas the table
        # contains multiple lots. Preserve the table as the live-sale evidence.
        docs=[urljoin(source['url'],u) for u in cells[9]['links']]
        docs=[u for u in docs if urlsplit(u).hostname==urlsplit(source['url']).hostname and urlsplit(u).path.lower().endswith('.pdf')]
        if not docs:continue
        row=listing_record(source,docs[0],Page('<h1>'+code+' '+city+' '+address+'</h1>'),'property',now.isoformat())
        row['title']=(code+' — '+city+', '+address)[:240]
        price=re.fullmatch(r'\s*€\s*([\d.]+(?:,\d+)?)\s*',values[8])
        row['facts'].update(source_listing_url=source['url'],reference=code,advertised_location=address+', '+city,advertised_use=values[6],advertised_area_text=values[7],currency='EUR',asking_price=float(price[1].replace('.','').replace(',','.')) if price else None,deadline=deadline.isoformat(),availability='Rok je u budućnosti prema javnoj tablici; potrebna je potvrda dostupnosti i dokumentacije',evidence_excerpt='; '.join(values[:9]))
        records.append(row)
    if not recognized:raise ValueError('INVIMIT sale-table format changed; no import')
    return records

def objects(value):
    if isinstance(value,dict):
        yield value
        for v in value.values(): yield from objects(v)
    elif isinstance(value,list):
        for v in value:yield from objects(v)

class Fetcher:
    def __init__(self,root):self.root=root;self.robots={};self.last=0;self.minimum_interval=2
    def raw(self,url):
        url=safe_url(url,self.root)
        owner=self
        class Redirect(HTTPRedirectHandler):
            def redirect_request(self,req,fp,code,msg,headers,newurl):
                safe_url(newurl,owner.root)
                return super().redirect_request(req,fp,code,msg,headers,newurl)
        delay=self.minimum_interval-(time.monotonic()-self.last)
        if delay>0:time.sleep(delay)
        self.last=time.monotonic()
        with build_opener(Redirect(),InterimHTTPSHandler()).open(Request(url,headers={'User-Agent':AGENT,'Accept':'text/html,application/xhtml+xml'}),timeout=15) as r:
            safe_url(r.url,self.root)
            data=r.read(4_000_001)
            if len(data)>4_000_000:raise ValueError('Page exceeds transfer budget')
            return data.decode(r.headers.get_content_charset() or 'utf-8',errors='replace')
    def get(self,url):
        p=urlsplit(url); origin=p.scheme+'://'+p.netloc
        if origin not in self.robots:
            try: content=self.raw(origin+'/robots.txt')
            except HTTPError as e:
                if e.code!=404:raise
                content=''
            parser=RobotFileParser();parser.parse(content.splitlines());self.robots[origin]=parser
        if not self.robots[origin].can_fetch(AGENT,url):raise ValueError('robots.txt disallows this URL')
        parser=self.robots[origin]
        delay=parser.crawl_delay(AGENT) or parser.crawl_delay('*') or 0
        rate=parser.request_rate(AGENT) or parser.request_rate('*')
        self.minimum_interval=max(2,delay,rate.seconds/rate.requests if rate else 0)
        return self.raw(url)

def api(body,token=None):
    from urllib.request import urlopen
    req=Request(ENDPOINT,data=json.dumps(body,ensure_ascii=False).encode(),headers={'Authorization':'Bearer '+(token or request_token()),'Content-Type':'application/json'},method='POST')
    with urlopen(req,timeout=90) as r:return json.load(r)

def save_rows(source_id,rows,state,api_call=api):
    # Old persisted queues may contain both /view/id and /view/id/. Keep one
    # canonical row per batch so one duplicate cannot reject 100 good records.
    unique={}
    for row in rows:unique[(row['kind'],canonical(row['url']))]=row
    rows=list(unique.values());inserted=updated=0
    for n in range(0,len(rows),100):
        batch=rows[n:n+100]
        try:
            saved=api_call({'action':'batch','source_id':source_id,'candidates':batch})
            inserted+=saved.get('inserted',0);updated+=saved.get('updated',0)
        except HTTPError as error:
            if error.code!=400:raise
            # Input rejection is isolated; authentication and server errors
            # still stop persistence and leave the prior checkpoint intact.
            for row in batch:
                try:
                    saved=api_call({'action':'batch','source_id':source_id,'candidates':[row]})
                    inserted+=saved.get('inserted',0);updated+=saved.get('updated',0)
                except HTTPError as item_error:
                    if item_error.code!=400:raise
                    detail=item_error.read(2000).decode('utf-8',errors='replace')
                    state.setdefault('failed_urls',[]).append({'url':row['url'],'mode':'buyer' if row['kind']=='buyer' else 'detail','error':'Database rejected candidate: '+detail[:500],'checked_at':state['checked_at']})
                    state.update(status='Djelomično',partial=True,coverage_complete=False)
    state.update(inserted_count=inserted,updated_count=updated)
    return inserted,updated

def buyer_source(source):
    return bool(re.search(r'kupac|kupci|kupaca|investitor|akvizic|kriteriji|potražnja',source.get('category',''),re.I))

def listing_record(source,url,page,kind,now):
    title=(page.meta.get('og:title') or page.meta.get('twitter:title') or ' '.join(page.title)).strip()
    nodes=[v for script in page.scripts for v in objects(script)]
    if source.get('import_config',{}).get('require_structured_listing') and kind=='property':
        if not any(set([n.get('@type')] if isinstance(n.get('@type'),str) else n.get('@type',[])) & {'RealEstateListing','Apartment','House','Residence','SingleFamilyResidence'} for n in nodes):
            raise ValueError('No structured listing title/type; adapter needs review')
    for node in nodes:
        types=node.get('@type',[]);types=[types] if isinstance(types,str) else types
        if any(t in ('RealEstateListing','Apartment','House','Residence','SingleFamilyResidence','Product') for t in types):
            title=title or node.get('name','')
    if not title or len(title)<8:raise ValueError('No reliable listing title; adapter needs review')
    text=' '.join(' '.join(page.text).split())
    facts={'evidence_excerpt':text[:1600],'asking_price':None,'currency':None,'advertised_area':None,'transaction_type':'buy_request' if kind=='buyer' else 'sale','availability':'Potrebna provjera aktualnosti i podataka oglasa'}
    if kind=='buyer':
        facts.update(role='Potencijalni kupac ili zastupnik; identitet i interes zahtijevaju provjeru',budget=None,interest='Javna stranica; nije potvrđen interes za konkretnu nekretninu')
    else:
        for node in nodes:
            node_types=node.get('@type',[])
            if isinstance(node_types,str):node_types=[node_types]
            if not any(t in ('RealEstateListing','Apartment','House','Residence','SingleFamilyResidence','Product','Place') for t in node_types):continue
            offers=node.get('offers')
            if isinstance(offers,dict):
                price=offers.get('price'); currency=offers.get('priceCurrency')
                if isinstance(price,(str,int,float)) and str(price).replace('.','',1).isdigit() and isinstance(currency,str) and re.fullmatch('[A-Z]{3}',currency):
                    facts.update(advertised_price=float(price),asking_price=float(price) if currency=='EUR' else None,currency=currency)
            area=node.get('floorSize')
            if isinstance(area,dict):facts['advertised_area']=area
            address=node.get('address')
            if isinstance(address,(dict,str)) and address:facts['advertised_location']=address
            type_map={'Apartment':'Stan','House':'Kuća','SingleFamilyResidence':'Kuća'}
            for node_type in node_types:
                if node_type in type_map:facts['property_type']=type_map[node_type]
            if isinstance(offers,dict) and str(offers.get('availability','')).rsplit('/',1)[-1] in ('SoldOut','Discontinued'):
                facts['source_listing_state']='removed'
                facts['source_status_evidence']=str(offers['availability'])
    return {'id':'registry:'+kind+':'+hashlib.sha256(url.encode()).hexdigest()[:32],'source_id':'registry-'+str(source['id']),'kind':kind,'title':title[:240],'country':source['country'],'url':url,'first_seen':now,'last_seen':now,'verified':False,'status':'Za provjeru','facts':facts}

def process(source,state,fetcher,deadline,max_pages=25):
    now=datetime.now(timezone.utc).isoformat(); sid='registry-'+str(source['id']);kind='buyer' if buyer_source(source) else 'property'
    previous=state or {}; root=source['url']; config=source.get('import_config') or {}
    if hostkey(urlsplit(root).hostname)=='vetrinaimmobili.invimit.it':
        stamp=datetime.now(timezone.utc)
        try:
            rows=invimit_rows(source,fetcher.get(root),stamp)
            return rows,dict(source_id=sid,status='Uspješno',checked_at=stamp.isoformat(),pending=[],cycle_seen=[root],pages_processed=1,imported_count=len(rows),exhausted=False,coverage_complete=False,scope='Public sale table only',error=None)
        except Exception as error:
            return [],dict(source_id=sid,status='Pogreška',checked_at=stamp.isoformat(),pending=[{'url':root,'mode':'index','sale':True}],cycle_seen=[],pages_processed=0,imported_count=0,exhausted=False,coverage_complete=False,error=type(error).__name__+': '+str(error)[:240],error_kind=failure_type(error))
    pattern=DETAIL.get(hostkey(urlsplit(root).hostname))
    if config.get('detail_path_prefixes'):
        pattern='^(?:'+'|'.join(re.escape(p) for p in config['detail_path_prefixes'])+')'
    pending=[dict(item) for item in previous.get('pending',[]) if in_scope(item['url'],root,config)]
    reset_scope=bool(previous.get('pending')) and not pending
    buyer_index=kind=='buyer' and bool(re.search(r'/oglasi-nakup/',root))
    if not pending:pending=[{'url':u,'mode':'buyer' if kind=='buyer' and not buyer_index else 'index','sale':bool(SALE.search(u)) or config.get('sale_scope') is True or hostkey(urlsplit(root).hostname) in ('openbareverkoop.nl','evarzytynes.lt')} for u in (config.get('entry_urls') or [root])]
    if hostkey(urlsplit(root).hostname) in ('openbareverkoop.nl','evarzytynes.lt'):
        for item in pending:item['sale']=True
    if buyer_index:
        for item in pending:
            if item.get('mode')=='buyer':item['mode']='index'
    pending.sort(key=lambda p:0 if p['mode']=='detail' else 1)
    seen={canonical(u) for u in previous.get('cycle_seen',[])} if previous.get('pending') and not reset_scope else set()
    # Revisit known individual listings as well as discovering new pages.
    queued={p['url'] for p in pending}
    for revisit in reversed(source.get('recheck_urls',[])[:10]):
        if pattern and re.search(pattern,urlsplit(revisit).path) and in_scope(revisit,root,config):
            seen.discard(canonical(revisit))
            if revisit not in queued:
                pending.insert(0,{'url':revisit,'mode':'detail','sale':True});queued.add(revisit)
    records=[]; pages=0; index_pages=0; detail_pages=0; errors=[]; exhausted=False; error_kind=None; skipped_non_sale=0
    failed=list(previous.get('failed_urls',[]));unavailable=[]
    if kind=='property' and not pattern:
        return [],dict(source_id=sid,status='Nepodržano',checked_at=now,pending=pending,cycle_seen=list(seen),pages_processed=0,imported_count=0,exhausted=False,error='No validated detail URL adapter; research automation must supply one')
    while pending and pages<max_pages and time.monotonic()<deadline:
        if index_pages>=5 and not any(p['mode'] in ('detail','buyer') for p in pending):break
        item=pending.pop(0);url=canonical(item['url'])
        if url in seen:continue
        try:
            url=safe_url(url,root);page=Page(fetcher.get(url));pages+=1
            text=' '.join(' '.join(page.text).split())
            if re.search(r'captcha|access denied|verify you are human|just a moment',page.meta.get('og:title','')+' '+text[:400],re.I):raise ValueError('Access challenge; no import')
            if item['mode']=='buyer':
                row=listing_record(source,url,page,kind,now)
                # A registered investor page is a potential profile, never a verified mandate.
                row['facts']['transaction_type']='unconfirmed_acquisition_profile'
                records.append(row)
            elif item['mode']=='detail':
                if hostkey(urlsplit(root).hostname)=='nehnutelnosti.sk':
                    # The home page mixes rentals and sales, and its detail URLs
                    # do not encode the transaction type. Inspect the detail.
                    if not re.search(r'\bna predaj\b',text,re.I):
                        seen.add(url);skipped_non_sale+=1;continue
                host=hostkey(urlsplit(root).hostname)
                extra={}
                if host=='openbareverkoop.nl':
                    if re.search(r'\b(?:motorschip|motorjacht|vaartuig)\b',text,re.I):
                        seen.add(url);skipped_non_sale+=1;continue
                    if not re.search(r'\b(?:woonhuis|appartement|villa|garage|winkel|bedrijfspand|perceel|grond|woning)\b',text,re.I):
                        raise ValueError('No real-estate type on auction detail; adapter needs review')
                    if re.search(r'Status:\s*(?:ingetrokken|verkocht|afgelast)',text,re.I):
                        seen.add(url);skipped_non_sale+=1;continue
                    extra['price_note']='Inzetpremie is an auction premium, not a property asking price; no price inferred.'
                if host=='evarzytynes.lt':
                    asset=re.search(r'Parduodamas turtas:\s*(Žemės sklypas|Gyvenamasis namas|Butas|Pastatas|Patalpos|Negyvenamoji patalpa)',text,re.I)
                    if not asset:
                        seen.add(url);skipped_non_sale+=1;continue
                    closing=re.search(r'Pabaigos data:\s*(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)',text)
                    if closing:
                        end=datetime.strptime(closing[1],'%Y-%m-%d %H:%M:%S').replace(tzinfo=ZoneInfo('Europe/Vilnius'))
                        if end<=datetime.fromisoformat(now):
                            seen.add(url);skipped_non_sale+=1;continue
                        extra['deadline']=end.isoformat()
                    amount=re.search(r'Pradinė pardavimo kaina:\s*([\d\s\u00a0]+(?:,\d+)?)\s*Eur',text)
                    if amount:extra.update(asking_price=float(re.sub(r'\s','',amount[1]).replace(',','.')),currency='EUR',price_basis='Pradinė pardavimo kaina – početna cijena')
                    extra['advertised_property_type']=asset[1]
                row=listing_record(source,url,page,kind,now);row['facts'].update(extra)
                if host=='evarzytynes.lt':
                    row['title']=('Dražba '+dict(parse_qsl(urlsplit(url).query)).get('number','')+' — '+extra['advertised_property_type'])[:240]
                records.append(row);detail_pages+=1
            else:
                index_pages+=1
                queued={x['url'] for x in pending}; links=list(page.links)
                for script in page.scripts:
                    for obj in objects(script):
                        if obj.get('@type')=='ListItem':
                            v=obj.get('url') or obj.get('item');v=v.get('url') if isinstance(v,dict) else v
                            if isinstance(v,str):links.append((v,''))
                details=0
                for href,label in links:
                    try:link=safe_url(urljoin(url,href),root)
                    except (ValueError,OSError):continue
                    if link in seen or link in queued or RENT.search(link) or not in_scope(link,root,config):continue
                    if hostkey(urlsplit(root).hostname)=='nepremicnine.net':
                        if kind=='buyer' and '/oglasi-prodaja/' in link:continue
                        if kind=='property' and '/oglasi-nakup/' in link:continue
                    sale=item.get('sale',False) or bool(SALE.search(link))
                    if re.search(pattern,urlsplit(link).path) and (sale or hostkey(urlsplit(root).hostname)=='nehnutelnosti.sk'):
                        pending.append({'url':link,'mode':'detail','sale':True});queued.add(link);details+=1
                    elif not re.search(pattern,urlsplit(link).path) and SALE.search(link+' '+label):
                        pending.append({'url':link,'mode':'index','sale':sale});queued.add(link)
                    elif item.get('sale') and (re.search(r'^(next|suivant|suivante|sljedeća|naslednja|naprej|weiter|siguiente|seguinte|volgende|successiva|avanti|›|»|→)$',label,re.I) or (urlsplit(link).path==urlsplit(url).path and re.search(r'[?&](?:page|stran|stranica|pagina|p)=\d+',link))):
                        pending.append({'url':link,'mode':'index','sale':True});queued.add(link)
                for href in page.next:
                    try:link=safe_url(urljoin(url,href),root)
                    except (ValueError,OSError):continue
                    if link not in seen and link not in queued and in_scope(link,root,config):pending.append({'url':link,'mode':'index','sale':item.get('sale',False)});queued.add(link)
                if not details and not pending:raise ValueError('No supported listing links or next page; completeness is unconfirmed')
            seen.add(url)
            # Import concrete records before exploring more category/filter pages.
            pending.sort(key=lambda p:0 if p['mode']=='detail' else 1)
        except Exception as e:
            if isinstance(e,HTTPError) and e.code in (404,410):
                unavailable.append({'url':url,'http_status':e.code,'checked_at':now});seen.add(url);continue
            if isinstance(e,ValueError) and item['mode']=='detail' and 'title' in str(e):
                # One malformed/deleted listing must not block the rest of the queue.
                failed.append({'url':url,'mode':item['mode'],'error':str(e),'checked_at':now});continue
            # Failed URL stays at the front for retry; never advance past a blocked page.
            pending.insert(0,item);errors.append(type(e).__name__+': '+str(e)[:240]);error_kind=failure_type(e);break
    exhausted=not pending and not errors
    state=dict(source_id=sid,status='Pogreška' if errors else 'Djelomično' if pending or failed else 'Uspješno',checked_at=now,pending=pending,cycle_seen=sorted(seen),next_url=pending[0]['url'] if pending else None,pages_processed=pages,index_pages=index_pages,detail_pages=detail_pages,imported_count=len(records),failed_urls=failed,unavailable_urls=unavailable,queue_exhausted=exhausted,exhausted=False,coverage_complete=False,scope='Discovered permitted pages only; not the whole portal',partial=bool(pending or failed),error='; '.join(errors) or None,stop_reason='error' if errors else 'discovered_queue_empty' if exhausted else 'runtime_or_page_budget')
    state.update(error_kind=error_kind,skipped_non_sale=skipped_non_sale)
    if error_kind in ('access_blocked','rate_limited','robots_disallowed'):
        from datetime import timedelta
        state['retry_after']=(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat()
    return records,state

def working_backlog(state):
    # A partial result can mean healthy pagination, not a broken adapter.
    return bool(state.get('pending')) and not state.get('error') and state.get('detail_pages',0)>0

def source_page_budget(source,state):
    # Lift the small initial probe only after real detail pages were imported.
    proven=working_backlog(state) and state.get('detail_pages',0)>=25 and state.get('imported_count',0)>=25
    return 150 if proven or hostkey(urlsplit(source['url']).hostname) in LARGE_BATCH_HOSTS else 25

def main():
    # Read the entire current registry at each run, including newly discovered sources.
    config=api({'action':'registry'}); deadline=time.monotonic()+900
    def priority(source):
        state=config['states'].get('registry-'+str(source['id']),{})
        return (0 if working_backlog(state) else 1,state.get('checked_at',''))
    sources=sorted(config['sources'],key=priority)
    for source in sources:
        if time.monotonic()>=deadline:break
        sid='registry-'+str(source['id'])
        prior=config['states'].get(sid,{})
        retry=prior.get('retry_after')
        if retry and datetime.fromisoformat(retry)>datetime.now(timezone.utc):continue
        budget=source_page_budget(source,prior)
        # Shorter resumable turns prevent two large portals from consuming the
        # entire run while other working sources wait six hours for a turn.
        seconds=120 if working_backlog(prior) else 360
        rows,state=process(source,prior,Fetcher(source['url']),min(deadline,time.monotonic()+seconds),max_pages=budget)
        # Small transactions prevent the legacy 2 MB whole-snapshot limit from blocking growth.
        save_rows(sid,rows,state)
        result=api({'action':'checkpoint','source_id':sid,'state':state})
        print(sid,state['status'],'pages',state['pages_processed'],'candidates',len(rows),'inserted',state.get('inserted_count',0),'updated',state.get('updated_count',0),'pending',len(state.get('pending',[])),'stop',state.get('stop_reason'),'checkpoint',result.get('saved'))
    print('Registry pass finished; unvisited sources retain their checkpoints.')

if __name__=='__main__':main()


