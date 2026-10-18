"""Resumable registry import. No API keys; GitHub OIDC authenticates database writes."""
import hashlib
import ipaddress
import json
import re
import socket
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError
from urllib.robotparser import RobotFileParser
from sync_discovery import request_token, call as legacy_call

ENDPOINT='https://izpzsfiqvransehvmuzn.supabase.co/functions/v1/registry-discovery'
AGENT='EUPropertyResearch/0.2'
SALE=re.compile(r'prodaja|prodaju|nakup|for-sale|for_sale|sale|verkauf|kaufen|koop|vente|vendre|vendita|vendesi|venta|comprar|imoveis|prodej|predaj|elado|vanzare|prodava|parduo|myyt|sprzedaz|mieszkania|müü|muua|til-salg|till-salu|πωλη',re.I)
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
}

def canonical(url):
    p=urlsplit(url)
    return urlunsplit((p.scheme,p.netloc.lower(),p.path,urlencode([(k,v) for k,v in parse_qsl(p.query,keep_blank_values=True) if not k.lower().startswith(('utm_','fbclid','gclid'))]),''))

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

def objects(value):
    if isinstance(value,dict):
        yield value
        for v in value.values(): yield from objects(v)
    elif isinstance(value,list):
        for v in value:yield from objects(v)

class Fetcher:
    def __init__(self,root):self.root=root;self.robots={};self.last=0
    def raw(self,url):
        url=safe_url(url,self.root)
        owner=self
        class Redirect(HTTPRedirectHandler):
            def redirect_request(self,req,fp,code,msg,headers,newurl):
                safe_url(newurl,owner.root)
                return super().redirect_request(req,fp,code,msg,headers,newurl)
        delay=1-(time.monotonic()-self.last)
        if delay>0:time.sleep(delay)
        self.last=time.monotonic()
        with build_opener(Redirect()).open(Request(url,headers={'User-Agent':AGENT,'Accept':'text/html,application/xhtml+xml'}),timeout=15) as r:
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
        return self.raw(url)

def api(body,token=None):
    from urllib.request import urlopen
    req=Request(ENDPOINT,data=json.dumps(body,ensure_ascii=False).encode(),headers={'Authorization':'Bearer '+(token or request_token()),'Content-Type':'application/json'},method='POST')
    with urlopen(req,timeout=90) as r:return json.load(r)

def buyer_source(source):
    return bool(re.search(r'kupac|kupci|kupaca|investitor|akvizic|kriteriji|potražnja',source.get('category',''),re.I))

def listing_record(source,url,page,kind,now):
    title=(page.meta.get('og:title') or page.meta.get('twitter:title') or ' '.join(page.title)).strip()
    nodes=[v for script in page.scripts for v in objects(script)]
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
            offers=node.get('offers')
            if isinstance(offers,dict):
                price=offers.get('price'); currency=offers.get('priceCurrency')
                if isinstance(price,(str,int,float)) and str(price).replace('.','',1).isdigit() and isinstance(currency,str) and re.fullmatch('[A-Z]{3}',currency):
                    facts.update(advertised_price=float(price),asking_price=float(price) if currency=='EUR' else None,currency=currency)
            area=node.get('floorSize')
            if isinstance(area,dict):facts['advertised_area']=area
            address=node.get('address')
            if isinstance(address,(dict,str)) and address:facts['advertised_location']=address
    return {'id':'registry:'+kind+':'+hashlib.sha256(url.encode()).hexdigest()[:32],'source_id':'registry-'+str(source['id']),'kind':kind,'title':title[:240],'country':source['country'],'url':url,'first_seen':now,'last_seen':now,'verified':False,'status':'Za provjeru','facts':facts}

