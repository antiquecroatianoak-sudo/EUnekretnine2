import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
// Every deployed copy and the Sites review copy must stay identical.
const copies=['supabase/functions/sites-platform/domain.mjs','supabase/functions/discovery-sync/domain.mjs','supabase/functions/registry-discovery/domain.mjs','sites-review/lib/domain.mjs'];
const text=f=>readFileSync(new URL(f,import.meta.url),'utf8').trimEnd();
for(const f of copies.slice(1))assert.equal(text(f),text(copies[0]),f+' differs from '+copies[0]);
const {investorInput,evaluate,CANDIDATE,MATCH,PHASE,PAIR_CONDITION,pairText}=await import('./supabase/functions/sites-platform/domain.mjs');
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
// EU interest, not the seat, decides the property country. Owner correction 6344490047/6344511552:
// the buyer's budget is optional and never a condition; the property's price stays a core fact.
const land={id:7,country:'Irska',city:'Dublin',property_type:'Zemljište',source:'https://example.ie/l/1',price:90000,area:6120,renovation:0,other_costs:0,legal:'Uredno',legal_evidence_url:'https://example.ie/legal',
 status:'Aktivno',source_checked_on:new Date(Date.now()-86400000).toISOString().slice(0,10)};
// Review 6361220363, reproduced: a record saved through propertyInput has no source check, so the database
// guard (property_eligible) refuses it as a real opportunity. It must stay a candidate with the open item.
{const {propertyInput,SOURCE_FRESH,ACTIVE_CHECK}=await import('./supabase/functions/sites-platform/domain.mjs');
 const saved={...propertyInput({title:'TEST Dublin',country:'Irska',city:'Dublin',property_type:'Zemljište',condition:'Neizgrađeno',status:'Aktivno',price:90000,area:6120,legal:'Uredno',legal_evidence_url:'https://example.ie/legal',source:'https://example.ie/l/1',source_checked_on:'2026-10-23'}),id:7};
 assert(!('source_checked_on' in saved),'an ordinary save never records a source check');
 const buyerNoBudget={...base,country:'US',min_budget:null,max_budget:null,verified:1,criteria_json:JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:'https://example.ie/eoi',checked_at:new Date().toISOString()})};
 let res=evaluate(saved,buyerNoBudget);
 assert.equal(res.status,CANDIDATE);assert.deepEqual(res.gaps.property,[SOURCE_FRESH]);
 res=evaluate({...saved,source_checked_on:new Date().toISOString().slice(0,10),status:'Provjera'},buyerNoBudget);assert.deepEqual(res.gaps.property,[ACTIVE_CHECK]);
 res=evaluate({...saved,source_checked_on:new Date(Date.now()-31*86400000).toISOString().slice(0,10)},buyerNoBudget);assert.deepEqual(res.gaps.property,[SOURCE_FRESH],'an expired check reopens the item');
 res=evaluate({...saved,source_checked_on:new Date(),city:''},buyerNoBudget);assert.deepEqual(res.gaps.property,['Grad nekretnine'],'a Date from the driver counts; city is required');
 assert.equal(evaluate({...saved,source_checked_on:new Date().toISOString().slice(0,10)},buyerNoBudget).status,MATCH,'with a current source check the same pair is a real opportunity without a budget');
 res=evaluate({...saved,source_checked_on:new Date().toISOString().slice(0,10)},{...buyerNoBudget,criteria_json:JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:'https://example.ie/eoi',checked_at:'2026-10-23T10:00:00'})});
 assert(res.gaps.buyer.includes('Zapis zahtjeva kupca u standardnom obliku (vrste, stanje, izvor, datum)'),'investor_eligible needs a time zone on checked_at');}
