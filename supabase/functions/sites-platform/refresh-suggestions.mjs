import {PROPERTY_ACTIVE} from './activity-policy.mjs';
import {suggestion} from './suggestions.mjs';
import {MATCH,country,norm,criteria,pairCheckMap,rankAffordability,gap,settle,GUARD_REFUSED} from './domain.mjs';
export async function refreshSuggestions(tx){
 await tx`select pg_advisory_xact_lock(2261022)`;
 await tx`select site_private.reconcile_listing_lifecycle()`;
 const props=await tx`select p.* from properties p where ${tx.unsafe(PROPERTY_ACTIVE)} and not exists(select 1 from source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.property_id=p.id and l.state in ('expired','removed')) order by p.id`;
 const investors=await tx`select i.* from investors i where not exists(select 1 from source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.investor_id=i.id and l.state in ('expired','removed')) order by i.id`;
 // Verified pair-specific answers (ops/pair-records.sql) close only the items they were recorded for.
 const checks=pairCheckMap(await tx`select id,property_id,investor_id,requirement,status,digest,evidence,outcome,answered_on,recorded_at from site_private.pair_answers where kind='Odgovor'`);
 const stamp=new Date().toISOString(),now=Date.now(),rows=[];
 // Preselect by the same country predicate used by suggestion(); avoid
 // parsing every investor's criteria for every unrelated EU listing.
 const byCountry=new Map();
 for(const i of investors){
  const c=criteria(i);
  const countries=String(i.preferred_countries||'').trim()||
    (Array.isArray(c.preferred_countries)?c.preferred_countries.join(','):'');
  for(const key of new Set(countries.split(',').map(v=>norm(country(v))).filter(Boolean))){
   if(!byCountry.has(key))byCountry.set(key,[]);
   byCountry.get(key).push(i);
  }
 }
 for(const p of props)for(const i of byCountry.get(norm(country(p.country)))||[]){const result=suggestion(p,i,now,checks.get(p.id+'-'+i.id));if(result)rows.push({property_id:p.id,investor_id:i.id,result_json:JSON.stringify(result),updated:stamp});}
 const write=async list=>{const out=[];for(let n=0;n<list.length;n+=100){const batch=list.slice(n,n+100);out.push(...await tx`insert into match_results ${tx(batch,'property_id','investor_id','result_json','updated')} on conflict(property_id,investor_id) do update set result_json=excluded.result_json,updated=excluded.updated returning property_id,investor_id`)}return out};
 const key=r=>r.property_id+'-'+r.investor_id;
 rankAffordability(rows,props);
 const accepted=await write(rows);
 let stored=new Set(accepted.map(key));
 // A real opportunity the database guard refuses stays visible as a candidate with an explicit open item
 // instead of disappearing; evaluate() mirrors the guard, so this is only a safety net.
 const retry=rows.filter(r=>!stored.has(key(r))&&JSON.parse(r.result_json).status===MATCH).map(r=>{const res=JSON.parse(r.result_json);gap(res,GUARD_REFUSED,'pair');settle(res);return {...r,result_json:JSON.stringify(res)}});
 if(retry.length){accepted.push(...await write(retry));stored=new Set(accepted.map(key))}
 // Affordability counts only pairs actually stored as real opportunities: refused writes must not shift ranks.
 const byKey=new Map(retry.map(r=>[key(r),r]));
 const kept=rows.map(r=>byKey.get(key(r))||r).filter(r=>stored.has(key(r))),before=new Map(kept.map(r=>[key(r),r.result_json]));
 rankAffordability(kept,props);
 const changed=kept.filter(r=>r.result_json!==before.get(key(r)));
 if(changed.length)await write(changed);
 // Use accepted writes, not timestamps: rejected guards and two refreshes in one millisecond must not preserve an old MATCH.
 await tx`delete from match_results m where not exists(select 1 from jsonb_to_recordset(${tx.json(accepted)}::jsonb) as a(property_id integer,investor_id integer) where a.property_id=m.property_id and a.investor_id=m.investor_id)`;
 await tx`update notification_outbox n set status='Potrebna ponovna provjera' where n.status='Spremno' and not exists(select 1 from match_results m where m.property_id=n.property_id and m.result_json::jsonb->>'status'=${MATCH})`;
 return Number((await tx`select count(*) as n from match_results`)[0].n);
}


