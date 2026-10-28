"""Explainable matching of recorded buyer mandates; never infers buying intent."""
import json
import math
import re
import unicodedata
from datetime import datetime, timezone
from urllib.parse import urlparse

from facts import AREA_BASIS, basis_area, compare_requirement, read_facts, requirement_label, validate_requirements

PROPERTY_TYPES = ['Zemljište', 'Kuća', 'Stan', 'Zgrada', 'Poslovni prostor']
CONDITIONS = ['Useljivo', 'Za obnovu', 'Za rušenje', 'Neizgrađeno']
INACTIVE = {'Prodano', 'Povučeno', 'Rok istekao - ishod nepoznat', 'Zatvoreno'}

COUNTRY_NAMES=dict(zip(
    ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'],
    ['Austrija','Belgija','Bugarska','Hrvatska','Cipar','Češka','Danska','Estonija','Finska','Francuska','Njemačka','Grčka','Mađarska','Irska','Italija','Latvija','Litva','Luksemburg','Malta','Nizozemska','Poljska','Portugal','Rumunjska','Slovačka','Slovenija','Španjolska','Švedska']))

def country_name(value):
    return COUNTRY_NAMES.get(str(value or '').strip().upper(),str(value or '').strip())

MATCH = 'Podudaranje kriterija'
CANDIDATE = 'Kandidat - potrebna provjera'
REJECT = 'Ne odgovara kriterijima'

def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(value or '').casefold()) if not unicodedata.combining(c)).strip()

def parse_criteria(investor):
    raw = investor.get('criteria_json') or '{}'
    try:
        result = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(result, dict): raise ValueError('Kriteriji moraju biti objekt.')
        return result
    except (ValueError, TypeError):
        return {'_invalid': True}

def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0

def valid_url(value):
    if not isinstance(value, str): return False
    p = urlparse(value)
    return p.scheme in ('http', 'https') and bool(p.netloc)

def fresh_evidence(criteria, today=None):
    try:
        value=criteria.get('checked_at')
        if not isinstance(value,str): return False
        checked = datetime.fromisoformat(value.replace('Z', '+00:00'))
        age = ((today or datetime.now(timezone.utc)) - checked).total_seconds()
        return checked.tzinfo is not None and 0 <= age <= 90 * 86400 and valid_url(criteria.get('source_url'))
    except (ValueError, TypeError):
        return False

def digest(value):
    """FNV-1a over UTF-16 units of whitespace-normalised text; equal to digest() in domain.mjs."""
    text = ' '.join(str(value if value is not None else '').split())
    units = text.encode('utf-16-le')
    h = 0x811c9dc5
    for i in range(0, len(units), 2):
        h = ((h ^ int.from_bytes(units[i:i + 2], 'little')) * 0x01000193) & 0xffffffff
    return format(h, '08x')

def check_valid(check, text, now=None):
    """A recorded check counts only for the exact checked text, within 90 days and with evidence."""
    if not isinstance(check, dict) or not isinstance(check.get('evidence'), str) or not check['evidence'].strip():
        return False
    try:
        checked = datetime.fromisoformat(str(check.get('checked_at')).replace('Z', '+00:00'))
        age = ((now or datetime.now(timezone.utc)) - checked).total_seconds()
    except (ValueError, TypeError):
        return False
    return checked.tzinfo is not None and 0 <= age <= 90 * 86400 and check.get('digest') == digest(text)

def validate_criteria(criteria):
    for key, allowed in [('property_types', PROPERTY_TYPES), ('conditions', CONDITIONS)]:
        values = criteria.get(key, [])
        if not isinstance(values, list) or any(v not in allowed for v in values):
            raise ValueError('Nepoznati kriteriji: ' + key)
    for key in ('cities', 'regions'):
        if not isinstance(criteria.get(key, []), list) or any(not isinstance(v, str) or not v.strip() for v in criteria.get(key, [])):
            raise ValueError('Lokacije moraju biti popis naziva.')
    for key in ('min_area', 'max_area', 'min_roi'):
        if criteria.get(key) is not None and not number(criteria[key]): raise ValueError('Nevaljana granica: ' + key)
    if criteria.get('min_area') is not None and criteria.get('max_area') is not None and criteria['min_area'] > criteria['max_area']:
        raise ValueError('Maksimalna površina mora biti veća ili jednaka minimalnoj.')
    if criteria.get('requires_buildable', False) not in (True, False): raise ValueError('Nevaljan uvjet gradnje.')
    if criteria.get('area_hard', False) not in (True, False): raise ValueError('Nevaljana oznaka tvrde granice površine.')
    if criteria.get('source_url') and not valid_url(criteria['source_url']): raise ValueError('Potreban je valjan URL dokaza zahtjeva kupca.')
    if criteria.get('requirements') is not None: validate_requirements(criteria['requirements'])
    if criteria.get('area_basis') is not None and criteria['area_basis'] not in AREA_BASIS: raise ValueError('Nepoznata osnova površine.')

