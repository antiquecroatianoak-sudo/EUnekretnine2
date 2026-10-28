// Data contract facts-v1 (module 1): shared vectors, evaluation semantics, digest stability and input validation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const vectors=JSON.parse(readFileSync(new URL('./ops/facts-vectors-v1.json',import.meta.url),'utf8'));
const F=await import('./supabase/functions/sites-platform/facts.mjs');
const D=await import('./supabase/functions/sites-platform/domain.mjs');
const {suggestion}=await import('./supabase/functions/sites-platform/suggestions.mjs');
assert.equal(vectors.version,F.FACTS_VERSION);
// Every directory with domain.mjs carries the same facts.mjs.
for(const p of ['supabase/functions/discovery-sync/facts.mjs','supabase/functions/registry-discovery/facts.mjs','sites-review/lib/facts.mjs'])
 assert.equal(readFileSync(new URL('./'+p,import.meta.url),'utf8'),readFileSync(new URL('./supabase/functions/sites-platform/facts.mjs',import.meta.url),'utf8'),p);
for(const v of vectors.compare){
 const [q]=F.validateRequirements([v.requirement]),facts=F.validateFacts(v.facts);
 assert.equal(F.compareRequirement(q,facts,v.today).state,v.state,v.name);
}
for(const v of vectors.invalid_requirements)assert.throws(()=>F.validateRequirements(v.input),undefined,v.name);
for(const v of vectors.invalid_facts)assert.throws(()=>F.validateFacts(v.input),undefined,v.name);
// Future observation (6464745746 P1): new input refuses it, stored records stay readable and the fact stays open.
for(const v of vectors.future_input){const now=Date.parse(v.now);
 if(v.valid)F.validateFacts(v.facts,{now});else assert.throws(()=>F.validateFacts(v.facts,{now}),undefined,v.name);
 if(/^\d{4}-\d{2}-\d{2}$/.test(v.facts.rooms.observed_on)&&Number.isFinite(Date.parse(v.facts.rooms.observed_on))&&v.facts.rooms.observed_on!=='2026-02-30')F.validateFacts(v.facts);}
// Inverted ranges (6464745746 P2): strict input refuses a mandatory inverted range; reading keeps it open.
const rangeFacts=F.validateFacts(vectors.range_facts);
for(const v of vectors.range_cases){
 if(v.strict_valid)F.validateRequirements(v.requirements,{strict:true});else assert.throws(()=>F.validateRequirements(v.requirements,{strict:true}),/obrnut raspon/,v.name);
 assert.deepEqual(F.compareRequirements(F.validateRequirements(v.requirements),rangeFacts,Date.parse('2026-10-28T10:00:00Z')).map(r=>r.state),v.states,v.name);}

// Evaluation through the real suggestion()/evaluate(): TEST ONLY records.
const now=Date.now(),today=new Date(now).toISOString().slice(0,10),stamp=new Date(now).toISOString();
const contact=u=>JSON.stringify({mode:'direct',name:'TEST ONLY',contact_url:u,evidence_url:u,record_reference:u,permitted:true});
const p0={id:'7',country:'Hrvatska',city:'Osijek',title:'TEST ONLY farma',source:'https://example.org/p/7',price:900000,area:1500000,renovation:0,other_costs:0,
 property_type:'Zemljište',condition:'Neizgrađeno',status:'Aktivno',source_checked_on:today,legal:'Uredno',legal_evidence_url:'https://example.org/legal',contact_json:contact('https://example.org/p/7')};
const fact=(value,unit,status='potvrđeno')=>({value,...(unit?{unit}:{}),origin:'izvor',status,...(status==='potvrđeno'?{evidence:'TEST ONLY oglas'}:{}),observed_on:today});
const buyer=(requirements)=>({id:'3',name:'TEST ONLY',country:'US',preferred_countries:'Hrvatska',notes:'',verified:1,min_budget:null,max_budget:null,contact_json:contact('https://example.org/d/3'),
 criteria_json:JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:'https://example.org/d/3',checked_at:stamp,...(requirements?{requirements}:{})})});
