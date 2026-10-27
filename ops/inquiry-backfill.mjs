import {contactInput,contactRoute} from '../supabase/functions/sites-platform/domain.mjs';
// Deliberately bounded to the exact source/form contract independently rechecked
// by recheck-inquiry-contacts.py. No existing contact or permission is replaced.
export function checkedProposals(rows){
 if(!Array.isArray(rows))throw Error('Expected reviewed proposals');
 const seen=new Set();
 return rows.map(row=>{
  const u=new URL(row.source),id=String(row.id),c=row.contact;
  if(!/^[1-9][0-9]*$/.test(id)||seen.has(id)||u.origin!=='https://www.emporia-realestate.com'||!/^\/property\/[a-z0-9-]+\/$/.test(u.pathname)||u.search||u.hash)throw Error('Unreviewed record');
  seen.add(id);
  if(c?.permission_scope!=='property_enquiry_only'||c?.permission_basis!=='record_bound_inquiry_form'||c?.checked_at==null||Date.parse(c.checked_at)>Date.now()||Date.now()-Date.parse(c.checked_at)>86400000)throw Error('Fresh form evidence required');
  const contact=contactInput({source:row.source,contact_json:c}).contact_json;
  if(!contactRoute({source:row.source,contact_json:contact}))throw Error('Invalid record contact');
  return {id,source:row.source,contact};
 });
}
export const APPLY_SQL=`update public.properties p set contact_json=a.contact
from jsonb_to_recordset($1::jsonb) as a(id bigint,source text,contact text)
where p.id=a.id and p.source=a.source and p.contact_json is null
and site_private.contact_usable(a.contact,a.source)
returning p.id`;
