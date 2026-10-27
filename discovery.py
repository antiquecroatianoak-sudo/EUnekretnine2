"""Bounded public-source discovery. Candidates are never verified buying mandates."""
import argparse
import csv
import hashlib
import io
import json
import math
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit, quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.robotparser import RobotFileParser
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET

USER_AGENT='EUPropertyResearch/0.1'
ROOT=Path(__file__).parent
SOURCES=[
 dict(id='fina-csv', name='Fina – javni CSV nekretnina', country='Hrvatska', kind='property', adapter='fina', url='https://ponip.fina.hr/ocevidnik-web/preuzmi/csv', public_export=True),
 dict(id='hr-state-sales',name='Državne nekretnine – natječaji prodaje',country='Hrvatska',kind='property',adapter='hr-links',url='https://hr-nekretnine.hr/natjecaji/'),
 dict(id='es-state-auctions',name='Hacienda – subastas y concursos',country='Španjolska',kind='property',adapter='rss',url='https://www.hacienda.gob.es/_layouts/15/rsssubastas.aspx?hiloid=12',public_export=True,expected_title='subastas'),
 dict(id='es-direct-sales',name='Hacienda – venta directa de inmuebles',country='Španjolska',kind='property',adapter='rss',url='https://www.hacienda.gob.es/_layouts/15/rssventasdirectas.aspx?hiloid=15',public_export=True,expected_title='venta directa'),
 dict(id='gradzilla-demand',name='Gradzilla – javni zahtjev za zemljišta',country='Hrvatska',kind='buyer',adapter='buyer',url='https://gradzilla.hr/trazimo-zemljista/',signal='Tražimo zemljišta',facts={'property_types':['Zemljište'],'min_area':300,'max_area':1500,'location_note':'Zona tramvaja; područje označeno kartom zahtijeva ručnu provjeru.'}),
 dict(id='immoexpert-demand',name='Immoexpert – javni zahtjev za zemljišta',country='Hrvatska',kind='buyer',adapter='buyer',url='https://www.immoexpert.hr/',signal='Kupujemo zemljišta u Gradu Zagrebu',facts={'property_types':['Zemljište'],'cities':['Zagreb'],'requires_buildable':True,'development_note':'Gradnja stambenih jedinica i ureda.'}),
]
HOSTS={urlsplit(s['url']).hostname for s in SOURCES}

class SourceError(ValueError): pass

def public_url(value):
    p=urlsplit(value)
    if p.scheme!='https' or not p.hostname or p.username or p.password or p.port not in (None,443): raise SourceError('Neprihvatljiva poveznica izvora.')
    return value

class SourceRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_url(newurl)
        if urlsplit(newurl).hostname not in HOSTS: raise SourceError('Preusmjerenje izvan registra izvora.')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def fetch(url, limit=2_000_000):
    public_url(url)
    if urlsplit(url).hostname not in HOSTS: raise SourceError('Izvor nije u dopuštenom registru.')
    with build_opener(SourceRedirect()).open(Request(url,headers={'User-Agent':USER_AGENT}),timeout=30) as response:
        if urlsplit(response.url).hostname not in HOSTS: raise SourceError('Izvor je preusmjeren izvan registra.')
        data=response.read(limit+1)
        if len(data)>limit: raise SourceError('Izvoz je prevelik; skeniranje nije dovršeno.')
        return data.decode('utf-8-sig')

def robots_allowed(source, fetcher=fetch):
    if source.get('public_export'): return
    root=urlsplit(source['url']); robots_url=root.scheme+'://'+root.netloc+'/robots.txt'
    try: content=fetcher(robots_url)
    except HTTPError as error:
        if error.code==404: return
        raise SourceError('Pravila dohvata nisu dostupna.') from error
    parser=RobotFileParser();parser.parse(content.splitlines())
    if not parser.can_fetch(USER_AGENT,source['url']): raise SourceError('Automatski dohvat nije dopušten pravilima izvora.')

class HTMLText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.links=[]; self.text=[]; self.anchor=None; self.ignore=0
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style'):self.ignore+=1
        if tag=='a':self.anchor=[dict(attrs).get('href',''),[]]
    def handle_data(self,data):
        if not self.ignore:
            self.text.append(data)
            if self.anchor is not None:self.anchor[1].append(data)
    def handle_endtag(self,tag):
        if tag in ('script','style'):self.ignore=max(0,self.ignore-1)
        if tag=='a' and self.anchor:
            self.links.append((self.anchor[0],' '.join(' '.join(self.anchor[1]).split())))
            self.anchor=None

def candidate(source, key, title, url, **facts):
    public_url(url)
    return dict(id=source['id']+':'+str(key),source_id=source['id'],country=source['country'],kind=source['kind'],title=title[:240],url=url,status='Za provjeru',verified=False,facts=facts)