# Property facts a pair-specific check is bound to; equal to PAIR_FACTS in domain.mjs.
PAIR_FACTS = ['id', 'country', 'region', 'city', 'title', 'property_type', 'condition', 'area', 'price', 'price_basis', 'renovation', 'other_costs',
              'legal', 'legal_evidence_url', 'buildable', 'planning_evidence_url', 'source', 'available_until', 'bid_deadline_at', 'auction_at', 'risk_notes']
PHASE = dict(REJECT='Ne odgovara potrebama kupca', PROPERTY='Mogući par – dopuna podataka o nekretnini',
             BUYER='Nekretnina provjerena – usklađivanje s potrebama kupca', REAL='Stvarna prilika – interes kupca još nije potvrđen')
PAIR_CONDITION = 'Ispunjenje dodatnih uvjeta kupca za ovu nekretninu'
# The same rules as site_private.property_eligible / investor_eligible and domain.mjs: a pair the
# database would refuse as a real opportunity stays a candidate with these open items.
ACTIVE_STATUSES = ['Aktivno', 'Provjereno', 'Novo - aktivna dražba']
SOURCE_FRESH = 'Aktualnost izvora nekretnine nije potvrđena unutar 30 dana'
ACTIVE_CHECK = 'Potrebna potvrda aktivnosti oglasa'
BUYER_RECORD = 'Zapis zahtjeva kupca u standardnom obliku (vrste, stanje, izvor, datum)'

def _stamp(value):
    if value is None or value == '': return None
    try:
        if hasattr(value, 'year') and not hasattr(value, 'hour'): value = value.isoformat()
        parsed = value if hasattr(value, 'hour') else datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None

def source_fresh(prop, now=None):
    """Mirrors source_checked_on::timestamptz between now()-30 days and now()."""
    checked, now = _stamp(prop.get('source_checked_on')), now or datetime.now(timezone.utc)
    return checked is not None and checked <= now and (now - checked).total_seconds() <= 30 * 86400

def stored_buyer_eligible(investor, criteria, now=None):
    now = now or datetime.now(timezone.utc)
    checked = _stamp(criteria.get('checked_at')) if isinstance(criteria.get('checked_at'), str) and re.search(r'(Z|[+-]\d\d:\d\d)$', criteria['checked_at']) else None
    types, conditions = criteria.get('property_types'), criteria.get('conditions')
    return (investor.get('verified') == 1 and bool((investor.get('preferred_countries') or '').strip())
            and isinstance(criteria.get('source_url'), str) and re.match(r'^https?://[^/ ]+', criteria['source_url']) is not None
            and checked is not None and checked <= now and (now - checked).total_seconds() <= 90 * 86400
            and isinstance(types, list) and bool(types) and all(v in PROPERTY_TYPES for v in types)
            and isinstance(conditions, list) and bool(conditions) and all(v in CONDITIONS for v in conditions))
SOURCE_CONDITIONS = [
 ('Provjera izvornog opisa vrste i namjene nekretnine', 'Ispunjenje izvornog opisa vrste i namjene za ovu nekretninu'),
 ('Provjera izvornih lokacijskih uvjeta kupca', 'Ispunjenje izvornih lokacijskih uvjeta kupca za ovu nekretninu'),
 ('Provjera dodatnih izvornih uvjeta kupca', 'Ispunjenje dodatnih izvornih uvjeta kupca za ovu nekretninu')]

def source_conditions(c):
    return json.dumps([c.get(k) for k in ('property_types','preferred_locations','locations','required_criteria','required')],ensure_ascii=False,separators=(',', ':'))


def _fact(value):
    if value is None or isinstance(value, str): return value
    if isinstance(value, float) and value.is_integer(): return int(value)
    if isinstance(value, (int, float)) and not isinstance(value, bool): return value
    return value.isoformat() if hasattr(value, 'isoformat') else str(value)

def pair_text(requirement, prop):
    """The buyer's condition wording plus the property facts it was checked against (as pairText in domain.mjs)."""
    # The id is compared as text, as the database driver returns bigint ids as strings in domain.mjs.
    values = [str(prop['id']) if k == 'id' and prop.get('id') is not None else _fact(prop.get(k)) for k in PAIR_FACTS]
    # Specialised facts (facts.py) join the text only when present, so earlier checks keep their digest.
    facts = read_facts(prop)
    if facts is None: values.append({'facts_invalid': str(prop.get('facts_json'))})
    elif facts: values.append({'facts': facts})
    return json.dumps([str(requirement if requirement is not None else '')] + values, ensure_ascii=False, separators=(',', ':'))

