"""Keep automatically discovered candidates separate from reviewed opportunities."""
import json
from datetime import datetime, timezone
from matching import valid_url, number, refresh_matches
from public_land_sources import keep_closed_state


def sync_snapshot(c, snapshot):
    if snapshot.get('schema_version') != 1 or not isinstance(snapshot.get('candidates'),list):
        raise ValueError('Nepoznat format dohvata izvora.')
    # Validate the whole batch before writing any row.
    for row in snapshot['candidates']:
        for key in ('id','source_id','country','kind','title','url','first_seen','last_seen'):
            if not isinstance(row.get(key),str) or not row[key].strip(): raise ValueError('Nedostaje podatak kandidata: '+key)
        if row['kind'] not in ('property','buyer') or row.get('verified') is not False or not valid_url(row['url']):
            raise ValueError('Kandidat ne može automatski postati potvrđen zapis.')
        for key in ('first_seen','last_seen'):
            if datetime.fromisoformat(row[key]).tzinfo is None: raise ValueError('Nedostaje vremenska zona dohvata.')
        if not isinstance(row.get('facts'),dict): raise ValueError('Nedostaju izvorne činjenice kandidata.')
    now=datetime.now(timezone.utc)
    for row in snapshot['candidates']:
        prior=c.execute('SELECT body_json FROM source_candidates WHERE id=?',(row['id'],)).fetchone()
        if prior:
            # Same rule as merge.mjs: missing data in a new fetch never reopens a closed call.
            row={**row,'facts':keep_closed_state(json.loads(prior['body_json']).get('facts',{}),row['facts'],now)}
        c.execute('INSERT INTO source_candidates(id,source_id,kind,title,country,url,body_json,last_seen) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,country=excluded.country,url=excluded.url,body_json=excluded.body_json,last_seen=excluded.last_seen WHERE source_candidates.last_seen<=excluded.last_seen',
                  (row['id'],row['source_id'],row['kind'],row['title'],row['country'],row['url'],json.dumps(row,ensure_ascii=False),row['last_seen']))
    for run in snapshot.get('runs',[]):
        c.execute('INSERT INTO discovery_runs(source_id,status,checked_at,body_json) VALUES(?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json WHERE discovery_runs.checked_at<=excluded.checked_at',
                  (run['source_id'],run['status'],run['checked_at'],json.dumps(run,ensure_ascii=False)))


def prepare_for_review(c, candidate_id):
    """Create an incomplete draft once; never overwrite a user's reviewed record."""
    row=c.execute('SELECT * FROM source_candidates WHERE id=?',(candidate_id,)).fetchone()
    if row is None: raise ValueError('Kandidat nije pronađen.')
    row=dict(row); data=json.loads(row['body_json']); facts=data['facts']
    if row['property_id'] or row['investor_id']: return row['kind'],row['property_id'] or row['investor_id']
    if row['kind']=='property':
        # A sale notice may describe multiple lots. No lot facts are inferred.
        result=c.execute('INSERT INTO properties(country,title,source,price,renovation,other_costs,legal,status,updated) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id',
                         (row['country'],row['title'],row['url'],facts.get('asking_price'),None,None,'Nepoznato','Provjera',row['last_seen'])).fetchone()
        c.execute('UPDATE source_candidates SET property_id=? WHERE id=?',(result['id'],candidate_id))
    else:
        # Same fields and budget rule as site_private.sync_source_listing.
        criteria={k:v for k,v in facts.items() if k in ('property_types','conditions','cities','regions','min_area','max_area','requires_buildable')}
        criteria.update(source_url=row['url'],checked_at=row['last_seen'])
        # A published deadline or explicit closed state ends the public demand.
        if facts.get('deadline'):criteria['call_deadline']=facts['deadline']
        if facts.get('source_listing_state') in ('expired','removed'):criteria['call_closed']=facts.get('source_status_evidence') or facts['source_listing_state']
        # A per-m² price or a programme total is not the buyer's budget.
        budget=facts.get('budget') if number(facts.get('budget')) and facts.get('budget_unit') not in ('EUR/m2','EUR/m²','€/m²') and 'unit_budget' not in facts else None
        notes='Javni zahtjev; provjeri budžet, lokaciju i sve uvjete. '+facts.get('location_note','')+' '+facts.get('development_note','')
        result=c.execute('INSERT INTO investors(name,country,min_budget,max_budget,preferred_countries,notes,verified,criteria_json) VALUES(?,?,?,?,?,?,?,?) RETURNING id',
                         (row['title'],row['country'],0,budget,row['country'],notes.strip(),0,json.dumps(criteria,ensure_ascii=False))).fetchone()
        c.execute('UPDATE source_candidates SET investor_id=? WHERE id=?',(result['id'],candidate_id))
    refresh_matches(c)
    return row['kind'],result['id']
