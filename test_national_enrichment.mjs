import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSnapshot} from './supabase/functions/discovery-sync/snapshot-merge.mjs';
import {identityFor,requestFor,parseResult,mergeEnrichment,enrich,isoCountry} from './supabase/functions/registry-discovery/national-enrichment.mjs';
const nl={country_iso:'NL',issuer:'Kadaster',identifier_type:'cadastral_parcel',municipality_code:'TTR00',section:'A',parcel:'00023',source_url:'https://example.org/original-listing'};
const body={country:'Nizozemska',verified:false,first_seen:'2020-01-01',facts:{registry_identity:nl,area:70,manual_note:'Keep me'}};
const row={country:'Nizozemska'};
const feature={properties:{akr_kadastrale_gemeente_code_waarde:'TTR00',sectie:'A',perceelnummer:23,status_historie_waarde:'Geldig',kadastrale_grootte_waarde:880,kadastrale_gemeente_waarde:'Teteringen'}};
const parse=(j,i=nl)=>parseResult(i,j,'https://api.pdok.nl/test','2026-10-25T09:00:00Z');
test('full country and local identity required; original zeroes retained',()=>{
 const a=identityFor(row,body);assert.equal(a.status,'ready');assert.equal(a.identity.parcel,'00023');assert.match(requestFor(a.identity),/perceelnummer=00023/);
 assert.equal(identityFor({country:'Hrvatska'},body).status,'country_unconfirmed');
 assert.equal(identityFor(row,{...body,facts:{registry_identity:{...nl,country_iso:'HR'}}}).status,'identity_conflict');
 assert.equal(isoCountry('Unknown'),null);
});
test('same number in another municipality or section cannot match',()=>{
 assert.equal(parse({features:[feature]},{...nl,municipality_code:'AAA00'}).status,'identity_conflict');
 assert.equal(parse({features:[feature]},{...nl,section:'B'}).status,'identity_conflict');
});
test('missing IDs, unknown issuer and individual units stop lookup',()=>{
 assert.equal(identityFor(row,{country:body.country,facts:{auction_id:'23'}}).status,'missing_identity');
 assert.equal(identityFor(row,{...body,facts:{registry_identity:{...nl,municipality_code:null}}}).status,'missing_identity');
 assert.equal(identityFor(row,{...body,facts:{registry_identity:{...nl,unit:'E-36'}}}).status,'unit_review_required');
});
test('zero or multiple results and truncation never select a winner',()=>{
 assert.equal(parse({features:[]}).status,'not_found');
 assert.equal(parse({features:[feature,feature]}).status,'ambiguous');
 assert.equal(parse({features:[feature],links:[{rel:'next'}]}).status,'ambiguous');
 assert.equal(parse({features:[feature],numberMatched:2}).status,'ambiguous');
});
test('historical record does not become current data',()=>assert.equal(parse({features:[{properties:{...feature.properties,status_historie_waarde:'Vervallen'}}]}).status,'historical_record'));
test('matched area is parcel area, with field provenance and no owner data',()=>{
 const r=parse({features:[feature]});assert.equal(r.status,'matched');assert.equal(r.fields.cadastral_area_m2.value,880);assert.equal(r.fields.cadastral_area_m2.identity.parcel,'00023');assert.equal(r.fields.cadastral_area_m2.license,'CC BY 4.0');assert.match(r.fields.cadastral_area_m2.meaning,/not apartment/);
});
test('source, manual and verification data survive enrichment and outage',()=>{
 const original=structuredClone(body),result={...parse({features:[feature]}),checked_at:'2026-10-25T09:00:00Z'};
 const merged=mergeEnrichment(body,result);assert.deepEqual(body,original);assert.equal(merged.verified,false);assert.equal(merged.first_seen,body.first_seen);assert.equal(merged.facts.area,70);assert.equal(merged.facts.manual_note,'Keep me');
 const failed=mergeEnrichment(merged,{status:'service_error',checked_at:'2026-10-26T09:00:00Z',fields:{}});assert.equal(failed.facts.registry_enrichment.automatic.fields.cadastral_area_m2.value,880);
});
test('conflicting observations remain separate with no automatic winner',()=>{
 const prior=mergeEnrichment(body,{...parse({features:[feature]}),checked_at:'2026-10-25T09:00:00Z'});
 const next=mergeEnrichment(prior,{status:'matched',checked_at:'2026-10-26T09:00:00Z',fields:{cadastral_area_m2:{value:900}}});
 const a=next.facts.registry_enrichment.automatic;assert.equal(a.status,'conflict_review_required');assert.equal(a.fields.cadastral_area_m2.value,880);assert.equal(a.conflicts[0].incoming.value,900);
});
test('French prefix and zeroes are checked independently',()=>{
 const fr={country_iso:'FR',issuer:'DGFiP',identifier_type:'cadastral_parcel',municipality_code:'94067',prefix:'000',section:'AB',parcel:'0001',source_url:'https://example.org/fr'};
 assert.equal(identityFor({country:'Francuska'},{country:'Francuska',facts:{registry_identity:fr}}).status,'ready');
 const j={features:[{properties:{code_dep:'94',code_com:'067',com_abs:'000',section:'AB',numero:'0001'}}]};
 assert.equal(parse(j,fr).status,'matched');assert.equal(parse(j,{...fr,prefix:'001'}).status,'identity_conflict');
});
test('unconfirmed identity performs no network request',async()=>{
 let calls=0;const r=await enrich({country:'Hrvatska'},body,async()=>{calls++;});assert.equal(calls,0);assert.equal(r.status,'country_unconfirmed');
});
test('403 is preserved as a blocker without retries',async()=>{
 let calls=0;const r=await enrich(row,body,async()=>{calls++;return {ok:false,status:403}});assert.equal(calls,1);assert.equal(r.status,'service_error');assert.equal(r.http_status,403);
});
test('a fresh listing import preserves national evidence, review and first_seen',()=>{
 const prior={...body,verified:true,status:'Ručno provjereno',facts:{...body.facts,registry_enrichment:{fields:{cadastral_area_m2:{value:880}}}}};
 const incoming={country:body.country,first_seen:'2026-10-25',verified:false,status:'Za provjeru',facts:{asking_price:250000}};
 const merged=mergeSnapshot(prior,incoming);assert.deepEqual(merged.facts.registry_enrichment,prior.facts.registry_enrichment);assert.equal(merged.verified,true);assert.equal(merged.first_seen,prior.first_seen);assert.equal(merged.status,prior.status);assert.equal(merged.facts.asking_price,250000);
});
test('exact municipality name is resolved only inside the chosen national service',()=>{
 const byName={...nl,municipality_code:undefined,municipality_name:'Teteringen'};
 assert.equal(identityFor(row,{...body,facts:{registry_identity:byName}}).status,'ready');
 assert.equal(parse({features:[{properties:{...feature.properties,kadastrale_gemeente_waarde:undefined}}]},byName).status,'identity_conflict');
 const withName={properties:{...feature.properties,kadastrale_gemeente_waarde:'Teteringen'}};
 assert.equal(parse({features:[withName]},byName).status,'matched');
 assert.equal(parse({features:[withName]},{...byName,municipality_name:'Waalre'}).status,'identity_conflict');
});
