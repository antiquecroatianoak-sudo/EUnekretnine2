"""Explicit official public land acquisition calls; never government land sales."""
import hashlib
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path

REGISTRY_PATH = Path(__file__).with_name('data') / 'public_land_registry.json'

PUBLIC_LAND_CALLS = {
    'https://lda.ie/projects/private-land-acquisition': {
        'country': 'IE', 'entity': 'Land Development Agency', 'authority_level': 'national',
        'demand': r'ongoing land acquisition programme',
        'purpose': 'Affordable housing; full acquisition requirements require document review',
    },
    'https://www.galway.ie/en/housing/housing-delivery/land-property-acquisition': {
        'country': 'IE', 'entity': 'Galway County Council', 'authority_level': 'local',
        'demand': r'(?:invite|asking) landowners to sell residential zoned lands',
        'purpose': 'Residential zoned land for housing in Galway County',
        'regions': ['Galway'],
    },
    'https://ssrs.si/razpisi/javni-pozivi-in-razpisi/javni-poziv-za-nakup-stanovanj-in-zemljisc-za-gradnjo-stanovanj-v-letih-2026-in-2027': {
        'country': 'SI', 'entity': 'Stanovanjski sklad Republike Slovenije, javni sklad',
        'authority_level': 'national',
        'demand': r'Javni poziv za nakup stanovanj in zemljišč za gradnjo stanovanj v letih 2026 in 2027',
        'purpose': 'Housing and development land; full public call conditions require review',
    },
    # Real fetch (run 39776595003): the page states no deadline; the call document
    # reportedly closed 10.7.2026, so it is monitored but not registered for import.
    'https://www.kerrycoco.ie/expression-of-interest-in-turnkey-units-land-with-development-potential': {
        'country': 'IE', 'entity': 'Kerry County Council', 'authority_level': 'local',
        'demand': r'Expressions? of Interest in Turnkey Units\s*/?\s*(?:and/or\s+)?Land with Development Potential',
        'purpose': 'Turnkey housing units and/or development land for housing in County Kerry',
        'regions': ['Kerry'],
    },
}

MONTHS = {
    # en
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6, 'july': 7,
    'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
    # sl
    'januarja': 1, 'februarja': 2, 'marca': 3, 'aprila': 4, 'maja': 5, 'junija': 6, 'julija': 7,
    'avgusta': 8, 'septembra': 9, 'oktobra': 10, 'novembra': 11, 'decembra': 12,
    # hr
    'siječnja': 1, 'veljače': 2, 'ožujka': 3, 'travnja': 4, 'svibnja': 5, 'lipnja': 6, 'srpnja': 7,
    'kolovoza': 8, 'rujna': 9, 'listopada': 10, 'studenoga': 11, 'studenog': 11, 'prosinca': 12,
    # de, fr, it, es, nl where they differ from the above
    'januar': 1, 'jänner': 1, 'februar': 2, 'märz': 3, 'mai': 5, 'juni': 6, 'juli': 7, 'oktober': 10, 'dezember': 12,
    'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4, 'juin': 6, 'juillet': 7, 'août': 8, 'septembre': 9,
    'octobre': 10, 'novembre': 11, 'décembre': 12,
    'gennaio': 1, 'febbraio': 2, 'aprile': 4, 'maggio': 5, 'giugno': 6, 'luglio': 7, 'agosto': 8,
    'settembre': 9, 'ottobre': 10, 'dicembre': 12,
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6, 'julio': 7,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
    'januari': 1, 'februari': 2, 'maart': 3, 'mei': 5, 'augustus': 8,
}
DATE = (r'(?:(?P<iso>\d{4}-\d{2}-\d{2})'
        r'|(?<!\d)(?P<d>\d{1,2})\.\s*(?P<m>\d{1,2})\.\s*(?P<y>\d{4})'
        r'|(?<!\d)(?P<dw>\d{1,2})(?:st|nd|rd|th)?\.?\s+(?:of\s+)?(?P<mw>[^\W\d_]+),?\s+(?P<yw>\d{4}))')