# Area tolerance, equal to areaFit() in domain.mjs: up to 15 % below the lower and 25 % above the upper bound;
# area_hard keeps the buyer's bounds strict. Unknown area is never 0.
AREA_TOLERANCE = dict(below=15, above=25)
_EPS = 1e-12

def area_fit(area, criteria):
    if not number(area) or area <= 0: return None
    hard, low, high = criteria.get('area_hard') is True, criteria.get('min_area'), criteria.get('max_area')
    ok_low = low is None or (area >= low if hard else area * 100 >= low * (100 - AREA_TOLERANCE['below']) * (1 - _EPS))
    ok_high = high is None or (area <= high if hard else area * 100 <= high * (100 + AREA_TOLERANCE['above']) * (1 + _EPS))
    deviation = 100 * (area - low) / low if low is not None and area < low else 100 * (area - high) / high if high is not None and area > high else 0
    # Half away from zero, like Math.round on the absolute value in domain.mjs for these magnitudes.
    rounded = math.floor(abs(deviation) * 10 + 0.5) / 10
    return dict(fits=ok_low and ok_high, deviation=rounded if deviation >= 0 else -rounded, hard=hard)

def _pct(v):
    return ('+' if v > 0 else '−' if v < 0 else '') + ('%g' % abs(v)).replace('.', ',') + ' %'