def process(source,state,fetcher,deadline,max_pages=25):
    now=datetime.now(timezone.utc).isoformat(); sid='registry-'+str(source['id']);kind='buyer' if buyer_source(source) else 'property'
    previous=state or {}; root=source['url']; pattern=DETAIL.get(hostkey(urlsplit(root).hostname))
    pending=list(previous.get('pending',[]))
    buyer_index=kind=='buyer' and bool(re.search(r'/oglasi-nakup/',root))
    if not pending:pending=[{'url':root,'mode':'buyer' if kind=='buyer' and not buyer_index else 'index','sale':bool(SALE.search(root))}]
    seen=set(previous.get('cycle_seen',[])) if previous.get('pending') else set()
    records=[]; pages=0; errors=[]; exhausted=False
    if kind=='property' and not pattern:
        return [],dict(source_id=sid,status='Nepodržano',checked_at=now,pending=pending,cycle_seen=list(seen),pages_processed=0,imported_count=0,exhausted=False,error='No validated detail URL adapter; research automation must supply one')
    while pending and pages<max_pages and time.monotonic()<deadline:
        item=pending.pop(0);url=item['url']
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
            elif item['mode']=='detail':records.append(listing_record(source,url,page,kind,now))
            else:
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
                    if link in seen or link in queued or RENT.search(link):continue
                    if hostkey(urlsplit(root).hostname)=='nepremicnine.net':
                        if kind=='buyer' and '/oglasi-prodaja/' in link:continue
                        if kind=='property' and '/oglasi-nakup/' in link:continue
                    sale=item.get('sale',False) or bool(SALE.search(link))
                    if re.search(pattern,urlsplit(link).path) and sale:
                        pending.append({'url':link,'mode':'detail','sale':True});queued.add(link);details+=1
                    elif not re.search(pattern,urlsplit(link).path) and SALE.search(link+' '+label):
                        pending.append({'url':link,'mode':'index','sale':sale});queued.add(link)
                    elif item.get('sale') and (re.search(r'^(next|suivant|suivante|sljedeća|naslednja|naprej|weiter|siguiente|seguinte|volgende|successiva|avanti|›|»|→)$',label,re.I) or (urlsplit(link).path==urlsplit(url).path and re.search(r'[?&](?:page|stran|stranica|pagina|p)=\d+',link))):
                        pending.append({'url':link,'mode':'index','sale':True});queued.add(link)
                for href in page.next:
                    try:link=safe_url(urljoin(url,href),root)
                    except (ValueError,OSError):continue
                    if link not in seen and link not in queued:pending.append({'url':link,'mode':'index','sale':item.get('sale',False)});queued.add(link)
                if not details and not pending:raise ValueError('No supported listing links or next page; completeness is unconfirmed')
            seen.add(url)
            # Import concrete records before exploring more category/filter pages.
            pending.sort(key=lambda p:0 if p['mode']=='detail' else 1)
        except Exception as e:
            # Failed URL stays at the front for retry; never advance past a blocked page.
            pending.insert(0,item);errors.append(type(e).__name__+': '+str(e)[:240]);break
    exhausted=not pending and not errors
    return records,dict(source_id=sid,status='Pogreška' if errors else 'Uspješno',checked_at=now,pending=pending,cycle_seen=sorted(seen),next_url=pending[0]['url'] if pending else None,pages_processed=pages,imported_count=len(records),exhausted=exhausted,partial=bool(pending),error='; '.join(errors) or None,stop_reason='error' if errors else 'complete' if exhausted else 'runtime_or_page_budget')

def main():
    # Read the entire current registry at each run, including newly discovered sources.
    config=api({'action':'registry'}); deadline=time.monotonic()+900
    sources=sorted(config['sources'],key=lambda s:config['states'].get('registry-'+str(s['id']),{}).get('checked_at',''))
    for source in sources:
        if time.monotonic()>=deadline:break
        sid='registry-'+str(source['id'])
        rows,state=process(source,config['states'].get(sid),Fetcher(source['url']),deadline)
        # Small transactions prevent the legacy 2 MB whole-snapshot limit from blocking growth.
        for n in range(0,len(rows),100):api({'action':'batch','source_id':sid,'candidates':rows[n:n+100]})
        result=api({'action':'checkpoint','source_id':sid,'state':state})
        print(sid,state['status'],'pages',state['pages_processed'],'candidates',len(rows),'checkpoint',result.get('saved'))
    print('Registry pass finished; unvisited sources retain their checkpoints.')

if __name__=='__main__':main()
