import postgres from 'npm:postgres@3.4.7';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.0';

const repo = 'antiquecroatianoak-sudo/EUnekretnine2';
const audience = 'eu-property-discovery:izpzsfiqvransehvmuzn';
const jwks = createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const sourceIds = new Set(['fina-csv','hr-state-sales','es-state-auctions','es-direct-sales','gradzilla-demand','immoexpert-demand']);
const allowedStatuses = new Set(['Podudaranje kriterija','Kandidat - potrebna provjera','Ne odgovara kriterijima']);
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function hashState(properties: unknown[], investors: unknown[]) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({properties,investors})));
  return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async req => {
  if(req.method !== 'POST')return response({error:'Method not allowed'},405);
  // Trust only a short-lived GitHub identity for the exact private repo, main branch and workflow.
  try {
    const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    if(!token || token.length > 20000)return response({error:'Unauthorized'},401);
    const {payload}=await jwtVerify(token,jwks,{issuer:'https://token.actions.githubusercontent.com',audience,algorithms:['RS256'],requiredClaims:['exp','iat','sub','repository_id','workflow_ref','ref']});
    if(payload.repository_id !== '1422569624' || payload.repository !== repo || payload.repository_visibility !== 'private' || payload.ref !== 'refs/heads/main' || payload.sub !== `repo:${repo}:ref:refs/heads/main` || payload.workflow_ref !== `${repo}/.github/workflows/discovery.yml@refs/heads/main` || !['schedule','push','workflow_dispatch'].includes(String(payload.event_name)))return response({error:'Forbidden'},403);
    if(typeof payload.iat !== 'number' || Date.now()/1000-payload.iat>600)return response({error:'Expired identity'},401);
  } catch {return response({error:'Unauthorized'},401);}
  if(Number(req.headers.get('content-length')||0)>2_000_000)return response({error:'Payload too large'},413);
  let text: string;
  try {
    const reader=req.body?.getReader(); if(!reader)return response({error:'Missing body'},400);
    let total=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>2_000_000){await reader.cancel();return response({error:'Payload too large'},413);}chunks.push(value);}
    const joined=new Uint8Array(total);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}text=new TextDecoder().decode(joined);
  }catch{return response({error:'Invalid body'},400);}
  let body:any;try{body=JSON.parse(text);}catch{return response({error:'Invalid JSON'},400);}
  const dbUrl=Deno.env.get('SUPABASE_DB_URL');if(!dbUrl)return response({error:'Database is not configured'},503);
  const sql=postgres(dbUrl,{prepare:false,ssl:'require',max:1,idle_timeout:5,connect_timeout:10});
  try {
    if(body.action==='state'){
      return await sql.begin(async tx=>{
        const properties=await tx`SELECT * FROM public.properties ORDER BY id`;
        const investors=await tx`SELECT * FROM public.investors ORDER BY id`;
        return response({properties,investors,state_hash:await hashState(properties,investors)});
      });
    }
    if(body.action==='sync'){
      const snapshot=body.snapshot;
      if(snapshot?.schema_version!==1 || !Array.isArray(snapshot.candidates) || snapshot.candidates.length>10000 || !Array.isArray(snapshot.runs))return response({error:'Invalid snapshot'},400);
      const age=Date.now()-Date.parse(snapshot.generated_at);if(!Number.isFinite(age)||age< -60000||age>86400000)return response({error:'Stale snapshot'},400);
      const ids=new Set<string>();
      for(const r of snapshot.candidates){
        if(typeof r.id!=='string'||ids.has(r.id)||!sourceIds.has(r.source_id)||!['property','buyer'].includes(r.kind)||r.verified!==false||typeof r.title!=='string'||!r.title||typeof r.country!=='string'||!r.facts||!Number.isFinite(Date.parse(r.last_seen))||!Number.isFinite(Date.parse(r.first_seen)))return response({error:'Invalid candidate'},400);
        let parsed:URL;try{parsed=new URL(r.url);}catch{return response({error:'Invalid source'},400);}
        if(parsed.protocol!=='https:'||parsed.username||parsed.password)return response({error:'Invalid source'},400);
        ids.add(r.id);
      }
      for(const r of snapshot.runs)if(!sourceIds.has(r.source_id)||!['Uspješno','Pogreška'].includes(r.status)||!Number.isFinite(Date.parse(r.checked_at)))return response({error:'Invalid source status'},400);
      await sql.begin(async tx=>{
        for(let start=0;start<snapshot.candidates.length;start+=100){
          const rows=snapshot.candidates.slice(start,start+100).map((r:any)=>({id:r.id,source_id:r.source_id,kind:r.kind,title:r.title,country:r.country,url:r.url,body_json:JSON.stringify(r),last_seen:r.last_seen}));
          if(rows.length)await tx`INSERT INTO public.source_candidates ${sql(rows,'id','source_id','kind','title','country','url','body_json','last_seen')} ON CONFLICT(id) DO UPDATE SET title=excluded.title,country=excluded.country,url=excluded.url,body_json=excluded.body_json,last_seen=excluded.last_seen WHERE source_candidates.last_seen<=excluded.last_seen`;
        }
        for(const r of snapshot.runs)await tx`INSERT INTO public.discovery_runs(source_id,status,checked_at,body_json) VALUES(${r.source_id},${r.status},${r.checked_at},${JSON.stringify(r)}) ON CONFLICT(source_id) DO UPDATE SET status=excluded.status,checked_at=excluded.checked_at,body_json=excluded.body_json WHERE discovery_runs.checked_at<=excluded.checked_at`;
      });
      return response({candidates:snapshot.candidates.length,sources:snapshot.runs.length});
    }
    if(body.action==='matches'){
      if(!Array.isArray(body.matches)||body.matches.length>50000||typeof body.state_hash!=='string')return response({error:'Invalid matches'},400);
      return await sql.begin(async tx=>{
        const properties=await tx`SELECT * FROM public.properties ORDER BY id FOR SHARE`;
        const investors=await tx`SELECT * FROM public.investors ORDER BY id FOR SHARE`;
        if(await hashState(properties,investors)!==body.state_hash)return response({error:'Inputs changed; recalculate'},409);
        const pids=new Set(properties.map(p=>p.id));const iids=new Set(investors.map(i=>i.id));const pairs=new Set();
        for(const r of body.matches){
          const pair=r.property_id+':'+r.investor_id;
          if(!pids.has(String(r.property_id))&&!pids.has(r.property_id)||!iids.has(String(r.investor_id))&&!iids.has(r.investor_id)||pairs.has(pair)||!allowedStatuses.has(r.result?.status)||!Number.isFinite(r.result.score)||r.result.score<0||r.result.score>100||!['reasons','missing','rejected'].every(k=>Array.isArray(r.result[k])&&r.result[k].every((v:unknown)=>typeof v==='string')))return response({error:'Invalid pair'},400);
          pairs.add(pair);
        }
        if(pairs.size!==properties.length*investors.length)return response({error:'Incomplete matching batch'},400);
        const updated=new Date().toISOString();
        for(let start=0;start<body.matches.length;start+=100){
          const rows=body.matches.slice(start,start+100).map((r:any)=>({property_id:r.property_id,investor_id:r.investor_id,result_json:JSON.stringify(r.result),updated}));
          if(rows.length)await tx`INSERT INTO public.match_results ${sql(rows,'property_id','investor_id','result_json','updated')} ON CONFLICT(property_id,investor_id) DO UPDATE SET result_json=excluded.result_json,updated=excluded.updated WHERE match_results.result_json<>excluded.result_json`;
        }
        await tx`UPDATE public.notification_outbox n SET status='Potrebna ponovna provjera' WHERE status='Spremno' AND NOT EXISTS(SELECT 1 FROM public.match_results m WHERE m.property_id=n.property_id AND m.result_json::jsonb->>'status'='Podudaranje kriterija')`;
        return response({pairs:body.matches.length});
      });
    }
    return response({error:'Unknown action'},400);
  }catch(error){console.error('Discovery synchronization failed',error instanceof Error?error.name:'Error');return response({error:'Synchronization failed'},500);}
  finally{await sql.end({timeout:2});}
});