const owned150={key:'land_owned',op:'min',value:150,unit:'ha',mandatory:true,quote:'kupnja 150 ha u vlasništvu'};
const without=suggestion(p0,buyer(),now);assert.equal(without.status,D.MATCH,'baseline is a real opportunity');
// Unknown fact: never green, an open property item; the stored requirement is no longer ignored.
let r=suggestion(p0,buyer([owned150]),now);
assert.equal(r.status,D.CANDIDATE);assert(r.gaps.property.includes('Uvjet zahtjeva: Zemljište u vlasništvu uključeno u prodaju'));assert.equal(r.requirements[0].state,'unknown');
// 150 ha advertised = 110 owned + 40 leased: a buyer requiring 150 ha owned is not confirmed.
const p1={...p0,facts_json:JSON.stringify({land_total:fact(150,'ha'),land_owned:fact(110,'ha'),land_leased:fact(40,'ha')})};
r=suggestion(p1,buyer([owned150]),now);assert.equal(r,null,'a mandatory unmet requirement rejects the pair');
const why={};suggestion(p1,buyer([owned150]),now,{},why);assert.equal(why.reason,'Ne odgovara: Uvjet zahtjeva: Zemljište u vlasništvu uključeno u prodaju');
// The same as a wish only informs and never blocks.
r=suggestion(p1,buyer([{...owned150,mandatory:false}]),now);assert.equal(r.status,D.MATCH);assert(r.info.some(v=>/želja nije ispunjena/.test(v)));
// Met requirement counts as a criterion; conflicting fact stays open.
r=suggestion(p1,buyer([{...owned150,value:100}]),now);assert.equal(r.status,D.MATCH);assert(r.reasons.includes('Uvjet zahtjeva: Zemljište u vlasništvu uključeno u prodaju'));
r=suggestion({...p0,facts_json:JSON.stringify({land_owned:fact(160,'ha','proturječno')})},buyer([owned150]),now);assert.equal(r.status,D.CANDIDATE);assert.equal(r.requirements[0].state,'conflict');
// Invalid stored facts are an open item, not an empty record.
r=suggestion({...p0,facts_json:'{nije json'},buyer([owned150]),now);assert(r.gaps.property.includes('Ispravni strukturirani podaci nekretnine'));
// Invalid requirements make the buyer's criteria invalid (open item), never silently dropped.
r=suggestion(p0,buyer([{key:'min_rooms',op:'min',value:3,unit:'kom',mandatory:true,quote:'x'}]),now);assert(r.gaps.buyer.includes('Ispravni strukturirani kriteriji kupca'));
// Digest stability: without facts, pairText is exactly the format before facts-v1.
const legacy=(req,p)=>JSON.stringify([String(req??''),...D.PAIR_FACTS.map(k=>k==='id'&&p.id!=null?String(p.id):p[k]==null?null:typeof p[k]==='number'?p[k]:String(p[k]))]);
assert.equal(D.pairText('uvjet',p0),legacy('uvjet',p0));assert.equal(D.pairText('uvjet',{...p0,facts_json:''}),legacy('uvjet',p0));
assert.notEqual(D.pairText('uvjet',p1),legacy('uvjet',p1),'facts join the checked text');
assert.notEqual(D.pairText('uvjet',p1),D.pairText('uvjet',{...p1,facts_json:JSON.stringify({land_total:fact(150,'ha'),land_owned:fact(111,'ha'),land_leased:fact(40,'ha')})}),'a changed fact voids earlier checks');
// Input: facts_json only when sent, validated; requirements validated through investorInput.
const base={title:'TEST ONLY',country:'Hrvatska',source:'https://example.org/p/9',legal:'Nepoznato'};
assert.equal('facts_json' in D.propertyInput(base),false);
assert.equal(D.propertyInput({...base,facts_json:''}).facts_json,null);
assert.deepEqual(JSON.parse(D.propertyInput({...base,facts_json:{rooms:fact(40,'kom')}}).facts_json),{rooms:fact(40,'kom')});
assert.throws(()=>D.propertyInput({...base,facts_json:{rooms:fact(40,'kom','potvrđeno'),stars:fact(4,'kom')}}),/Nepoznat podatak/);
assert.throws(()=>D.investorInput({name:'TEST ONLY',country:'US',preferred_countries:'Hrvatska',notes:'',verified:0,criteria_json:JSON.stringify({requirements:[{key:'rooms',op:'min',value:3,unit:'kom',mandatory:true}]})}),/izvorni navod/);
// Module 4: area basis and land composition through evaluate(); same vectors as test_facts.py.
const areaState=(r,label)=>r.reasons.includes(label)?'met':r.rejected.includes(label)?'unmet':r.missing.includes(label)?'open':'absent';
const areaResults=vectors.area_cases.map(v=>{const i={...buyer(),criteria_json:JSON.stringify({...JSON.parse(buyer().criteria_json),...v.request})};
 const r=D.evaluate({...p0,area:1500000,facts_json:JSON.stringify(v.facts)},i,now),label=v.request.area_basis?'Površina ('+v.request.area_basis+')':'Površina';
 assert.equal(areaState(r,label),v.state,v.name);if(v.note)assert(r.info.includes(v.note),v.name+': note');return areaState(r,label)});