# A date counts as a deadline only directly after deadline wording, so a
# publication or update date elsewhere on the page is never read as a deadline.
DEADLINE = re.compile(r'(?:closing date|deadline|no later than|not later than|submitted by|received by|returned by|due by'
                      r'|by\s+\d{1,2}(?:[.:]\d\d)?\s*(?:am|pm|noon)\s+on'
                      r'|rok za (?:oddajo|predložitev|podnošenje|dostavu)|najkasneje do|odprt do|traja do|do vključno'
                      r'|date limite|au plus tard le|scadenza|entro il|einsendeschluss|bis spätestens|plazo|uiterlijk)'
                      r'[^0-9]{0,40}?' + DATE, re.I)
CLOSED = re.compile(r'\b(?:(?:this|the)\s+(?:call|competition|expression of interest|process|scheme)\s+(?:is|has)\s+(?:now\s+)?closed'
                    r'|closed for (?:submissions|applications)|no longer accepting (?:submissions|expressions of interest)'
                    r'|(?:javni\s+)?poziv je (?:zaključen|zaprt|zatvoren)|natječaj je (?:zatvoren|zaključen)'
                    r'|appel (?:est )?clôturé|avviso scaduto|convocatoria cerrada|aufruf (?:ist )?beendet)\b', re.I)
# Statements that the authority sells or disposes of land are never demand.
SALE = re.compile(r'\b(?:for sale|disposal of|to dispose|prodaja|prodajo|odprodaj\w*|zu verkaufen|verkauf von|te koop'
                  r'|vente de|vendita di|venta de|na sprzedaż)\b', re.I)
AMOUNT = (r'(?P<amount>\d{1,3}(?:[ ., ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*'
          r'(?P<scale>milijonov|milijona|milijon|milijuna|milijun|millions?|mio\.?)?\s*(?:EUR|€|eur)')
BUDGET = re.compile(r'(?:budget|funding of|allocated|višina sredstev|sredstva v (?:skupni )?višini|skupna vrednost'
                    r'|okvirna vrednost|iznos sredstava|enveloppe|dotazione|presupuesto)'
                    r'[^0-9€]{0,40}?(?:€\s*(?P<pre>\d[\d.,]*)\s*(?P<prescale>million|mio|m)?\b|' + AMOUNT + r')', re.I)
MIN_AREA = re.compile(r'(?:minimum(?: site)?(?: area| size)?(?: of)?|at least|not less than|najmanj|najmanje|minimalno'
                      r'|mindestens|au moins|almeno|como mínimo)'
                      r'\s*(?P<value>\d[\d.,]*)\s*(?P<unit>m2|m²|sq\.?\s*m|square met(?:re|er)s|hectares?|ha|acres?)', re.I)
SCALE = {'milijonov': 1e6, 'milijona': 1e6, 'milijon': 1e6, 'milijuna': 1e6, 'milijun': 1e6,
         'million': 1e6, 'millions': 1e6, 'mio': 1e6, 'mio.': 1e6}


def number(text):
    """Parse '1,250,000', '1.250.000', '13,3' or '1 000' as written in EU sources."""
    value = re.sub(r'[\s ]', '', text.strip()).rstrip('.,')
    if re.fullmatch(r'\d{1,3}(?:[.,]\d{3})+', value):
        return float(re.sub(r'[.,]', '', value))
    if ',' in value and '.' in value:
        value = value.replace('.', '').replace(',', '.') if value.rfind(',') > value.rfind('.') else value.replace(',', '')
    return float(value.replace(',', '.'))


def parse_date(match):
    try:
        if match.group('iso'):
            return date.fromisoformat(match.group('iso'))
        if match.group('d'):
            return date(int(match.group('y')), int(match.group('m')), int(match.group('d')))
        month = MONTHS.get(match.group('mw').lower())
        return date(int(match.group('yw')), month, int(match.group('dw'))) if month else None
    except ValueError:
        return None


