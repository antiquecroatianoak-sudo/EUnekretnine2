"""Record-bound direct or agency contact, matching domain.mjs. No inferred contacts."""
import json,re
from urllib.parse import urlparse

def _url(value):
    if not isinstance(value,str) or re.search(r'[\s\x00-\x1f]',value):return False
    try:
        p=urlparse(value)
        return p.scheme in ('http','https') and bool(p.hostname) and not p.username and not p.password
    except ValueError:return False

def contact_route(row):
    try:
        c=row.get('contact_json');c=json.loads(c) if isinstance(c,str) else c
        if not isinstance(c,dict):return None
        criteria=row.get('criteria_json') or '{}';criteria=json.loads(criteria) if isinstance(criteria,str) else criteria
        source=row.get('source') or (criteria.get('source_url') if isinstance(criteria,dict) else None)
        text=lambda v:isinstance(v,str) and bool(v.strip()) and len(v)<=2000 and not re.search(r'[\x00-\x1f]',v)
        endpoint=(text(c.get('email')) and re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',c['email']) or
                  text(c.get('phone')) and re.fullmatch(r'\+?[0-9 ()/.-]{7,30}',c['phone']) and len(re.sub(r'\D','',c['phone']))>=7 or
                  text(c.get('contact_url')) and _url(c['contact_url']))
        if c.get('mode') not in ('direct','agency') or c.get('permitted') is not True or not endpoint or not text(c.get('name')) or not _url(c.get('evidence_url')) or not _url(source) or c.get('record_reference')!=source:return None
        if c['mode']=='agency' and (not text(c.get('agency_name')) or c.get('represents_record') is not True):return None
        return dict(mode=c['mode'],label='Kontakt preko agencije' if c['mode']=='agency' else 'Izravan kontakt')
    except (ValueError,TypeError):return None
