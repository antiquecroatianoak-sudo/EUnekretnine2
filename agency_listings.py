"""Conservative adapters: evidence belongs to the current property, never its agent."""
import math
import re
from urllib.parse import urljoin, urlsplit, urlunsplit

JUSTIMMO={'immonestor.at','adamant-immobilien.at','immolution.at'}
AGENCIES=JUSTIMMO|{'raiffeisen-immobilien.at','zweitwohnsitze.com'}
EU=set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split())

class RejectedListing(ValueError):
    """An unsupported detail is deferred without stopping unrelated valid listings."""

def identity(value,base):
    p=urlsplit(urljoin(base,value))
    return p.hostname.removeprefix('www.'),p.path.rstrip('/')

def country(value):
    if isinstance(value,dict):value=value.get('name') or value.get('identifier')
    value=str(value or '').strip()
    names={'Österreich':'AT','Oesterreich':'AT','Austria':'AT','Deutschland':'DE','Germany':'DE','Italien':'IT','Italy':'IT','Kroatien':'HR','Croatia':'HR','Spanien':'ES','Spain':'ES'}
    return value.upper() if value.upper() in EU else names.get(value)

def primary_data(host,url,nodes,page):
    expected='Product' if host=='zweitwohnsitze.com' else 'RealEstateListing'
    matches=[n for n in nodes if expected in ([n.get('@type')] if isinstance(n.get('@type'),str) else n.get('@type',[])) and isinstance(n.get('url'),str) and identity(n['url'],url)==identity(url,url)]
    if not matches:raise RejectedListing('No structured listing matching the current URL')
    main=matches[0];offer=main.get('offers',{})
    title=main.get('name')
    if not isinstance(title,str) or len(title.strip())<8:raise RejectedListing('No reliable primary title')
    facts={'evidence_excerpt':str(main.get('description') or title)[:1600],'asking_price':None,'currency':None,'advertised_area':None,'transaction_type':'sale','availability':'Potrebna provjera aktualnosti i podataka oglasa','price_basis':'asking_price'}
    address=None
    if host in JUSTIMMO:
        if not isinstance(offer,dict) or offer.get('@type')!='OfferForPurchase':raise RejectedListing('No explicit purchase offer for the current listing')
        item=offer.get('itemOffered',{})
        if not isinstance(item,dict):item={}
        address=item.get('address') or main.get('address')
        area=item.get('floorSize') or main.get('floorSize')
        if isinstance(area,dict):facts['advertised_area']=area
        types=item.get('@type',[]);types=[types] if isinstance(types,str) else types
        for t in types:
            if t in ('House','SingleFamilyResidence','Apartment'):facts['property_type']='Stan' if t=='Apartment' else 'Kuća'
        c=country(address.get('addressCountry')) if isinstance(address,dict) else None
    elif host=='zweitwohnsitze.com':
        if not re.search(r'\bkauf(?:en|preis)\b',str(main.get('description','')),re.I) or not isinstance(offer,dict) or offer.get('@type')!='Offer':raise RejectedListing('No explicit property purchase evidence')
        locations=[p.get('value') for p in main.get('additionalProperty',[]) if isinstance(p,dict) and p.get('name')=='Lage' and isinstance(p.get('value'),str)]
        if len(locations)!=1:raise RejectedListing('Missing unambiguous property location')
        address=locations[0];c=country(address.rsplit(',',1)[-1])
        facts['price_basis']='Advertised price; tax basis requires review'
        if re.search(r'netto', ' '.join(page.text),re.I):facts['price_basis']='Advertised net asking price; VAT and acquisition costs additional'
    else:
        # This reviewed postcode/locality is property evidence, not the agent seat.
        # Other Raiffeisen locations remain deferred until their country evidence is adapted.
        path=urlsplit(url).path
        if not re.fullmatch(r'/de/immobilien/kauf/7000/eisenstadt/[^/]+\.\d+',path):raise RejectedListing('Property country not yet supported for this Raiffeisen detail')
        text=' '.join(' '.join(page.main_text).split())
        if not re.search(r'\b7000 Eisenstadt\b',text):raise RejectedListing('Missing reviewed property locality')
        c='AT';address={'postalCode':'7000','addressLocality':'Eisenstadt','addressCountry':'AT'}
        facts['country_basis']='Reviewed property postcode and locality: 7000 Eisenstadt, Austria'
        # Main content only, before description, agent and related offers.
        header=text.split('Beschreibung',1)[0]
        prices=re.findall(r'Kaufpreis\s+([\d.]+,\d{2})\s*€',header)
        if not prices or len(set(prices))!=1:raise RejectedListing('No unambiguous primary purchase price')
        offer={'price':prices[0].replace('.','').replace(',','.'),'priceCurrency':'EUR'}
        area=re.search(r'Wohnfläche\s+([\d.]+,\d+)\s*m²',header)
        if area:facts['advertised_area']={'value':float(area[1].replace('.','').replace(',','.')),'unitCode':'MTK'}
    if not c:raise RejectedListing('Missing supported EU country of the property')
    if address:facts['advertised_location']=address
    price=offer.get('price');currency=offer.get('priceCurrency')
    if price is not None:
        try:amount=float(price)
        except (TypeError,ValueError):raise RejectedListing('Invalid primary price')
        if not math.isfinite(amount) or amount<=0 or not isinstance(currency,str) or not re.fullmatch('[A-Z]{3}',currency):raise RejectedListing('Invalid primary price or currency')
        facts.update(advertised_price=amount,asking_price=amount if currency=='EUR' else None,currency=currency)
    if str(offer.get('availability','')).rsplit('/',1)[-1] in ('SoldOut','Discontinued'):
        facts.update(source_listing_state='removed',source_status_evidence=str(offer['availability']))
    p=urlsplit(url)
    canonical=urlunsplit(('https',p.netloc,p.path,'',''))
    return title.strip(),c,facts,canonical
