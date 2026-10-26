import {explicitProof} from './activity-policy.mjs';
import postgres from 'npm:postgres@3.4.7';
import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.1.0';
import {mergeCandidate} from './merge.mjs';
import {runCountry} from './national-enrichment.mjs';
const repo='antiquecroatianoak-sudo/EUnekretnine2',audience='eu-property-discovery:izpzsfiqvransehvmuzn';
const jwks=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
let db;
function hostkey(h){return h.replace(/^www\./,'').replace(/^en\./,'')}
export function validURL(value,root){
 const u=new URL(value),base=new URL(root),h=hostkey(base.hostname);
 if(u.protocol!=='https:'||u.port||u.username||u.password)throw Error('Invalid URL');
 if(hostkey(u.hostname)!==h&&(!['nieruchomosci-online.pl','imot.bg'].includes(h)||!u.hostname.endsWith('.'+h)))throw Error('Cross-source URL');
 return u.href;
}
export function validateRows(rows,source){
 if(!Array.isArray(rows)||rows.length>100)throw Error('Batch must contain at most 100 candidates');
 const ids=new Set();
 for(const r of rows){
  if(typeof r.id!=='string'||!/^registry:(property|buyer):[a-f0-9]{32}$/.test(r.id)||ids.has(r.id)||r.source_id!=='registry-'+source.id||!['property','buyer'].includes(r.kind)||!r.id.startsWith('registry:'+r.kind+':')||r.verified!==false||typeof r.title!=='string'||r.title.length<8||r.title.length>500||!r.facts||Array.isArray(r.facts)||typeof r.facts!=='object')throw Error('Invalid candidate');
  validURL(r.url,source.url);ids.add(r.id);
  if(source.url.includes('/oglasi-nakup/')&&r.url===source.url)throw Error('Category is not an individual buying request');
  for(const k of ['first_seen','last_seen'])if(typeof r[k]!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(r[k])||!Number.isFinite(Date.parse(r[k]))||Date.parse(r[k])>Date.now()+60000)throw Error('Invalid timestamp');
  if(Date.parse(r.first_seen)>Date.parse(r.last_seen)||Date.now()-Date.parse(r.last_seen)>86400000)throw Error('Stale candidate');
 }
}
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token||token.length>20000)return reply({error:'Unauthorized'},401);
  const {payload}=await jwtVerify(token,jwks,{issuer:'https://token.actions.githubusercontent.com',audience,algorithms:['RS256'],maxTokenAge:'10m',clockTolerance:5,requiredClaims:['exp','iat','sub','repository_id','repository_owner_id','repository','repository_visibility','workflow_ref','ref','event_name']});
  const checks={repository_id:payload.repository_id==='1422569624',repository_owner_id:payload.repository_owner_id==='343548834',repository:payload.repository===repo,repository_visibility:payload.repository_visibility==='private',ref:payload.ref==='refs/heads/main',sub:payload.sub==='repo:antiquecroatianoak-sudo@343548834/EUnekretnine2@1422569624:ref:refs/heads/main',workflow_ref:payload.workflow_ref===repo+'/.github/workflows/discovery.yml@refs/heads/main',event_name:['push','schedule','workflow_dispatch'].includes(payload.event_name)}; const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name); if(failed.length)return reply({error:'Forbidden',checks:failed},403);
  if(typeof payload.iat!=='number'||typeof payload.exp!=='number'||payload.exp-payload.iat>600)return reply({error:'Expired identity'},401);

 }catch{return reply({error:'Unauthorized'},401)}
 let body;
 try{
  const reader=req.body?.getReader();if(!reader)return reply({error:'Missing body'},400);
  let total=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>2000000){await reader.cancel();return reply({error:'Payload too large'},413)}chunks.push(value)}
  const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength}body=JSON.parse(new TextDecoder().decode(bytes));
 }catch{return reply({error:'Invalid JSON'},400)}
 try{
  const sql=db??=postgres(Deno.env.get('SUPABASE_DB_URL'),{ssl:'require',max:1,prepare:false,idle_timeout:5,connect_timeout:10});
  if(body.action==='enrichment-country')return reply(await runCountry(sql,body.country));
  if(body.action==='registry'){
   await sql`select site_private.reconcile_listing_lifecycle()`;
   const sources=await sql`select id,country,name,url,category from sources where is_active order by id`;
   // Read-only complete inventory for grouped diagnostics; import selection stays active-only.
   const diagnosticSources=await sql`select id,country,name,url,category,is_active,inactive_reason from sources order by id`;
   const runs=await sql`select source_id,body_json from discovery_runs where source_id like 'registry-%'`;
   const states={};for(const r of runs){try{states[r.source_id]=JSON.parse(r.body_json)}catch{}}
   for(const source of sources){
    const priorListings=await sql`select c.url from source_candidates c left join site_private.listing_lifecycle l on l.candidate_id=c.id where c.source_id=${'registry-'+source.id} and l.state is distinct from 'expired' order by coalesce(l.checked_at,site_private.safe_stamp(c.last_seen)) nulls first limit 10`;
    source.recheck_urls=priorListings.map(r=>r.url);
    const config=states['registry-config-'+source.id];
    if(!config)continue;
    let valid=true;
    for(const key of ['index_path_prefixes','detail_path_prefixes'])if(config[key]!=null&&(!Array.isArray(config[key])||config[key].length>20||config[key].some(p=>typeof p!=='string'||!p.startsWith('/')||p.length>300)))valid=false;
    if(config.entry_urls!=null&&(!Array.isArray(config.entry_urls)||config.entry_urls.length>20))valid=false;
    if(valid){try{for(const u of config.entry_urls||[])validURL(u,source.url)}catch{valid=false}}
    if(valid)source.import_config=config;
   }
   return reply({sources,states,diagnostic_sources:diagnosticSources});
  }
  if(!/^registry-\d+$/.test(body.source_id||''))return reply({error:'Invalid source ID'},400);
  const [source]=await sql`select id,country,name,url,category from sources where id=${body.source_id.slice(9)}`;
  if(!source)return reply({error:'Unknown registered source'},400);
  if(body.action==='checkpoint'){
   const s=body.state;
   if(!s||s.source_id!==body.source_id||!['Uspješno','Djelomično','Pogreška','Nepodržano'].includes(s.status)||!Array.isArray(s.pending)||!Array.isArray(s.cycle_seen)||!Number.isFinite(Date.parse(s.checked_at))||Math.abs(Date.now()-Date.parse(s.checked_at))>3600000)throw Error('Invalid checkpoint');
   for(const item of s.pending)validURL(item.url,source.url);
   for(const u of s.cycle_seen)validURL(u,source.url);
   if(!Array.isArray(s.unavailable_urls||[])||(s.unavailable_urls||[]).length>500)throw Error('Invalid unavailable URLs');
   for(const u of s.unavailable_urls||[]){validURL(u.url,source.url);if(![404,410].includes(u.http_status))throw Error('Invalid unavailable status')}
   for(const u of s.unavailable_urls||[]){
    await sql`select site_private.mark_listing_unavailable(${u.url},${u.http_status},${s.checked_at}::timestamptz)`;
    const note='Izvor nedostupan pri provjeri '+s.checked_at+' (HTTP '+u.http_status+'); prodaja nije dokazana';
    await sql`update source_candidates set body_json=jsonb_set(jsonb_set(body_json::jsonb,'{facts,availability}',to_jsonb(${note}::text),true),'{verification,availability}',to_jsonb(${note}::text),true)::text where rtrim(url,'/')=rtrim(${u.url},'/')`;
   }
   await sql`insert into discovery_runs(source_id,status,checked_at,body_json) values(${body.source_id},${s.status},${s.checked_at},${JSON.stringify(s)}) on conflict(source_id) do update set status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json where discovery_runs.checked_at<=excluded.checked_at`;
   await sql`select site_private.reconcile_listing_lifecycle()`;
   return reply({saved:true});
  }
  if(body.action!=='batch')return reply({error:'Unknown action'},400);
  validateRows(body.candidates,source);
  for(const row of body.candidates)if(row.kind==='property'&&row.facts.source_listing_state==='active'&&row.facts.source_status_evidence){
   row.facts.activity_record_url=row.url;row.facts.activity_evidence_url=row.facts.evidence_url||row.url;row.facts.checked_at=row.last_seen;
  }
  const rejected=body.candidates.filter(r=>!explicitProof(r));
  const accepted=body.candidates.filter(r=>explicitProof(r));
  const result=await sql.begin(async tx=>{
   // Serialize only registry imports so URL duplicates cannot race between sources.
   await tx`select pg_advisory_xact_lock(1422569624,2)`;
   let inserted=0,updated=0;
   for(const row of rejected)await tx`update site_private.listing_lifecycle set state='missing_once',checked_at=now(),reason='Posljednja provjera nije potvrdila aktivnost oglasa' where candidate_id in (select id from source_candidates where kind='property' and rtrim(url,'/')=rtrim(${row.url},'/'))`;
   for(const row of accepted){
    const [existing]=await tx`select * from source_candidates where (rtrim(url,'/')=rtrim(${row.url},'/') and kind=${row.kind}) or id=${row.id} order by (id=${row.id}) desc limit 1 for update`;
    const merged=mergeCandidate(existing,row,source);
    if(existing){
     await tx`update source_candidates set title=${merged.title},country=${merged.country},url=${merged.url},body_json=${JSON.stringify(merged)},last_seen=${row.last_seen} where id=${existing.id} and last_seen<=${row.last_seen}`;updated++;
    }else{
     await tx`insert into source_candidates(id,source_id,kind,title,country,url,body_json,last_seen) values(${merged.id},${merged.source_id},${merged.kind},${merged.title},${merged.country},${merged.url},${JSON.stringify(merged)},${merged.last_seen})`;inserted++;
    }
    await tx`select site_private.sync_source_listing(${merged.id})`;
   }
   await tx`select site_private.reconcile_listing_lifecycle()`;
   return {inserted,updated};
  });
  return reply({...result,candidates:accepted.length,activity_rejected:rejected.length});
 }catch(e){console.error('registry-discovery',e?.name,e?.code,body.action==='enrichment-country'?String(e?.message).slice(0,200):'');return reply({error:'Registry operation failed',detail:e instanceof Error?e.message:'Unknown error'},400)}
});



