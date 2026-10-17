"""Explainable matching of recorded buyer mandates; never infers buying intent."""
import json
import math
import unicodedata
from datetime import datetime, timezone
from urllib.parse import urlparse

PROPERTY_TYPES = ['Zemljište', 'Kuća', 'Stan', 'Zgrada', 'Poslovni prostor']
CONDITIONS = ['Useljivo', 'Za obnovu', 'Za rušenje', 'Neizgrađeno']
INACTIVE = {'Prodano', 'Povučeno', 'Rok istekao - ishod nepoznat', 'Zatvoreno'}
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
        checked = datetime.fromisoformat(criteria.get('checked_at', '').replace('Z', '+00:00'))
        age = ((today or datetime.now(timezone.utc)) - checked).total_seconds()
        return checked.tzinfo is not None and 0 <= age <= 90 * 86400 and valid_url(criteria.get('source_url'))
    except (ValueError, TypeError):
        return False

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
    if criteria.get('source_url') and not valid_url(criteria['source_url']): raise ValueError('Potreban je valjan URL dokaza zahtjeva kupca.')

def evaluate(prop, investor):
    criteria = parse_criteria(investor)
    reasons, missing, rejected = [], [], []
    passed, checks = 0, 0
    def check(label, known, fits):
        nonlocal passed, checks
        checks += 1
        if not known: missing.append(label)
        elif fits: reasons.append(label); passed += 1
        else: rejected.append(label)
    try:
        validate_criteria(criteria)
        if criteria.get('_invalid'): raise ValueError('Nevaljani kriteriji')
    except ValueError:
        missing.append('Ispravni strukturirani kriteriji kupca')
        criteria = {}
    countries = [x.strip() for x in (investor.get('preferred_countries') or '').split(',') if x.strip()]
    check('Država', bool(countries and prop.get('country')), norm(prop.get('country')) in {norm(x) for x in countries})
    total = sum(prop[k] for k in ('price', 'renovation', 'other_costs')) if all(number(prop.get(k)) for k in ('price', 'renovation', 'other_costs')) else None
    low, high = investor.get('min_budget'), investor.get('max_budget')
    budget_known = number(low) and number(high) and high > 0 and high >= low and total is not None
    check('Ukupni trošak unutar budžeta', budget_known, budget_known and low <= total <= high)
    for key, field, label in [('property_types', 'property_type', 'Vrsta nekretnine'), ('conditions', 'condition', 'Stanje / obnova / rušenje')]:
        wanted = criteria.get(key, [])
        check(label, bool(wanted) and prop.get(field) in (PROPERTY_TYPES if field == 'property_type' else CONDITIONS), prop.get(field) in wanted)
    for key, field, label in [('cities', 'city', 'Grad'), ('regions', 'region', 'Regija')]:
        if criteria.get(key):
            check(label, bool(prop.get(field)), norm(prop.get(field)) in {norm(v) for v in criteria[key]})
    min_area, max_area = criteria.get('min_area'), criteria.get('max_area')
    if min_area is not None or max_area is not None:
        area = prop.get('area')
        check('Površina', number(area) and area > 0, number(area) and (min_area is None or area >= min_area) and (max_area is None or area <= max_area))
    if criteria.get('requires_buildable'):
        check('Potvrđena mogućnost gradnje', prop.get('buildable') in ('Da', 'Ne'), prop.get('buildable') == 'Da' and valid_url(prop.get('planning_evidence_url')))
        if prop.get('buildable') == 'Da' and not valid_url(prop.get('planning_evidence_url')):
            # A claim without evidence is unknown, not a confirmed planning refusal.
            rejected.remove('Potvrđena mogućnost gradnje')
            missing.append('Dokaz mogućnosti gradnje')
    roi = 100 * (prop['estimated_value'] - total) / total if number(prop.get('estimated_value')) and total is not None and total > 0 else None
    if criteria.get('min_roi') is not None:
        check('Minimalni jednostavni ROI', roi is not None and valid_url(prop.get('valuation_evidence_url')), roi is not None and roi >= criteria['min_roi'])
    if not investor.get('verified') or not fresh_evidence(criteria):
        missing.append('Potvrđen zahtjev kupca s izvorom i provjerom unutar 90 dana')
    if (investor.get('notes') or '').strip():
        missing.append('Dodatni uvjeti iz napomena za ručnu provjeru')
    if not valid_url(prop.get('source')): missing.append('Izvor oglasa')
    if prop.get('legal') == 'Komplikacije': rejected.append('Pravne komplikacije')
    elif prop.get('legal') != 'Uredno' or not valid_url(prop.get('legal_evidence_url')):
        missing.append('Dokaz pravne provjere')
    expired = False
    if prop.get('available_until'):
        try: expired = datetime.fromisoformat(prop['available_until']).date() < datetime.now(timezone.utc).date()
        except (ValueError, TypeError): missing.append('Valjan rok dostupnosti')
    if prop.get('status') in INACTIVE or expired: rejected.append('Nekretnina više nije aktivna')
    status = REJECT if rejected else CANDIDATE if missing else MATCH
    return dict(status=status, score=round(100 * passed / checks) if checks else 0,
                reasons=reasons, missing=missing, rejected=rejected, total_cost=total, roi=roi)

def refresh_matches(c):
    """Refresh latest results without committing the caller's transaction."""
    props = [dict(r) for r in c.execute('SELECT * FROM properties')]
    investors = [dict(r) for r in c.execute('SELECT * FROM investors')]
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
