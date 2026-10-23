import {strict as assert} from 'node:assert';
import {suggestion} from './supabase/functions/discovery-sync/suggestions.mjs';
import {CANDIDATE,PHASE} from './supabase/functions/discovery-sync/domain.mjs';
import {mergeCandidate,reopens} from './supabase/functions/registry-discovery/merge.mjs';
const now=Date.parse('2026-10-22T12:00:00Z'),day=new Date(now).toISOString().slice(0,10);
// A public authority imported from an official call: no budget is published.
const buyer={id:1,name:'Galway County Council — javna potražnja za zemljištem',preferred_countries:'Irska',min_budget:null,max_budget:null,verified:0,
 notes:'Javni oglas potražnje; identitet krajnjeg kupca i interes za pojedinu nekretninu nisu potvrđeni.',
 criteria_json:JSON.stringify({property_types:['Zemljište'],regions:['Galway'],source_url:'https://www.galway.ie/en/housing/housing-delivery/land-property-acquisition',checked_at:'2026-10-22T09:39:02Z'})};
const land={id:7,country:'Irska',region:'Galway',property_type:'Zemljište',source:'https://example.ie/listing/7',price:180000,renovation:null,other_costs:null,status:'Aktivno',source_checked_on:day,legal:'Nepoznato'};

// A buyer need not disclose a budget (owner, 6344490047/6344511552): an unknown budget is never a gap.
let r=suggestion(land,buyer,now);
assert.equal(r.status,CANDIDATE);
assert(!r.missing.some(v=>/budžet/i.test(v)),'unknown budget does not keep the pair incomplete');
assert(!r.rejected.length);
assert.equal(r.phase,PHASE.PROPERTY,'the listing still needs its legal check and area');
assert(r.gaps.property.includes('Dokaz pravne provjere')&&r.gaps.buyer.includes('Potvrđen zahtjev kupca s izvorom i provjerom unutar 90 dana'));
r=suggestion({...land,price:null},buyer,now);
assert.equal(r.status,CANDIDATE,'unknown price is also unknown, not rejected');
assert(r.gaps.property.includes('Cijena nekretnine'),'the property price stays a core fact');

// Known non-matching criteria exclude the pair.
assert.equal(suggestion({...land,property_type:'Kuća'},buyer,now),null,'wrong type');
assert.equal(suggestion({...land,region:'Dublin'},buyer,now),null,'known region outside the call');
assert.equal(suggestion({...land,country:'Slovenija'},buyer,now),null,'other country');
// A published budget is informative: exceeding it is shown, never a reason to drop the pair.
const over=suggestion({...land,renovation:0,other_costs:0},{...buyer,min_budget:0,max_budget:100000},now);
assert(over&&!over.rejected.length&&over.info.includes('Ukupni trošak iznad navedenog budžeta kupca (informativno)'));
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
// Regression (review on 8caa88a): a closed call is not reopened by missing data.
assert.equal(m.facts.source_listing_state,'expired','an "active" claim without new evidence is ignored');
const unknown={...row,facts:{...row.facts,source_listing_state:null,call_currency:'Program objavljen; aktualnost konkretnog poziva nepoznata'}};
let k=mergeCandidate(existing,unknown,source,now);
assert.equal(k.facts.source_listing_state,'expired');
assert.equal(k.facts.call_currency,'Poziv zatvoren ili istekao','a closed record is never relabelled as unknown');
assert.equal(k.facts.deadline,'2026-07-10');
assert.equal(k.status,'Provjereno ručno');
// Reopening needs an explicit active state with a future deadline and its evidence.
const reopened={...row,facts:{...row.facts,deadline:'2027-04-30',reopen_evidence:'returned by 5pm on Friday 30th April 2027',source_listing_state:'active',call_currency:'Poziv otvoren: objavljen budući rok'}};
k=mergeCandidate(existing,reopened,source,now);
assert.equal(k.facts.source_listing_state,'active');
assert.equal(k.facts.deadline,'2027-04-30');
assert.equal(mergeCandidate(existing,{...reopened,facts:{...reopened.facts,deadline:'2026-09-01'}},source,now).facts.source_listing_state,'expired','a past deadline is not reopening');
assert.equal(mergeCandidate(existing,{...reopened,facts:{...reopened.facts,reopen_evidence:null}},source,now).facts.source_listing_state,'expired','no evidence, no reopening');
assert(reopens(reopened.facts,now)&&!reopens(row.facts,now));
// A new record never arrives verified.
assert.equal(mergeCandidate(null,row,source,now).verified,false);
// pairFunnel: every property × buyer pair is suggested, excluded with the suggestion() reason, or outside the buyer countries.
{const {pairFunnel,EXCLUDED}=await import('./supabase/functions/discovery-sync/suggestions.mjs');
 const f=pairFunnel([land,{...land,id:8,property_type:null},{...land,id:9,property_type:'Kuća'},{...land,id:10,country:'Slovenija'},{...land,id:11,source:''}],[buyer],now);
 assert.equal(f.pairs,5);assert.equal(f.country_mismatch,1);
 assert.deepEqual(f.excluded,{[EXCLUDED.PROPERTY_TYPE]:1,[EXCLUDED.TYPE]:1,[EXCLUDED.PROPERTY_SOURCE]:1});
 assert.equal(Object.values(f.suggested).reduce((a,b)=>a+b,0),1);
 assert.equal(f.properties_without_type,1);assert.equal(f.properties_without_source,1);
 const why={};assert.equal(suggestion({...land,region:'Dublin'},buyer,now,{},why),null);assert.equal(why.reason,'Ne odgovara: Regija');}
console.log('Public land matching and merge checks passed.');