def evaluate(prop, investor, pair_checks=None):
    pair_checks = pair_checks or {}
    criteria = parse_criteria(investor)
    call = {k: criteria.get(k) for k in ('call_closed', 'call_deadline')} if not criteria.get('_invalid') else {}
    reasons, missing, rejected, info = [], [], [], []
    gaps = dict(property=[], buyer=[], pair=[])
    passed, checks = 0, 0
    def gap(label, side):
        missing.append(label); gaps[side].append(label)
    def check(label, buyer_known, property_known, fits):
        nonlocal passed, checks
        checks += 1
        if not buyer_known: gap(label, 'buyer')
        elif not property_known: gap(label, 'property')
        elif fits: reasons.append(label); passed += 1
        else: rejected.append(label)
    try:
        validate_criteria(criteria)
        if criteria.get('_invalid'): raise ValueError('Nevaljani kriteriji')
    except ValueError:
        gap('Ispravni strukturirani kriteriji kupca', 'buyer')
        criteria = {}
    countries = [x.strip() for x in (investor.get('preferred_countries') or '').split(',') if x.strip()]
    check('Država', bool(countries), bool(prop.get('country')), norm(country_name(prop.get('country'))) in {norm(country_name(x)) for x in countries})
    total = sum(prop[k] for k in ('price', 'renovation', 'other_costs')) if all(number(prop.get(k)) for k in ('price', 'renovation', 'other_costs')) else None
    # The property's price is a core fact; the buyer's budget is optional and never blocks a pair.
    if not number(prop.get('price')) or prop['price'] <= 0: gap('Cijena nekretnine', 'property')
    low, high = investor.get('min_budget'), investor.get('max_budget')
    if number(low) and number(high) and high > 0 and high >= low and total is not None:
        if total > high: info.append('Ukupni trošak iznad navedenog budžeta kupca (informativno)')
        elif total < low: info.append('Ukupni trošak ispod navedenog budžeta kupca (informativno)')
    for key, field, label in [('property_types', 'property_type', 'Vrsta nekretnine'), ('conditions', 'condition', 'Stanje / obnova / rušenje')]:
        wanted = criteria.get(key, [])
        check(label, bool(wanted), prop.get(field) in (PROPERTY_TYPES if field == 'property_type' else CONDITIONS), prop.get(field) in wanted)
    for key, field, label in [('cities', 'city', 'Grad'), ('regions', 'region', 'Regija')]:
        if criteria.get(key):
            check(label, True, bool(prop.get(field)), norm(prop.get(field)) in {norm(v) for v in criteria[key]})
    min_area, max_area = criteria.get('min_area'), criteria.get('max_area')
    area = prop.get('area')
    area_deviation = None
    if min_area is not None or max_area is not None:
        # Module 4, as in domain.mjs: a documented basis uses that confirmed measure; a known zero is a value.
        label = 'Površina'
        if criteria.get('area_basis'):
            b = basis_area(criteria['area_basis'], read_facts(prop) or {}, datetime.now(timezone.utc).date().isoformat())
            label = 'Površina (' + criteria['area_basis'] + ')'
            if b.get('note'): info.append(b['note'])
            fit = None if b['area'] is None else area_fit(b['area'], criteria) if b['area'] > 0 else dict(fits=min_area is None or min_area <= 0, deviation=-100, hard=criteria.get('area_hard') is True)
        else:
            fit = area_fit(area, criteria)
        check(label, True, fit is not None, bool(fit and fit['fits']))
        if fit:
            area_deviation = fit['deviation']
            if fit['deviation'] and fit['fits']: info.append('Površina ' + _pct(fit['deviation']) + ' od tražene granice, unutar tolerancije −15 %/+25 %')
            elif not fit['fits']: info.append('Površina ' + _pct(fit['deviation']) + ' od tražene granice, izvan ' + ('tvrde granice kupca' if fit['hard'] else 'tolerancije −15 %/+25 %'))
    elif not number(area) or area <= 0:
        gap('Površina nekretnine', 'property')
    if criteria.get('requires_buildable'):
        check('Potvrđena mogućnost gradnje', True, prop.get('buildable') in ('Da', 'Ne'), prop.get('buildable') == 'Da' and valid_url(prop.get('planning_evidence_url')))
        if prop.get('buildable') == 'Da' and not valid_url(prop.get('planning_evidence_url')):
            # A claim without evidence is unknown, not a confirmed planning refusal.
            rejected.remove('Potvrđena mogućnost gradnje')
            gap('Dokaz mogućnosti gradnje', 'property')
    roi = 100 * (prop['estimated_value'] - total) / total if number(prop.get('estimated_value')) and total is not None and total > 0 else None
    if criteria.get('min_roi') is not None:
        check('Minimalni jednostavni ROI', True, roi is not None and valid_url(prop.get('valuation_evidence_url')), roi is not None and roi >= criteria['min_roi'])
    if not investor.get('verified') or not fresh_evidence(criteria):
        gap('Potvrđen zahtjev kupca s izvorom i provjerom unutar 90 dana', 'buyer')
    # Checking the wording of the buyer's notes confirms what they ask for, not that this property meets it.
    if (investor.get('notes') or '').strip():
        if not check_valid(criteria.get('notes_check'), investor.get('notes')): gap('Dodatni uvjeti iz napomena za ručnu provjeru', 'buyer')
        else:
            evidence = pair_checks.get(PAIR_CONDITION) or {}
            if not check_valid(evidence, pair_text(investor.get('notes'), prop)) or evidence.get('outcome') not in ('zadovoljava', 'ne zadovoljava'): gap(PAIR_CONDITION, 'pair')
            elif evidence['outcome'] == 'ne zadovoljava': rejected.append(PAIR_CONDITION)
    source_text = source_conditions(criteria)
    applies = [any(v not in PROPERTY_TYPES for v in criteria.get('property_types', [])),
               bool(criteria.get('preferred_locations') or criteria.get('locations')),
               bool(criteria.get('required_criteria') or criteria.get('required'))]
    for applies_here, (wording, fulfilment) in zip(applies, SOURCE_CONDITIONS):
        if not applies_here: continue
        if not check_valid(criteria.get('source_conditions_check'), source_text): gap(wording, 'buyer')
        else:
            evidence = pair_checks.get(fulfilment) or {}
            if not check_valid(evidence, pair_text(source_text, prop)) or evidence.get('outcome') not in ('zadovoljava', 'ne zadovoljava'): gap(fulfilment, 'pair')
            elif evidence['outcome'] == 'ne zadovoljava': rejected.append(fulfilment)
    # Documented requirements (facts-v1), as in domain.mjs: a mandatory one is a criterion, a wish only informs.
    if criteria.get('requirements'):
        facts = read_facts(prop)
        if facts is None: gap('Ispravni strukturirani podaci nekretnine', 'property')
        today = datetime.now(timezone.utc).date().isoformat()
        for q in criteria['requirements']:
            state, label = compare_requirement(q, facts or {}, today), requirement_label(q['key'])
            if q['mandatory']: check(label, True, state in ('met', 'unmet'), state == 'met')
            else: info.append(label + (' — želja ispunjena' if state == 'met' else ' — želja nije ispunjena (informativno)' if state == 'unmet' else ' — želja, podatak nije potvrđen'))
    if not valid_url(prop.get('source')): gap('Izvor oglasa', 'property')
    if not (prop.get('city') or '').strip(): gap('Grad nekretnine', 'property')
    if not source_fresh(prop): gap(SOURCE_FRESH, 'property')
    if prop.get('status') not in ACTIVE_STATUSES: gap(ACTIVE_CHECK, 'property')
    if not stored_buyer_eligible(investor, parse_criteria(investor)): gap(BUYER_RECORD, 'buyer')
    if prop.get('legal') == 'Komplikacije': rejected.append('Pravne komplikacije')
    elif prop.get('legal') != 'Uredno' or not valid_url(prop.get('legal_evidence_url')):
        gap('Dokaz pravne provjere', 'property')
    expired = False
    deadline=prop.get('available_until') or prop.get('bid_deadline_at')
    if deadline:
        try:
            parsed=datetime.fromisoformat(str(deadline).replace('Z','+00:00'))
            expired=(parsed < datetime.now(timezone.utc)) if parsed.tzinfo else (parsed.date() < datetime.now(timezone.utc).date())
        except (ValueError, TypeError): gap('Valjan rok dostupnosti', 'property')
    status=norm(prop.get('status'))
    if prop.get('status') in INACTIVE or any(status.startswith(prefix) for prefix in ('prodano','povuceno','rok istekao','zatvoreno')) or expired: rejected.append('Nekretnina više nije aktivna')
    # A public buyer's call that closed or passed its published deadline is no longer demand.
    # The latest linked source state counts, like the database lifecycle; the investor row stays untouched.
    linked = investor.get('_call_facts') or {}
    call_closed = bool(call.get('call_closed')) or linked.get('source_listing_state') in ('expired', 'removed')
    for deadline in (call.get('call_deadline'), linked.get('deadline')):
        if not deadline: continue
        try: call_closed = call_closed or datetime.fromisoformat(str(deadline)[:10]).date() < datetime.now(timezone.utc).date()
        except ValueError: gap('Valjan rok javnog poziva kupca', 'buyer')
    if call_closed: rejected.append('Javni poziv kupca je zatvoren ili istekao')
    missing = list(dict.fromkeys(missing))
    gaps = {k: list(dict.fromkeys(v)) for k, v in gaps.items()}
    status = REJECT if rejected else CANDIDATE if missing else MATCH
    phase = PHASE['REJECT'] if rejected else PHASE['PROPERTY'] if gaps['property'] else PHASE['BUYER'] if missing else PHASE['REAL']
    return dict(status=status, phase=phase, score=round(100 * passed / checks) if checks else 0,
                reasons=reasons, missing=missing, rejected=rejected, gaps=gaps, info=info, total_cost=total, roi=roi,
                **({'area_deviation': area_deviation} if area_deviation is not None else {}))

