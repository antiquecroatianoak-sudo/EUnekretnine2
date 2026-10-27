import {COUNTRIES} from './domain.mjs';
// OIDC-authenticated intake only. Registration is never activation or partnership.
export function sourceHost(value){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.port||u.username||u.password||!u.hostname.includes('.')||u.hostname.endsWith('.local')||u.hostname.endsWith('.localhost')||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':'))throw Error('Public HTTPS source required');
 return u.hostname.toLowerCase().replace(/^www\./,'').replace(/^en\./,'');
}
export function intakeInput(value){
 if(!value||!['property','buyer','reference'].includes(value.kind)||typeof value.name!=='string'||value.name.trim().length<3||value.name.length>180)throw Error('Invalid source intake');
 sourceHost(value.url);sourceHost(value.found_on);
 if(typeof value.checked_at!=='string'||!Number.isFinite(Date.parse(value.checked_at))||Math.abs(Date.now()-Date.parse(value.checked_at))>3600000)throw Error('Fresh source evidence required');
 return {...value,name:value.name.trim()};
}
export async function registerSource(sql,value){
 const v=intakeInput(value),host=sourceHost(v.url);
 return sql.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(1422569624,3)`;
  const all=await tx`select id,name,url,is_active from sources order by id`;
  const prior=all.find(s=>{try{return sourceHost(s.url)===host}catch{return false}});
  if(prior)return {source:prior,existing:true};
  const [source]=await tx`insert into sources(name,url,country,category,is_active,inactive_reason) values(${v.name},${v.url},null,${v.kind==='reference'?'Mreža — otkrivanje novih izvora':'Novi izvor — provjera uvoza'},false,'Automatski registriran; probni upis i redovno osvježavanje još nisu potvrđeni') returning id,name,url,is_active`;
  const state={kind:v.kind,status:'registered',found_on:v.found_on,url:v.url,checked_at:v.checked_at,partner:false,coverage_complete:false};
  await tx`insert into discovery_runs(source_id,status,checked_at,body_json) values(${'registry-intake-'+source.id},'registered',${v.checked_at},${JSON.stringify(state)})`;
  return {source,existing:false};
 });
}
export async function intakeStatus(sql,source,state){
 if(!state||!['registered','access_required','format_required','reference_only','fetch_failed','ready'].includes(state.status)||typeof state.note!=='string'||state.note.length>800||!Number.isFinite(Date.parse(state.checked_at))||Math.abs(Date.now()-Date.parse(state.checked_at))>3600000)throw Error('Invalid intake status');
 if(state.retry_after!=null&&(!Number.isFinite(Date.parse(state.retry_after))||Date.parse(state.retry_after)<=Date.now()||Date.parse(state.retry_after)>Date.now()+8*86400000))throw Error('Invalid intake retry');
 const rows=await sql`update discovery_runs set status=${state.status},checked_at=${state.checked_at},body_json=(body_json::jsonb||${JSON.stringify(state)}::text::jsonb)::text where source_id=${'registry-intake-'+source.id} returning source_id`;
 if(rows.length!==1)throw Error('Existing sources are outside new-source intake');
 await sql`update sources set inactive_reason=${state.note} where id=${source.id} and not is_active`;
 return {saved:true};
}
export async function activateSource(sql,source){
 return sql.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(1422569624,3)`;
  const [intake]=await tx`select body_json::jsonb as state from discovery_runs where source_id=${'registry-intake-'+source.id} for update`;
  if(!intake||intake.state.kind!=='property'||!['registered','ready','format_required','fetch_failed'].includes(intake.state.status))throw Error('Source is not eligible for automatic property intake');
  const [checkpoint]=await tx`select body_json::jsonb as state from discovery_runs where source_id=${'registry-'+source.id}`;
  const c=checkpoint?.state;
  if(!c||c.error||!['Uspješno','Djelomično'].includes(c.status)||!(c.inserted_count+c.updated_count>0)||Date.now()-Date.parse(c.checked_at)>3600000||Date.parse(c.checked_at)>Date.now()+60000)throw Error('Fresh successful normal refresh required');
  const [proof]=await tx`select count(*)::int as n from source_candidates where source_id=${'registry-'+source.id} and kind='property' and last_seen=${c.checked_at} and country=any(${[...Object.keys(COUNTRIES),...Object.values(COUNTRIES)]}::text[]) and body_json::jsonb#>>'{facts,source_contact,represents_record}'='true'`;
  if(!proof?.n)throw Error('Persisted EU record with bound contact required');
  const stamp=new Date().toISOString(),config={shared_structured_property:true};
  if(intake.state.entry_urls){
   if(!Array.isArray(intake.state.entry_urls)||intake.state.entry_urls.length>20||intake.state.entry_urls.some(u=>sourceHost(u)!==sourceHost(source.url)))throw Error('Invalid intake entry URLs');
   config.entry_urls=intake.state.entry_urls;
  }
  await tx`insert into discovery_runs(source_id,status,checked_at,body_json) values(${'registry-config-'+source.id},'Configured',${stamp},${JSON.stringify(config)}) on conflict(source_id) do update set status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json`;
  await tx`update sources set is_active=true,inactive_reason=null where id=${source.id}`;
  const state={...intake.state,status:'active',activated_at:stamp,normal_refresh_confirmed:true,coverage_complete:false};
  await tx`update discovery_runs set status='active',checked_at=${stamp},body_json=${JSON.stringify(state)} where source_id=${'registry-intake-'+source.id}`;
  return {activated:true,source_id:'registry-'+source.id};
 });
}
