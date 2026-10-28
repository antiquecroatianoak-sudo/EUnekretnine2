import {hydrateContacts} from './hydrate-contacts.mjs';
import {PROPERTY_ACTIVE} from './activity-policy.mjs';
import {suggestion,propertyTypeKey,buyerTypeSet} from './suggestions.mjs';
import {MATCH,country,norm,criteria,pairCheckMap,rankAffordability,gap,settle,GUARD_REFUSED} from './domain.mjs';
// The review-task method exactly as site_private.sync_match_review_tasks() derives it (ops/pair-records.sql); a test
// keeps this copy identical to the trigger's text.
export const REVIEW_METHOD_SQL=`case
when label ilike '%budžet%' then 'Izvor cijene i troškova; budžet i interes zahtijevaju dokaz kupca. Bez automatskog kontaktiranja.'
when label ilike '%pravne%' then 'Zemljišne knjige, dokumentacija i stručna pravna provjera.'
when label ilike '%gradnje%' then 'Službeni prostorni plan, identifikacija parcele i stručna urbanistička provjera.'
when label ilike '%kupca%' or label ilike '%napomena%' then 'Pregledati izvorne uvjete i napomene; nepotvrđeno ostaviti otvoreno.'
else 'Provjeriti pojedinačni izvorni oglas i dokumentirane podatke; ne nagađati.' end`;
const CLOSED=`('Provjereno','Više nije navedeno kao nedostatak')`;
// Pairs among `keys` for which re-writing the identical result would change nothing the match_results triggers derive
// (record_pair, sync_match_review_tasks): the pair record is current and equal, no archived tasks wait to return, every
// reported item has its task with the current sources and method and an open status, and no task that left the list
// still has an open status. Any other pair is written, so the triggers bring it up to date exactly as before.
async function inSync(tx,keys){
 if(!keys.length)return new Set();
 const rows=await tx`with c as (select * from jsonb_to_recordset(${tx.json(keys)}::jsonb) as a(property_id integer,investor_id integer)),
  s as (select c.property_id,c.investor_id,m.result_json::jsonb res,p.source purl,
   coalesce(site_private.safe_json(i.criteria_json)->>'source_url',site_private.safe_json(i.criteria_json)->>'evidence_url',site_private.safe_json(i.notes)->>'official_url') iurl
   from c join match_results m using(property_id,investor_id) join properties p on p.id=c.property_id join investors i on i.id=c.investor_id)
  select s.property_id,s.investor_id from s
  where exists(select 1 from site_private.pair_records r where r.property_id=s.property_id and r.investor_id=s.investor_id and r.in_latest_calculation
    and r.status is not distinct from s.res->>'status' and r.phase is not distinct from s.res->>'phase' and r.result_json=s.res)
   and not exists(select 1 from site_private.pair_task_archive a where a.property_id=s.property_id and a.investor_id=s.investor_id)
   and not exists(select 1 from jsonb_array_elements_text(coalesce(s.res->'missing','[]'::jsonb)) l(label) where not exists(
    select 1 from site_private.match_review_tasks t where t.property_id=s.property_id and t.investor_id=s.investor_id and t.requirement=l.label
     and t.status not in ${tx.unsafe(CLOSED)} and t.property_source is not distinct from s.purl and t.investor_source is not distinct from s.iurl
     and t.verification_method is not distinct from (${tx.unsafe(REVIEW_METHOD_SQL)})))
   and not exists(select 1 from site_private.match_review_tasks t where t.property_id=s.property_id and t.investor_id=s.investor_id
    and t.status not in ${tx.unsafe(CLOSED)} and not (coalesce(s.res->'missing','[]'::jsonb) ? t.requirement))`;
 return new Set(rows.map(r=>r.property_id+'-'+r.investor_id));
}
export async function refreshSuggestions(tx){
 await tx`select pg_advisory_xact_lock(2261022)`;
 await tx`select site_private.reconcile_listing_lifecycle()`;
 await hydrateContacts(tx);
 const props=await tx`select p.* from properties p where ${tx.unsafe(PROPERTY_ACTIVE)} and not exists(select 1 from source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.property_id=p.id and l.state in ('expired','removed')) order by p.id`;
 const investors=await tx`select i.* from investors i where not exists(select 1 from source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.investor_id=i.id and l.state in ('expired','removed')) order by i.id`;
 // criteria() and contactData() accept a parsed object, so each record's JSON is parsed once per refresh instead of once
 // per pair. Only a plain object replaces the text (anything else keeps the original text and its existing handling);
 // the objects are frozen, so no evaluation step can change the input of another pair.
 const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x)}return v};
 const parseOnce=(rows,keys)=>rows.map(r=>{const out={...r};for(const k of keys){if(typeof r[k]!=='string')continue;
  try{const v=JSON.parse(r[k]);if(v&&typeof v==='object'&&!Array.isArray(v))out[k]=freeze(v)}catch{}}return out});
 // Verified pair-specific answers (ops/pair-records.sql) close only the items they were recorded for.
 const checks=pairCheckMap(await tx`select id,property_id,investor_id,requirement,status,digest,evidence,outcome,answered_on,recorded_at from site_private.pair_answers where kind='Odgovor'`);
 const stamp=new Date().toISOString(),now=Date.now(),rows=[];
 // Preselect by the same country and type predicates used by suggestion(); pairs outside them always end in
 // null there, so skipping them changes no result and avoids parsing every buyer for every unrelated listing.
 const byCountryType=new Map();
 const evalProps=parseOnce(props,['contact_json']),evalInvestors=parseOnce(investors,['criteria_json','contact_json']);
 for(const i of evalInvestors){
  const c=criteria(i);
  const countries=String(i.preferred_countries||'').trim()||
    (Array.isArray(c.preferred_countries)?c.preferred_countries.join(','):'');
  const types=buyerTypeSet(i);
  for(const key of new Set(countries.split(',').map(v=>norm(country(v))).filter(Boolean)))for(const t of types){
   const k=key+'\n'+t;
   if(!byCountryType.has(k))byCountryType.set(k,[]);
   byCountryType.get(k).push(i);
  }
 }
 for(const p of evalProps){const t=propertyTypeKey(p);if(!t)continue;
  for(const i of byCountryType.get(norm(country(p.country))+'\n'+t)||[]){const result=suggestion(p,i,now,checks.get(p.id+'-'+i.id));if(result)rows.push({property_id:p.id,investor_id:i.id,result_json:JSON.stringify(result),updated:stamp});}}
 const write=async list=>{const out=[];for(let n=0;n<list.length;n+=100){const batch=list.slice(n,n+100);out.push(...await tx`insert into match_results ${tx(batch,'property_id','investor_id','result_json','updated')} on conflict(property_id,investor_id) do update set result_json=excluded.result_json,updated=excluded.updated returning property_id,investor_id`)}return out};
 const key=r=>r.property_id+'-'+r.investor_id;
 rankAffordability(rows,props);
 // A candidate whose stored result is identical keeps its row only when re-writing it would change nothing the pair
 // triggers derive (inSync); otherwise it is written as before. A real opportunity is always re-submitted, so the
 // database guard re-checks every MATCH on each refresh.
 const existing=new Map((await tx`select property_id,investor_id,result_json from match_results`).map(r=>[key(r),r.result_json]));
 const same=rows.filter(r=>existing.get(key(r))===r.result_json&&JSON.parse(r.result_json).status!==MATCH);
 const synced=await inSync(tx,same.map(r=>({property_id:Number(r.property_id),investor_id:Number(r.investor_id)})));
 const unchanged=r=>synced.has(key(r));
 const accepted=await write(rows.filter(r=>!unchanged(r)));
 const skipped=rows.filter(unchanged).map(r=>({property_id:Number(r.property_id),investor_id:Number(r.investor_id)}));
 accepted.push(...skipped);
 // last_evaluated_at means "last evaluated", as when every pair was re-written; pair_history records actual changes.
 if(skipped.length)await tx`update site_private.pair_records r set last_evaluated_at=now() from jsonb_to_recordset(${tx.json(skipped)}::jsonb) as a(property_id integer,investor_id integer) where r.property_id=a.property_id and r.investor_id=a.investor_id`;
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


