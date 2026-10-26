import assert from 'node:assert/strict';
import {activityValid,candidateActive,ACTIVITY_MAX_AGE} from './supabase/functions/discovery-sync/active-listings.mjs';
const now=Date.parse('2026-10-26T12:00:00Z'),url='https://example.com/listing/123';
const f={source_listing_state:'active',source_status_evidence:'Explicit primary status: active',activity_record_url:url,activity_evidence_url:url,checked_at:new Date(now).toISOString()};
assert(activityValid(url,f,f.checked_at,now));
for(const state of [null,'unknown','observed','removed','sold','expired'])assert(!activityValid(url,{...f,source_listing_state:state},f.checked_at,now));
assert(!activityValid(url,{...f,activity_record_url:url+'4'},f.checked_at,now));
assert(!activityValid(url,{...f,activity_evidence_url:'https://other.com/123'},f.checked_at,now));
assert(activityValid(url,f,new Date(now-ACTIVITY_MAX_AGE).toISOString(),now));
assert(!activityValid(url,f,new Date(now-ACTIVITY_MAX_AGE-1).toISOString(),now));
assert(!activityValid(url,f,new Date(now+1).toISOString(),now));
for(const key of ['deadline','bid_deadline_at','available_until','auction_at']){
 assert(!activityValid(url,{...f,[key]:f.checked_at},f.checked_at,now));
 assert(!activityValid(url,{...f,[key]:'bad'},f.checked_at,now));
 assert(activityValid(url,{...f,[key]:new Date(now+1).toISOString()},f.checked_at,now));
}
assert(candidateActive({kind:'buyer'},now));
assert(!candidateActive({kind:'property',url,facts:{}},now));
console.log('Activity status, record identity, freshness, conflicts and deadlines: passed');
