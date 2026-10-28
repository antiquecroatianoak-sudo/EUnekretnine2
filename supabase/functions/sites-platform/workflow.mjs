import {criteria,investorInput,contactRoute,pairCheckMap,REJECT} from './domain.mjs';
import {stagedVisibility,INVESTOR_VISIBLE} from './catalog.mjs';
import {suggestion} from './suggestions.mjs';
import {presentation,fingerprint,evidenceSnapshot,reviewReadiness,reviewSides,requestIdentity,responseInput,handoffInput,changeOf,effectiveResponse,INTEREST} from './offer.mjs';
// Buyer requests, final review, versioned anonymous presentations, written responses and the internal agency
// package (plan #46). Nothing here sends anything; every record is an append-only activity event.
const id=v=>{if(!Number.isSafeInteger(Number(v))||Number(v)<=0)throw Error('Nevaljana oznaka.');return Number(v)};
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v}catch{return null}};
export const STAGE='Tijek ponude v1';
export const ACTIONS=['workflow','buyer_requests','save_request','offer_create','offer_approve','offer_response','agency_package'];
export const READ_ACTIONS=['workflow','buyer_requests'];
// Only well-formed events of known types count; invalid JSON or foreign notes are ignored, never repaired.
const TYPES=['version','approval','response','handoff'];
async function events(tx,p,i){
 const rows=await tx`select id,notes,date from activity where property_id=${p} and investor_id=${i} and stage=${STAGE} order by id`;
 return rows.flatMap(r=>{const n=parse(r.notes);return n&&typeof n==='object'&&!Array.isArray(n)&&TYPES.includes(n.type)?[{...n,id:String(r.id),date:r.date}]:[]});
}
async function append(tx,p,i,data){const [r]=await tx`insert into activity(property_id,investor_id,stage,notes,date) values(${p},${i},${STAGE},${JSON.stringify(data)},${new Date().toISOString()}) returning id`;return String(r.id)}
const dayOf=v=>{const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):null};
// The final review always recomputes the pair with the current rules and data; the stored result is shown beside it.
// Writes lock both records FOR SHARE: a concurrent edit either commits first (and is seen here) or waits until
// this transaction ends; evidence written meanwhile changes the fingerprint and voids the result at the next read.
async function state(tx,a,{write=false}={}){
 const p=id(a.property_id),i=id(a.investor_id);
 const lock=write?tx`for share`:tx``,PROPERTY_VISIBLE=await stagedVisibility(tx);
 const [[property],[investor],[match],history,answers,tasks,changes]=await Promise.all([
  tx`select p.* from properties p where p.id=${p} and ${tx.unsafe(PROPERTY_VISIBLE)} ${lock}`,
  tx`select i.* from investors i where i.id=${i} and ${tx.unsafe(INVESTOR_VISIBLE)} ${lock}`,
  tx`select result_json,updated from match_results where property_id=${p} and investor_id=${i}`,events(tx,p,i),
  tx`select id,property_id,investor_id,requirement,status,digest,evidence,outcome,answered_on,recorded_at from site_private.pair_answers where property_id=${p} and investor_id=${i} and kind='Odgovor' order by id`,
  tx`select requirement,status,status_reason,checked_at,evidence from site_private.match_review_tasks where property_id=${p} and investor_id=${i} order by requirement`,
  tx`select event,status,missing,rejected,recorded_at from site_private.pair_history where property_id=${p} and investor_id=${i} order by recorded_at desc,id desc limit 2`]);
 if(!property||!investor)throw Error('Nekretnina ili zahtjev više nisu dostupni u operativnom katalogu.');
 const why={},fresh=suggestion(property,investor,Date.now(),pairCheckMap(answers).get(property.id+'-'+investor.id),why)||
  {status:REJECT,score:null,reasons:[],missing:[],rejected:[why.reason||'Par ne prolazi aktualna pravila uparivanja'],gaps:{property:[],buyer:[],pair:[]},info:[]};
 const stored=parse(match?.result_json)||null;
 // Approvals cover the records and the pair evidence under the current rule version.
 const fp=await fingerprint(property,investor,evidenceSnapshot(answers,tasks,fresh)),readiness=reviewReadiness(property,investor,fresh,stored);
 const offers=history.filter(e=>e.type==='version').map(o=>{
  const approval=history.find(e=>e.type==='approval'&&e.offer_id===o.id&&e.fingerprint===o.fingerprint);
  return {...o,current:o.fingerprint===fp,approved:!!approval,approved_on:approval?dayOf(approval.date):null,responses:history.filter(e=>e.type==='response'&&e.offer_id===o.id)};
 });
 // One business-valid response for the pair, across all versions, by documented chronology.
 const effective=effectiveResponse(history.filter(e=>e.type==='response'));
 const s={property,investor,result:fresh,stored,sides:reviewSides(fresh),tasks,change:changeOf(changes),readiness,fingerprint:fp,offers,effective,
  contacts:{seller:contactRoute(property),buyer:contactRoute(investor)}};
 // A stored package stays as an immutable historical record; whether it may be handed over is recomputed every time.
 s.history=history.map(e=>e.type==='handoff'?{...e,validity:packageValidity(e,s)}:e);
 return s;
}
// Why a version can or cannot start a hand-over now (empty list = it can).
function handoverBlockers(offer,s){
 const out=[],r=s.effective.response;
 if(!offer)return ['Verzija ponude više ne postoji'];
 if(!offer.current)out.push('Podaci ili dokazi para promijenili su se nakon ove verzije');
 if(!offer.approved)out.push('Verzija nije odobrena');
 if(!s.readiness.ready)out.push('Završni pregled više nije spreman: '+s.readiness.blockers.join('; '));
 if(s.effective.ambiguous)out.push(s.effective.reason);
 else if(!r)out.push('Nema pisanog odgovora kupca');
 else if(r.response!==INTEREST)out.push('Važeći odgovor kupca ('+r.responded_on+') je: '+r.response);
 else if(r.offer_id!==offer.id)out.push('Važeći interes odnosi se na verziju '+(r.version??'?')+', ne na ovu');
 else if(r.version_current!==true)out.push('Interes je zabilježen uz zastarjelu verziju');
 return out;
}
function packageValidity(h,s){
 const offer=s.offers.find(o=>o.id===h.offer_id),reasons=handoverBlockers(offer,s);
 if(h.fingerprint!==s.fingerprint&&!reasons.includes('Podaci ili dokazi para promijenili su se nakon ove verzije'))reasons.unshift('Podaci ili dokazi para promijenili su se nakon pripreme paketa');
 if(s.effective.response&&h.buyer_response?.id!==s.effective.response.id&&!reasons.length)reasons.push('Paket se temelji na drugom odgovoru kupca');
 return {valid:!reasons.length,reasons,checked_at:new Date().toISOString()};
}
async function buyerRequests(tx,a){
 const [base]=await tx`select * from investors where id=${id(a.investor_id)}`;if(!base)throw Error('Kupac nije pronađen.');
 const root=requestIdentity(base);
 // A text prefilter, then the parsed identity: one record with invalid criteria JSON cannot break the list.
 const items=(await tx`select i.*,(${tx.unsafe(INVESTOR_VISIBLE)}) as visible from investors i where i.id::text=${root} or strpos(i.criteria_json,'buyer_identity_id')>0 order by i.id`).filter(r=>requestIdentity(r)===root);
 if(!items.some(r=>String(r.id)===root))throw Error('Izvorni profil kupca nije pronađen.');
 return {identity_id:root,items:items.map(r=>({...r,root:String(r.id)===root,request_label:String(r.id)===root?'Izvorni profil':criteria(r).request_label||'Zahtjev bez naziva'})),count:items.length};
}
async function saveRequest(tx,a,refresh){
 const [base]=await tx`select * from investors where id=${id(a.investor_id)}`;if(!base)throw Error('Kupac nije pronađen.');
 const root=requestIdentity(base);
 await tx`select pg_advisory_xact_lock(2261028,${Number(root)}::int)`;
 const [profile]=await tx`select * from investors where id=${Number(root)}`;if(!profile)throw Error('Izvorni profil kupca nije pronađen.');
 let existing=null;
 if(a.request_id!=null){
  [existing]=await tx`select * from investors where id=${id(a.request_id)} for update`;
  if(!existing||requestIdentity(existing)!==root)throw Error('Zahtjev ne pripada ovom kupcu.');
  // The original (often imported) profile is never rewritten through requests; it keeps its own editor and sync.
  if(String(existing.id)===root)throw Error('Izvorni profil kupca ne mijenja se kroz zasebne zahtjeve.');
 }
 if(!a.criteria||typeof a.criteria!=='object'||Array.isArray(a.criteria))throw Error('Kriteriji zahtjeva moraju biti objekt.');
 const label=String(a.label||'').trim();if(!label||label.length>160)throw Error('Unesi naziv zasebnog zahtjeva.');
 for(const k of ['buyer_identity_id','request_label'])if(Object.hasOwn(a.criteria,k))throw Error('Nevaljan kriterij zahtjeva: '+k);
 const before=existing?criteria(existing):{};
 const c={...before,...a.criteria,buyer_identity_id:root,request_label:label};
 // Each request carries its own evidence. A new request never inherits checks; a changed source keeps no
 // earlier check or date unless one is entered for the new source.
 const sourceChanged=!existing||c.source_url!==before.source_url;
 if(sourceChanged){for(const k of ['notes_check','source_conditions_check'])delete c[k];if(existing&&!Object.hasOwn(a.criteria,'checked_at'))delete c.checked_at}
 // A contact is bound to one requirement's source; it is kept only for the same request and the same source.
 const contact=existing&&!sourceChanged?existing.contact_json??null:null;
 const record=investorInput({name:profile.name,country:profile.country,preferred_countries:String(a.preferred_countries??''),notes:String(a.notes??''),
  min_budget:a.min_budget===''?null:a.min_budget??null,max_budget:a.max_budget===''?null:a.max_budget??null,verified:a.verified===true,criteria_json:JSON.stringify(c),contact_json:contact});
 const [saved]=existing?await tx`update investors set ${tx(record,...Object.keys(record))} where id=${id(existing.id)} returning id`:await tx`insert into investors ${tx(record,...Object.keys(record))} returning id`;
 await tx`insert into activity(investor_id,stage,notes,date) values(${saved.id},'Zahtjev kupca',${(existing?'Izmjena zahtjeva: ':'Novi zahtjev: ')+label},${new Date().toISOString()})`;
 await refresh(tx);return {id:saved.id,identity_id:root};
}
export async function workflow(tx,a,{refresh,businessPhase=false}){
 if(a.action==='buyer_requests')return buyerRequests(tx,a);
 if(a.action==='save_request')return saveRequest(tx,a,refresh);
 const p=id(a.property_id),i=id(a.investor_id);
 // One writer per pair: version numbers, approvals and responses are decided on a consistent history.
 if(a.action!=='workflow')await tx`select pg_advisory_xact_lock(2261027,${p}::int)`;
 const s=await state(tx,a,{write:a.action!=='workflow'});
 if(a.action==='workflow')return {...s,business_phase:businessPhase};
 if(a.action==='offer_create'){
  const code='EU-'+crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
  const data={type:'version',number:s.offers.length+1,fingerprint:s.fingerprint,presentation:presentation(s.property,s.investor,s.result,code),
   request_label:criteria(s.investor).request_label||'Osnovni zahtjev',readiness:s.readiness,business_phase:businessPhase};
  return {id:await append(tx,p,i,data)};
 }
 const offer=s.offers.find(o=>o.id===String(a.offer_id));if(!offer)throw Error('Verzija ponude nije pronađena za ovaj par.');
 if(a.action==='offer_approve'){
  if(a.reviewed!==true||!offer.current||!s.readiness.ready)throw Error('Prije odobrenja dovrši sve provjere i izradi aktualnu verziju.');
  const done=s.history.find(e=>e.type==='approval'&&e.offer_id===offer.id&&e.fingerprint===s.fingerprint);
  if(done)return {id:done.id,already:true};
  return {id:await append(tx,p,i,{type:'approval',offer_id:offer.id,fingerprint:s.fingerprint,reviewed:true,fit:s.readiness.fit})};
 }
 // Responses and the agency hand-over belong to the business phase, which stays off until the owner starts it.
 if(!businessPhase)throw Error('Poslovna faza nije aktivirana: odgovori kupaca i predaja agenciji se ne evidentiraju.');
 if(a.action==='offer_response'){
  if(!offer.approved)throw Error('Odgovor se evidentira samo uz pregledanu i odobrenu verziju.');
  const response=responseInput(a,{after:offer.approved_on,previous:s.history.filter(e=>e.type==='response')});
  // A response to a version whose data has since changed is kept as history but cannot start a hand-over.
  return {id:await append(tx,p,i,{type:'response',offer_id:offer.id,version:offer.number,version_current:offer.current&&s.readiness.ready,...response})};
 }
 if(a.action==='agency_package'){
  const blockers=handoverBlockers(offer,s),response=s.effective.response;
  if(blockers.length)throw Error('Predaja zahtijeva aktualan pregledan par i posljednji pisani interes kupca za tu verziju: '+blockers.join('; '));
  const fields=handoffInput(a);
  const data={type:'handoff',offer_id:offer.id,version:offer.number,fingerprint:s.fingerprint,...fields,property:s.property,buyer:s.investor,criteria:criteria(s.investor),buyer_response:response,
   contacts:s.contacts,review:{fit:s.readiness.fit,reliability:s.readiness.reliability,sides:s.sides,tasks:s.tasks},
   documents:{legal:s.property.legal_evidence_url||null,planning:s.property.planning_evidence_url||null,source:s.property.source||null},prepared_at:new Date().toISOString(),status:'Interni paket — nije poslan'};
  return {id:await append(tx,p,i,data),package:data};
 }
 throw Error('Nepoznata radnja tijeka ponude.');
}