const buyer={...base,country:'US',min_budget:null,max_budget:null,verified:1,criteria_json:JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:'https://example.ie/eoi',checked_at:new Date().toISOString()})};
let r=evaluate({...land,condition:'Neizgrađeno'},buyer);
assert.equal(r.status,MATCH,'an undisclosed budget does not block a complete pair');assert(r.reasons.includes('Država'));
assert.equal(r.phase,PHASE.REAL);assert(!r.missing.length&&!r.info.length);
r=evaluate({...land,condition:'Neizgrađeno'},{...buyer,min_budget:0,max_budget:50000});
assert.equal(r.status,MATCH,'a known budget below the price is informative, not a rejection');
assert.deepEqual(r.info,['Ukupni trošak iznad navedenog budžeta kupca (informativno)']);
r=evaluate({...land,price:null,condition:'Neizgrađeno'},buyer);
assert.equal(r.phase,PHASE.PROPERTY);assert.deepEqual(r.gaps.property,['Cijena nekretnine']);
r=evaluate({...land,area:null,condition:'Neizgrađeno'},buyer);
assert.deepEqual(r.gaps.property,['Površina nekretnine'],'unknown area is a property gap, never zero');
r=evaluate({...land,condition:'Za obnovu'},buyer);
assert.equal(r.status,'Ne odgovara kriterijima','a cheap price never replaces a condition mismatch');
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
// Review 6344298344 point 1: checking the note's wording confirms what the buyer asks for, not that
// this property meets it. The pair stays open until a check bound to this pair's facts exists.
r=evaluate(full,mandate('Uvjeti provjereni',check('Uvjeti provjereni')),now);
assert.equal(r.status,CANDIDATE);assert.deepEqual(r.missing,[PAIR_CONDITION]);assert.deepEqual(r.gaps.pair,[PAIR_CONDITION]);
assert.equal(r.phase,PHASE.BUYER,'the property itself is complete');
const pairCheck=(p,text='Uvjeti provjereni',age=day)=>({[PAIR_CONDITION]:{digest:digest(pairText(text,p)),checked_at:new Date(now-age).toISOString(),outcome:'zadovoljava',evidence:'Prodavatelj dostavio situacijski nacrt 22.10.; udaljenost od pruge 120 m'}});
assert.equal(evaluate(full,mandate('Uvjeti provjereni',check('Uvjeti provjereni')),now,pairCheck(full)).status,MATCH,'pair-specific evidence closes the item');
assert.equal(evaluate(full,mandate('Uvjeti provjereni',check('Uvjeti provjereni')),now,pairCheck({...full,id:8})).status,CANDIDATE,'evidence for another property does not count');
assert.equal(evaluate({...full,area:5000},mandate('Uvjeti provjereni',check('Uvjeti provjereni')),now,pairCheck(full)).status,CANDIDATE,'a property change invalidates the pair evidence');
assert.equal(evaluate(full,mandate('Uvjeti provjereni; samo jug',check('Uvjeti provjereni; samo jug')),now,pairCheck(full)).status,CANDIDATE,'a changed condition invalidates the pair evidence');
assert.equal(evaluate(full,mandate('Uvjeti provjereni',check('Uvjeti provjereni')),now,{[PAIR_CONDITION]:{...pairCheck(full)[PAIR_CONDITION],evidence:''}}).status,CANDIDATE,'no evidence, no pair check');
assert.equal(digest(pairText('Samo uz prugu',{id:7,country:'Irska',region:'Galway',area:6120,price:90000.5,title:'Šuma – 1 ha',legal:'Uredno',auction_at:null})),'4e3b120b','same as matching.pair_text');
assert.equal(evaluate(full,mandate('Uvjeti  provjereni\n',check('Uvjeti provjereni')),now).missing[0],PAIR_CONDITION,'whitespace is not a change of the note');
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
assert(!r.missing.includes('Provjera izvornih lokacijskih uvjeta kupca'));
// Reproduced review 6344298344: a global check of "Uz tramvajsku prugu" used to make every candidate a match.
const fulfil='Ispunjenje izvornih lokacijskih uvjeta kupca za ovu nekretninu';
assert.equal(r.status,CANDIDATE);assert.deepEqual(r.gaps.pair,[fulfil]);
const sc={[fulfil]:{digest:digest(pairText(sourceConditions(sourceRaw),listing)),checked_at:new Date(now-day).toISOString(),outcome:'zadovoljava',evidence:'Karta: parcela 150 m od pruge, provjereno 22.10.'}};
assert.equal(suggestion(listing,sbuyer(sourceCheck),now,sc).status,MATCH,'only evidence for this property closes it');
assert.equal(suggestion({...listing,id:9},sbuyer(sourceCheck),now,sc).status,CANDIDATE,'another property stays open');
assert(suggestion(listing,sbuyer({...sourceCheck,preferred_locations:['Uz tramvajsku prugu','Samo Trešnjevka']}),now).missing.includes('Provjera izvornih lokacijskih uvjeta kupca'),'changed source wording needs a new check');
// Question drafts (never sent) and the latest-answer rule for pair checks.
const {questionDraft,pairCheckMap,conditionText}=await import('./supabase/functions/sites-platform/domain.mjs');
assert.equal(questionDraft('Dokaz pravne provjere','property').addressed_to,'Prodavatelj');
assert.match(questionDraft('Cijena nekretnine','property').body,/početna ili minimalna ponuda/);
assert.equal(questionDraft('Potvrđen zahtjev kupca s izvorom i provjerom unutar 90 dana','buyer').addressed_to,'Kupac');
assert.match(questionDraft(PAIR_CONDITION,'pair').body,/bez podataka o kupcu/);
assert.equal(conditionText(PAIR_CONDITION,{notes:'Samo uz prugu'}),'Samo uz prugu');assert.equal(conditionText('Dokaz pravne provjere',{}),null);
const answer=(id,status,at)=>({id,property_id:7,investor_id:'10',requirement:PAIR_CONDITION,status,digest:'aa411872',evidence:'E',recorded_at:at});
assert.equal(pairCheckMap([answer(1,'Provjereno','2026-10-20T10:00:00Z')]).get('7-10')[PAIR_CONDITION].digest,'aa411872');
assert.equal(pairCheckMap([answer(1,'Provjereno','2026-10-20T10:00:00Z'),answer(2,'Odbačeno','2026-10-21T10:00:00Z')]).get('7-10'),undefined,'a later rejected answer withdraws the check');
assert.equal(pairCheckMap([answer(1,'Zaprimljeno - nije provjereno','2026-10-21T10:00:00Z')]).size,0,'an unverified answer never counts');
assert(pairCheckMap([answer(1,'Provjereno','2026-10-20T10:00:00Z'),answer(2,'Zaprimljeno - nije provjereno','2026-10-21T10:00:00Z')]).get('7-10'),'nor does it withdraw a verification');
console.log('Domain input checks passed: optional budget, global seat, EU interest, identical copies, pair-specific condition checks.');

