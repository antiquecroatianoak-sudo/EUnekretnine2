"""Keep automatically discovered candidates separate from reviewed opportunities."""
import json
from datetime import datetime, timezone
from matching import valid_url, number, refresh_matches, COUNTRY_NAMES, country_name
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


# Equal to buyerDraft() in domain.mjs (6369690655 point 2): every known criterion and call fact is kept, an unknown
# budget stays NULL, and the seat is not the EU interest. Interest comes only from the source: listed preferred
# countries, or the location of a public buy request (as site_private.sync_source_listing).
BUYER_FACTS=('property_types','conditions','cities','regions','min_area','max_area','requires_buildable','area_hard','preferred_locations','locations',
             'required_criteria','required','original_property_types','min_area_m2','max_area_m2')

def buyer_draft(row, facts):
    eu=lambda v: country_name(v) if country_name(v) in COUNTRY_NAMES.values() else None
    criteria={k:facts[k] for k in BUYER_FACTS if facts.get(k) is not None}
    criteria.update(source_url=row['url'],checked_at=row['last_seen'],candidate_source_id=row['id'])
    if facts.get('buyer_type')=='public_authority':criteria['buyer_kind']='Javno tijelo'
    if facts.get('listing_kind'):criteria['listing_kind']=facts['listing_kind']
    # A published deadline or explicit closed state ends the public demand.
    if facts.get('deadline'):criteria['call_deadline']=facts['deadline']
    if facts.get('source_listing_state') in ('expired','removed'):criteria['call_closed']=facts.get('source_status_evidence') or facts['source_listing_state']
    raw=facts.get('preferred_countries') or []
    listed=[x for x in (eu(v) for v in (raw if isinstance(raw,list) else str(raw).split(','))) if x]
    public=facts.get('transaction_type') in ('buy_request','public_buy_request') or facts.get('listing_kind')=='public_buy_request' or facts.get('buyer_type')=='public_authority'
    interest=list(dict.fromkeys(listed or ([eu(row['country'])] if public and eu(row['country']) else [])))
    criteria['interest_basis']='Države navedene u izvoru' if listed else 'Lokacija objavljene potražnje' if interest else 'Interes za države EU nije naveden u izvoru'
    # A per-m² price or a programme total is not the buyer's budget.
    budget=facts.get('budget') if number(facts.get('budget')) and facts.get('budget_unit') not in ('EUR/m2','EUR/m²','€/m²') and 'unit_budget' not in facts else None
    notes=('Javni zahtjev; provjeri lokaciju i sve uvjete. '+facts.get('location_note','')+' '+facts.get('development_note','')).strip()
    return dict(name=row['title'],country=country_name(facts.get('seat_country') or facts.get('headquarters_country') or row['country']),min_budget=None,max_budget=budget,
                preferred_countries=','.join(interest),notes=notes,verified=0,criteria_json=json.dumps(criteria,ensure_ascii=False))

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
        draft=buyer_draft(row,facts)
        result=c.execute('INSERT INTO investors(name,country,min_budget,max_budget,preferred_countries,notes,verified,criteria_json) VALUES(?,?,?,?,?,?,?,?) RETURNING id',
                         tuple(draft[k] for k in ('name','country','min_budget','max_budget','preferred_countries','notes','verified','criteria_json'))).fetchone()
        c.execute('UPDATE source_candidates SET investor_id=? WHERE id=?',(result['id'],candidate_id))
    refresh_matches(c)
    return row['kind'],result['id']
