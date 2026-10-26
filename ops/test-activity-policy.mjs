import assert from 'node:assert/strict';
import {explicitProof,PROPERTY_ACTIVE,SOURCE_ACTIVE} from '../supabase/functions/sites-platform/activity-policy.mjs';
const now=Date.parse('2026-10-26T12:00:00Z'),url='https://example.org/listing/1';
const proof={source_listing_state:'active',source_status_evidence:'Primary listing explicitly active',activity_record_url:url,activity_evidence_url:url,checked_at:new Date(now).toISOString()};
const row={kind:'property',url,facts:proof,last_seen:proof.checked_at};
assert(explicitProof(row,now));
for(const state of [null,'observed','unknown','expired','removed','sold','withdrawn'])assert(!explicitProof({...row,facts:{...proof,source_listing_state:state}},now));
assert(!explicitProof({...row,facts:{...proof,activity_record_url:url+'2'}},now));
assert(!explicitProof({...row,facts:{...proof,activity_evidence_url:'https://other.org/listing/1'}},now));
for(const offset of [1,-86400001])assert(!explicitProof({...row,facts:{...proof,checked_at:new Date(now+offset).toISOString()}},now));
assert(explicitProof({...row,facts:{...proof,checked_at:new Date(now-86400000).toISOString()}},now));
for(const k of ['deadline','auction_at','bid_deadline_at']){
 assert(!explicitProof({...row,facts:{...proof,[k]:new Date(now).toISOString()}},now));
 assert(!explicitProof({...row,facts:{...proof,[k]:'bad'}},now));
}
assert(!explicitProof({...row,facts:{}},now));
assert(explicitProof({kind:'buyer'},now));
assert(SOURCE_ACTIVE.includes('source_listing_state'));
assert(!PROPERTY_ACTIVE.includes('missing_once'));
assert(!/activity_evidence\s*[,)]/.test(PROPERTY_ACTIVE));
console.log('No-schema activity policy: status, source identity, time boundaries and expired deadlines passed');
