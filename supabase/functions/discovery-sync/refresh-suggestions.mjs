import {suggestion} from './suggestions.mjs';
import {MATCH,country,norm,criteria} from './domain.mjs';
export async function refreshSuggestions(tx){
 await tx`select pg_advisory_xact_lock(2261022)`;
 await tx`select site_private.reconcile_listing_lifecycle()`;
 const props=await tx`select p.* from properties p where not exists(select 1 from source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.property_id=p.id and l.state in ('expired','removed')) order by p.id`;
 const investors=await tx`select i.* from investors i where not exists(select 1 from source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.investor_id=i.id and l.state in ('expired','removed')) order by i.id`;
 const stamp=new Date().toISOString(),rows=[];
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
 for(const p of props)for(const i of byCountry.get(norm(country(p.country)))||[]){const result=suggestion(p,i);if(result)rows.push({property_id:p.id,investor_id:i.id,result_json:JSON.stringify(result),updated:stamp});}
 for(let n=0;n<rows.length;n+=100){const batch=rows.slice(n,n+100);await tx`insert into match_results ${tx(batch,'property_id','investor_id','result_json','updated')} on conflict(property_id,investor_id) do update set result_json=excluded.result_json,updated=excluded.updated`;}
 await tx`delete from match_results where updated is distinct from ${stamp}`;
 await tx`update notification_outbox n set status='Potrebna ponovna provjera' where n.status='Spremno' and not exists(select 1 from match_results m where m.property_id=n.property_id and m.result_json::jsonb->>'status'=${MATCH})`;
 return Number((await tx`select count(*) as n from match_results`)[0].n);
}
