"""Fail-closed listing activity checks, before persistence and matching.

A fetch timestamp is not a positive status. Only a record-bound explicit status
from the primary source counts; a later failed check never renews that evidence.
"""
from datetime import datetime, timezone, timedelta
from urllib.parse import urlsplit

MAX_AGE = timedelta(hours=24)
DEADLINES = ('deadline', 'bid_deadline_at', 'available_until', 'auction_at')

def stamp(value):
    try:
        result = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return result if result.tzinfo else None
    except (ValueError, TypeError):
        return None

def https(value):
    try:
        p = urlsplit(value)
        return p.scheme == 'https' and bool(p.hostname) and not p.username and not p.password
    except (ValueError, TypeError, AttributeError):
        return False

def activity_valid(url, facts, checked_at, now=None):
    now = now or datetime.now(timezone.utc)
    checked = stamp(checked_at)
    if not isinstance(facts, dict) or not https(url) or checked is None or not timedelta(0) <= now - checked <= MAX_AGE:
        return False
    evidence = facts.get('source_status_evidence')
    if facts.get('source_listing_state') != 'active' or not isinstance(evidence, str) or len(evidence.strip()) < 12:
        return False
    # Evidence is explicitly bound to this record, not a generic portal page.
    if facts.get('activity_record_url') != url or not https(facts.get('activity_evidence_url')):
        return False
    if urlsplit(url).hostname.removeprefix('www.') != urlsplit(facts['activity_evidence_url']).hostname.removeprefix('www.'):
        return False
    for key in DEADLINES:
        if facts.get(key):
            end = stamp(facts[key])
            if end is None or end <= now:
                return False
    return True

def candidate_active(row, now=None):
    return row.get('kind') != 'property' or activity_valid(row.get('url'), row.get('facts'), (row.get('facts') or {}).get('checked_at'), now)

def property_active(row, now=None):
    import json
    try:
        evidence = row.get('activity_evidence') or {}
        if isinstance(evidence, str): evidence = json.loads(evidence)
        if not isinstance(evidence, dict): return False
        return activity_valid(row.get('source'), evidence, evidence.get('checked_at'), now)
    except (ValueError, TypeError):
        return False

def checked_activity(url, evidence_url, quote, checked_at, **extra):
    return dict(source_listing_state='active', source_status_evidence=quote,
                activity_record_url=url, activity_evidence_url=evidence_url,
                checked_at=checked_at, **extra)
