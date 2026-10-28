// Module 6: travel-time contract, queue and matching behaviour; the module is off and uses only a TEST adapter here.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const T=await import('./supabase/functions/sites-platform/travel.mjs');
const D=await import('./supabase/functions/sites-platform/domain.mjs');
for(const p of ['supabase/functions/discovery-sync/travel.mjs','supabase/functions/registry-discovery/travel.mjs','sites-review/lib/travel.mjs'])
 assert.equal(readFileSync(new URL('./'+p,import.meta.url),'utf8'),readFileSync(new URL('./supabase/functions/sites-platform/travel.mjs',import.meta.url),'utf8'),p);
const src=readFileSync(new URL('./supabase/functions/sites-platform/travel.mjs',import.meta.url),'utf8');
assert(!/Deno\.env|process\.env|fetch\(/.test(src),'no secret, environment read or network call in the module');
assert.equal(T.TRAVEL_CONFIG.enabled,false);assert.match(T.TRAVEL_CONFIG.reason,/isključen/);
const airport={name:'TEST ONLY zračna luka',lat:45.7429,lon:16.0688,precision:'poi'};
const req={destination:airport,mode:'automobil',max_minutes:30,mandatory:true,quote:'do 30 minuta vožnje do zračne luke'};
// Validation: a city centre is not a destination; minutes, mode and quote are required.
assert.deepEqual(T.validateTravel([req]),[req]);
for(const bad of [{...req,destination:{...airport,precision:'grad'}},{...req,destination:{...airport,lat:95}},{...req,mode:'zrakoplov'},{...req,max_minutes:0},{...req,max_minutes:30.5},{...req,quote:''},{...req,mandatory:'da'}])
 assert.throws(()=>T.validateTravel([bad]));
// Matching never computes: a mandatory requirement is an open pair item, a wish only informs; never a match by default.
const now=Date.now(),today=new Date(now).toISOString().slice(0,10),stamp=new Date(now).toISOString();
const contact=u=>JSON.stringify({mode:'direct',name:'TEST ONLY',contact_url:u,evidence_url:u,record_reference:u,permitted:true});
const p={id:'7',country:'Hrvatska',city:'Velika Gorica',title:'TEST ONLY',source:'https://example.org/p/7',price:1,area:600,renovation:0,other_costs:0,property_type:'Zemljište',condition:'Neizgrađeno',
 status:'Aktivno',source_checked_on:today,legal:'Uredno',legal_evidence_url:'https://example.org/legal',contact_json:contact('https://example.org/p/7')};
const buyer=travel=>({id:'3',name:'TEST ONLY',country:'US',preferred_countries:'Hrvatska',notes:'',verified:1,contact_json:contact('https://example.org/d/3'),
 criteria_json:JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:'https://example.org/d/3',checked_at:stamp,...(travel?{travel}:{})})});
const label='Vrijeme putovanja do „TEST ONLY zračna luka” (automobil)';
assert.equal(D.evaluate(p,buyer(),now).status,D.MATCH);
let r=D.evaluate(p,buyer([req]),now);assert.equal(r.status,D.CANDIDATE);assert(r.gaps.pair.includes(label+' nije izračunato'));
r=D.evaluate(p,buyer([{...req,mandatory:false}]),now);assert.equal(r.status,D.MATCH);assert(r.info.some(v=>v.startsWith(label+' — želja')));
assert(D.evaluate(p,buyer([{...req,mode:'let'}]),now).gaps.buyer.includes('Ispravni strukturirani kriteriji kupca'));
// No coordinates in the anonymous presentation.
const O=await import('./supabase/functions/sites-platform/offer.mjs');
assert(!JSON.stringify(O.presentation(p,buyer([req]),{reasons:[]},'EU-T')).includes('45.74'),'coordinates stay internal');
// Outcomes from stored results only.
assert.equal(T.travelOutcome(req,null).state,'not_computed');
assert.equal(T.travelOutcome(req,{minutes:25,expires_at:now+1000,source:'x'},now).state,'met');
assert.equal(T.travelOutcome(req,{minutes:35,expires_at:now+1000,source:'x'},now).state,'unmet');
assert.equal(T.travelOutcome(req,{minutes:25,expires_at:now-1,source:'x'},now).state,'not_computed','a stale cache is not a result');
assert.equal(T.travelOutcome(req,{error:'429',expires_at:now+1},now).state,'not_computed');
// Queue: dedup, TTL, location change, retries with backoff, 429, concurrency, imprecise origin.
let clock=1_000_000;const sleeps=[];const origin={lat:45.7,lon:16.07,precision:'adresa'};
let q=new T.TravelQueue({adapter:T.testAdapter(),ttl:1000,now:()=>clock,sleep:async ms=>{sleeps.push(ms)}});
const [a,b]=await Promise.all([q.enqueue(origin,airport,'automobil'),q.enqueue(origin,airport,'automobil')]);
assert.equal(q.calls,1,'identical concurrent jobs are computed once');assert.equal(a,b);assert(a.minutes>=0&&a.source.startsWith('TEST ONLY'));
await q.enqueue(origin,airport,'automobil');assert.equal(q.calls,1,'cache hit within the TTL');
clock+=1001;await q.enqueue(origin,airport,'automobil');assert.equal(q.calls,2,'expired cache is recomputed');
await q.enqueue({...origin,lat:45.71},airport,'automobil');assert.equal(q.calls,3,'a moved location is a new key');
assert.deepEqual(await q.enqueue({lat:45.8,lon:15.97,precision:'grad'},airport,'automobil'),{error:'Lokacija nekretnine nije dovoljno precizna',expires_at:Infinity});assert.equal(q.calls,3,'no call for an imprecise origin');
const timeout=Object.assign(Error('timeout'),{code:'ETIMEDOUT'}),limited=Object.assign(Error('limit'),{status:429});
q=new T.TravelQueue({adapter:T.testAdapter(60,{fail:[timeout,limited]}),now:()=>clock,sleep:async ms=>{sleeps.push(ms)},backoff:100});sleeps.length=0;
assert(Number.isFinite((await q.enqueue(origin,airport,'automobil')).minutes));assert.deepEqual(sleeps,[100,200],'exponential backoff');assert.equal(q.calls,3);
q=new T.TravelQueue({adapter:T.testAdapter(60,{fail:[limited,limited,limited,limited]}),now:()=>clock,sleep:async()=>{},retries:3});
const failed=await q.enqueue(origin,airport,'automobil');assert.equal(failed.error,'Ograničenje servisa (429)');assert.equal(q.get(T.travelKey(origin,airport,'automobil')),null,'a failure is not cached as a result');
q=new T.TravelQueue({adapter:{name:'bad',route:async()=>({minutes:-1})},now:()=>clock,sleep:async()=>{}});
assert.match((await q.enqueue(origin,airport,'automobil')).error,/Neispravan odgovor/);assert.equal(q.calls,1,'an invalid answer is not retried');
let active=0,peak=0;const slow={name:'slow',route:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return {minutes:1}}};
q=new T.TravelQueue({adapter:slow,concurrency:2});await Promise.all([0,1,2,3,4].map(k=>q.enqueue({...origin,lat:45+k/10},airport,'automobil')));assert.equal(peak,2,'parallelism is bounded');
console.log(JSON.stringify([D.evaluate(p,buyer([req]),now).gaps.pair,D.evaluate(p,buyer([{...req,mandatory:false}]),now).info]));
console.error('travel-v1: off by default, contract, matching without calls, queue (dedup, TTL, retries, 429, concurrency), privacy passed');
