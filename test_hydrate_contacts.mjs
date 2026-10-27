import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sourceContact,notesContact,hydrateContacts} from './supabase/functions/sites-platform/hydrate-contacts.mjs';
import {contactRoute} from './supabase/functions/sites-platform/domain.mjs';
const require=createRequire(process.argv[2]+'/package.json'),{PGlite}=require('@electric-sql/pglite');
const url='https://example.org/demand';
const contact={mode:'agency',name:'Named agent',agency_name:'Agency',email:'agent@example.org',permitted:false,represents_record:true,evidence_url:url,record_reference:url};
const candidate=(c=contact,u=url)=>({url:u,body_json:JSON.stringify({facts:{source_contact:c}})});
assert.equal(JSON.parse(sourceContact(candidate())).permitted,false);
assert.equal(contactRoute({source:url,contact_json:sourceContact(candidate())}),null);
assert.equal(sourceContact(candidate(contact,'https://example.org/other')),null);
assert.equal(sourceContact(candidate({...contact,email:'bad'})),null);
assert.equal(sourceContact(candidate({...contact,represents_record:false})),null);
assert.equal(sourceContact(candidate({...contact,permitted:true,email:'bad'})),null);
assert.ok(contactRoute({source:url,contact_json:sourceContact(candidate({...contact,permitted:true}))}));
const scoped={...contact,permitted:true,permission_scope:'property_enquiry_only',permission_quote:'Present your real estate offer',permission_basis:'reviewed_acquisition_invitation',checked_at:new Date().toISOString()};
const normalized=JSON.parse(sourceContact(candidate(scoped)));
for(const key of ['permission_scope','permission_quote','permission_basis','checked_at'])assert.equal(normalized[key],scoped[key],'preserve inquiry evidence through normalization');
assert.equal(sourceContact(candidate({...scoped,permission_scope:'marketing'})),null);
assert.equal(sourceContact(candidate({...scoped,permission_quote:''})),null);
assert.equal(notesContact({name:'Buyer',criteria_json:JSON.stringify({source_url:url}),notes:JSON.stringify({official_url:'https://example.org/other',public_business_contact:{email:'a@example.org'}})}),null);
const db=new PGlite();
async function tx(parts,...values){const params=[],query=parts.reduce((s,p,i)=>s+(i?(params.push(values[i-1]),'$'+params.length):'')+p,'');return (await db.query(query,params)).rows}
tx.json=x=>JSON.stringify(x);
try{
 await db.exec(`create schema site_private;
 create function site_private.safe_json(s text) returns jsonb language plpgsql as $$begin return s::jsonb;exception when others then return '{}'::jsonb;end$$;
 create table source_candidates(id text,url text,body_json text,property_id bigint,investor_id bigint,last_seen text);
 create table properties(id bigint,source text,contact_json text);
 create table investors(id bigint,name text,notes text,criteria_json text,contact_json text);`);
 await db.query('insert into properties values (1,$1,null),(2,$1,$2),(3,$3,null)',[url,'{"manual":"KEEP"}','https://example.org/different']);
 await db.query('insert into investors values(1,$1,$2,$3,null),(2,$1,null,$3,null)', ['Buyer',JSON.stringify({official_url:url,public_business_contact:{email:'buyer@example.org'}}),JSON.stringify({source_url:url})]);
 for(const [id,p,i,c] of [['a',1,null,contact],['b',2,null,contact],['c',3,null,contact],['d',null,2,{...contact,permitted:true}]]){
  await db.query('insert into source_candidates values($1,$2,$3,$4,$5,$6)',[id,url,candidate(c).body_json,p,i,'2026-10-26T12:00:00Z']);
 }
 assert.equal(await hydrateContacts(tx),3);
 const props=(await db.query('select * from properties order by id')).rows;
 assert.equal(JSON.parse(props[0].contact_json).permitted,false);
 assert.equal(props[1].contact_json,'{"manual":"KEEP"}');
 assert.equal(props[2].contact_json,null);
 const buyers=(await db.query('select * from investors order by id')).rows;
 assert.equal(JSON.parse(buyers[0].contact_json).permitted,false);
 assert.equal(JSON.parse(buyers[1].contact_json).permitted,true);
 await db.query('insert into investors values(3,$1,$2,$3,null)', ['Legacy buyer',JSON.stringify({official_url:url,public_business_contact:{email:'buyer@example.org'}}),'{}']);
 assert.equal(await hydrateContacts(tx),1);
 const legacy=(await db.query('select * from investors where id=3')).rows[0];
 assert.equal(JSON.parse(legacy.criteria_json).source_url,url);
 assert.equal(JSON.parse(legacy.contact_json).permitted,false);
 assert.equal(await hydrateContacts(tx),0,'repeated refresh does not overwrite contacts');
 console.log('Contact hydration PostgreSQL tests passed: direct/agency linkage, permission preservation, malformed evidence, both entities, manual preservation, reference conflicts and idempotence.');
}finally{await db.close()}


