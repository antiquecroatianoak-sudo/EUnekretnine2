import {catalogPage,PROPERTY_VISIBLE,INVESTOR_VISIBLE} from './catalog.mjs';
import postgres from 'npm:postgres@3.4.7';
import {evaluate,propertyInput,investorInput,MATCH,criteria,validUrl,num,digest,pairText,conditionText,pairCheckMap,ACTIVE_STATUSES,buyerDraft,COUNTRIES,country} from './domain.mjs';
import {refreshSuggestions} from './refresh-suggestions.mjs';
import {pairFunnel} from './suggestions.mjs';
const PUBLIC_KEY={"kty":"RSA","n":"zftp10EPtvkqY_g46ytE0Mx6r2Y9cFyoMSEUn19hAEGIkeVFahS2m-j_O5fLUYt4b3tNvgGUOK-v92DhNwEdlYU8nSJa3Qlr2uEMCo_N-rQdwhjMc12fJBOQHDB4MCTF3MuydWIeyniALAhASW5DyjN4nUnT8C97ztPLnCXghTrQU8B4rUGASSPTbuq5sLBXRHfbkPaRnBHxjJLfE84gfn9huLyS4-tft3VsOBBejGZctrRj0ZdVmd-btmMifm7eVjVfPahHO9k5WjLBR3iuh6eiJlWDyKRKhmZQXt07QGG0MqFMEfveZqtsbUU5hNjwechw_1a_wgF77JcwhTn6-Q","e":"AQAB"};
const AUDIENCE='appgprj_6ad3d11946fc8191bd34af0ad4f2cdd8';
const enc=new TextEncoder();
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
const key=crypto.subtle.importKey('jwk',PUBLIC_KEY,{name:'RSA-PSS',hash:'SHA-256'},false,['verify']);
let db;
function database(){return db??=postgres(Deno.env.get('SUPABASE_DB_URL'),{ssl:'require',max:2,prepare:false,idle_timeout:10,connect_timeout:10})}
// Manual refresh, record edits and discovery use the same rules and transaction lock.
const refresh=refreshSuggestions;
// Deferred business phase (6364306499 C): preparing presentations for buyers, seller contact and agency hand-over
// stay off until the owner starts the business. Reversible with BUSINESS_PHASE=on; it changes no data and never
// sends anything (this function has no sending path); internal review and manual entry are never blocked.
const settings=()=>({business_phase:Deno.env.get('BUSINESS_PHASE')==='on'});
// Visibility rules shared by the full read and the pairs read: expired/removed sources, past deadlines.
// Bounded initial payload. Catalogues continue through `catalog` keyset pages with server-side
// search; source candidates continue through `sources`. These are page sizes, never overall maxima.
const LIMITS={properties:100,investors:100,sources:10000,source_candidates:500,discovery_runs:2000,activity:500,notification_outbox:2000,match_results:10000};
async function list(tx){
 const tables=Object.keys(LIMITS);
 const values=await Promise.all(tables.map(t=>{
 if(t==='properties')return tx`select p.* from properties p where ${tx.unsafe(PROPERTY_VISIBLE)} order by p.id limit ${LIMITS.properties}`;
 if(t==='investors')return tx`select i.* from investors i where ${tx.unsafe(INVESTOR_VISIBLE)} order by i.id limit ${LIMITS.investors}`;
 if(t==='source_candidates')return tx`select * from source_candidates order by last_seen desc,id limit ${LIMITS.source_candidates}`;
 if(t==='activity')return tx`select a.*,p.title as property_title,i.name as investor_name from activity a left join properties p on p.id=a.property_id left join investors i on i.id=a.investor_id order by a.id desc limit ${LIMITS.activity}`;
 return tx`select * from ${tx(t)} order by 1 limit ${LIMITS[t]}`;
}));
 const [counts]=await tx`select (select count(*) from properties p where ${tx.unsafe(PROPERTY_VISIBLE)})::int as properties,(select count(*) from investors i where ${tx.unsafe(INVESTOR_VISIBLE)})::int as investors,
  (select count(*) from properties)::int as properties_all,(select count(*) from investors)::int as investors_all,
  (select count(*) from properties p where site_private.property_eligible(p) and ${tx.unsafe(PROPERTY_VISIBLE)})::int as properties_eligible,
  (select count(*) from investors i where site_private.investor_eligible(i) and ${tx.unsafe(INVESTOR_VISIBLE)})::int as investors_eligible,
  (select count(*) from sources)::int as sources,(select count(*) from source_candidates)::int as source_candidates,(select count(*) from discovery_runs)::int as discovery_runs,
  (select count(*) from activity)::int as activity,(select count(*) from notification_outbox)::int as notification_outbox,(select count(*) from match_results)::int as match_results`;
 const truncated=Object.fromEntries(tables.map((t,n)=>[t,counts[t]>values[n].length]));
 return Object.fromEntries([...tables.map((t,i)=>[t,values[i]]),['counts',counts],['truncated',truncated],['settings',settings()],['loaded_at',new Date().toISOString()]]);
}
// Stored pairs with only the records they link to: small, independent of the full read, and explicit about
// pairs whose property or buyer is outside the visible lists (they are reported, never silently dropped).
async function pairsRead(tx){
 const rows=await tx`select property_id,investor_id,result_json,updated from match_results order by property_id,investor_id`;
 const pids=[...new Set(rows.map(r=>Number(r.property_id)))],iids=[...new Set(rows.map(r=>Number(r.investor_id)))];
 const [properties,investors,[totals]]=await Promise.all([
  tx`select p.*,(${tx.unsafe(PROPERTY_VISIBLE)}) as visible from properties p where p.id=any(${pids}::bigint[])`,
  tx`select i.*,(${tx.unsafe(INVESTOR_VISIBLE)}) as visible from investors i where i.id=any(${iids}::bigint[])`,
  tx`select (select count(*) from properties)::int as properties,(select count(*) from investors)::int as investors,(select max(last_evaluated_at) from site_private.pair_records) as last_evaluated_at`]);
 return {match_results:rows,properties,investors,totals,settings:settings(),loaded_at:new Date().toISOString()};
}
// Paged source candidates for the Izvori tab (newest first).
async function sourcesPage(tx,a){
 const offset=Number(a.offset??0),limit=Number(a.limit??LIMITS.source_candidates);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw Error('Nevaljana stranica izvora.');
 const [rows,[{n}]]=await Promise.all([tx`select * from source_candidates order by last_seen desc,id limit ${limit} offset ${offset}`,tx`select count(*)::int as n from source_candidates`]);
 return {source_candidates:rows,offset,total:n};
}
// Counts only: how the stored candidates arise and why the remaining property × buyer pairs are excluded.
async function pairDiagnostics(tx){
 const props=await tx`select p.* from properties p where not exists(select 1 from source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.property_id=p.id and l.state in ('expired','removed')) order by p.id`;
 const investors=await tx`select i.* from investors i where ${tx.unsafe(INVESTOR_VISIBLE)} order by i.id`;
 const checks=pairCheckMap(await tx`select id,property_id,investor_id,requirement,status,digest,evidence,outcome,answered_on,recorded_at from site_private.pair_answers where kind='Odgovor'`);
 const [stored]=await tx`select count(*)::int as total,count(*) filter (where result_json::jsonb->>'status'=${MATCH})::int as matches,count(*) filter (where result_json::jsonb->>'status'<>${MATCH})::int as candidates,
  (select count(*) from properties)::int as all_properties,(select count(*) from investors)::int as all_investors from match_results`;
 return {funnel:pairFunnel(props,investors,Date.now(),checks),stored,checked_at:new Date().toISOString()};
}
async function save(tx,table,input,id){
 const data=table==='properties'?propertyInput(input):investorInput(input);
 if(id!=null){if(!Number.isSafeInteger(Number(id))||Number(id)<=0)throw Error('Nevaljana oznaka zapisa.');
  const rows=await tx`update ${tx(table)} set ${tx(data,...Object.keys(data))} where id=${Number(id)} returning id`;if(!rows.length)throw Error('Zapis nije pronađen.');return rows[0].id;
 }
 const rows=await tx`insert into ${tx(table)} ${tx(data,...Object.keys(data))} returning id`;return rows[0].id;
}
async function prepare(tx,id){
 const rows=await tx`select * from source_candidates where id=${id} for update`;const r=rows[0];if(!r)throw Error('Kandidat nije pronađen.');
 if(r.property_id||r.investor_id)return {kind:r.kind,id:r.property_id||r.investor_id};
 const d=JSON.parse(r.body_json),f=d.facts||{};let result;
 if(r.kind==='property'){
  result=await tx`insert into properties(country,title,source,price,renovation,other_costs,legal,status,updated) values(${r.country},${r.title},${r.url},${num(f.asking_price)?f.asking_price:null},null,null,'Nepoznato','Provjera',${r.last_seen}) returning id`;
  await tx`update source_candidates set property_id=${result[0].id} where id=${id}`;
 }else{
  const b=buyerDraft(r,f);
  result=await tx`insert into investors ${tx(b,'name','country','min_budget','max_budget','preferred_countries','notes','verified','criteria_json')} returning id`;
  await tx`update source_candidates set investor_id=${result[0].id} where id=${id}`;
 }
 return {kind:r.kind,id:result[0].id};
}
const pairId=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw Error('Nevaljana oznaka para.');return n};
const text=(v,max,label)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Nedostaje ili je predug podatak: '+label+'.');return v.trim()};
const optional=(v,max,label)=>v==null||v===''?null:text(v,max,label);
// Permanent pair record with its history, review tasks, answers and stages (read only).
async function pair(tx,a){
 const p=pairId(a.property_id),i=pairId(a.investor_id);
 const [record,history,tasks,answers,stages,current,properties,investors]=await Promise.all([
  tx`select * from site_private.pair_records where property_id=${p} and investor_id=${i}`,
  tx`select * from site_private.pair_history where property_id=${p} and investor_id=${i} order by recorded_at desc,id desc limit 100`,
  tx`select requirement,status,status_reason,verification_method,checked_at,evidence,updated_at from site_private.match_review_tasks where property_id=${p} and investor_id=${i} order by requirement`,
  tx`select * from site_private.pair_answers where property_id=${p} and investor_id=${i} order by recorded_at desc,id desc limit 200`,
  tx`select * from site_private.pair_stages where property_id=${p} and investor_id=${i} order by recorded_at desc,id desc`,
  tx`select result_json,updated from match_results where property_id=${p} and investor_id=${i}`,
  tx`select * from properties where id=${p}`,tx`select * from investors where id=${i}`]);
 return {record:record[0]||null,history,tasks,answers,stages,current:current[0]||null,property:properties[0]||null,investor:investors[0]||null};
}
// A question is only a draft: it is stored for review and never sent from here.
async function pairQuestion(tx,a){
 const p=pairId(a.property_id),i=pairId(a.investor_id),requirement=text(a.requirement,500,'stavka'),body=text(a.body,8000,'pitanje');
 if(!['Prodavatelj','Kupac','Interni izvor'].includes(a.addressed_to))throw Error('Odaberi kome je pitanje namijenjeno.');
 if(!(await tx`select 1 from site_private.match_review_tasks where property_id=${p} and investor_id=${i} and requirement=${requirement} union all select 1 from site_private.pair_task_archive where property_id=${p} and investor_id=${i} and requirement=${requirement}`).length)throw Error('Stavka provjere nije pronađena za ovaj par.');
 const r=await tx`insert into site_private.pair_answers(property_id,investor_id,requirement,kind,addressed_to,body,status,recorded_by) values(${p},${i},${requirement},'Nacrt pitanja',${a.addressed_to},${body},'Nacrt','Sites') returning id`;
 await tx`update site_private.match_review_tasks set status='U provjeri',status_reason='Pripremljen nacrt pitanja (nije poslan).',updated_at=now() where property_id=${p} and investor_id=${i} and requirement=${requirement} and status='Otvoreno'`;
 return {id:r[0].id};
}
// An answer changes the pair only when it is verified with evidence, source and date.
async function pairAnswer(tx,a){
 const p=pairId(a.property_id),i=pairId(a.investor_id),requirement=text(a.requirement,500,'stavka'),body=text(a.body,8000,'odgovor');
 const status=a.verified===true?'Provjereno':a.discard===true?'Odbačeno':'Zaprimljeno - nije provjereno';
 const evidence=optional(a.evidence,2000,'dokaz'),source=optional(a.source,2000,'izvor'),channel=optional(a.channel,200,'kanal');
 const day=a.answered_on==null||a.answered_on===''?null:String(a.answered_on);
 if(day&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day>new Date().toISOString().slice(0,10)))throw Error('Datum odgovora mora biti valjan i ne u budućnosti.');
 if(status==='Provjereno'&&(!evidence||!source||!day))throw Error('Za provjeren odgovor potrebni su dokaz, izvor i datum.');
 const [prop]=await tx`select * from properties where id=${p}`,[inv]=await tx`select * from investors where id=${i}`;
 if(!prop||!inv)throw Error('Par nije pronađen.');
 if(!(await tx`select 1 from site_private.match_review_tasks where property_id=${p} and investor_id=${i} and requirement=${requirement} union all select 1 from site_private.pair_task_archive where property_id=${p} and investor_id=${i} and requirement=${requirement}`).length)throw Error('Stavka provjere nije pronađena za ovaj par.');
 // Pair-specific conditions are bound to the condition text and this property's current facts.
 const condition=conditionText(requirement,inv);
 const outcome=a.outcome??'nepoznato';
 if(!['zadovoljava','ne zadovoljava','nepoznato'].includes(outcome))throw Error('Nevaljan ishod provjere.');
 if(condition!=null&&status==='Provjereno'&&a.outcome==null)throw Error('Odaberi ishod: zadovoljava, ne zadovoljava ili nepoznato.');
 const fingerprint=condition!=null&&status==='Provjereno'?digest(pairText(condition,prop)):null;
 const r=await tx`insert into site_private.pair_answers(property_id,investor_id,requirement,kind,body,evidence,source,channel,answered_on,status,digest,outcome,recorded_by) values(${p},${i},${requirement},'Odgovor',${body},${evidence},${source},${channel},${day},${status},${fingerprint},${outcome},'Sites') returning id`;
 const [taskStatus,reason]=status==='Provjereno'?(fingerprint?['Provjereno',null]:['U provjeri','Odgovor provjeren; stavka se zatvara tek kad se podatak upiše u zapis nekretnine ili kupca.']):
  status==='Odbačeno'?['Otvoreno','Odgovor odbačen.']:['U provjeri','Odgovor zaprimljen, još nije provjeren.'];
 await tx`update site_private.match_review_tasks set status=${taskStatus},status_reason=${reason},checked_at=${status==='Provjereno'?new Date():null},evidence=${status==='Provjereno'?evidence:null},updated_at=now() where property_id=${p} and investor_id=${i} and requirement=${requirement}`;
 await refresh(tx);return {id:r[0].id};
}
// An explicit, evidenced check of the property's source listing. Ordinary saves never set this date;
// the evidence is kept in the activity log because properties has no evidence column.
async function sourceCheck(tx,a){
 const p=pairId(a.property_id),day=String(a.checked_on||''),evidence=text(a.evidence,2000,'dokaz provjere izvora');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day>new Date().toISOString().slice(0,10))throw Error('Datum provjere izvora mora biti valjan i ne u budućnosti.');
 if(a.status!=null&&!ACTIVE_STATUSES.includes(a.status))throw Error('Potvrđeni status mora biti jedan od: '+ACTIVE_STATUSES.join(', ')+'.');
 const rows=a.status!=null?await tx`update properties set source_checked_on=${day},status=${a.status} where id=${p} returning id`:await tx`update properties set source_checked_on=${day} where id=${p} returning id`;
 if(!rows.length)throw Error('Nekretnina nije pronađena.');
 await tx`insert into activity(property_id,stage,notes,date) values(${p},'Provjera',${'Provjera izvora oglasa '+day+(a.status?' (status: '+a.status+')':'')+': '+evidence},${new Date().toISOString()})`;
 await refresh(tx);return {id:p};
}
// Confirmed interest and a closed deal are recorded only by a person, with evidence; the database guards the order.
async function pairStage(tx,a){
 await refresh(tx);
 const p=pairId(a.property_id),i=pairId(a.investor_id);
 if(!['Potvrđen interes','Interes povučen','Realiziran posao'].includes(a.stage))throw Error('Nevaljana faza para.');
 const day=String(a.stage_on||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day>new Date().toISOString().slice(0,10))throw Error('Datum mora biti valjan i ne u budućnosti.');
 const r=await tx`insert into site_private.pair_stages(property_id,investor_id,stage,evidence,source,stage_on,recorded_by) values(${p},${i},${a.stage},${text(a.evidence,2000,'dokaz')},${text(a.source,2000,'izvor')},${day},'Sites') returning id`;
 return {id:r[0].id};
}
async function dispatch(tx,a){
 if(a.action==='pair')return await pair(tx,a);
 if(a.action==='pair_question')return await pairQuestion(tx,a);
 if(a.action==='pair_answer')return await pairAnswer(tx,a);
 if(a.action==='pair_stage')return await pairStage(tx,a);
 if(a.action==='source_check')return await sourceCheck(tx,a);
 if(a.action==='read')return await list(tx);
 if(a.action==='pairs')return await pairsRead(tx);
 if(a.action==='catalog'){const value=String(a.country||'');return await catalogPage(tx,{...a,country_values:[value,...Object.keys(COUNTRIES).filter(k=>COUNTRIES[k]===value)]})}
 if(a.action==='sources')return await sourcesPage(tx,a);
 if(a.action==='pair_diagnostics')return await pairDiagnostics(tx);
 if(a.action==='refresh')return {pairs:await refresh(tx)};
 if(a.action==='save_property'||a.action==='save_investor'){
  const table=a.action==='save_property'?'properties':'investors';const id=await save(tx,table,a.record,a.id);await refresh(tx);
  await tx`insert into activity(property_id,investor_id,stage,notes,date) values(${table==='properties'?id:null},${table==='investors'?id:null},'Uređivanje zapisa preko Sitesa',${a.id?'Izmjena postojećeg zapisa':'Novi zapis'},${new Date().toISOString()})`;return {id};
 }
 if(a.action==='prepare'){if(typeof a.id!=='string'||a.id.length>500)throw Error('Nevaljan kandidat.');const r=await prepare(tx,a.id);await refresh(tx);return r}
 if(a.action==='activity'){
  if(!['Novo','Provjera','Kontakt','Pregovori','Realizirano','Odustalo'].includes(a.stage)||typeof a.notes!=='string'||a.notes.length>8000)throw Error('Nevaljan unos postupka.');
  const property=a.property_id?Number(a.property_id):null,investor=a.investor_id?Number(a.investor_id):null;
  if(!property&&!investor)throw Error('Odaberi nekretninu ili kupca.');
  if(property&&!(await tx`select id from properties where id=${property}`).length)throw Error('Nekretnina nije pronađena.');
  if(investor&&!(await tx`select id from investors where id=${investor}`).length)throw Error('Kupac nije pronađen.');
  const r=await tx`insert into activity(property_id,investor_id,stage,notes,date) values(${property},${investor},${a.stage},${a.notes},${new Date().toISOString()}) returning id`;return {id:r[0].id};
 }
 if(a.action==='import'){
  if(!Array.isArray(a.items)||!a.items.length||a.items.length>1000)throw Error('Potreban je popis od 1 do 1000 zapisa.');
  for(const p of a.items){
   propertyInput(p);for(const k of ['city','evidence_url','checked_at'])if(typeof p[k]!=='string'||!p[k].trim())throw Error('Nedostaje '+k);
   // EU27 on equal terms (6369690655 point 1); the country must be an EU member state.
   if(!Object.values(COUNTRIES).includes(country(p.country))||!validUrl(p.evidence_url)||!/(Z|[+-]\d\d:\d\d)$/.test(p.checked_at)||!Number.isFinite(Date.parse(p.checked_at))||Date.parse(p.checked_at)>Date.now()||p.source_verified!==true||p.listing_active!==true)throw Error('Uvoz zahtijeva provjerene izvore, aktivnost i valjan datum.');
   if(!['price','area','renovation','other_costs'].every(k=>num(p[k])))throw Error('U uvozu su obavezni provjereni iznosi i površina.');
  }
  let inserted=0;for(const p of a.items){if((await tx`select id from properties where source=${p.source} union all select property_id from imports where source_url=${p.source} limit 1`).length)continue;
   const id=await save(tx,'properties',{...p,status:'Novo'});await tx`insert into imports(source_url,checked_at,evidence_url,property_id) values(${p.source},${p.checked_at},${p.evidence_url},${id})`;
   await tx`insert into activity(property_id,stage,notes,date) values(${id},'Uvoz provjerenog zapisa',${JSON.stringify(p)},${p.checked_at})`;inserted++;
  }await refresh(tx);return {inserted,skipped:a.items.length-inserted};
 }
 throw Error('Nepoznata radnja.');
}
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(Number(req.headers.get('content-length')||0)>5_000_000)return reply({error:'Prevelik zahtjev'},413);
 const stamp=req.headers.get('x-site-time'),id=req.headers.get('x-site-request'),signature=req.headers.get('x-site-signature');
 if(!stamp||!/^\d{13}$/.test(stamp)||Math.abs(Date.now()-Number(stamp))>30000||!id||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!signature)return reply({error:'Unauthorized'},401);
 let raw;try{raw=await req.text();if(raw.length>5_000_000)return reply({error:'Prevelik zahtjev'},413);
  const bytes=Uint8Array.from(atob(signature),c=>c.charCodeAt(0));
  if(!await crypto.subtle.verify({name:'RSA-PSS',saltLength:32},await key,bytes,enc.encode(AUDIENCE+'\n'+stamp+'\n'+id+'\n'+raw)))return reply({error:'Unauthorized'},401);
 }catch{return reply({error:'Unauthorized'},401)}
 try{
  const a=JSON.parse(raw);if(!a||typeof a!=='object')throw Error('Nevaljan zahtjev.');
  if(['read','pair','pairs','sources','catalog','pair_diagnostics'].includes(a.action))return reply(await database().begin(tx=>dispatch(tx,a)));
  const result=await database().begin(async tx=>{
   const known=await tx`insert into site_private.requests(id) values(${id}) on conflict do nothing returning id`;
   if(!known.length){const r=await tx`select response from site_private.requests where id=${id}`;return r[0].response}
   const response=await dispatch(tx,a);await tx`update site_private.requests set response=${tx.json(response)} where id=${id}`;return response;
  });return reply(result);
 }catch(e){console.error('platform request failed',e?.code||e?.name);return reply({error:e?.name==='PostgresError'?'Baza nije spremila promjene. Pokušaj ponovno nakon provjere veze.':String(e?.message||'Zahtjev nije izvršen.')},400)}
});

