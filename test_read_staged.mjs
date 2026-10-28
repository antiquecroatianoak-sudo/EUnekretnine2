// Read-path performance fix (PR #47 comments 6452174425/6452231134): the inactive-listing set is staged once per
// transaction instead of re-parsing every source candidate for each use of the visibility predicate. Every result must
// equal the original predicate. Runs from test_pair_records.py on an isolated database (real exported schema +
// ops/pair-records.sql); all records are TEST ONLY fixtures. Needs PAIR_DB_URL and PG_MODULE (postgres@3.4.7).
import {strict as assert} from 'node:assert';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
const dir=new URL('./supabase/functions/sites-platform/',import.meta.url),copy=new URL('.read-staged-test.mjs',dir);
globalThis.Deno={env:{get:k=>k==='SUPABASE_DB_URL'?process.env.PAIR_DB_URL:undefined},serve:()=>{}};
writeFileSync(copy,readFileSync(new URL('index.js',dir),'utf8').replace("from 'npm:postgres@3.4.7'",'from '+JSON.stringify(pathToFileURL(process.env.PG_MODULE).href))+'\nexport {dispatch};');
let dispatch;try{({dispatch}=await import(copy.href))}finally{rmSync(copy)}
const {PROPERTY_VISIBLE,PROPERTY_VISIBLE_STAGED,stagedVisibility}=await import('./supabase/functions/sites-platform/catalog.mjs');
const {sourceProgress}=await import('./sites-review/lib/platform-view.mjs');
const {SOURCE_ACTIVE}=await import('./supabase/functions/sites-platform/activity-policy.mjs');
const sql=postgres(process.env.PAIR_DB_URL,{max:4,onnotice:()=>{}});
const run=a=>sql.begin(tx=>dispatch(tx,a));
const contact=u=>JSON.stringify({mode:'direct',name:'TEST ONLY',contact_url:u,evidence_url:u,record_reference:u,permitted:true});
const today=new Date().toISOString().slice(0,10),past=new Date(Date.now()-86400000).toISOString(),future=new Date(Date.now()+30*86400000).toISOString();
const ids=rows=>rows.map(r=>Number(r.id??r.property_id)).sort((a,b)=>a-b);
try{
 // Properties, each paired with the source situation that decides its visibility.
 const cases=[
  ['own-sold',{status:'Prodano'},null],['own-expired-until',{available_until:'2000-01-01'},null],['no-candidate',{},null],
  ['active-candidate',{},{facts:{source_listing_state:'active'}}],['unknown-availability',{},{facts:{}}],['invalid-json',{},'{nije json'],
  ['candidate-sold',{},{facts:{source_listing_state:'sold'}}],['candidate-removed',{},{facts:{source_listing_state:'removed'}}],
  ['candidate-deadline-past',{},{facts:{deadline:past}}],['candidate-deadline-future',{},{facts:{deadline:future}}],
  ['lifecycle-expired',{},{facts:{}},'expired'],['lifecycle-observed',{},{facts:{}},'observed'],
  ['url-only-sold',{},{facts:{source_listing_state:'sold'}},null,{byUrl:true}],['url-slash-sold',{},{facts:{source_listing_state:'sold'}},null,{byUrl:true,slash:true}],
  ['buyer-kind-sold',{},{facts:{source_listing_state:'sold'}},null,{kind:'buyer'}]];
 const created={};
 for(const [name,own,body,state,opt={}] of cases){
  const source='https://example.org/test-only/'+name;
  const [p]=await sql`insert into properties(country,city,title,source,price,area,renovation,other_costs,property_type,condition,status,source_checked_on,legal,available_until,contact_json)
   values('Hrvatska','Zagreb',${'TEST ONLY '+name},${source},100000,600,0,0,'Zemljište','Neizgrađeno',${own.status||'Aktivno'},${today},'Nepoznato',${own.available_until||null},${contact(source)}) returning id`;
  created[name]=Number(p.id);
  if(body!==null){
   const cid='cand-'+name;
   await sql`insert into source_candidates(id,source_id,kind,title,country,url,body_json,last_seen,property_id)
    values(${cid},'test',${opt.kind||'property'},'TEST ONLY',${'HR'},${opt.slash?source+'/':source},${typeof body==='string'?body:JSON.stringify(body)},${new Date().toISOString()},${opt.byUrl?null:Number(p.id)})`;
   if(state)await sql`insert into site_private.listing_lifecycle(candidate_id,state) values(${cid},${state})`;
  }
 }
 // Visible but without a usable contact: not eligible, so the eligible count must differ from the visible count.
 const [nc]=await sql`insert into properties(country,city,title,source,price,area,renovation,other_costs,property_type,condition,status,source_checked_on,legal)
  values('Hrvatska','Zagreb','TEST ONLY no-contact','https://example.org/test-only/no-contact',100000,600,0,0,'Zemljište','Neizgrađeno','Aktivno',${today},'Nepoznato') returning id`;
 created['no-contact']=Number(nc.id);
 for(const n of [1,2]){const u='https://example.org/test-only/demand/'+n;
  await sql`insert into investors(name,country,preferred_countries,notes,verified,criteria_json,contact_json) values(${'TEST ONLY kupac '+n},'US','Hrvatska','',1,${JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:u,checked_at:new Date().toISOString()})},${contact(u)})`;}
 await run({action:'refresh'});

 // 1. Row-level equality of the staged and the original predicate for every property.
 const visible=await sql.begin(async tx=>{
  const frag=await stagedVisibility(tx);assert.equal(frag,PROPERTY_VISIBLE_STAGED);
  const [a,b]=await Promise.all([tx`select p.id from properties p where ${tx.unsafe(PROPERTY_VISIBLE)} order by p.id`,tx`select p.id from properties p where ${tx.unsafe(frag)} order by p.id`]);
  assert.deepEqual(ids(b),ids(a),'staged visibility equals the original predicate');return ids(a);
 });
 const expect={'own-sold':false,'own-expired-until':false,'no-candidate':true,'active-candidate':true,'unknown-availability':true,'invalid-json':true,'candidate-sold':false,'candidate-removed':false,
  'candidate-deadline-past':false,'candidate-deadline-future':true,'lifecycle-expired':false,'lifecycle-observed':true,'url-only-sold':false,'url-slash-sold':false,'buyer-kind-sold':true,'no-contact':true};
 for(const [name,v] of Object.entries(expect))assert.equal(visible.includes(created[name]),v,name);

 // 2. read: every count and list equals the original predicate; properties_all keeps its value.
 const ref=async q=>Number((await sql.unsafe(q))[0].n);
 const V=PROPERTY_VISIBLE;
 const read=await run({action:'read'});
 assert.equal(read.counts.properties,visible.length);assert.equal(read.counts.properties_all,visible.length,'properties_all keeps its meaning');
 assert(read.counts.properties_eligible<visible.length,'fixture separates eligible from visible');
 assert.equal(read.counts.properties_eligible,await ref(`select count(*)::int n from properties p where site_private.property_eligible(p) and site_private.contact_usable(p.contact_json,p.source) and ${V}`));
 assert.equal(read.counts.match_results,await ref(`select count(*)::int n from match_results m join properties p on p.id=m.property_id where ${V}`));
 assert.equal(read.counts.notification_outbox,await ref(`select count(*)::int n from notification_outbox n join properties p on p.id=n.property_id where ${V}`));
 assert.deepEqual(ids(read.properties),visible.slice(0,100));
 assert.deepEqual(read.match_results.map(m=>m.property_id+'-'+m.investor_id),(await sql.unsafe(`select m.property_id,m.investor_id from match_results m join properties p on p.id=m.property_id where ${V} order by m.property_id,m.investor_id`)).map(m=>m.property_id+'-'+m.investor_id));
 assert(read.match_results.length>0,'fixture produces stored pairs');
 // Source candidates: list and counts equal the original SOURCE_ACTIVE predicate (NULL stays excluded).
 const refSources=(await sql.unsafe(`select c.id from source_candidates c where c.kind<>'property' or ((${SOURCE_ACTIVE}) and not exists(select 1 from site_private.listing_lifecycle l where l.candidate_id=c.id and l.state in ('expired','removed'))) order by last_seen desc,id limit 500`)).map(r=>r.id);
 assert.deepEqual(read.source_candidates.map(r=>r.id),refSources);
 assert.equal(read.counts.source_candidates,await ref(`select count(*)::int n from source_candidates c where c.kind<>'property' or ${SOURCE_ACTIVE}`));
 const srcPage=await run({action:'sources',offset:0,limit:500});
 assert.equal(srcPage.total,read.counts.source_candidates);
 assert.deepEqual(srcPage.source_candidates.map(r=>r.id),(await sql.unsafe(`select c.id from source_candidates c where c.kind<>'property' or ${SOURCE_ACTIVE} order by last_seen desc,id limit 500`)).map(r=>r.id));
 assert(srcPage.total<await ref('select count(*)::int n from source_candidates'),'fixture has excluded candidates');
 // 3. pairs, catalog and diagnostics use the same visibility.
 const pairs=await run({action:'pairs'});
 assert.deepEqual(pairs.match_results.map(m=>m.property_id+'-'+m.investor_id),read.match_results.map(m=>m.property_id+'-'+m.investor_id));
 assert.equal(pairs.totals.properties,visible.length);
 let page=await run({action:'catalog',table:'properties',limit:4}),seen=[...page.items];
 while(page.has_more){page=await run({action:'catalog',table:'properties',limit:4,after:page.next,through:page.through});seen.push(...page.items)}
 assert.equal(page.total,visible.length);assert.deepEqual(ids(seen),visible,'catalog pages cover exactly the visible properties');
 const diag=await run({action:'pair_diagnostics'});assert.equal(diag.stored.all_properties,visible.length,'diagnostics count the visible properties');
 const fp=diag.funnel;assert(fp&&typeof fp==='object');
 // 4. Transaction cleanup: nothing remains after commit or rollback on the same session.
 const reserved=await sql.reserve();
 try{
  const left=async()=>(await reserved`select to_regclass('pg_temp.source_state') as t`)[0].t;
  await reserved`begin`;await dispatch(reserved,{action:'read'});assert.notEqual(await left(),null,'staged inside the transaction');await reserved`commit`;
  assert.equal(await left(),null,'dropped at commit');
  await reserved`begin`;await stagedVisibility(reserved);await reserved`rollback`;assert.equal(await left(),null,'dropped at rollback');
 }finally{reserved.release()}
 // 5. A later call in the same transaction sees writes made earlier in that transaction.
 await assert.rejects(sql.begin(async tx=>{
  const frag=await stagedVisibility(tx);
  assert.equal((await tx`select count(*)::int n from properties p where ${tx.unsafe(frag)} and p.id=${created['active-candidate']}`)[0].n,1);
  await tx`update source_candidates set body_json=${JSON.stringify({facts:{source_listing_state:'sold'}})} where id='cand-active-candidate'`;
  const again=await stagedVisibility(tx);
  assert.equal((await tx`select count(*)::int n from properties p where ${tx.unsafe(again)} and p.id=${created['active-candidate']}`)[0].n,0,'rebuilt stage sees the new closure');
  throw Error('undo');
 }),/undo/);
 // 6. Concurrent reads on separate sessions each stage their own set and return the same results.
 const parallel=await Promise.all([run({action:'read'}),run({action:'pairs'}),run({action:'read'}),run({action:'catalog',table:'properties',limit:500})]);
 assert.equal(parallel[0].counts.properties,visible.length);assert.equal(parallel[2].counts.properties,visible.length);
 assert.equal(parallel[1].match_results.length,pairs.match_results.length);assert.deepEqual(ids(parallel[3].items),visible);
 // 7. discovery_runs: the read returns the status summary; the stored checkpoint is unchanged.
 const big={pages_processed:3,inserted_count:2,updated_count:1,pending:['a','b','c'],error:'TEST ONLY greška',cursor:'x'.repeat(200000)};
 await sql`insert into discovery_runs(source_id,status,checked_at,body_json) values('test-big','Djelomično',${new Date().toISOString()},${JSON.stringify(big)}),('test-invalid','ok',${new Date().toISOString()},'{nije json')`;
 const r2=await run({action:'read'}),runs=Object.fromEntries(r2.discovery_runs.map(r=>[r.source_id,r]));
 const summary=JSON.parse(runs['test-big'].body_json);
 assert.deepEqual(summary,{summarized:true,pages_processed:3,inserted_count:2,updated_count:1,pending_count:3,error:'TEST ONLY greška'});
 assert(runs['test-big'].body_json.length<300,'checkpoint payload is not sent');
 assert.equal(sourceProgress(runs['test-big']).summary,'3 obrađenih stranica · 2 novih · 1 ažuriranih · 3 poveznica čeka nastavak');
 assert.equal(sourceProgress(runs['test-big']).continuing,false,'an error stops the continuing note, as before');
 assert.deepEqual(JSON.parse(runs['test-invalid'].body_json),{summarized:true,pages_processed:null,inserted_count:null,updated_count:null,pending_count:0,error:null});
 assert.equal((await sql`select length(body_json)::int n from discovery_runs where source_id='test-big'`)[0].n,JSON.stringify(big).length,'stored checkpoint unchanged');
 assert.equal(sourceProgress({status:'Djelomično',body_json:JSON.stringify({pending:[1,2]})}).summary,'2 poveznica čeka nastavak','full checkpoints still read');
 console.log('read staged: ok');
}finally{await sql.end()}