def published_terms(text, today):
    """Terms are returned only when the page states them; nothing is inferred."""
    terms = {}
    deadlines = [(parsed, m) for m in DEADLINE.finditer(text) if (parsed := parse_date(m))]
    if deadlines:
        # Any future deadline keeps the call open; an old sentence must not close it.
        latest, evidence = max(deadlines, key=lambda item: item[0])
        terms.update(deadline=latest.isoformat(), deadline_evidence=text[max(0, evidence.start()-60):evidence.end()+60])
    budget = BUDGET.search(text)
    if budget:
        if budget.group('pre'):
            amount = number(budget.group('pre')) * (1e6 if budget.group('prescale') else 1)
        else:
            amount = number(budget.group('amount')) * SCALE.get((budget.group('scale') or '').lower(), 1)
        # A programme total is not a per-site budget, so it never becomes facts.budget.
        terms.update(programme_budget=amount, programme_budget_currency='EUR',
                     budget_evidence=text[max(0, budget.start()-60):budget.end()+80])
    area = MIN_AREA.search(text)
    if area:
        unit = area.group('unit').lower()
        factor = 10000 if unit.startswith(('ha', 'hect')) else 4046.8564224 if unit.startswith('acre') else 1
        terms.update(min_area=round(number(area.group('value')) * factor, 2),
                     area_evidence=text[max(0, area.start()-60):area.end()+60])
    closed = CLOSED.search(text)
    if closed:
        terms.update(source_listing_state='expired', call_currency=CALL_CLOSED,
                     source_status_evidence=text[max(0, closed.start()-60):closed.end()+60])
    elif terms.get('deadline') and date.fromisoformat(terms['deadline']) < today:
        terms.update(source_listing_state='expired', call_currency=CALL_CLOSED,
                     source_status_evidence='Objavljeni rok '+terms['deadline']+' je istekao: '+terms['deadline_evidence'])
    elif terms.get('deadline'):
        # Only a published future deadline is evidence that the call is open (or reopened).
        terms.update(source_listing_state='active', call_currency=CALL_OPEN, reopen_evidence=terms['deadline_evidence'],
                     source_status_evidence='Objavljen budući rok '+terms['deadline']+': '+terms['deadline_evidence'])
    else:
        # A programme page without a deadline or closing notice proves neither state.
        terms.update(call_currency=CALL_UNKNOWN)
    return terms


CALL_OPEN = 'Poziv otvoren: objavljen budući rok'
CALL_CLOSED = 'Poziv zatvoren ili istekao'
CALL_UNKNOWN = 'Program objavljen; aktualnost konkretnog poziva nepoznata'
CLOSURE_KEYS = ('source_listing_state', 'source_status_evidence', 'call_currency', 'availability')


def reopens(facts, now):
    """A closed call reopens only with new evidence: an explicit active state and a future deadline."""
    deadline = facts.get('deadline')
    try:
        future = bool(deadline) and date.fromisoformat(str(deadline)[:10]) >= now.date()
    except ValueError:
        future = False
    return facts.get('source_listing_state') == 'active' and bool(facts.get('reopen_evidence')) and future


def keep_closed_state(prior, facts, now):
    """Same rule as merge.mjs: a fetch without new evidence never turns a closed call into demand."""
    if prior.get('source_listing_state') in ('expired', 'removed') and not reopens(facts, now):
        facts = {**facts, **{k: prior[k] for k in CLOSURE_KEYS if k in prior}}
        # Older closed records predate these labels; the new fetch must not describe them as unknown.
        facts['call_currency'] = prior.get('call_currency') or CALL_CLOSED
        facts['availability'] = prior.get('availability') or 'Poziv je zatvoren ili mu je objavljeni rok istekao; nije aktivna potražnja.'
        for key in ('deadline', 'deadline_evidence'):
            if facts.get(key) is None and prior.get(key) is not None:
                facts[key] = prior[key]
    return facts