// Negative, unknown and legacy outcome-less evidence cannot create a real opportunity.
const good=pairCheck(full);
assert.equal(evaluate(full,mandate('Uvjeti provjereni',check('Uvjeti provjereni')),now,{[PAIR_CONDITION]:{...good[PAIR_CONDITION],outcome:'ne zadovoljava'}}).status,'Ne odgovara kriterijima');
for(const outcome of [undefined,'nepoznato'])assert.equal(evaluate(full,mandate('Uvjeti provjereni',check('Uvjeti provjereni')),now,{[PAIR_CONDITION]:{...good[PAIR_CONDITION],outcome}}).status,CANDIDATE);
assert.equal(evaluate(listing,sbuyer(sourceCheck),now).status,CANDIDATE,'direct evaluation must enforce original source locations');
for(const name of ['suggestions.mjs','refresh-suggestions.mjs'])assert.equal(text('supabase/functions/sites-platform/'+name),text('supabase/functions/discovery-sync/'+name),'manual and automatic refresh modules stay identical');
const {rankAffordability}=await import('./supabase/functions/sites-platform/domain.mjs');
const ps=[{...listing,id:101,city:'Galway',price:100000,area:1000,price_basis:'asking_price'},{...listing,id:102,city:'Galway',price:90000,area:1000,price_basis:'asking_price'},
 {...listing,id:103,city:'Galway',price:10000,area:1000,price_basis:'auction_starting_bid'},{...listing,id:104,city:'Dublin',price:10000,area:1000,price_basis:'asking_price'},
 {...listing,id:105,city:'Galway',price:1000,area:1000,price_basis:'asking_price'}];
const ranked=rankAffordability(ps.map(p=>({property_id:p.id,investor_id:1,result_json:JSON.stringify({status:p.id===105?CANDIDATE:MATCH})})),ps).map(r=>JSON.parse(r.result_json).affordability);
assert.equal(ranked[1].rank,1);assert.equal(ranked[0].rank,2);assert.equal(ranked[0].compared,2);
for(const n of [2,3,4])assert.equal(ranked[n].rank,null,'auction, different city and incomplete pair are not comparable');

// Ten real groups with public sources; they remain unverified profiles, not invented mandates.
const globalCases=JSON.parse(readFileSync(new URL('./data/global_investor_review_cases.json',import.meta.url),'utf8'));
assert.equal(globalCases.cases.length,10);
for(const actual of globalCases.cases){
 const imported=investorInput(actual);assert.equal(imported.country,actual.country);assert.equal(imported.min_budget,null);assert.equal(imported.max_budget,null);assert.equal(imported.verified,0);
 assert.notEqual(evaluate(full,imported).status,MATCH,actual.name+' is not a confirmed demand');
 // An identical synthetic mandate must behave identically regardless of this real group seat.
 assert.equal(evaluate(full,{...buyer,country:actual.country}).status,evaluate(full,buyer).status,actual.name+' seat must not restrict EU interests');
}
console.log('Ten sourced global-group input regressions passed; current mandates and individual-property interest remain unverified.');
