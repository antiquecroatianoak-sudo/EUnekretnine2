"""Bounded discovery of NEW public sources for both flows (property sellers and buyers).

Leads come only from links on pages the registry crawler already fetches; there is no search API, key or
paid service. A lead is recorded with its evidence (where it was seen and the link text), deduplicated by
domain, then checked once: robots.txt, 401/403 and login walls are respected and never bypassed. Nothing is
crawled as a source or written to the database automatically: a checked lead is a proposal for the owner's
review, after which it is added to `sources` like any other registry source (ops/source-leads.md).
"""
import json
import re
import sys
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit, urlunsplit

LEADS_FILE = Path(__file__).with_name('data') / 'source_leads.json'
MAX_EVIDENCE = 5
RETRY_AFTER = timedelta(days=7)

# Link text or path must name a sale/auction or a buyer's acquisition demand, in an EU language.
PROPERTY_WORDS = re.compile(r'(nekretnin|oglasi|prodaja|na prodaj|for sale|property|properties|real estate|immobili|immobilien|immo|vente|à vendre|en venta|inmuebles|vendita|zu verkaufen|te koop|woning|nieruchomo|sprzeda|ingatlan|eladó|nemovitost|prodej|imobil|vânzare|kinnisvara|müük|nekilnojam|pardavim|nekustam|pārdo|kiinteist|myydään|bostad|till salu|bolig|til salg|ακίνητ|πώληση|недвижим|продажба|dražb|auction|enchère|subasta|asta giudiziaria|versteigerung|veiling|licytac|árverés|aukce|licitați|huutokaup)', re.I)
BUYER_WORDS = re.compile(r'(land acquisition|site acquisition|property acquisition|expressions? of interest|we buy|wanted|otkup|kupujemo|kupnja zemlji|nakup zemlji|oglasi nakup|ankauf|wir kaufen|achat de terrain|nous achetons|compramos|adquisición de suelo|acquisizione|acquistiamo|aankoop|wij kopen|skup|kupimy|felvásárl|vásárolunk|výkup|kupujeme|cumpărăm|ostame|perkame|pērkam|ostamme|köper|køber|αγοράζουμε|изкупуваме)', re.I)
SKIP_HOSTS = ('facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
              'google.com', 'goo.gl', 'apple.com', 'microsoft.com', 'wikipedia.org', 'whatsapp.com', 't.me', 'bit.ly')
EU_TLDS = {'at': 'AT', 'be': 'BE', 'bg': 'BG', 'hr': 'HR', 'cy': 'CY', 'cz': 'CZ', 'dk': 'DK', 'ee': 'EE', 'fi': 'FI', 'fr': 'FR', 'de': 'DE', 'gr': 'GR',
           'hu': 'HU', 'ie': 'IE', 'it': 'IT', 'lv': 'LV', 'lt': 'LT', 'lu': 'LU', 'mt': 'MT', 'nl': 'NL', 'pl': 'PL', 'pt': 'PT', 'ro': 'RO',
           'sk': 'SK', 'si': 'SI', 'es': 'ES', 'se': 'SE'}

_observed = []
_lock = threading.Lock()

def host_of(url):
    host = (urlsplit(url).hostname or '').lower()
    return host.removeprefix('www.').removeprefix('en.')

def classify_text(text):
    """'buyer' wins over 'property': demand wording is the rarer, more specific signal."""
    if BUYER_WORDS.search(text): return 'buyer'
    if PROPERTY_WORDS.search(text): return 'property'
    return None

def observe(page_url, links):
    """Record off-site HTTPS links whose text or path names property sales or buyer demand (thread-safe)."""
    page_host = host_of(page_url)
    found = []
    for href, text in links:
        try:
            url = urljoin(page_url, href)
            p = urlsplit(url)
        except ValueError:
            continue
        host = host_of(url)
        if p.scheme != 'https' or p.username or p.password or not host or host == page_host or host.endswith('.' + page_host) or page_host.endswith('.' + host):
            continue
        if any(host == s or host.endswith('.' + s) for s in SKIP_HOSTS):
            continue
        kind = classify_text((text or '') + ' ' + p.path)
        if kind:
            found.append(dict(host=host, url=urlunsplit(('https', p.netloc.lower(), p.path or '/', '', '')), kind=kind,
                              found_on=page_url, anchor=' '.join((text or '').split())[:120]))
    with _lock:
        _observed.extend(found)
    return found

def take_observed():
    with _lock:
        items = list(_observed); _observed.clear()
    return items

def merge(leads, observed, known_hosts, now):
    """Deduplicate by domain. New leads start as 'novo'; review fields of existing leads are never overwritten."""
    by_host = {lead['host']: lead for lead in leads}
    known = {h.lower().removeprefix('www.') for h in known_hosts}
    stamp = now.isoformat()
    for item in observed:
        host = item['host']
        if host in known or any(host.endswith('.' + k) for k in known):
            continue
        lead = by_host.get(host)
        if lead is None:
            lead = by_host[host] = dict(host=host, country_hint=EU_TLDS.get(host.rsplit('.', 1)[-1]), kinds=[], first_seen=stamp,
                                        status='novo', evidence=[])
        lead['last_seen'] = stamp
        if item['kind'] not in lead['kinds']: lead['kinds'].append(item['kind'])
        if len(lead['evidence']) < MAX_EVIDENCE and not any(e['url'] == item['url'] for e in lead['evidence']):
            lead['evidence'].append(dict(url=item['url'], found_on=item['found_on'], anchor=item['anchor'], seen=stamp))
    return sorted(by_host.values(), key=lambda l: l['host'])

