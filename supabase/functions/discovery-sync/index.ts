import postgres from 'npm:postgres@3.4.7';
import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.1.0';
import {evaluate,MATCH} from './domain.mjs';
const repo='antiquecroatianoak-sudo/EUnekretnine2',audience='eu-property-discovery:izpzsfiqvransehvmuzn';
const jwks=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const hosts={'fina-csv':'ponip.fina.hr','hr-state-sales':'hr-nekretnine.hr','es-state-auctions':'www.hacienda.gob.es','es-direct-sales':'www.hacienda.gob.es','gradzilla-demand':'gradzilla.hr','immoexpert-demand':'www.immoexpert.hr'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function validStamp(v){return typeof v==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))}
export function validate(snapshot,now=Date.now()){
 if(snapshot?.schema_version!==1||!Array.isArray(snapshot.candidates)||snapshot.candidates.length>10000||!Array.isArray(snapshot.runs)||snapshot.runs.length>6)throw Error('Invalid snapshot');
 const age=now-Date.parse(snapshot.generated_at);if(!validStamp(snapshot.generated_at)||age< -60000||age>86400000)throw Error('Stale snapshot');
 const ids=new Set();
 for(const r of snapshot.candidates){
  if(typeof r.id!=='string'||!r.id||r.id.length>500||ids.has(r.id)||!Object.hasOwn(hosts,r.source_id)||!['property','buyer'].includes(r.kind)||r.verified!==false||typeof r.title!=='string'||!r.title||r.title.length>5000||typeof r.country!=='string'||!r.facts||typeof r.facts!=='object'||Array.isArray(r.facts)||!validStamp(r.last_seen)||!validStamp(r.first_seen)||Date.parse(r.last_seen)>now+60000||Date.parse(r.first_seen)>Date.parse(r.last_seen))throw Error('Invalid candidate');
  let url;try{url=new URL(r.url)}catch{throw Error('Invalid source')}
  if(url.protocol!=='https:'||url.hostname!==hosts[r.source_id]||url.port||url.username||url.password)throw Error('Invalid source');
  ids.add(r.id);
 }
 const runs=new Set();
 for(const r of snapshot.runs){if(!Object.hasOwn(hosts,r.source_id)||runs.has(r.source_id)||!['Uspješno','Pogreška'].includes(r.status)||!validStamp(r.checked_at)||Date.parse(r.checked_at)>now+60000)throw Error('Invalid source status');runs.add(r.source_id)}
 if(runs.size!==6)throw Error('Incomplete source status');
}
let db;
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token||token.length>20000)return reply({error:'Unauthorized'},401);
  const {payload}=await jwtVerify(token,jwks,{issuer:'https://token.actions.githubusercontent.com',audience,algorithms:['RS256'],maxTokenAge:'10m',clockTolerance:5,requiredClaims:['exp','iat','sub','repository_id','repository_owner_id','repository','repository_visibility','workflow_ref','ref','event_name']});
  const checks={repository_id:payload.repository_id==='1422569624',repository_owner_id:payload.repository_owner_id==='343548834',repository:payload.repository===repo,repository_visibility:payload.repository_visibility==='private',ref:payload.ref==='refs/heads/main',sub:payload.sub==='repo:antiquecroatianoak-sudo@343548834/EUnekretnine2@1422569624:ref:refs/heads/main',workflow_ref:payload.workflow_ref===repo+'/.github/workflows/discovery.yml@refs/heads/main',event_name:['push','schedule','workflow_dispatch'].includes(payload.event_name)}; const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name); if(failed.length)return reply({error:'Forbidden',checks:failed},403);
  if(typeof payload.iat!=='number'||typeof payload.exp!=='number'||payload.exp-payload.iat>600)return reply({error:'Expired identity'},401);
 }catch{return reply({error:'Unauthorized'},401)}
 if(Number(req.headers.get('content-length')||0)>2000000)return reply({error:'Payload too large'},413);
 let body;
 try{
  const reader=req.body?.getReader();if(!reader)return reply({error:'Missing body'},400);
  let total=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>2000000){await reader.cancel();return reply({error:'Payload too large'},413)}chunks.push(value)}
  const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength}
  body=JSON.parse(new TextDecoder().decode(bytes));if(body.action!=='sync')throw Error('Unknown action');validate(body.snapshot);
 }catch(e){return reply({error:e.message||'Invalid input'},400)}
 try{
  const sql=db??=postgres(Deno.env.get('SUPABASE_DB_URL'),{ssl:'require',max:1,prepare:false,idle_timeout:5,connect_timeout:10});
  const snapshot=body.snapshot;
  const result=await sql.begin(async tx=>{
   for(let n=0;n<snapshot.candidates.length;n+=100){
    const rows=snapshot.candidates.slice(n,n+100).map(r=>({id:r.id,source_id:r.source_id,kind:r.kind,title:r.title,country:r.country,url:r.url,body_json:JSON.stringify(r),last_seen:r.last_seen}));
    if(rows.length)await tx`insert into source_candidates ${tx(rows,'id','source_id','kind','title','country','url','body_json','last_seen')} on conflict(id) do update set title=excluded.title,country=excluded.country,url=excluded.url,body_json=excluded.body_json,last_seen=excluded.last_seen where source_candidates.last_seen<=excluded.last_seen`;
   }
   for(const r of snapshot.runs)await tx`insert into discovery_runs(source_id,status,checked_at,body_json) values(${r.source_id},${r.status},${r.checked_at},${JSON.stringify(r)}) on conflict(source_id) do update set status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json where discovery_runs.checked_at<=excluded.checked_at`;
   const properties=await tx`select * from properties order by id for share`,investors=await tx`select * from investors order by id for share`,updated=new Date().toISOString();
   const matches=[];for(const p of properties)for(const i of investors)matches.push({property_id:p.id,investor_id:i.id,result_json:JSON.stringify(evaluate(p,i)),updated});
   for(let n=0;n<matches.length;n+=100){const rows=matches.slice(n,n+100);await tx`insert into match_results ${tx(rows,'property_id','investor_id','result_json','updated')} on conflict(property_id,investor_id) do update set result_json=excluded.result_json,updated=excluded.updated where match_results.result_json is distinct from excluded.result_json`}
   await tx`update notification_outbox n set status='Potrebna ponovna provjera' where n.status='Spremno' and not exists(select 1 from match_results m where m.property_id=n.property_id and m.result_json::jsonb->>'status'=${MATCH})`;
   return {candidates:snapshot.candidates.length,sources:snapshot.runs.length,pairs:matches.length,synced_at:updated};
  });
  return reply(result);
 }catch(e){console.error('discovery-sync failed',e?.code||e?.name);return reply({error:'Synchronization failed; transaction rolled back'},500)}
});
