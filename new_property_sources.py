"""Reviewed primary facts for new catalogues; no copied listing descriptions."""
import hashlib,re
from urllib.parse import urlsplit
DUTCH_COUNTRIES={'Nederland':'NL','Oostenrijk':'AT','België':'BE','Bulgarije':'BG','Tsjechië':'CZ','Duitsland':'DE','Denemarken':'DK','Estland':'EE','Spanje':'ES','Frankrijk':'FR','Kroatië':'HR','Hongarije':'HU','Ierland':'IE','Italië':'IT','Litouwen':'LT','Luxemburg':'LU','Letland':'LV','Polen':'PL','Portugal':'PT','Roemenië':'RO','Zweden':'SE','Slowakije':'SK','Slovenië':'SI','Finland':'FI','Griekenland':'GR','Cyprus':'CY','Malta':'MT'}

def interfarms_record(source,url,page,stamp):
    p=urlsplit(url);ref=re.fullmatch(r'/nl/object/(\d+)',p.path)
    if p.hostname!='interfarms.com' or not ref or page is None:raise ValueError('interfarms_primary_detail_required')
    text=' '.join(' '.join(page.text).split())
    title=page.meta.get('og:title') or ' '.join(page.title)
    title=title.strip()
    if len(title)<8:raise ValueError('interfarms_title_required')
    header=re.search(r'([\d.,]+)\s+Hectare\s*\|\s*(.*?)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*ID\s+(\d+)\s+(.*?)\s+Alle fotos',text)
    if not header or header[5]!=ref[1]:raise ValueError('interfarms_primary_reference_required')
    location=header[6].strip();country_name=location.rsplit(',',1)[-1].strip()
    country=DUTCH_COUNTRIES.get(country_name)
    if not country:raise ValueError('explicit_eu_property_country_required')
    state=header[3].strip();closed=bool(re.search(r'verkocht|verhuurd|ingetrokken',state,re.I))
    if state.casefold()!='te koop' and not closed:raise ValueError('interfarms_sale_state_required')
    # Broker block precedes the country guide/related listings and identifies the
    # contact for this specific object, not Interfarms' generic footer contact.
    agent=re.search(r'\bMakelaar\s+(.+?)\s+([^\s@]+@[^\s@]+\.[^\s@]+)\s+([\d ()+./-]+)\s+Lees meer',text)
    if not agent or 'Ontvang meer informatie over dit object.' not in text:raise ValueError('interfarms_record_bound_contact_required')
    hectares=float(header[1].replace('.','').replace(',','.'))
    if hectares<=0:raise ValueError('invalid_land_area')
    advertised=header[2].strip();price=None;currency=None
    match=re.fullmatch(r'(EUR|USD|DKK|SEK|CAD|AUD)\s+([\d.]+)(?:,-|,\d{2})?',advertised)
    if match:currency=match[1];price=float(match[2].replace('.',''))
    elif advertised!='Prijs op aanvraag':raise ValueError('interfarms_price_format_required')
    if price is not None and price<=0:raise ValueError('invalid_price')
    facts={'reference':ref[1],'transaction_type':'sale','advertised_location':{'addressCountry':country,'addressRegion':location.rsplit(',',1)[0]},'country_basis':'Primary object location after the matching ID, not the agency address','land_area_m2':hectares*10000,'advertised_land_area':{'value':hectares,'unit':'ha'},'advertised_use':header[4].strip(),'asking_price':price if currency=='EUR' else None,'advertised_price':price,'currency':currency,'availability':'Dostupnost nije potvrđena','source_contact':{'mode':'agency','name':agent[1].strip(),'agency_name':agent[1].strip(),'email':agent[2],'phone':agent[3].strip(),'record_reference':url,'evidence_url':url,'contact_url':url,'represents_record':True,'permitted':True,'permission_scope':'property_enquiry_only','permission_quote':'Ontvang meer informatie over dit object.','permission_basis':'record_bound_inquiry_invitation','checked_at':stamp},'evidence_excerpt':'Interfarms object '+ref[1]+'; '+location+'; '+state+'; '+header[1]+' ha; '+advertised+'; broker '+agent[1].strip()}
    if header[4].strip()=='Losse grond':facts.update(property_type='Zemljište',advertised_area={'value':hectares*10000,'unitCode':'MTK'})
    if closed:facts.update(source_listing_state='removed',source_status_evidence='Primary object state: '+state)
    return {'id':'registry:property:'+hashlib.sha256(url.encode()).hexdigest()[:32],'source_id':'registry-'+str(source['id']),'kind':'property','title':title[:240],'country':country,'url':url,'first_seen':stamp,'last_seen':stamp,'verified':False,'status':'Za provjeru','facts':facts}
