import postgres from 'npm:postgres@3.4.7';
import {evaluate,propertyInput,investorInput,MATCH,criteria,validUrl,num} from './domain.mjs';
const PUBLIC_KEY={"kty":"RSA","n":"zftp10EPtvkqY_g46ytE0Mx6r2Y9cFyoMSEUn19hAEGIkeVFahS2m-j_O5fLUYt4b3tNvgGUOK-v92DhNwEdlYU8nSJa3Qlr2uEMCo_N-rQdwhjMc12fJBOQHDB4MCTF3MuydWIeyniALAhASW5DyjN4nUnT8C97ztPLnCXghTrQU8B4rUGASSPTbuq5sLBXRHfbkPaRnBHxjJLfE84gfn9huLyS4-tft3VsOBBejGZctrRj0ZdVmd-btmMifm7eVjVfPahHO9k5WjLBR3iuh6eiJlWDyKRKhmZQXt07QGG0MqFMEfveZqtsbUU5hNjwechw_1a_wgF77JcwhTn6-Q","e":"AQAB"};
const AUDIENCE='appgprj_6ad3d11946fc8191bd34af0ad4f2cdd8';
const enc=new TextEncoder();
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
const key=crypto.subtle.importKey('jwk',PUBLIC_KEY,{name:'RSA-PSS',hash:'SHA-256'},false,['verify']);
let db;
function database(){return db??=postgres(Deno.env.get('SUPABASE_DB_URL'),{ssl:'require',max:2,prepare:false,idle_timeout:10,connect_timeout:10})}
async function refresh(tx){
 const [props,investors]=await Promise.all([tx`select * from properties order by id`,tx`select * from investors order by id`]);
 const stamp=new Date().toISOString(), rows=[];
 for(const p of props)for(const i of investors)rows.push({property_id:p.id,investor_id:i.id,result_json:JSON.stringify(evaluate(p,i)),updated:stamp});
 if(rows.length)await tx`insert into match_results ${tx(rows,'property_id','investor_id','result_json','updated')} on conflict(property_id,investor_id) do update set result_json=excluded.result_json,updated=excluded.updated where match_results.result_json is distinct from excluded.result_json`;
 await tx`update notification_outbox n set status='Potrebna ponovna provjera' where n.status='Spremno' and not exists(select 1 from match_results m where m.property_id=n.property_id and m.result_json::jsonb->>'status'=${MATCH})`;
 return rows.length;
}
async function list(tx){
 const tables=['properties','investors','sources','source_candidates','discovery_runs','activity','notification_outbox','match_results'];
 const values=await Promise.all(tables.map(t=>tx`select * from ${tx(t)} order by 1 limit 10000`));
 return Object.fromEntries([...tables.map((t,i)=>[t,values[i]]),['loaded_at',new Date().toISOString()]]);
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
  const c=Object.fromEntries(Object.entries(f).filter(([k])=>['property_types','cities','min_area','max_area','requires_buildable'].includes(k)));c.source_url=r.url;c.checked_at=r.last_seen;
  result=await tx`insert into investors(name,country,min_budget,max_budget,preferred_countries,notes,verified,criteria_json) values(${r.title},${r.country},0,null,${r.country},${'Javni zahtjev; provjeri budžet, lokaciju i sve uvjete. '+(f.location_note||'')+' '+(f.development_note||'')},0,${JSON.stringify(c)}) returning id`;
  await tx`update source_candidates set investor_id=${result[0].id} where id=${id}`;
 }
 return {kind:r.kind,id:result[0].id};
}
async function dispatch(tx,a){
 if(a.action==='read')return await list(tx);
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
   if(!['Francuska','Nizozemska','Hrvatska','Slovenija'].includes(p.country)||!validUrl(p.evidence_url)||!/(Z|[+-]\d\d:\d\d)$/.test(p.checked_at)||!Number.isFinite(Date.parse(p.checked_at))||Date.parse(p.checked_at)>Date.now()||p.source_verified!==true||p.listing_active!==true)throw Error('Uvoz zahtijeva provjerene izvore, aktivnost i valjan datum.');
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
  if(a.action==='read')return reply(await database().begin(tx=>dispatch(tx,a)));
  const result=await database().begin(async tx=>{
   const known=await tx`insert into site_private.requests(id) values(${id}) on conflict do nothing returning id`;
   if(!known.length){const r=await tx`select response from site_private.requests where id=${id}`;return r[0].response}
   const response=await dispatch(tx,a);await tx`update site_private.requests set response=${tx.json(response)} where id=${id}`;return response;
  });return reply(result);
 }catch(e){console.error('platform request failed',e?.code||e?.name);return reply({error:e?.name==='PostgresError'?'Baza nije spremila promjene. Pokušaj ponovno nakon provjere veze.':String(e?.message||'Zahtjev nije izvršen.')},400)}
});