def _default_fetcher(url):
    from registry_discovery import Fetcher
    return Fetcher(url)

def verify(lead, now, fetcher_for=_default_fetcher):
    """One respectful check of a lead's first evidenced URL. Returns the updated lead; never bypasses refusals."""
    from registry_discovery import Page
    url = lead['evidence'][0]['url']
    lead = dict(lead, checked_at=now.isoformat())
    try:
        page = Page(fetcher_for(url).get(url))
    except HTTPError as error:
        lead.update(status='blokirano' if error.code in (401, 403, 451) else 'nedostupno', check_note='HTTP ' + str(error.code))
        return lead
    except ValueError as error:
        lead.update(status='robots_zabrana' if 'robots' in str(error) else 'nedostupno', check_note=str(error)[:200])
        return lead
    except OSError as error:
        lead.update(status='nedostupno', check_note=type(error).__name__)
        return lead
    text = ' '.join(page.text)
    if re.search(r'(type=.password|log ?in|sign ?in|prijav|anmelden|connexion)', ' '.join(page.title).lower()) and len(text) < 2000:
        lead.update(status='blokirano', check_note='Stranica traži prijavu; ne zaobilazi se.')
        return lead
    listing_types = sum(1 for s in page.scripts for d in (s if isinstance(s, list) else [s]) if isinstance(d, dict)
                        and str(d.get('@type', '')).lower() in ('realestatelisting', 'offer', 'house', 'apartment', 'singlefamilyresidence', 'place', 'product'))
    prices = len(re.findall(r'(€\s?\d[\d.,\s]{2,}|\d[\d.,\s]{2,}\s?(€|eur\b))', text, re.I))
    areas = len(re.findall(r'\d[\d.,]*\s?(m²|m2|ha\b)', text, re.I))
    property_score = listing_types * 3 + min(prices, 20) + min(areas, 20) + len(PROPERTY_WORDS.findall(text[:20000]))
    buyer_score = len(BUYER_WORDS.findall(text[:20000])) * 3
    title = ' '.join(' '.join(page.title).split())[:160]
    lead.update(signals=dict(listing_types=listing_types, prices=prices, areas=areas, property_words=property_score - listing_types * 3 - min(prices, 20) - min(areas, 20), buyer_words=buyer_score // 3), title=title)
    if buyer_score >= 3 and buyer_score >= property_score / 2:
        lead.update(status='kandidat_kupci', check_note='Tekst navodi otkup ili potražnju; interes nije potvrđen.')
    elif property_score >= 8 and (prices or listing_types):
        lead.update(status='kandidat_nekretnine', check_note='Stranica prikazuje oglase s cijenama; dostupnost i uvjeti korištenja nisu potvrđeni.')
    else:
        lead.update(status='nije_relevantno', check_note='Nema dovoljno znakova oglasa ili potražnje.')
    return lead

def due(lead, now):
    if lead['status'] == 'novo': return True
    if lead['status'] == 'nedostupno' and lead.get('checked_at'):
        return datetime.fromisoformat(lead['checked_at']) + RETRY_AFTER <= now
    return False

def load(path=LEADS_FILE):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return dict(schema_version=1, leads=[])

def save(data, path=LEADS_FILE):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + '\n')
    tmp.replace(path)

def record_observed(known_hosts, now=None, path=LEADS_FILE):
    """Called at the end of a registry pass: persist this run's observations as deduplicated leads."""
    now = now or datetime.now(timezone.utc)
    data = load(path)
    data['leads'] = merge(data['leads'], take_observed(), known_hosts, now)
    data['updated_at'] = now.isoformat()
    save(data, path)
    return data

def verify_due(max_checks=10, now=None, path=LEADS_FILE, fetcher_for=_default_fetcher):
    """Check at most `max_checks` due leads (oldest first); the file is the checkpoint between runs."""
    now = now or datetime.now(timezone.utc)
    data = load(path)
    # Due retries first (they would otherwise starve behind a growing set of new leads), then oldest new leads.
    order = sorted((l for l in data['leads'] if due(l, now)), key=lambda l: (l['status'] == 'novo', l.get('checked_at') or '', l['first_seen']))
    checked = {}
    for lead in order[:max_checks]:
        checked[lead['host']] = verify(lead, now, fetcher_for)
    data['leads'] = [checked.get(l['host'], l) for l in data['leads']]
    counts = {}
    for l in data['leads']: counts[l['status']] = counts.get(l['status'], 0) + 1
    data.update(verified_at=now.isoformat(), counts=counts)
    save(data, path)
    return data

if __name__ == '__main__':
    result = verify_due(int(sys.argv[1]) if len(sys.argv) > 1 else 10)
    print('Tragovi novih izvora:', json.dumps(result.get('counts', {}), ensure_ascii=False))
