"""Import an explicitly checked batch. No scraping or message sending."""
import argparse
import json
import math
from datetime import datetime, timezone
from urllib.parse import urlparse
from storage import connect
from matching import PROPERTY_TYPES, CONDITIONS, MATCH, evaluate, refresh_matches

def url(value):
    parsed = urlparse(value)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        raise ValueError('Potreban je valjan javni URL.')
    return value

def validate(item):
    for key in ('country', 'city', 'title', 'source', 'evidence_url', 'checked_at'):
        if not isinstance(item.get(key), str) or not item[key].strip():
            raise ValueError('Nedostaje polje: ' + key)
    if item['country'] not in ('Francuska', 'Nizozemska', 'Hrvatska', 'Slovenija'):
        raise ValueError('Uvoz prihvaća Francusku, Nizozemsku, Hrvatsku i Sloveniju.')
    url(item['source']); url(item['evidence_url'])
    checked = datetime.fromisoformat(item['checked_at'].replace('Z', '+00:00'))
    if checked.tzinfo is None or checked > datetime.now(timezone.utc):
        raise ValueError('Datum provjere mora imati vremensku zonu i ne smije biti u budućnosti.')
    if item.get('source_verified') is not True or item.get('listing_active') is not True:
        raise ValueError('Izvor i aktivnost oglasa moraju biti provjereni.')
    if item.get('legal') not in ('Nepoznato', 'Uredno', 'Komplikacije'):
        raise ValueError('Potreban je status pravne provjere.')
    for field, allowed in [('property_type', PROPERTY_TYPES), ('condition', CONDITIONS)]:
        if item.get(field) is not None and item[field] not in allowed: raise ValueError('Nepoznata vrijednost: ' + field)
    if item.get('buildable') not in (None, 'Da', 'Ne', 'Nepoznato'): raise ValueError('Nevaljana mogućnost gradnje.')
    for field in ('planning_evidence_url', 'legal_evidence_url', 'valuation_evidence_url'):
        if item.get(field): url(item[field])
    if item.get('available_until'):
        datetime.fromisoformat(item['available_until'])
    if item['legal'] == 'Uredno': url(item.get('legal_evidence_url', ''))
    for field in ('price', 'area', 'renovation', 'other_costs'):
        value = item.get(field)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError('Nevaljan broj: ' + field)
    if item.get('estimated_value') is not None:
        value = item['estimated_value']
        if isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value) or value <= 0:
            raise ValueError('Nevaljana tržišna procjena.')
        url(item.get('valuation_evidence_url', ''))

def run(c, items):
    for item in items: validate(item)
    inserted = 0
    try:
        for item in items:
            if c.execute('SELECT id FROM imports WHERE source_url=?', (item['source'],)).fetchone(): continue
            if c.execute('SELECT id FROM properties WHERE source=?', (item['source'],)).fetchone(): continue
            fields = ('country','city','title','price','area','source','legal','renovation','other_costs','estimated_value','property_type','condition','region','buildable','planning_evidence_url','legal_evidence_url','valuation_evidence_url','available_until')
            p = c.execute('INSERT INTO properties('+','.join(fields)+',updated) VALUES('+','.join('?' for _ in range(len(fields)+1))+') RETURNING id', tuple(item.get(f) for f in fields)+(item['checked_at'],)).fetchone()
            property_id = p['id']
            # Retain the complete submitted evidence in the audit log.
            c.execute('INSERT INTO activity(property_id,stage,notes,date) VALUES(?,?,?,?)', (property_id,'Uvoz provjerenog zapisa',json.dumps(item,ensure_ascii=False),item['checked_at']))
            c.execute('INSERT INTO imports(source_url,checked_at,evidence_url,property_id) VALUES(?,?,?,?)', (item['source'],item['checked_at'],item['evidence_url'],property_id))
            if item['legal'] == 'Uredno' and item.get('estimated_value') is not None:
                cost = sum(item[f] for f in ('price','renovation','other_costs'))
                matches = [dict(r) for r in c.execute('SELECT * FROM investors WHERE verified=1') if evaluate(dict(item, status='Novo'), dict(r))['status'] == MATCH]
                if matches:
                    message = json.dumps({'title':item['title'],'total_cost':cost,'estimated_difference':item['estimated_value']-cost,'potential_investor_ids':[r['id'] for r in matches]},ensure_ascii=False)
                    c.execute('INSERT INTO notification_outbox(property_id,created_at,message) VALUES(?,?,?)',(property_id,item['checked_at'],message))
            inserted += 1
        refresh_matches(c)
        c.commit()
    except Exception:
        c.rollback()
        raise
    return inserted

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('batch')
    args = parser.parse_args()
    with open(args.batch, encoding='utf-8') as f: items = json.load(f)
    if not isinstance(items, list): raise ValueError('Očekuje se JSON popis zapisa.')
    c = connect()
    try: print('Integrirano zapisa:', run(c, items))
    finally: c.close()


