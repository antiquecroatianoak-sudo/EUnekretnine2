"""Explicit official public land acquisition calls; never government land sales."""
import hashlib
import re
from datetime import datetime, timezone

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
}

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
    stamp = now or datetime.now(timezone.utc).isoformat()
    excerpt = text[max(0, match.start()-120):match.end()+700]
    facts = {
        'transaction_type': 'buy_request', 'buyer_type': 'public_authority',
        'authority_level': config['authority_level'], 'entity_name': config['entity'],
        'identity_source_url': source['url'], 'intent_source_url': source['url'],
        'intent_evidence': excerpt, 'evidence_excerpt': excerpt,
        'property_types': ['Zemljište'], 'purpose': config['purpose'],
        'budget': None, 'deadline': None,
        'availability': 'Javni poziv opažen; aktualni rok i potpuni uvjeti zahtijevaju pregled dokumentacije.',
        'interest': 'Javna potražnja; interes za pojedinačnu nekretninu nije potvrđen.',
        'review_required': ['Rok i otvorenost poziva', 'Potpuni lokacijski i urbanistički uvjeti',
                            'Ovlaštenje ponuditelja', 'Uvjeti sudjelovanja i dokumentacija'],
    }
    if config.get('regions'):
        facts['regions'] = config['regions']
    return {'id': 'registry:buyer:'+hashlib.sha256(source['url'].encode()).hexdigest()[:32],
            'source_id': 'registry-'+str(source['id']), 'kind': 'buyer',
            'title': config['entity']+' — javna potražnja za zemljištem',
            'country': config['country'], 'url': source['url'],
            'first_seen': stamp, 'last_seen': stamp, 'verified': False,
            'status': 'Za provjeru', 'facts': facts}