def public_land_record(source, text, now=None):
    url = source['url'].rstrip('/')
    config = PUBLIC_LAND_CALLS.get(url)
    if not config:
        raise ValueError('Public land acquisition source is not validated')
    if source['country'] != config['country']:
        raise ValueError('Public authority country mismatch')
    # Use only the reviewed, page-specific affirmative acquisition wording.
    match = re.search(config['demand'], text, re.I)
    if not match:
        raise ValueError('Current page does not contain the reviewed public acquisition call')
    if SALE.search(text[max(0, match.start()-80):match.end()+80]):
        raise ValueError('Public land sale or disposal, not an acquisition call')
    stamp = now or datetime.now(timezone.utc).isoformat()
    excerpt = text[max(0, match.start()-120):match.end()+700]
    facts = {
        'transaction_type': 'buy_request', 'buyer_type': 'public_authority',
        'authority_level': config['authority_level'], 'entity_name': config['entity'],
        'identity_source_url': source['url'], 'intent_source_url': source['url'],
        'intent_evidence': excerpt, 'evidence_excerpt': excerpt,
        'property_types': ['Zemljište'], 'purpose': config['purpose'],
        'budget': None, 'deadline': None,
        'availability': 'Program javne kupnje objavljen; aktualnost konkretnog poziva i uvjeti zahtijevaju pregled dokumentacije.',
        'interest': 'Javna potražnja; interes za pojedinačnu nekretninu nije potvrđen.',
        # Not observed unless the page states it; null never overwrites an earlier closure on merge.
        'source_listing_state': None,
    }
    # The existing lifecycle closes pairs from deadline / source_listing_state.
    facts.update(published_terms(text, datetime.fromisoformat(stamp).date()))
    if facts.get('source_listing_state') == 'expired':
        facts['availability'] = 'Poziv je zatvoren ili mu je objavljeni rok istekao; nije aktivna potražnja.'
    elif facts.get('source_listing_state') == 'active':
        facts['availability'] = 'Poziv otvoren prema objavljenom budućem roku; uvjeti zahtijevaju pregled dokumentacije.'
    review = [('deadline', 'Rok i otvorenost poziva'), (None, 'Potpuni lokacijski i urbanistički uvjeti'),
              (None, 'Ovlaštenje ponuditelja'), (None, 'Uvjeti sudjelovanja i dokumentacija'),
              ('budget', 'Budžet po lokaciji nije objavljen')]
    facts['review_required'] = [label for key, label in review if key is None or facts.get(key) is None]
    if config.get('regions'):
        facts['regions'] = config['regions']
    return {'id': 'registry:buyer:'+hashlib.sha256(source['url'].encode()).hexdigest()[:32],
            'source_id': 'registry-'+str(source['id']), 'kind': 'buyer',
            'title': config['entity']+' — javna potražnja za zemljištem',
            'country': config['country'], 'url': source['url'],
            'first_seen': stamp, 'last_seen': stamp, 'verified': False,
            'status': 'Za provjeru', 'facts': facts}


def load_registry(path=REGISTRY_PATH):
    return json.loads(Path(path).read_text(encoding='utf-8'))


STATUS_ORDER = ['uvoz_testiran', 'dohvat_testiran', 'konfiguriran_ceka_provjeru', 'pronaden_nije_konfiguriran',
                'zatvoren', 'izvan_opsega', 'blokiran']
# Short labels keep the coverage table readable on a phone; full meanings are in the registry.
SHORT_STATUS = {'uvoz_testiran': 'Uvoz testiran', 'dohvat_testiran': 'Dohvat testiran', 'konfiguriran_ceka_provjeru': 'Čeka provjeru',
                'pronaden_nije_konfiguriran': 'Pronađen, bez adaptera', 'zatvoren': 'Samo zatvoren poziv',
                'izvan_opsega': 'Nije kupnja zemljišta', 'blokiran': 'Dohvat blokiran', 'nije_pronaden': 'Nije pronađen'}


def coverage_rows(registry):
    """One equal row per member state: best real status, what is missing and where the sources are."""
    rows = []
    for country in registry['countries'].values():
        statuses = [s['support_status'] for s in country['sources']]
        best = min(statuses, key=STATUS_ORDER.index) if statuses else 'nije_pronaden'
        checks = [s['last_import_check']['at'] for s in country['sources'] if s.get('last_import_check')]
        rows.append({'Država': country['name'], 'Najbolji status': SHORT_STATUS[best],
                     'Testiran uvoz': sum(s == 'uvoz_testiran' for s in statuses), 'Izvora': len(statuses),
                     'Zadnji stvarni uvoz': max(checks) if checks else '—', 'Stanje i nedostaci': country['summary'],
                     'Izvori': '\n'.join(s['url'] for s in country['sources']) or '—'})
    return rows
