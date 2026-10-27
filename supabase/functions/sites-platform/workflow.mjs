import {criteria,investorInput,contactRoute,validUrl} from './domain.mjs';
import {PROPERTY_VISIBLE,INVESTOR_VISIBLE} from './catalog.mjs';
import {presentation,fingerprint,reviewReadiness,requestIdentity,responseInput,handoffInput} from './offer.mjs';
const id=v=>{if(!Number.isSafeInteger(Number(v))||Number(v)<=0)throw Error('Nevaljana oznaka.');return Number(v)};
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v}catch{return null}};
const STAGE='Tijek ponude v1';
async function events(tx,p,i){const rows=await tx`select id,notes,date from activity where property_id=${p} and investor_id=${i} and stage=${STAGE} order by id`;return rows.map(r=>({id:String(r.id),date:r.date,...parse(r.notes)}))}
async function append(tx,p,i,data){const [r]=await tx`insert into activity(property_id,investor_id,stage,notes,date) values(${p},${i},${STAGE},${JSON.stringify(data)},${new Date().toISOString()}) returning id`;return String(r.id)}
async function state(tx,a){
 const p=id(a.property_id),i=id(a.investor_id);
 const [[property],[investor],[match],history]=await Promise.all([
 tx`select p.* from properties p where p.id=${p} and ${tx.unsafe(PROPERTY_VISIBLE)}`,
 tx`select i.* from investors i where i.id=${i} and ${tx.unsafe(INVESTOR_VISIBLE)}`,
 tx`select result_json,updated from match_results where property_id=${p} and investor_id=${i}`,events(tx,p,i)]);
 if(!property||!investor)throw Error('Nekretnina ili zahtjev više nisu dostupni u operativnom katalogu.');
 const result=parse(match?.result_json)||{status:'Nije u zadnjem izračunu',missing:['Potrebna nova provjera'],reasons:[]};
 const fp=await fingerprint(property,investor),readiness=reviewReadiness(property,investor,result);
 const offers=history.filter(e=>e.type==='version').map(o=>({...o,current:o.fingerprint===fp,approved:history.some(e=>e.type==='approval'&&e.offer_id===o.id&&e.fingerprint===fp),responses:history.filter(e=>e.type==='response'&&e.offer_id===o.id)}));
 return {property,investor,result,readiness,fingerprint:fp,offers,history};
}
export async function workflow(tx,a,{refresh,businessPhase=false}){
 if(a.action==='buyer_requests'){
  const [base]=await tx`select * from investors where id=${id(a.investor_id)}`;if(!base)throw Error('Kupac nije pronađen.');const root=requestIdentity(base);
  const items=await tx`select * from investors where id::text=${root} or criteria_json::jsonb->>'buyer_identity_id'=${root} order by id`;
  return {identity_id:root,items};
 }
 if(a.action==='save_request'){
  const [base]=await tx`select * from investors where id=${id(a.investor_id)}`;if(!base)throw Error('Kupac nije pronađen.');
  const root=requestIdentity(base);let existing=null;
  if(a.request_id){[existing]=await tx`select * from investors where id=${id(a.request_id)} for update`;if(!existing||requestIdentity(existing)!==root)throw Error('Zahtjev ne pripada ovom kupcu.');}
  const label=String(a.label||'').trim();if(!label||label.length>160)throw Error('Unesi naziv zasebnog zahtjeva.');
  const c={...criteria(existing||{}),...a.criteria,buyer_identity_id:root,request_label:label};
  // Each request has its own evidence. A new request never inherits verification, source checks or notes checks.
  if(!existing)for(const k of ['notes_check','source_conditions_check'])delete c[k];
  const record=investorInput({...base,...existing,preferred_countries:String(a.preferred_countries||''),notes:String(a.notes||''),min_budget:a.min_budget??null,max_budget:a.max_budget??null,verified:a.verified===true,criteria_json:JSON.stringify(c)});
  // An agency contact bound to a different requirement cannot be silently reused.
  if(c.source_url!==criteria(existing||base).source_url){record.contact_json='{}'}
  const [saved]=existing?await tx`update investors set ${tx(record,...Object.keys(record))} where id=${id(existing.id)} returning id`:await tx`insert into investors ${tx(record,...Object.keys(record))} returning id`;
  await tx`insert into activity(investor_id,stage,notes,date) values(${saved.id},'Zahtjev kupca',${label},${new Date().toISOString()})`;
  await refresh(tx);return {id:saved.id};
 }
 const p=id(a.property_id),i=id(a.investor_id);
 if(a.action!=='workflow')await tx`select pg_advisory_xact_lock(2261027,${p})`;
 const s=await state(tx,a);
 if(a.action==='workflow')return {...s,business_phase:businessPhase};
 if(a.action==='offer_create'){
  const code='EU-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
  const data={type:'version',number:s.offers.length+1,fingerprint:s.fingerprint,presentation:presentation(s.property,s.investor,s.result,code),request_label:criteria(s.investor).request_label||'Osnovni zahtjev',readiness:s.readiness};
  return {id:await append(tx,p,i,data)};
 }
 const offer=s.offers.find(o=>o.id===String(a.offer_id));if(!offer)throw Error('Verzija ponude nije pronađena za ovaj par.');
 if(a.action==='offer_approve'){
  if(a.reviewed!==true||!offer.current||!s.readiness.ready)throw Error('Prije odobrenja dovrši sve provjere i izradi aktualnu verziju.');
  return {id:await append(tx,p,i,{type:'approval',offer_id:offer.id,fingerprint:s.fingerprint,reviewed:true})};
 }
 if(a.action==='offer_response'){
  const response=responseInput(a);if(!offer.approved||!offer.current)throw Error('Odgovor evidentiraj uz pregledanu aktualnu verziju.');
  return {id:await append(tx,p,i,{type:'response',offer_id:offer.id,...response})};
 }
 if(a.action==='agency_package'){
  const response=offer.responses.at(-1);
  // A newer withdrawal/rejection on any version cancels an old expression of interest.
  const latest=s.history.filter(e=>e.type==='response').at(-1);
  if(!offer.current||!offer.approved||!s.readiness.ready||response?.response!=='Zainteresiran'||latest?.id!==response?.id)throw Error('Predaja zahtijeva aktualan pregledan par i posljednji pisani interes kupca za tu verziju.');
  const fields=handoffInput(a);
  const data={type:'handoff',offer_id:offer.id,version:offer.number,fingerprint:s.fingerprint,...fields,property:s.property,buyer:s.investor,criteria:criteria(s.investor),buyer_response:response,
   contacts:{seller:contactRoute(s.property),buyer:contactRoute(s.investor)},review:s.result,
   documents:{legal:s.property.legal_evidence_url||null,planning:s.property.planning_evidence_url||null,source:s.property.source||null},prepared_at:new Date().toISOString(),status:'Interni paket — nije poslan'};
  return {id:await append(tx,p,i,data),package:data};
 }
 throw Error('Nepoznata radnja tijeka ponude.');
}
