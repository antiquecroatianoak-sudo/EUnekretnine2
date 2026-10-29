// Module 7: partner agency proposals through supabase/functions/sites-platform/index.js dispatch on an isolated database
// prepared by test_pair_records.py (real exported schema + ops/pair-records.sql + facts and partner migrations).
// Internal staging only; TEST ONLY fixtures; nothing is fetched or sent.
import {strict as assert} from 'node:assert';
import {readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
const dir=new URL('./supabase/functions/sites-platform/',import.meta.url),copy=new URL('.partner-api-test.mjs',dir);
globalThis.Deno={env:{get:k=>k==='SUPABASE_DB_URL'?process.env.PAIR_DB_URL:undefined},serve:()=>{}};
writeFileSync(copy,readFileSync(new URL('index.js',dir),'utf8').replace("from 'npm:postgres@3.4.7'",'from '+JSON.stringify(pathToFileURL(process.env.PG_MODULE).href))+'\nexport {dispatch};');
let dispatch;try{({dispatch}=await import(copy.href))}finally{rmSync(copy)}
const P=await import('./supabase/functions/sites-platform/partner.mjs');
const src=readFileSync(new URL('partner.mjs',dir),'utf8');
assert(!/fetch\(|Deno\.env|process\.env/.test(src),'no network call, secret or environment read in the partner module');
assert.equal(P.PARTNER_CONFIG.external,false);
const sql=postgres(process.env.PAIR_DB_URL,{max:4,prepare:false,onnotice:()=>{}});
const run=a=>sql.begin(tx=>dispatch(tx,a));
const migrations=new URL('./supabase/migrations/',import.meta.url),apply=async end=>{const m=readFileSync(new URL(readdirSync(migrations).find(f=>f.endsWith(end)),migrations),'utf8');await sql.unsafe(m);await sql.unsafe(m)};
const contact=u=>JSON.stringify({mode:'direct',name:'TEST ONLY',contact_url:u,evidence_url:u,record_reference:u,permitted:true});
const today=new Date().toISOString().slice(0,10),now=new Date().toISOString();
try{
 // Supabase roles exist in production; the throwaway cluster gets them so the migration's revoke runs as written.
 for(const r of ['anon','authenticated'])await sql.unsafe(`do $$ begin create role ${r}; exception when duplicate_object then null; end $$`);
 await apply('_property_facts.sql');await apply('_partner_proposals.sql');
 const agency=async name=>Number((await sql`insert into sources(country,name,url,category) values('HR',${'TEST ONLY '+name},${'https://example.org/test-only/'+name},'Agencija za nekretnine') returning id`)[0].id);
 const A1=await agency('agencija-1'),A2=await agency('agencija-2');
 const prop=async(name,ag,extra={})=>{const u='https://example.org/test-only/p/'+name;
  const [p]=await sql`insert into properties(country,city,title,source,price,area,renovation,other_costs,property_type,condition,status,source_checked_on,legal,contact_json,risk_notes,facts_json)
   values('Hrvatska','Grad',${'TEST ONLY '+name},${u},100000,600,0,0,'Zemljište','Neizgrađeno','Aktivno',${today},'Nepoznato',${contact(u)},${extra.notes||null},${extra.facts||null}) returning id`;
  if(ag)await sql`insert into source_candidates(id,source_id,kind,title,country,url,body_json,last_seen,property_id) values(${'cand-'+name},${'registry-'+ag},'property','TEST ONLY','HR',${u},'{"facts":{}}',${now},${p.id})`;
  return Number(p.id)};
 const manualFacts=JSON.stringify({land_total:{value:5,unit:'ha',status:'potvrđeno',origin:'ručno',evidence:'TEST ONLY zapisnik',observed_on:today}});
 const X=await prop('X',A1,{notes:'Ručna bilješka operatera',facts:manualFacts}),Y=await prop('Y',A1),Z=await prop('Z',A2),W=await prop('W',null);
 await sql`insert into investors(name,country,preferred_countries,notes,verified,criteria_json,contact_json) values('TEST ONLY kupac','US','Hrvatska','',1,
  ${JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:'https://example.org/test-only/d/1',checked_at:now})},${contact('https://example.org/test-only/d/1')})`;
 await run({action:'refresh'});
 // Grants: hash only, records must be the agency's own listings, 1–30 days, known fields only.
 const token=P.newToken(),hash=await P.hashToken(token);
 const grant=await run({action:'partner_grant_create',agency_source_id:A1,record_ids:[X,Y],fields:['price','legal_evidence_url','facts.land_total','available_until'],days:7,token_hash:hash});
 assert(grant.id);
 assert.equal((await sql`select count(*)::int n from site_private.partner_grants where token_hash=${hash}`)[0].n,1);
 assert(!JSON.stringify(await sql`select * from site_private.partner_grants`).includes(token),'the token itself is never stored');
 for(const bad of [{record_ids:[Z]},{record_ids:[W]},{record_ids:[999999]},{fields:['status']},{fields:['facts.__proto__']},{days:31},{days:0},{token_hash:'x'},{agency_source_id:999999}])
  await assert.rejects(run({action:'partner_grant_create',agency_source_id:A1,record_ids:[X],fields:['price'],days:7,token_hash:'0'.repeat(64),...bad}));
 const stage=(extra={})=>run({action:'partner_stage',token,property_id:X,field:'price',value:95000,evidence:'TEST ONLY cjenik agencije',author:'TEST ONLY agent',...extra});
 // Wrong token, record outside the grant, other agency's record and an unknown id all get the same answer.
 const denied='Pristup nije valjan za ovaj zapis.';
 for(const extra of [{token:P.newToken()},{property_id:Z},{property_id:W},{property_id:999999},{property_id:'abc'}])assert.deepEqual(await stage(extra),{ok:false,reason:denied},JSON.stringify(extra));
 assert.equal((await stage({field:'area',value:700})).reason,'Polje nije dopušteno ovim pristupom.');
 assert.equal((await sql`select count(*)::int n from site_private.partner_proposals`)[0].n,0,'nothing staged on a denial');
 // Validation: URLs are text (https only, no credentials, never fetched), facts are forced to partner/unconfirmed.
 for(const v of ['http://example.org/x','javascript:alert(1)','https://u:p@example.org/x','https://example.org/a b'])await assert.rejects(stage({field:'legal_evidence_url',value:v}));
 await assert.rejects(stage({value:-1}));await assert.rejects(stage({value:'95000'}));await assert.rejects(stage({evidence:''}));await assert.rejects(stage({author:'x'.repeat(201)}));
 await assert.rejects(stage({field:'available_until',value:'2026-02-30'}));
 // Staging, replay and dedupe.
 const s1=await stage();assert(s1.ok&&s1.id);
 assert.deepEqual(await stage(),{ok:true,duplicate:true},'the same open proposal is not staged twice');
 const xss='<script>alert(1)</script> https://evil.example/steal';
 const s2=await stage({field:'legal_evidence_url',value:'https://example.org/test-only/legal-proof',evidence:xss});
 const s3=await stage({field:'facts.land_total',value:{value:7,unit:'ha',status:'potvrđeno',origin:'ručno',evidence:'lažni dokaz',observed_on:today}});
 const [f3]=await sql`select value_json from site_private.partner_proposals where id=${s3.id}`;
 assert.equal(f3.value_json.origin,'partner');assert.equal(f3.value_json.status,'nepotvrđeno');assert.equal(f3.value_json.evidence,undefined,'a partner cannot confirm its own fact');
 // Review list: current value, stale flag, evidence kept as plain text; the grant list never exposes the hash.
 let list=await run({action:'partner_proposals'});
 assert.equal(list.proposals.length,3);assert(!JSON.stringify(list).includes(hash));assert.equal(list.config.external,false);
 assert.equal(list.proposals.find(p=>p.id==s2.id).evidence,xss);assert.equal(list.proposals.find(p=>p.id==s1.id).current,100000);assert(list.proposals.every(p=>!p.stale));
 // Accept: only that field changes, manual data stays, history entry and audit are written, pairs are refreshed.
 const before=(await sql`select * from properties where id=${X}`)[0];
 assert.deepEqual(await run({action:'partner_decide',id:s1.id,decision:'prihvaćeno',note:'TEST ONLY provjereno'}),{id:s1.id,status:'prihvaćeno'});
 const after=(await sql`select * from properties where id=${X}`)[0];
 assert.equal(Number(after.price),95000);
 for(const k of Object.keys(before))if(k!=='price')assert.deepEqual(after[k],before[k],k+' unchanged');
 assert.equal((await sql`select count(*)::int n from activity where property_id=${X} and stage='Prihvaćen prijedlog partnera'`)[0].n,1);
 await assert.rejects(run({action:'partner_decide',id:s1.id,decision:'prihvaćeno'}),/već odlučeno/,'a decision is final');
 // A fact proposal keeps the other facts and stays unconfirmed after acceptance.
 await run({action:'partner_decide',id:s3.id,decision:'prihvaćeno'});
 const facts=JSON.parse((await sql`select facts_json from properties where id=${X}`)[0].facts_json);
 assert.equal(facts.land_total.value,7);assert.equal(facts.land_total.status,'nepotvrđeno');assert.equal(facts.land_total.origin,'partner');
 // Stale write: the record changed after staging, so acceptance does not overwrite it.
 const s4=await stage({value:90000});
 await sql`update properties set price=91000 where id=${X}`;
 list=await run({action:'partner_proposals'});assert(list.proposals.find(p=>p.id==s4.id).stale);
 // With PARTNER_RESPONSE_OUT set, this real response (a stale and an open proposal with markup in its evidence) is
 // rendered by sites-review/scripts/check-offer-workflow-dom.jsx.
 if(process.env.PARTNER_RESPONSE_OUT)writeFileSync(process.env.PARTNER_RESPONSE_OUT,JSON.stringify({list,stale_id:String(s4.id),xss_id:String(s2.id)}));
 assert.equal((await run({action:'partner_decide',id:s4.id,decision:'prihvaćeno'})).status,'zastarjelo');
 assert.equal(Number((await sql`select price from properties where id=${X}`)[0].price),91000);
 // Concurrent accepts of two proposals for the same field: exactly one applies, the other becomes stale.
 const c1=await stage({property_id:Y,value:80000}),c2=await stage({property_id:Y,value:81000});
 const outcomes=(await Promise.all([c1,c2].map(c=>run({action:'partner_decide',id:c.id,decision:'prihvaćeno'})))).map(r=>r.status).sort();
 assert.deepEqual(outcomes,['prihvaćeno','zastarjelo']);
 // The same proposal accepted twice at once: one decision wins, the other is refused and the status stays accepted.
 const d1=await stage({property_id:Y,value:82000});
 const both=await Promise.allSettled([0,1].map(()=>run({action:'partner_decide',id:d1.id,decision:'prihvaćeno'})));
 assert.deepEqual(both.map(r=>r.status).sort(),['fulfilled','rejected']);assert.match(both.find(r=>r.status==='rejected').reason.message,/već odlučeno/);
 assert.equal((await sql`select status from site_private.partner_proposals where id=${d1.id}`)[0].status,'prihvaćeno');
 // A record whose listing moved to another agency after the grant is no longer reachable with it.
 await sql`update source_candidates set source_id=${'registry-'+A2} where property_id=${Y}`;
 assert.deepEqual(await stage({property_id:Y,value:83000}),{ok:false,reason:denied});
 await sql`update source_candidates set source_id=${'registry-'+A1} where property_id=${Y}`;
 // 6471206531: the agency link is re-checked at acceptance. Staged for agency A1, then the listing moves to A2 or loses
 // its agency link: the proposal becomes stale with an audit entry; nothing is written and nothing is refreshed.
 const link=(id,ag)=>sql`update source_candidates set source_id=${'registry-'+ag} where property_id=${id}`;
 const priceOf=async id=>Number((await sql`select price from properties where id=${id}`)[0].price);
 const accepted=async id=>(await sql`select count(*)::int n from activity where property_id=${id} and stage='Prihvaćen prijedlog partnera'`)[0].n;
 const evaluated=async()=>String((await sql`select max(last_evaluated_at) t from site_private.pair_records`)[0].t);
 for(const [label,move,restore,value] of [['moved',()=>link(X,A2),()=>link(X,A1),77001],
  ['unlinked',()=>sql`update source_candidates set property_id=null where id='cand-X'`,()=>sql`update source_candidates set property_id=${X} where id='cand-X'`,77002]]){
  const st=await stage({value});assert(st.ok,label);
  const before=[await priceOf(X),await accepted(X),await evaluated()];
  await move();
  const listed=(await run({action:'partner_proposals'})).proposals.find(p=>p.id==st.id);
  assert(listed.stale&&/agencijom/.test(listed.stale_reason),label+': listed as stale with its reason');
  assert.equal((await run({action:'partner_decide',id:st.id,decision:'prihvaćeno'})).status,'zastarjelo',label);
  assert.deepEqual([await priceOf(X),await accepted(X),await evaluated()],before,label+': nothing written, no refresh');
  const [ev]=await sql`select event,detail from site_private.partner_audit where proposal_id=${st.id} order by id desc limit 1`;
  assert.equal(ev.event,'stale');assert.equal(ev.detail.reason,'agency_link',label);
  await restore();
 }
 // A link change that is in flight while the operator accepts: acceptance waits for it and then sees the new link.
 {const st=await stage({value:76000}),before=await priceOf(X);let release;const gate=new Promise(r=>{release=r});
  const mover=sql.begin(async tx=>{await tx`update source_candidates set source_id=${'registry-'+A2} where property_id=${X}`;await gate});
  await new Promise(r=>setTimeout(r,150));
  let done=false;const decision=run({action:'partner_decide',id:st.id,decision:'prihvaćeno'}).then(r=>{done=true;return r});
  try{await new Promise(r=>setTimeout(r,400));assert.equal(done,false,'acceptance waits for the concurrent link change')}finally{release();await mover}
  assert.equal((await decision).status,'zastarjelo');assert.equal(await priceOf(X),before);
  await link(X,A1);}
 // With the link intact the same path still accepts (control).
 {const st=await stage({value:75000});assert.equal((await run({action:'partner_decide',id:st.id,decision:'prihvaćeno'})).status,'prihvaćeno');assert.equal(await priceOf(X),75000);}
 // Reject leaves the record alone.
 assert.equal((await run({action:'partner_decide',id:s2.id,decision:'odbijeno'})).status,'odbijeno');
 assert.equal((await sql`select legal_evidence_url from properties where id=${X}`)[0].legal_evidence_url,null);
 // Revoked and expired grants stop staging and acceptance (rejecting stays possible).
 const s5=await stage({value:88000});
 await run({action:'partner_grant_revoke',id:grant.id});
 assert.equal((await stage({value:87000})).reason,'Pristup je istekao ili je opozvan.');
 await assert.rejects(run({action:'partner_decide',id:s5.id,decision:'prihvaćeno'}),/istekao ili je opozvan/);
 assert.equal((await run({action:'partner_decide',id:s5.id,decision:'odbijeno'})).status,'odbijeno');
 await assert.rejects(run({action:'partner_grant_revoke',id:grant.id}),/već opozvan/);
 const t2=P.newToken(),g2=await run({action:'partner_grant_create',agency_source_id:A1,record_ids:[Y],fields:['price'],days:1,token_hash:await P.hashToken(t2)});
 await sql`update site_private.partner_grants set created_at=now()-interval '2 days',expires_at=now()-interval '1 second' where id=${g2.id}`;
 assert.equal((await stage({token:t2,property_id:Y})).reason,'Pristup je istekao ili je opozvan.');
 // Rate limit per grant and hour.
 const t3=P.newToken();await run({action:'partner_grant_create',agency_source_id:A1,record_ids:[Y],fields:['price'],days:1,token_hash:await P.hashToken(t3)});
 for(let k=0;k<P.RATE_LIMIT.proposals;k++)assert((await stage({token:t3,property_id:Y,value:50000+k})).ok);
 assert.match((await stage({token:t3,property_id:Y,value:1})).reason,/Previše prijedloga/);
 // The audit is append-only and records every step.
 const events=(await sql`select event from site_private.partner_audit`).map(r=>r.event);
 for(const e of ['grant_created','grant_revoked','staged','accepted','rejected','stale','denied','rate_limited'])assert(events.includes(e),e);
 await assert.rejects(sql`update site_private.partner_audit set event='x'`,/append-only/);await assert.rejects(sql`delete from site_private.partner_audit`,/append-only/);
 // Row security is on and public roles have no grant on the partner tables.
 assert.equal((await sql`select count(*)::int n from pg_class where relname like 'partner_%' and relrowsecurity and relkind='r'`)[0].n,3);
 assert.equal((await sql`select count(*)::int n from information_schema.role_table_grants where table_name like 'partner_%' and grantee in ('anon','authenticated','PUBLIC')`)[0].n,0);
 console.log(JSON.stringify({proposals:(await run({action:'partner_proposals',status:'sve'})).proposals.length,events:events.length}));
 console.error('partner-v1: grants, denial without disclosure, validation, dedupe, review, stale write, concurrency, revoke/expiry, rate limit, audit passed');
}finally{await sql.end()}
