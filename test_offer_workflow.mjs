// Plan #46 through supabase/functions/sites-platform/index.js dispatch, against an isolated database prepared by
// test_pair_records.py (real exported schema + ops/pair-records.sql). Needs PAIR_DB_URL and PG_MODULE (postgres@3.4.7).
// Every record here is a TEST ONLY fixture; nothing is sent and no production data is touched.
import {strict as assert} from 'node:assert';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
const dir=new URL('./supabase/functions/sites-platform/',import.meta.url),copy=new URL('.offer-workflow-test.mjs',dir);
globalThis.Deno={env:{get:k=>k==='SUPABASE_DB_URL'?process.env.PAIR_DB_URL:process.env['TEST_'+k]},serve:()=>{}};
writeFileSync(copy,readFileSync(new URL('index.js',dir),'utf8').replace("from 'npm:postgres@3.4.7'",'from '+JSON.stringify(pathToFileURL(process.env.PG_MODULE).href))+'\nexport {dispatch};');
let dispatch;try{({dispatch}=await import(copy.href))}finally{rmSync(copy)}
const {MATCH,CANDIDATE}=await import('./supabase/functions/sites-platform/domain.mjs');
const {presentationHtml,packageSections,changeOf}=await import('./supabase/functions/sites-platform/offer.mjs');
const {buyerTeaser}=await import('./supabase/functions/sites-platform/teaser.mjs');
const sql=postgres(process.env.PAIR_DB_URL,{max:4,onnotice:()=>{}});
const contact=source=>JSON.stringify({mode:'direct',name:'TEST ONLY',contact_url:source,evidence_url:source,record_reference:source,permitted:true});
const run=a=>sql.begin(tx=>dispatch(tx,a));
const phase=on=>{if(on)process.env.TEST_BUSINESS_PHASE='on';else delete process.env.TEST_BUSINESS_PHASE};
const today=new Date().toISOString().slice(0,10),now=new Date().toISOString();
const events=async ids=>(await sql`select notes from activity where property_id=${ids.property_id} and investor_id=${ids.investor_id} and stage='Tijek ponude v1' order by id`).flatMap(r=>{try{return [JSON.parse(r.notes)]}catch{return []}});
// The Sites copy renders the print view; it must be the same code the backend versions with.
assert.equal(readFileSync(new URL('./sites-review/lib/offer.mjs',import.meta.url),'utf8'),readFileSync(new URL('offer.mjs',dir),'utf8'),'sites-review/lib/offer.mjs differs from the backend copy');
try{
 phase(false);
 const listing='https://example.org/test-only/listing/77';
 const [p]=await sql`insert into properties(country,region,city,title,source,price,price_basis,area,renovation,other_costs,property_type,condition,status,source_checked_on,legal,legal_evidence_url,contact_json)
  values('Hrvatska','Zagrebačka','Velika Gorica','TEST ONLY Zemljište uz potok Lukavec',${listing},180000,'asking',2400,0,0,'Zemljište','Neizgrađeno','Aktivno',${today},'Uredno','https://example.org/test-only/legal/77',${contact(listing)}) returning id`;
 // The imported profile: seat outside the EU, unknown budget, its own source and contact.
 const demand='https://example.org/test-only/demand/1';
 const profileCriteria={property_types:['Zemljište'],conditions:['Neizgrađeno'],min_area:2000,max_area:3000,source_url:demand,checked_at:now,listing_kind:'imported_profile'};
 const [b]=await sql`insert into investors(name,country,min_budget,max_budget,preferred_countries,notes,verified,criteria_json,contact_json) values('TEST ONLY kupac','US',null,null,'Hrvatska','',1,${JSON.stringify(profileCriteria)},${contact(demand)}) returning id`;
 const profileBefore=(await sql`select * from investors where id=${b.id}`)[0];
 await run({action:'refresh'});
 let pairs=await run({action:'pairs'});
 const own=pairs.match_results.find(m=>Number(m.property_id)===Number(p.id)&&Number(m.investor_id)===Number(b.id));
 assert.equal(JSON.parse(own.result_json).status,MATCH,'fixture is a real opportunity');
 assert.equal(own.change?.kind,'Novo','a pair computed for the first time is marked new from pair_history');

 // 1. Separate requests of one buyer: own criteria, source and date; nothing is inherited or crossed.
 await assert.rejects(run({action:'save_request',investor_id:b.id,request_id:b.id,label:'Prepis',criteria:{}}),/Izvorni profil/,'the imported profile is never rewritten');
 await assert.rejects(run({action:'save_request',investor_id:b.id,label:'',criteria:{}}),/naziv/);
 await assert.rejects(run({action:'save_request',investor_id:b.id,label:'X',criteria:{buyer_identity_id:'999'}}),/Nevaljan kriterij/);
 await assert.rejects(run({action:'save_request',investor_id:b.id,label:'Obrnuti raspon',preferred_countries:'Hrvatska',criteria:{property_types:['Kuća'],conditions:['Za obnovu'],min_area:300,max_area:100}}),/raspon površine/);
 const houseSource='https://example.org/test-only/demand/2';
 // A verified request needs its own source and date: the profile's check is not copied.
 await assert.rejects(run({action:'save_request',investor_id:b.id,label:'Kuća za obnovu',preferred_countries:'Hrvatska',verified:true,criteria:{property_types:['Kuća'],conditions:['Za obnovu'],source_url:houseSource}}),/izvor, datum i kriterije/);
 const house=await run({action:'save_request',investor_id:b.id,label:'Kuća za obnovu',preferred_countries:'Hrvatska',verified:true,
  criteria:{property_types:['Kuća'],conditions:['Za obnovu'],min_area:120,max_area:120,source_url:houseSource,checked_at:now}});
 const equal=await run({action:'save_request',investor_id:house.id,label:'Zemljište bez potvrde',preferred_countries:'Hrvatska',criteria:{property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:demand}});
 let req=await run({action:'buyer_requests',investor_id:house.id});
 assert.equal(req.identity_id,String(b.id));assert.equal(req.count,3);assert.deepEqual(req.items.map(r=>r.request_label),['Izvorni profil','Kuća za obnovu','Zemljište bez potvrde']);
 const [houseRow,landRow]=[req.items[1],req.items[2]];
 assert.equal(houseRow.name,'TEST ONLY kupac');assert.equal(houseRow.country,'US','seat is kept, never used as demand');
 assert.equal(houseRow.contact_json,null,'an agency/buyer contact is never copied onto another request');
 assert.equal(landRow.contact_json,null);assert.equal(landRow.verified,0,'unverified request stays unverified');
 const hc=JSON.parse(houseRow.criteria_json);assert.deepEqual(hc.property_types,['Kuća']);assert.equal(hc.min_area,120);assert.equal(hc.max_area,120,'equal bounds are valid');
 assert.equal(hc.listing_kind,undefined,'criteria of the profile are not merged into a new request');
 assert.deepEqual((await sql`select * from investors where id=${b.id}`)[0],profileBefore,'the original profile is unchanged');
 const read=await run({action:'read'});assert.equal(read.counts.buyers,1,'three requests, one buyer');assert(read.counts.investors>=3);
 // The house request cannot pair with land; the unverified land request gets no real opportunity.
 pairs=await run({action:'pairs'});
 assert(!pairs.match_results.some(m=>String(m.investor_id)===String(house.id)),'criteria of separate requests are not crossed');
 // Editing a request with a new source drops its earlier date and contact; an unknown budget stays empty.
 await sql`update investors set contact_json=${contact(houseSource)} where id=${house.id}`;
 await run({action:'save_request',investor_id:b.id,request_id:house.id,label:'Kuća za obnovu',preferred_countries:'Hrvatska',min_budget:'',max_budget:'',criteria:{min_area:100,max_area:150}});
 let hr=(await sql`select * from investors where id=${house.id}`)[0];assert.equal(hr.contact_json!=null,true,'same source keeps its own contact');assert.equal(JSON.parse(hr.criteria_json).checked_at,now);assert.equal(hr.max_budget,null);
 await run({action:'save_request',investor_id:b.id,request_id:house.id,label:'Kuća za obnovu',preferred_countries:'Hrvatska',criteria:{source_url:'https://example.org/test-only/demand/3'}});
 hr=(await sql`select * from investors where id=${house.id}`)[0];assert.equal(hr.contact_json,null,'changed source does not inherit the contact');assert.equal(JSON.parse(hr.criteria_json).checked_at,undefined,'changed source does not inherit the check date');
 await assert.rejects(run({action:'save_request',investor_id:b.id,request_id:p.id+100000,label:'X',criteria:{}}),/ne pripada/);

 // 3. Final review: fresh evaluation, separate fit and reliability, both contact channels.
 const ids={property_id:Number(p.id),investor_id:Number(b.id)};
 let w=await run({action:'workflow',...ids});
 assert.equal(w.result.status,MATCH);assert.equal(w.readiness.ready,true);assert.equal(w.readiness.fit,100);assert.match(w.readiness.reliability,/interes nije potvrđen/);
 assert.equal(w.contacts.seller.label,'Izravan kontakt');assert.equal(w.contacts.buyer.label,'Izravan kontakt');assert.equal(w.business_phase,false);
 // 4. Versioned anonymous presentation.
 const v1=await run({action:'offer_create',...ids});
 w=await run({action:'workflow',...ids});let o=w.offers[0];
 assert.equal(o.number,1);assert.equal(o.current,true);assert.equal(o.approved,false);
 const shown=JSON.stringify(o.presentation);
 for(const secret of ['Lukavec','Velika Gorica','Zagrebačka','example.org','TEST ONLY',demand,listing])assert(!shown.includes(secret),'presentation leaks '+secret);
 assert.deepEqual(o.presentation.request.slice(0,2),['Vrsta: Zemljište','Stanje: Neizgrađeno']);assert.match(o.presentation.request[2],/^Površina: okvirno/);
 assert(o.presentation.reasons.includes('Površina je unutar dopuštenog raspona'));
 const html=presentationHtml({...o.presentation,title:'<script>alert(1)</script>'},{version:1,approved:false});
 assert(!html.includes('<script>alert'),'escaped');assert(html.includes('INTERNI NACRT'));
 // Approval needs an explicit review; it is idempotent.
 await assert.rejects(run({action:'offer_approve',...ids,offer_id:v1.id}),/Prije odobrenja/);
 const a1=await run({action:'offer_approve',...ids,offer_id:v1.id,reviewed:true}),a2=await run({action:'offer_approve',...ids,offer_id:v1.id,reviewed:true});
 assert.equal(a2.id,a1.id);assert.equal(a2.already,true);
 // 5./6. Business phase is off by default: nothing about responses or hand-over is recorded.
 const response={action:'offer_response',...ids,offer_id:v1.id,response:'Zainteresiran',body:'Zanima nas, molimo dodatne podatke o pristupu.',evidence:'E-pošta TEST 1',channel:'E-pošta',respondent:'TEST ONLY kupac',responded_on:today,written:true};
 await assert.rejects(run(response),/Poslovna faza/);
 phase(true);
 // Opening/clicking is never interest: a response needs written=true and evidence.
 await assert.rejects(run({...response,written:false}),/pisani odgovor/);
 await assert.rejects(run({...response,evidence:''}),/evidence/);
 await assert.rejects(run({...response,responded_on:'2000-01-01'}),/prethoditi/,'a response cannot predate the approval');
 await assert.rejects(run({...response,response:'Otvoreno'}),/izričit/);
 await assert.rejects(run({...response,offer_id:'999999999'}),/nije pronađena/,'wrong version');
 // Concurrent writes on one pair are serialised: two versions get distinct numbers.
 const [c1,c2]=await Promise.all([run({action:'offer_create',...ids}),run({action:'offer_create',...ids})]);
 w=await run({action:'workflow',...ids});assert.deepEqual(w.offers.map(x=>x.number),[1,2,3]);
 await assert.rejects(run({...response,offer_id:c1.id}),/odobrenu verziju/,'a response to an unapproved version is refused');
 await run(response);
 const handoff={action:'agency_package',...ids,offer_id:v1.id,agency_name:'TEST ONLY agencija',agency_channel:'Ugovoreni portal',mandate_evidence:'Ugovor o partnerstvu TEST',sharing_permission:'Suglasnost prodavatelja TEST',
  fee_terms:'2 % od kupoprodajne cijene',fee_evidence:'Potpisani dodatak TEST',open_questions:'Pristup s javne ceste',reviewed:true,fee_accepted:true};
 await assert.rejects(run({...handoff,fee_accepted:false}),/naknad|dogovor/);
 await assert.rejects(run({...handoff,sharing_permission:''}),/dijeljenja/);
 // A newer withdrawal overrides the older interest.
 await run({...response,response:'Interes povučen',body:'Povlačimo interes.'});
 await assert.rejects(run(handoff),/posljednji pisani interes/);
 // A rejection recorded on another version of the same pair also cancels the earlier interest.
 await run({...response,body:'Ponovno zainteresirani nakon razgovora.'});
 await run({action:'offer_approve',...ids,offer_id:c1.id,reviewed:true});
 await run({...response,offer_id:c1.id,response:'Ne odgovara',body:'Druga verzija ne odgovara.'});
 await assert.rejects(run(handoff),/posljednji pisani interes/,'newer response on another version wins');
 await run({...response,body:'Ipak zainteresirani za prvu verziju.'});
 const pkg=await run(handoff);
 assert.equal(pkg.package.status,'Interni paket — nije poslan');assert.equal(pkg.package.fee_payer,'Agencija');assert.equal(pkg.package.fee_due,'Tek nakon uspješno dovršene prodaje');
 // With WORKFLOW_RESPONSE_OUT set, the real responses are saved for sites-review/scripts/check-offer-workflow-dom.jsx.
 if(process.env.WORKFLOW_RESPONSE_OUT)writeFileSync(process.env.WORKFLOW_RESPONSE_OUT,JSON.stringify({workflow:await run({action:'workflow',...ids}),requests:await run({action:'buyer_requests',investor_id:b.id}),
  secrets:['Lukavec','Velika Gorica','Zagrebačka','example.org',demand,listing]}));
 const sections=packageSections(pkg.package);assert(sections.some(([t,rows])=>t==='Naknada'&&rows.some(([,v])=>v.includes('2 %'))),'readable package');
 w=await run({action:'workflow',...ids});o=w.offers[0];
 assert(!JSON.stringify(o.presentation).includes('TEST ONLY agencija'),'the package never enters the anonymous presentation');
 // A data change makes every version stale: no new hand-over, the old response stays recorded as history.
 await run({action:'save_property',id:p.id,record:{...(await sql`select * from properties where id=${p.id}`)[0],price:175000,contact_json:contact(listing)}});
 w=await run({action:'workflow',...ids});
 assert.equal(w.offers.every(x=>!x.current),true);assert.equal(w.offers[0].approved,true,'the historical approval is kept');
 await assert.rejects(run({action:'offer_approve',...ids,offer_id:v1.id,reviewed:true}),/aktualnu verziju/);
 await assert.rejects(run(handoff),/aktualan/);
 await run({...response,body:'Odgovor na staru verziju'});
 const stale=(await events(ids)).filter(e=>e.type==='response').at(-1);assert.equal(stale.version_current,false);
 const v4=await run({action:'offer_create',...ids});await run({action:'offer_approve',...ids,offer_id:v4.id,reviewed:true});
 await assert.rejects(run({...handoff,offer_id:v4.id}),/posljednji pisani interes/,'interest in an old version does not carry over');
 // A stale source check blocks approval of a fresh version even though stored data looks complete.
 await sql`update properties set source_checked_on=${new Date(Date.now()-40*86400000).toISOString().slice(0,10)} where id=${p.id}`;
 w=await run({action:'workflow',...ids});assert.equal(w.readiness.ready,false);
 const v5=await run({action:'offer_create',...ids});
 await assert.rejects(run({action:'offer_approve',...ids,offer_id:v5.id,reviewed:true}),/Prije odobrenja/);
 // Invalid JSON in the activity log is ignored, never repaired or counted.
 await sql`insert into activity(property_id,investor_id,stage,notes,date) values(${ids.property_id},${ids.investor_id},'Tijek ponude v1','{nije json',${now})`;
 w=await run({action:'workflow',...ids});assert.equal(w.offers.length,5);
 // History is append-only: every earlier event is still there.
 assert.equal((await events({...ids})).length>=12,true);
 // A closed listing leaves the operational workflow.
 await sql`update properties set status='Prodano' where id=${p.id}`;
 await assert.rejects(run({action:'workflow',...ids}),/više nisu dostupni/);
 // 2. Pair history marks only real improvements.
 const h=(event,status,missing,rejected,days=0)=>({event,status,missing,rejected,recorded_at:new Date(Date.now()-days*86400000)});
 assert.equal(changeOf([h('Promjena rezultata',MATCH,[],[]),h('Prvi izračun',CANDIDATE,['x'],[])])?.kind,'Poboljšano');
 assert.equal(changeOf([h('Promjena rezultata',CANDIDATE,['x'],[]),h('Prvi izračun',CANDIDATE,['x','y'],[])])?.kind,'Poboljšano');
 assert.equal(changeOf([h('Promjena rezultata',CANDIDATE,['x','z'],[]),h('Prvi izračun',CANDIDATE,['x'],[])]),null,'more open items is not an improvement');
 assert.equal(changeOf([h('Promjena rezultata',CANDIDATE,[],['a']),h('Prvi izračun',MATCH,[],[])]),null,'a downgrade is not an improvement');
 assert.equal(changeOf([h('Promjena rezultata',CANDIDATE,[],['a','b']),h('Prvi izračun',CANDIDATE,['x'],['a'])]),null,'mixed change is not an improvement');
 assert.equal(changeOf([h('Prvi izračun',CANDIDATE,[],[],30)]),null,'old changes are not highlighted');
 assert.equal(changeOf([h('Promjena rezultata',MATCH,'nije json',[]),h('Prvi izračun',CANDIDATE,[],[])])?.kind,'Poboljšano','status rank decides before list sizes');
 assert.equal(changeOf([h('Promjena rezultata',CANDIDATE,'nije json',[]),h('Prvi izračun',CANDIDATE,[],[])]),null,'unreadable history is not an improvement');
 assert.equal(changeOf([]),null);
 // The buyer teaser itself stays identifier-free for the fixture.
 assert.equal(buyerTeaser({property_type:'Zemljište',condition:'Neizgrađeno',country:'Hrvatska',area:2400,price:180000,price_basis:'asking'}).leaks.length,0);
 console.log('offer workflow: ok');
}finally{phase(false);await sql.end()}