assert.throws(()=>D.investorInput({name:'TEST ONLY',country:'US',preferred_countries:'Hrvatska',notes:'',verified:0,criteria_json:JSON.stringify({min_area:10,area_basis:'zemljište'})}),/osnova površine/);
console.error(JSON.stringify(areaResults));
// Module 5: confirmed facts reach the presentation only as generalised lines; unconfirmed facts never do.
const O=await import('./supabase/functions/sites-platform/offer.mjs');
const hotel={...p0,facts_json:JSON.stringify({rooms:fact(43,'kom'),hotel_category:fact(4,'kom'),power:fact(0.45,'MW'),land_owned:fact(110,'ha'),subtype:fact('hotel'),operating_months:fact(6,'kom'),
 truck_access:{value:true,origin:'ručno',status:'nepotvrđeno',observed_on:today},water_rights:{...fact(true),valid_until:'2000-01-01',observed_on:'1999-01-01'}})};
assert.deepEqual(O.factsSummary(hotel),['Smještajni kapacitet: 40 – 50 soba','Kategorija prema dokumentu: 4★ (potrebna provjera)','Priključna snaga: 400 – 500 kW','Zemljište u vlasništvu: 110 – 111 ha','Podvrsta: hotel','Sezona rada: 6 mjeseci']);
const pres=O.presentation(hotel,buyer(),{reasons:[]},'EU-TEST');assert(!JSON.stringify(pres).includes('43'),'exact room count stays internal');
assert(O.presentationHtml(pres).includes('Dodatna obilježja (potvrđeni podaci)'));assert.deepEqual(O.factsSummary(p0),[]);
assert.equal(readFileSync(new URL('./sites-review/lib/offer.mjs',import.meta.url),'utf8'),readFileSync(new URL('./supabase/functions/sites-platform/offer.mjs',import.meta.url),'utf8'));
// 6471377815: the confirmed export uses the comparison's currency rule (factCurrent): an observation dated after
// today is not yet a fact, an expired one no longer is; past and today count. Stored data is left as it is.
{const at=Date.parse('2026-10-28T12:00:00Z'),day=n=>new Date(at+n*86400000).toISOString().slice(0,10);
 const withRooms=f=>({...p0,facts_json:JSON.stringify({rooms:{...fact(43,'kom'),...f}})});
 const lines=f=>O.factsSummary(withRooms(f),at);
 assert.deepEqual(lines({observed_on:day(-30)}),['Smještajni kapacitet: 40 – 50 soba'],'past');
 assert.deepEqual(lines({observed_on:day(0)}),['Smještajni kapacitet: 40 – 50 soba'],'today');
 assert.deepEqual(lines({observed_on:day(1)}),[],'tomorrow is not yet observed');
 assert.deepEqual(lines({observed_on:'2099-01-01'}),[],'far future');
 assert.deepEqual(lines({observed_on:'2099-01-01',valid_until:'2099-12-31'}),[],'future with a later valid_until');
 assert.deepEqual(lines({observed_on:day(-30),valid_until:day(0)}),['Smještajni kapacitet: 40 – 50 soba'],'valid until today');
 assert.deepEqual(lines({observed_on:day(-30),valid_until:day(-1)}),[],'expired yesterday');
 for(const [f,n] of [[{observed_on:day(-1)},1],[{observed_on:day(0)},1],[{observed_on:'2099-01-01'},0]])assert.equal(F.factCurrent(JSON.parse(withRooms(f).facts_json).rooms,day(0))?1:0,n);
 // presentation() and its HTML: a future-dated fact never appears under "confirmed data" (presentation uses now).
 const future=withRooms({observed_on:'2099-01-01'}),html=O.presentationHtml(O.presentation(future,buyer(),{reasons:[]},'EU-TEST'));
 assert(!html.includes('Smještajni kapacitet')&&!html.includes('Dodatna obilježja (potvrđeni podaci)'),'future fact not exported');
 assert(O.presentationHtml(O.presentation(withRooms({observed_on:today}),buyer(),{reasons:[]},'EU-TEST')).includes('Smještajni kapacitet: 40 – 50 soba'),'today is exported');
 assert.equal(JSON.parse(future.facts_json).rooms.observed_on,'2099-01-01','stored data unchanged');}
// Sector templates list relevant fields only.
assert.deepEqual(Object.keys(F.SECTOR_TEMPLATES),['hotel','skladište / logistika','farma']);for(const keys of Object.values(F.SECTOR_TEMPLATES))for(const k of keys)assert(F.FACTS[k],k);
console.log(JSON.stringify(vectors.compare.map(v=>F.compareRequirement(F.validateRequirements([v.requirement])[0],F.validateFacts(v.facts),v.today).state)));
console.error('facts-v1: vectors, evaluation, digest stability and input validation passed');