def parse_fina(source, content, now):
    reader=csv.DictReader(io.StringIO(content),delimiter=';')
    needed={'Vrsta predmeta prodaje','ID nadmetanja','Datum i vrijeme završetka nadmetanja','Opis','Početna cijena za nadmetanje'}
    if not needed.issubset(reader.fieldnames or []):raise SourceError('Promijenjen format Fina CSV-a.')
    found=[]
    for row in reader:
        if None in row or any(row.get(k) is None for k in needed):raise SourceError('Nepotpun CSV zapis; ne spremam djelomičan dohvat.')
        if row['Vrsta predmeta prodaje'].strip().casefold()!='nekretnina':continue
        try: end=datetime.fromisoformat(row['Datum i vrijeme završetka nadmetanja']).replace(tzinfo=ZoneInfo('Europe/Zagreb'))
        except ValueError:continue
        if end<=now:continue
        key=row['ID nadmetanja'].strip()
        if not key.isdigit():raise SourceError('Nevaljan Fina ID nadmetanja.')
        try: price=float(row['Početna cijena za nadmetanje'])
        except ValueError:price=None
        if price is not None and (not math.isfinite(price) or price<0):price=None
        found.append(candidate(source,key,'Fina '+key+' — '+row['Opis'][:160],source['url'],auction_id=key,description=row['Opis'][:500],asking_price=price,deadline=end.isoformat(),case_reference=row.get('Poslovni broj spisa'),evidence_note='Javni CSV; pronađi zapis prema ID-u nadmetanja. Budući rok nije potvrda da prodaja nije povučena.'))
    return found

def parse_rss(source,content,now):
    try:root=ET.fromstring(content)
    except ET.ParseError as e:raise SourceError('Neispravan RSS.') from e
    title=root.findtext('./channel/title') or ''
    if source['expected_title'].casefold() not in title.casefold():raise SourceError('RSS ne odgovara temi prodaje nekretnina.')
    found=[]
    for item in root.findall('./channel/item'):
        url=urljoin(source['url'],item.findtext('link') or '').replace(' ', '%20')
        if urlsplit(url).hostname!='www.hacienda.gob.es':continue
        title=(item.findtext('title') or '').strip()
        if not title:continue
        key=hashlib.sha256(url.encode()).hexdigest()[:24]
        found.append(candidate(source,key,title,url,published=item.findtext('pubDate'),availability='Potrebna provjera roka i dokumentacije; RSS može sadržavati stare objave.'))
    return found

def parse_html(source,content,now):
    page=HTMLText();page.feed(content)
    if source['adapter']=='buyer':
        text=' '.join(' '.join(page.text).split())
        if source['signal'].casefold() not in text.casefold():raise SourceError('Javni zahtjev kupca više nije pronađen na stranici.')
        return [candidate(source,'mandate',source['name'],source['url'],**source['facts'],budget=None,conditions=None,interest='Javno objavljen opći zahtjev; aktualnost i interes za konkretnu kupnju nisu potvrđeni.')]
    found=[]
    for href,title in page.links:
        url=urljoin(source['url'],href)
        if urlsplit(url).hostname=='hr-nekretnine.hr' and '/natjecaji/' in urlsplit(url).path and 'prodaju nekretnina' in title.casefold():
            key=hashlib.sha256(url.encode()).hexdigest()[:24]
            found.append(candidate(source,key,title,url,availability='Natječaj može obuhvaćati više nekretnina. Rok, pojedinačni predmeti i dokumentacija zahtijevaju provjeru.'))
    if not found:raise SourceError('Nisu pronađene poveznice natječaja; provjeriti strukturu izvora.')
    return list({r['id']:r for r in found}.values())

def scan(previous=None,fetcher=fetch,now=None,sources=SOURCES):
    now=now or datetime.now(timezone.utc)
    timestamp=now.isoformat()
    records={r['id']:dict(r) for r in (previous or {}).get('candidates',[])}
    runs=[]
    for source in sources:
        try:
            robots_allowed(source,fetcher)
            content=fetcher(source['url'],limit=100_000_000 if source['adapter']=='fina' else 2_000_000)
            if source['adapter']=='fina':found=parse_fina(source,content,now)
            elif source['adapter']=='rss':found=parse_rss(source,content,now)
            else:found=parse_html(source,content,now)
            seen={r['id'] for r in found}
            for old in records.values():
                if old['source_id']==source['id'] and old['id'] not in seen:old['observation']='Nije u posljednjem dohvatu; ishod nije potvrđen'
            for row in found:
                old=records.get(row['id'],{})
                row.update(first_seen=old.get('first_seen',timestamp),last_seen=timestamp,observation='Pronađen u posljednjem dohvatu')
                records[row['id']]=row
            runs.append(dict(source_id=source['id'],status='Uspješno',count=len(found),checked_at=timestamp))
        except Exception as error:
            # Keep earlier records and their last_seen on failure. No fabricated freshness.
            runs.append(dict(source_id=source['id'],status='Pogreška',count=0,checked_at=timestamp,error=type(error).__name__+': '+str(error)[:180]))
    return dict(schema_version=1,generated_at=timestamp,sources=SOURCES,runs=runs,candidates=sorted(records.values(),key=lambda r:r['id']))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'data'/'discovered_candidates.json'));args=parser.parse_args()
    path=Path(args.output);previous=json.loads(path.read_text()) if path.exists() else None
    result=scan(previous)
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
    for run in result['runs']:print(run['source_id'],run['status'],run['count'],run.get('error',''))
    # A degraded snapshot is retained, but the scheduled run must visibly fail.
    if any(r['status']=='Pogreška' for r in result['runs']):raise SystemExit(1)

if __name__=='__main__':main()
