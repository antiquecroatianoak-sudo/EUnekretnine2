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

// Audit 6342938279 point 2: a note is checked once with evidence, not deleted, and the check expires with any change.
const {digest}=await import('./supabase/functions/sites-platform/domain.mjs');
for(const [t,h] of [['','811c9dc5'],['Uvjeti provjereni','aa411872'],['  Samo  uz\nprugu ','8285722d'],['Šibenik – zemljište ≥ 1.000 m²','72db6e92']])assert.equal(digest(t),h,'same fingerprint as matching.digest');
const full={...land,condition:'Neizgrađeno'},now=Date.now(),day=86400000;
const mandate=(notes,extra={})=>({...buyer,min_budget:0,max_budget:100000,notes,criteria_json:JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:'https://example.ie/eoi',checked_at:new Date(now-day).toISOString(),...extra})});
const check=(text,age=day,evidence='Telefonski potvrđeno s uredom, zapisnik 22.10.')=>({notes_check:{digest:digest(text),checked_at:new Date(now-age).toISOString(),evidence}});
assert.equal(evaluate(full,mandate(''),now).status,MATCH);
r=evaluate(full,mandate('Uvjeti provjereni'),now);
assert.equal(r.status,CANDIDATE,'reproduced: an unchecked note blocks the match');assert(r.missing.includes('Dodatni uvjeti iz napomena za ručnu provjeru'));
assert.equal(evaluate(full,mandate('Uvjeti provjereni',check('Uvjeti provjereni')),now).status,MATCH,'a dated check with evidence of this exact note');
assert.equal(evaluate(full,mandate('Uvjeti  provjereni\n',check('Uvjeti provjereni')),now).status,MATCH,'whitespace is not a change');
assert.equal(evaluate(full,mandate('Uvjeti provjereni; samo uz prugu',check('Uvjeti provjereni')),now).status,CANDIDATE,'changed note invalidates the check');
assert.equal(evaluate(full,mandate('Uvjeti provjereni',check('Uvjeti provjereni',91*day)),now).status,CANDIDATE,'check older than 90 days');
assert.equal(evaluate(full,mandate('Uvjeti provjereni',check('Uvjeti provjereni',day,' ')),now).status,CANDIDATE,'no evidence, no check');
assert.equal(evaluate(full,mandate('Uvjeti provjereni',check('Uvjeti provjereni',-day)),now).status,CANDIDATE,'future check date');
saved=investorInput({...mandate('Uvjeti provjereni',check('Uvjeti provjereni')),country:'Irska'});
assert.equal(saved.notes,'Uvjeti provjereni','the note itself is kept');
assert.throws(()=>investorInput({...base,min_budget:null,max_budget:null,criteria_json:JSON.stringify({notes_check:{digest:'x',checked_at:'2026-10-01T00:00:00Z',evidence:'a'}})}),/provjera dodatnih uvjeta/);
assert.throws(()=>investorInput({...base,min_budget:null,max_budget:null,criteria_json:JSON.stringify({notes_check:{digest:digest('a'),checked_at:new Date(now+2*day).toISOString(),evidence:'a'}})}),/provjera dodatnih uvjeta/);
// The same for original location / purpose conditions that suggestions() reports.
const {suggestion}=await import('./supabase/functions/discovery-sync/suggestions.mjs');
const {sourceConditions}=await import('./supabase/functions/discovery-sync/domain.mjs');
const sourceRaw={property_types:['Zemljište'],conditions:['Neizgrađeno'],preferred_locations:['Uz tramvajsku prugu'],source_url:'https://example.ie/eoi',checked_at:new Date(now-day).toISOString()};
const listing={...full,status:'Aktivno',source_checked_on:new Date(now-day).toISOString().slice(0,10)};
const sbuyer=extra=>({...buyer,min_budget:0,max_budget:100000,notes:'',criteria_json:JSON.stringify({...sourceRaw,...extra})});
assert(suggestion(listing,sbuyer({}),now).missing.includes('Provjera izvornih lokacijskih uvjeta kupca'));
const sourceCheck={source_conditions_check:{digest:digest(sourceConditions(sourceRaw)),checked_at:new Date(now-day).toISOString(),evidence:'Karta izvornog poziva pregledana 21.10.'}};
r=suggestion(listing,sbuyer(sourceCheck),now);
assert(!r.missing.includes('Provjera izvornih lokacijskih uvjeta kupca'));assert.equal(r.status,MATCH);
assert(suggestion(listing,sbuyer({...sourceCheck,preferred_locations:['Uz tramvajsku prugu','Samo Trešnjevka']}),now).missing.includes('Provjera izvornih lokacijskih uvjeta kupca'),'changed source wording needs a new check');
console.log('Domain input checks passed: NULL budget, global seat, EU interest, identical copies, dated condition checks.');
