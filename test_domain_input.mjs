import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
// Every deployed copy and the Sites review copy must stay identical.
const copies=['supabase/functions/sites-platform/domain.mjs','supabase/functions/discovery-sync/domain.mjs','supabase/functions/registry-discovery/domain.mjs','sites-review/lib/domain.mjs'];
const text=f=>readFileSync(new URL(f,import.meta.url),'utf8').trimEnd();
for(const f of copies.slice(1))assert.equal(text(f),text(copies[0]),f+' differs from '+copies[0]);
const {investorInput,evaluate,CANDIDATE,MATCH}=await import('./supabase/functions/sites-platform/domain.mjs');
const base={name:'Kerry County Council',country:'Irska',preferred_countries:'Irska',notes:'',verified:0,
 criteria_json:JSON.stringify({property_types:['Zemljište'],buyer_kind:'Javno tijelo',call_deadline:'2026-07-10',call_closed:'Rok istekao',listing_kind:'public_buy_request'})};
// Audit 6342938279 point 1: unknown budget stays NULL, a seat outside the EU is kept.
let saved=investorInput({...base,min_budget:null,max_budget:null,country:'US'});
assert.equal(saved.min_budget,null);assert.equal(saved.max_budget,null);assert.equal(saved.country,'US');
assert.deepEqual(JSON.parse(saved.criteria_json),JSON.parse(base.criteria_json),'source criteria and public-body kind are kept');
saved=investorInput({...base,min_budget:undefined,max_budget:250000});
assert.equal(saved.min_budget,null);assert.equal(saved.max_budget,250000);
// Known bounds are still validated.
for(const bad of [{min_budget:500,max_budget:100},{max_budget:0},{min_budget:-1},{max_budget:'100'}])
 assert.throws(()=>investorInput({...base,...bad}),/budžet/);
assert.throws(()=>investorInput({...base,country:''}),/sjedište/);
assert.throws(()=>investorInput({...base,country:'x'.repeat(81)}),/sjedište/);
// EU interest, not the seat, decides the property country; an unknown budget is never a match.
const land={country:'Irska',property_type:'Zemljište',source:'https://example.ie/l/1',price:90000,renovation:0,other_costs:0,legal:'Uredno',legal_evidence_url:'https://example.ie/legal'};
const buyer={...base,country:'US',min_budget:null,max_budget:null,verified:1,criteria_json:JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:'https://example.ie/eoi',checked_at:new Date().toISOString()})};
let r=evaluate({...land,condition:'Neizgrađeno'},buyer);
assert.equal(r.status,CANDIDATE);assert(r.reasons.includes('Država'));assert(r.missing.includes('Ukupni trošak unutar budžeta'));
r=evaluate({...land,condition:'Neizgrađeno'},{...buyer,min_budget:0,max_budget:100000});
assert.equal(r.status,MATCH,'with a known budget the same pair can match');
assert(!evaluate({...land,country:'Hrvatska',condition:'Neizgrađeno'},buyer).reasons.includes('Država'),'the US seat does not widen EU interest');
console.log('Domain input checks passed: NULL budget, global seat, EU interest, identical copies.');
