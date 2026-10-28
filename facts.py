"""Data contract facts-v1 for specialised property facts and documented buyer requirements; mirrors
supabase/functions/sites-platform/facts.mjs. ops/facts-vectors-v1.json holds the vectors both must pass identically.
Unknown is never False or zero; a requirement that cannot be compared stays a visible open item."""
import json
import re
from datetime import date

FACTS_VERSION = 'facts-v1'
FACT_STATUS = ('potvrđeno', 'nepotvrđeno', 'proturječno')
FACT_ORIGIN = ('izvor', 'ručno', 'partner', 'predloženo')
UNITS = {'m2': ('area', 1), 'ha': ('area', 10000), 'm': ('length', 1), 'kW': ('power', 1), 'MW': ('power', 1000), 'kom': ('count', 1)}
FACTS = {
    'land_total': dict(label='Ukupno oglašeno zemljište', type='number', dim='area'),
    'land_owned': dict(label='Zemljište u vlasništvu uključeno u prodaju', type='number', dim='area'),
    'land_leased': dict(label='Zakupljeno zemljište', type='number', dim='area'),
    'building_area': dict(label='Površina zgrada', type='number', dim='area'),
    'usable_area': dict(label='Korisna površina', type='number', dim='area'),
    'rooms': dict(label='Broj soba / smještajnih jedinica', type='number', dim='count'),
    'hotel_category': dict(label='Dokumentirana kategorija smještaja', type='number', dim='count'),
    'clear_height': dict(label='Dokumentirana svijetla visina', type='number', dim='length'),
    'power': dict(label='Priključna električna snaga', type='number', dim='power'),
    'truck_access': dict(label='Pristup kamionima / utovar', type='boolean'),
    'water_rights': dict(label='Dokumentirana prava na vodu', type='boolean'),
    'operating': dict(label='Objekt posluje', type='boolean'),
    'subtype': dict(label='Podvrsta / namjena', type='enum',
                    values=('hotel', 'turistički smještaj', 'skladište / logistika', 'industrijski objekt', 'farma', 'mješovita imovina')),
}
OPS = {'number': ('min', 'max'), 'boolean': ('equals',), 'enum': ('includes',)}


def _day(v):
    if not isinstance(v, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', v):
        return False
    try:
        return date.fromisoformat(v).isoformat() == v
    except ValueError:
        return False


def _text(v, limit):
    return isinstance(v, str) and v.strip() != '' and len(v) <= limit and not re.search(r'[\x00-\x1f]', v)


def _is_number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and v not in (float('inf'), float('-inf')) and v >= 0


def _check_value(spec, value, unit, where):
    if spec['type'] == 'number':
        if not _is_number(value): raise ValueError(where + ': vrijednost mora biti nenegativan broj.')
        if unit not in UNITS or UNITS[unit][0] != spec['dim']: raise ValueError(where + ': jedinica mora biti dimenzije ' + spec['dim'] + '.')
    elif spec['type'] == 'boolean':
        if not isinstance(value, bool): raise ValueError(where + ': vrijednost mora biti da/ne.')
    else:
        for v in value if isinstance(value, list) else [value]:
            if v not in spec['values']: raise ValueError(where + ': nepoznata vrijednost.')


def validate_facts(raw):
    f = json.loads(raw) if isinstance(raw, str) else raw
    if not isinstance(f, dict): raise ValueError('Podaci nekretnine moraju biti objekt.')
    out = {}
    for key, v in f.items():
        spec = FACTS.get(key)
        if not spec: raise ValueError('Nepoznat podatak nekretnine: ' + str(key))
        if not isinstance(v, dict): raise ValueError(spec['label'] + ': neispravan zapis.')
        _check_value(spec, v.get('value'), v.get('unit'), spec['label'])
        if spec['type'] == 'enum' and isinstance(v.get('value'), list): raise ValueError(spec['label'] + ': nekretnina ima jednu podvrstu.')
        if v.get('status') not in FACT_STATUS or v.get('origin') not in FACT_ORIGIN: raise ValueError(spec['label'] + ': status i podrijetlo su obavezni.')
        if v['status'] == 'potvrđeno' and not _text(v.get('evidence'), 2000): raise ValueError(spec['label'] + ': potvrđen podatak traži dokaz.')
        if v.get('evidence') is not None and not _text(v.get('evidence'), 2000): raise ValueError(spec['label'] + ': neispravan dokaz.')
        if not _day(v.get('observed_on')): raise ValueError(spec['label'] + ': datum opažanja YYYY-MM-DD je obavezan.')
        if v.get('valid_until') is not None and (not _day(v['valid_until']) or v['valid_until'] < v['observed_on']): raise ValueError(spec['label'] + ': neispravan rok važenja.')
        out[key] = {k: v[k] for k in ('value', 'unit', 'origin', 'status', 'evidence', 'observed_on', 'valid_until') if v.get(k) is not None}
        if 'evidence' in out[key]: out[key]['evidence'] = out[key]['evidence'].strip()
    return out


def validate_requirements(items):
    if not isinstance(items, list) or len(items) > 50: raise ValueError('Zahtjevi moraju biti popis (najviše 50).')
    seen, out = set(), []
    for n, q in enumerate(items):
        where = 'Zahtjev ' + str(n + 1)
        spec = FACTS.get(q.get('key')) if isinstance(q, dict) else None
        if not spec: raise ValueError(where + ': nepoznat podatak.')
        if q.get('op') not in OPS[spec['type']]: raise ValueError(where + ': nevaljana usporedba.')
        _check_value(spec, q.get('value'), q.get('unit'), where)
        if not isinstance(q.get('mandatory'), bool): raise ValueError(where + ': odredi je li uvjet obavezan ili želja.')
        if not _text(q.get('quote'), 500): raise ValueError(where + ': potreban je izvorni navod zahtjeva.')
        ident = (q['key'], q['op'])
        if ident in seen: raise ValueError(where + ': isti uvjet je naveden dvaput.')
        seen.add(ident)
        out.append({k: q[k] for k in ('key', 'op', 'value', 'unit', 'mandatory') if q.get(k) is not None} | {'quote': q['quote'].strip()})
    return out


def read_facts(prop):
    raw = (prop or {}).get('facts_json')
    if raw is None or raw == '': return {}
    try:
        return validate_facts(raw)
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def compare_requirement(q, facts, today):
    spec, f = FACTS[q['key']], (facts or {}).get(q['key'])
    if not f: return 'unknown'
    if f['status'] == 'proturječno': return 'conflict'
    if f['status'] != 'potvrđeno': return 'unknown'
    if f.get('valid_until') and f['valid_until'] < today: return 'expired'
    if spec['type'] == 'number':
        a, b = f['value'] * UNITS[f['unit']][1], q['value'] * UNITS[q['unit']][1]
        fits = a >= b if q['op'] == 'min' else a <= b
    elif spec['type'] == 'boolean':
        fits = f['value'] is q['value']
    else:
        fits = f['value'] in (q['value'] if isinstance(q['value'], list) else [q['value']])
    return 'met' if fits else 'unmet'


def requirement_label(key):
    return 'Uvjet zahtjeva: ' + FACTS[key]['label']
