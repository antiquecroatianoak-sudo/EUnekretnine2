// Partner agency proposals (plan #46 addendum, module 7): internal staging and operator review only. There is no
// external form or endpoint; staging runs through the owner gateway until the owner decides on an external audience.
// A partner never writes a record: a proposal is reviewed, then applied in one transaction against the version it was
// made for. URLs are validated as text and never fetched; no files are accepted.
import {FACTS,validateFacts,readFacts} from './facts.mjs';
import {num,propertyInput} from './domain.mjs';
import {agencyDirectory} from './agencies.mjs';
export const PARTNER_VERSION='partner-v1';
export const PARTNER_CONFIG={external:false,reason:'Vanjski pristup partnera nije uključen; prijedlozi se unose samo interno (staging) do odluke vlasnika.'};
const FIELDS=['legal_evidence_url','planning_evidence_url','price','area','available_until'];
export const PROPOSAL_FIELDS=[...Object.keys(FACTS).map(k=>'facts.'+k),...FIELDS];
export const RATE_LIMIT={proposals:50,window_ms:3600000};
export const ACTIONS=['partner_grant_create','partner_grant_revoke','partner_stage','partner_proposals','partner_decide'];
export const READ_ACTIONS=['partner_proposals'];
const ACTOR='vlasnik (Sites)';
const enc=new TextEncoder();
export async function sha256(v){const b=await crypto.subtle.digest('SHA-256',enc.encode(String(v)));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export const hashToken=sha256;
export function newToken(){const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
const ids=v=>{if(!Array.isArray(v)||!v.length||v.length>200)throw Error('Popis zapisa mora imati 1–200 oznaka.');const out=[...new Set(v.map(Number))];if(out.some(n=>!Number.isSafeInteger(n)||n<=0))throw Error('Nevaljana oznaka zapisa.');return out};
const id=(v,what)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw Error('Nevaljana oznaka: '+what+'.');return n};
const text=(v,max,what)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error(what+' je obavezan tekst (najviše '+max+' znakova).');return v.trim()};
export function grantInput(a,now=Date.now()){
 const agency=Number(a.agency_source_id);if(!Number.isSafeInteger(agency)||agency<=0)throw Error('Nevaljana agencija.');
 const fields=[...new Set(a.fields||[])];if(!fields.length||fields.length>40||fields.some(f=>!PROPOSAL_FIELDS.includes(f)))throw Error('Nedopušteno polje u pristupu.');
 const days=Number(a.days??7);if(!Number.isInteger(days)||days<1||days>30)throw Error('Trajanje pristupa mora biti 1–30 dana.');
 if(typeof a.token_hash!=='string'||!/^[0-9a-f]{64}$/.test(a.token_hash))throw Error('Potreban je SHA-256 sažetak pristupnog ključa.');
 return {agency_source_id:agency,record_ids:ids(a.record_ids),fields,token_hash:a.token_hash,expires_at:new Date(now+days*86400000).toISOString()};
}
const https=v=>{try{const u=new URL(v);return typeof v==='string'&&v.length<=2000&&u.protocol==='https:'&&!u.username&&!u.password&&!/[\s\u0000-\u001f]/.test(v)}catch{return false}};
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
// A proposed value, validated for its field. A partner fact is always "partner" and "nepotvrđeno": only the operator's
// review, with evidence, can confirm it later in the record editor.
export function proposalValue(field,value){
 if(field.startsWith('facts.')){const key=field.slice(6);if(!Object.hasOwn(FACTS,key))throw Error('Nedopušteno polje.');
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Prijedlog podatka mora biti objekt.');
  const {evidence:_,...rest}=value;
  return validateFacts({[key]:{...rest,origin:'partner',status:'nepotvrđeno'}},{now:Date.now()})[key];}
 if(field.endsWith('_url')){if(!https(value))throw Error('Poveznica mora biti javni https URL bez korisničkih podataka.');return value}
 if(field==='price'||field==='area'){if(!num(value)||value<=0)throw Error('Vrijednost mora biti pozitivan broj.');return value}
 if(field==='available_until'){if(!day(value))throw Error('Datum mora biti YYYY-MM-DD.');return value}
 throw Error('Nedopušteno polje.');
}
export const currentValue=(field,p)=>field.startsWith('facts.')?(readFacts(p)||{})[field.slice(6)]??null:p?.[field]??null;
export const baseValue=(field,p)=>JSON.stringify(currentValue(field,p));
// One reason, or null. Unknown token, other agency and records outside the grant get the same answer, so a partner
// cannot learn whether other records exist.
export function authorize(grant,{property,field,agencyId},now=Date.now()){
 const denied='Pristup nije valjan za ovaj zapis.';
 if(!grant)return denied;
 if(grant.revoked_at||Date.parse(grant.expires_at)<=now)return 'Pristup je istekao ili je opozvan.';
 if(!property||!grant.record_ids.map(Number).includes(Number(property.id))||Number(agencyId)!==Number(grant.agency_source_id))return denied;
 if(!grant.fields.includes(field))return 'Polje nije dopušteno ovim pristupom.';
 return null;
}
// The record after applying an accepted proposal: only that field changes.
export function applyProposal(p,field,value){
 if(field.startsWith('facts.')){const facts={...(readFacts(p)||{}),[field.slice(6)]:value};return {facts_json:JSON.stringify(facts)}}
 return {[field]:value};
}
// The agency a property comes from: its own imported source listing from a source catalogued as an agency.
// With `lock` the linking listing row is held (FOR SHARE) until the transaction ends, so the link cannot be moved
// or removed between the check and an accepted write.
async function agencyOf(tx,property,{lock=false}={}){
 const [r]=await tx`select s.id from source_candidates c join sources s on c.source_id='registry-'||s.id::text where c.property_id=${Number(property.id)} and c.url=${property.source} and s.category ilike 'Agencija%' order by c.last_seen desc,c.id limit 1 ${lock?tx`for share of c`:tx``}`;
 return r?Number(r.id):null;
}
// Current agency per property for the review list, by the same rule as agencyOf().
async function agenciesOf(tx,props){
 if(!props.length)return new Map();
 const rows=await tx`select distinct on (p.id) p.id as property_id,s.id from properties p join source_candidates c on c.property_id=p.id and c.url=p.source
  join sources s on c.source_id='registry-'||s.id::text where p.id=any(${props.map(p=>Number(p.id))}::bigint[]) and s.category ilike 'Agencija%' order by p.id,c.last_seen desc,c.id`;
 return new Map(rows.map(r=>[String(r.property_id),Number(r.id)]));
}
const audit=(tx,proposal,grant,event,detail={})=>tx`insert into site_private.partner_audit(proposal_id,grant_id,event,detail) values(${proposal},${grant},${event},${tx.json(detail)})`;
const publicGrant=({token_hash:_,...g})=>g;
export async function partner(tx,a,{refresh,now=Date.now()}={}){
 if(a.action==='partner_grant_create'){
  const g=grantInput(a,now);
  const [agency]=await tx`select id from sources where id=${g.agency_source_id} and category ilike 'Agencija%'`;if(!agency)throw Error('Agencija nije pronađena.');
  const props=await tx`select id,source from properties where id=any(${g.record_ids}::bigint[])`;
  if(props.length!==g.record_ids.length)throw Error('Neki zapisi nisu pronađeni.');
  for(const p of props)if(await agencyOf(tx,p)!==g.agency_source_id)throw Error('Zapis '+p.id+' nije oglas te agencije.');
  const [row]=await tx`insert into site_private.partner_grants(agency_source_id,record_ids,fields,token_hash,expires_at,created_by) values(${g.agency_source_id},${g.record_ids},${g.fields},${g.token_hash},${g.expires_at},${ACTOR}) returning id,expires_at`;
  await audit(tx,null,row.id,'grant_created',{agency_source_id:g.agency_source_id,records:g.record_ids.length,fields:g.fields});
  return {id:row.id,expires_at:row.expires_at};
 }
 if(a.action==='partner_grant_revoke'){
  const [row]=await tx`update site_private.partner_grants set revoked_at=now() where id=${id(a.id,'pristup')} and revoked_at is null returning id`;
  if(!row)throw Error('Pristup nije pronađen ili je već opozvan.');
  await audit(tx,null,row.id,'grant_revoked');return {id:row.id,revoked:true};
 }
 if(a.action==='partner_stage'){
  // Internal staging (test adapter for a future partner channel): the token stands in for the partner's credential.
  if(typeof a.token!=='string'||a.token.length<20||a.token.length>200)throw Error('Pristup nije valjan za ovaj zapis.');
  const [grant]=await tx`select * from site_private.partner_grants where token_hash=${await sha256(a.token)} for share`;
  const field=String(a.field||''),propertyId=Number(a.property_id);
  const [property]=Number.isSafeInteger(propertyId)&&propertyId>0?await tx`select * from properties where id=${propertyId} for share`:[];
  const reason=authorize(grant,{property,field,agencyId:property&&grant?await agencyOf(tx,property):null},now);
  if(reason){if(grant)await audit(tx,null,grant.id,'denied',{reason,field:field.slice(0,100)});return {ok:false,reason}}
  const [{n}]=await tx`select count(*)::int n from site_private.partner_proposals where grant_id=${grant.id} and created_at>${new Date(now-RATE_LIMIT.window_ms).toISOString()}`;
  if(n>=RATE_LIMIT.proposals){await audit(tx,null,grant.id,'rate_limited');return {ok:false,reason:'Previše prijedloga; pokušaj kasnije.'}}
  const value=proposalValue(field,a.value),evidence=text(a.evidence,2000,'Dokaz'),author=text(a.author,200,'Autor');
  const valueJson=JSON.stringify(value);
  const [row]=await tx`insert into site_private.partner_proposals(grant_id,property_id,field,value_json,value_digest,base_value,evidence,author)
   values(${grant.id},${property.id},${field},${tx.json(value)},${await sha256(valueJson)},${baseValue(field,property)},${evidence},${author}) on conflict do nothing returning id`;
  if(!row)return {ok:true,duplicate:true};
  await audit(tx,row.id,grant.id,'staged',{field});return {ok:true,id:row.id};
 }
 if(a.action==='partner_proposals'){
  const status=a.status??'novo';if(!['novo','prihvaćeno','odbijeno','zastarjelo','sve'].includes(status))throw Error('Nevaljan status prijedloga.');
  const rows=await tx`select pp.*,g.agency_source_id,s.name as agency_name,p.title as property_title from site_private.partner_proposals pp join site_private.partner_grants g on g.id=pp.grant_id
   left join sources s on s.id=g.agency_source_id left join properties p on p.id=pp.property_id where ${status==='sve'?tx`true`:tx`pp.status=${status}`} order by pp.created_at desc,pp.id desc limit 500`;
  const props=new Map((await tx`select * from properties where id=any(${[...new Set(rows.map(r=>Number(r.property_id)))]}::bigint[])`).map(p=>[String(p.id),p]));
  const grants=(await tx`select g.*,s.name as agency_name from site_private.partner_grants g left join sources s on s.id=g.agency_source_id order by g.id desc limit 200`).map(publicGrant);
  const linked=await agenciesOf(tx,[...props.values()]);
  return {config:PARTNER_CONFIG,fields:PROPOSAL_FIELDS,agencies:await agencyDirectory(tx),grants,proposals:rows.map(r=>{const p=props.get(String(r.property_id));
   const stale_reason=!p?'Zapis više ne postoji':baseValue(r.field,p)!==r.base_value?'Vrijednost se promijenila nakon prijedloga':linked.get(String(r.property_id))!==Number(r.agency_source_id)?'Oglas više nije povezan s agencijom prijedloga':null;
   return {...r,current:p?currentValue(r.field,p):null,stale:!!stale_reason,stale_reason}})};
 }
 if(a.action==='partner_decide'){
  if(!['prihvaćeno','odbijeno'].includes(a.decision))throw Error('Odluka mora biti prihvaćeno ili odbijeno.');
  const note=a.note==null||a.note===''?null:text(a.note,2000,'Napomena');
  const [pp]=await tx`select * from site_private.partner_proposals where id=${id(a.id,'prijedlog')} for update`;
  if(!pp)throw Error('Prijedlog nije pronađen.');if(pp.status!=='novo')throw Error('O prijedlogu je već odlučeno ('+pp.status+').');
  const decide=async(status,event,detail={})=>{await tx`update site_private.partner_proposals set status=${status},decided_at=now(),decided_by=${ACTOR},decision_note=${note} where id=${pp.id}`;await audit(tx,pp.id,pp.grant_id,event,detail);return {id:pp.id,status}};
  if(a.decision==='odbijeno')return decide('odbijeno','rejected');
  const [grant]=await tx`select * from site_private.partner_grants where id=${pp.grant_id} for share`;
  if(grant.revoked_at||Date.parse(grant.expires_at)<=now)throw Error('Pristup je istekao ili je opozvan; prijedlog se može samo odbiti.');
  const [p]=await tx`select * from properties where id=${pp.property_id} for update`;
  // Acceptance only against the version the proposal was made for: any change in between makes it stale.
  if(!p||baseValue(pp.field,p)!==pp.base_value)return decide('zastarjelo','stale');
  // The grant must still cover this record now (review 6471206531): a listing moved to another agency or unlinked
  // after staging makes the proposal stale; nothing is written and nothing is refreshed.
  const reason=authorize(grant,{property:p,field:pp.field,agencyId:await agencyOf(tx,p,{lock:true})},now);
  if(reason)return decide('zastarjelo','stale',{reason:'agency_link',detail:reason});
  const change=applyProposal(p,pp.field,pp.value_json),checked=propertyInput({...p,...change});
  await tx`update properties set ${tx(Object.fromEntries(Object.keys(change).map(k=>[k,checked[k]])))} where id=${p.id}`;
  await tx`insert into activity(property_id,stage,notes,date) values(${p.id},'Prihvaćen prijedlog partnera',${JSON.stringify({proposal_id:pp.id,field:pp.field,evidence:pp.evidence})},${new Date(now).toISOString()})`;
  const out=await decide('prihvaćeno','accepted',{field:pp.field});
  if(refresh)await refresh(tx);
  return out;
 }
 throw Error('Nepoznata radnja.');
}
