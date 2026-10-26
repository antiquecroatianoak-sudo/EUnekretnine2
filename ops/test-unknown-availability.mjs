import assert from 'node:assert/strict';
import {explicitProof,admissibleListing,availabilityLabel,closureState,PROPERTY_ACTIVE,SOURCE_ACTIVE,retainedSQL} from '../supabase/functions/sites-platform/activity-policy.mjs';
import {readFileSync} from 'node:fs';
const now=Date.parse('2026-10-26T12:00:00Z'),url='https://example.org/listing/1';
const row=facts=>({kind:'property',url,facts});
for(const facts of [undefined,{}, {source_listing_state:'observed'}, {source_listing_state:'unknown'}, {source_listing_state:'active'}, {deadline:'invalid'}]){
 assert(admissibleListing(row(facts),now));
 assert.equal(availabilityLabel(row(facts),now),'Dostupnost nije potvrđena');
}
for(const source_listing_state of ['expired','removed','sold','withdrawn','inactive','closed']){
 assert(!admissibleListing(row({source_listing_state}),now));
 assert.equal(availabilityLabel(row({source_listing_state}),now),'Potvrđeno neaktivan');
}
const proof={source_listing_state:'active',source_status_evidence:'Primary listing explicitly active',activity_record_url:url,activity_evidence_url:url,checked_at:new Date(now).toISOString()};
assert(explicitProof(row(proof),now));
assert.equal(availabilityLabel(row(proof),now),'Aktivnost potvrđena');
for(const delta of [-86400001,1]){
 const stale={...proof,checked_at:new Date(now+delta).toISOString()};
 assert(admissibleListing(row(stale),now));assert(!explicitProof(row(stale),now));
 assert.equal(availabilityLabel(row(stale),now),'Dostupnost nije potvrđena');
}
for(const k of ['deadline','auction_at','bid_deadline_at']){
 for(const offset of [-1,0])assert(!admissibleListing(row({...proof,[k]:new Date(now+offset).toISOString()}),now));
 assert(admissibleListing(row({...proof,[k]:new Date(now+1).toISOString()}),now));
 assert.equal(closureState(row({...proof,[k]:new Date(now).toISOString()}),now),'expired');
}
assert(admissibleListing({kind:'buyer',facts:{source_listing_state:'expired'}},now));
assert(!SOURCE_ACTIVE.includes('missing_once'));
assert(!PROPERTY_ACTIVE.includes('24 hours'));
assert(SOURCE_ACTIVE.includes(retainedSQL("(site_private.safe_json(c.body_json)->'facts')")));
for(const slug of ['registry-discovery','discovery-sync']){
 assert.equal(readFileSync(new URL(`../supabase/functions/${slug}/activity-policy.mjs`,import.meta.url),'utf8'),readFileSync(new URL('../supabase/functions/sites-platform/activity-policy.mjs',import.meta.url),'utf8'));
 const index=readFileSync(new URL(`../supabase/functions/${slug}/index.js`,import.meta.url),'utf8');
 assert(index.includes('admissibleListing(r)'));assert(index.includes('availabilityLabel(r)')||index.includes('availabilityLabel(row)'));
 assert(index.includes('closureState(row)'));
}
console.log('Unknown availability retained; explicit closures/deadlines excluded; proof labels and both import paths passed.');
