import {strict as assert} from 'node:assert';
import {suggestion} from './supabase/functions/discovery-sync/suggestions.mjs';
import {CANDIDATE} from './supabase/functions/discovery-sync/domain.mjs';
import {mergeCandidate} from './supabase/functions/registry-discovery/merge.mjs';
const now=Date.parse('2026-10-22T12:00:00Z'),day=new Date(now).toISOString().slice(0,10);
// A public authority imported from an official call: no budget is published.
const buyer={id:1,name:'Galway County Council — javna potražnja za zemljištem',preferred_countries:'Irska',min_budget:null,max_budget:null,verified:0,
 notes:'Javni oglas potražnje; identitet krajnjeg kupca i interes za pojedinu nekretninu nisu potvrđeni.',
 criteria_json:JSON.stringify({property_types:['Zemljište'],regions:['Galway'],source_url:'https://www.galway.ie/en/housing/housing-delivery/land-property-acquisition',checked_at:'2026-10-22T09:39:02Z'})};
const land={id:7,country:'Irska',region:'Galway',property_type:'Zemljište',source:'https://example.ie/listing/7',price:180000,renovation:null,other_costs:null,status:'Aktivno',source_checked_on:day,legal:'Nepoznato'};

// Unknown budget keeps a candidate, but it can never become a confirmed deal.
let r=suggestion(land,buyer,now);
assert.equal(r.status,CANDIDATE);
assert(r.missing.includes('Ukupni trošak unutar budžeta'));
assert(!r.rejected.length);
r=suggestion({...land,price:null},buyer,now);
assert.equal(r.status,CANDIDATE,'unknown price is also unknown, not rejected');

// Known non-matching criteria exclude the pair.
assert.equal(suggestion({...land,property_type:'Kuća'},buyer,now),null,'wrong type');
assert.equal(suggestion({...land,region:'Dublin'},buyer,now),null,'known region outside the call');
assert.equal(suggestion({...land,country:'Slovenija'},buyer,now),null,'other country');
assert.equal(suggestion(land,{...buyer,max_budget:100000},now),null,'published budget exceeded');
assert.equal(suggestion({...land,auction_at:'2026-10-01T10:00:00Z'},buyer,now),null,'expired auction');
// A missing region on the listing is missing data, not a rejection.
assert.equal(suggestion({...land,region:null},buyer,now).status,CANDIDATE);

// Merge keeps manual review, identity and first_seen; duplicates keep one stored id.
const source={id:100,country:'IE',url:'https://www.galway.ie/en/housing/housing-delivery/land-property-acquisition'};
const existing={id:'registry:buyer:'+'a'.repeat(32),source_id:'registry-100',body_json:JSON.stringify({
 id:'registry:buyer:'+'a'.repeat(32),status:'Provjereno ručno',verified:true,first_seen:'2026-10-20T08:00:00Z',match_suggestions:[{investor_id:3}],
 facts:{deadline:'2026-07-10',source_listing_state:'expired',reviewer_note:'Nazvan ured 21.10.',entity_name:'Galway County Council'}})};
const row={id:'registry:buyer:'+'b'.repeat(32),source_id:'registry-100',kind:'buyer',url:source.url,title:'Galway County Council — javna potražnja za zemljištem',
 first_seen:'2026-10-22T09:39:02Z',last_seen:'2026-10-22T09:39:02Z',verified:false,status:'Za provjeru',
 facts:{deadline:null,budget:null,source_listing_state:'active',source_status_evidence:'Poziv opažen bez oznake zatvaranja i bez isteklog objavljenog roka',entity_name:'Galway County Council'}};
const m=mergeCandidate(existing,row,source,now);
assert.equal(m.id,existing.id,'deduplicated against the stored record');
assert.equal(m.status,'Provjereno ručno');
assert.equal(m.verified,true,'manual verification is not reset by an import');
assert.equal(m.first_seen,'2026-10-20T08:00:00Z');
assert.deepEqual(m.match_suggestions,[{investor_id:3}]);
assert.equal(m.facts.reviewer_note,'Nazvan ured 21.10.');
assert.equal(m.country,'Irska');
// Not published in the latest fetch: kept and reported, never silently erased.
assert.equal(m.facts.deadline,'2026-07-10');
assert(m.facts.not_observed_in_latest_fetch.includes('deadline'));
// An explicit state replaces the earlier closure, so a reopened call is not stuck as expired.
assert.equal(m.facts.source_listing_state,'active');
// A new record never arrives verified.
assert.equal(mergeCandidate(null,row,source,now).verified,false);
console.log('Public land matching and merge checks passed.');