def refresh_matches(c):
    """Refresh latest results without committing the caller's transaction."""
    props = [dict(r) for r in c.execute('SELECT * FROM properties')]
    investors = [dict(r) for r in c.execute('SELECT * FROM investors')]
    linked = {r['investor_id']: json.loads(r['body_json']).get('facts', {}) for r in c.execute(
        'SELECT investor_id,body_json FROM source_candidates WHERE investor_id IS NOT NULL')}
    for investor in investors:
        investor['_call_facts'] = linked.get(investor['id'])
    for prop in props:
        for investor in investors:
            result = evaluate(prop, investor)
            payload = json.dumps(result, ensure_ascii=False, sort_keys=True)
            c.execute('INSERT INTO match_results(property_id,investor_id,result_json,updated) VALUES(?,?,?,?) ON CONFLICT(property_id,investor_id) DO UPDATE SET result_json=excluded.result_json,updated=excluded.updated WHERE match_results.result_json<>excluded.result_json',
                      (prop['id'], investor['id'], payload, datetime.now(timezone.utc).isoformat()))
    # Obsolete ready notifications must not survive a criteria/property change.
    for row in c.execute("SELECT id,property_id FROM notification_outbox WHERE status='Spremno'").fetchall():
        results = c.execute('SELECT result_json FROM match_results WHERE property_id=?', (row['property_id'],)).fetchall()
        if not any(json.loads(r['result_json'])['status'] == MATCH for r in results):
            c.execute("UPDATE notification_outbox SET status='Potrebna ponovna provjera' WHERE id=?", (row['id'],))

def ranked_matches(c):
    rows = []
    for row in c.execute('SELECT m.*,p.title,i.name FROM match_results m JOIN properties p ON p.id=m.property_id JOIN investors i ON i.id=m.investor_id'):
        item = dict(row)
        item.update(json.loads(item.pop('result_json')))
        rows.append(item)
    order = {MATCH: 0, CANDIDATE: 1, REJECT: 2}
    return sorted(rows, key=lambda r: (order[r['status']], -r['score'], r['property_id'], r['investor_id']))
