import {contactInput,contactRoute,criteria,validUrl} from './domain.mjs';
const object=v=>{try{const x=typeof v==='string'?JSON.parse(v):v;return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return {}}};
// Transport evidence without promoting public contact details to permission,
// partner status, buyer verification or interest in a specific property.
export function sourceContact(row){
 const f=object(row.body_json).facts||{},c=object(f.source_contact);
 if(!Object.keys(c).length||c.record_reference!==row.url)return null;
 try{
  const normalized=contactInput({source:row.url,contact_json:c}).contact_json;
  const parsed=object(normalized);
  if(!['direct','agency'].includes(parsed.mode)||!parsed.name||!validUrl(parsed.evidence_url))return null;
  if(!(parsed.email||parsed.phone||parsed.contact_url))return null;
  if(parsed.mode==='agency'&&(!parsed.agency_name||parsed.represents_record!==true))return null;
  if(parsed.permitted===true&&!contactRoute({source:row.url,contact_json:parsed}))return null;
  return normalized;
 }catch{return null}
}
export function notesContact(row){
 const n=object(row.notes),c=object(n.public_business_contact),reference=criteria(row).source_url||n.official_url;
 // Do not attach a general company contact to a different acquisition page.
 if(!validUrl(reference)||n.official_url!==reference)return null;
 const raw={mode:'direct',name:row.name,record_reference:reference,evidence_url:reference,permitted:false};
 for(const k of ['email','phone'])if(typeof c[k]==='string')raw[k]=c[k];
 for(const k of ['contact_url','contact_page','land_submission_form','land_submission_page'])if(validUrl(c[k])){raw.contact_url=c[k];break}
 return sourceContact({url:reference,body_json:{facts:{source_contact:raw}}});
}
export async function hydrateContacts(tx){
 const candidates=await tx`select id,url,body_json,property_id,investor_id from source_candidates where (property_id is not null or investor_id is not null) and site_private.safe_json(body_json)->'facts' ? 'source_contact' order by last_seen desc,id`;
 const seen=new Set(),updates={properties:[],investors:[]};
 for(const row of candidates){
  const kind=row.property_id!=null?'properties':'investors',id=row.property_id??row.investor_id,key=kind+':'+id;
  if(seen.has(key))continue;seen.add(key);
  const contact=sourceContact(row);if(contact)updates[kind].push({id:String(id),contact,reference:row.url});
 }
 const buyers=await tx`select id,name,notes,criteria_json from investors where contact_json is null and notes is not null order by id`;
 for(const row of buyers){if(seen.has('investors:'+row.id))continue;const contact=notesContact(row);if(contact)updates.investors.push({id:String(row.id),contact,reference:criteria(row).source_url||object(row.notes).official_url})}
 let filled=0;
 for(const [table,rows] of Object.entries(updates)){
  if(!rows.length)continue;
  // Existing nonempty/manual contacts are never replaced; linkage is checked
  // again during the write, in case a source reference changed.
  const result=table==='properties'?
   await tx`update properties p set contact_json=a.contact from jsonb_to_recordset(${tx.json(rows)}::jsonb) as a(id bigint,contact text,reference text) where p.id=a.id and p.contact_json is null and p.source=a.reference returning p.id`:
   await tx`update investors i set contact_json=a.contact,criteria_json=(case when nullif(site_private.safe_json(i.criteria_json)->>'source_url','') is null then site_private.safe_json(i.criteria_json)||jsonb_build_object('source_url',a.reference) else site_private.safe_json(i.criteria_json) end)::text from jsonb_to_recordset(${tx.json(rows)}::jsonb) as a(id bigint,contact text,reference text) where i.id=a.id and i.contact_json is null and coalesce(nullif(site_private.safe_json(i.criteria_json)->>'source_url',''),site_private.safe_json(i.notes)->>'official_url')=a.reference returning i.id`;
  filled+=result.length;
 }
 return filled;
}

