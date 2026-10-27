import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {checkedProposals,APPLY_SQL} from './ops/inquiry-backfill.mjs';
import {contactInput} from './supabase/functions/sites-platform/domain.mjs';
const require=createRequire(process.argv[2]+'/package.json'),{PGlite}=require('@electric-sql/pglite');
const url='https://www.emporia-realestate.com/property/urbanized-land-l600-zadar/';
const contact={mode:'agency',name:'Emporia d.o.o. Zadar',agency_name:'Emporia d.o.o. Zadar',record_reference:url,evidence_url:url,contact_url:url,represents_record:true,permitted:true,permission_scope:'property_enquiry_only',permission_quote:'Your Message',permission_basis:'record_bound_inquiry_form',checked_at:new Date().toISOString()};
const rows=checkedProposals([{id:1,source:url,contact},{id:2,source:url,contact},{id:3,source:url,contact}]);
for(const bad of [{...contact,record_reference:url+'other'},{...contact,permitted:false},{...contact,checked_at:'bad'},{...contact,checked_at:new Date(Date.now()+10000).toISOString()}])assert.throws(()=>checkedProposals([{id:1,source:url,contact:bad}]));
assert.throws(()=>checkedProposals([{id:1,source:'https://other.org/listing',contact}]));
const db=new PGlite();
try{
 await db.exec(`create schema site_private; create table public.properties(id bigint primary key,source text,contact_json text);
 create function site_private.contact_usable(payload text,ref text) returns boolean language sql as $$select (payload::jsonb->>'permitted')::boolean and payload::jsonb->>'record_reference'=ref$$;`);
 await db.query('insert into properties values(1,$1,null),(2,$1,$2),(3,$3,null)',[url,'{"manual":"KEEP"}','https://example.org/different']);
 await db.exec('begin');
 assert.deepEqual((await db.query(APPLY_SQL,[JSON.stringify(rows)])).rows.map(r=>Number(r.id)),[1]);
 await db.exec('rollback');
 assert.equal((await db.query('select contact_json from properties where id=1')).rows[0].contact_json,null);
 assert.equal((await db.query(APPLY_SQL,[JSON.stringify(rows)])).rows.length,1);
 assert.equal((await db.query(APPLY_SQL,[JSON.stringify(rows)])).rows.length,0);
 assert.equal((await db.query('select contact_json from properties where id=2')).rows[0].contact_json,'{"manual":"KEEP"}');
 assert.equal((await db.query('select contact_json from properties where id=3')).rows[0].contact_json,null);
 assert.equal(JSON.parse(contactInput({source:url,contact_json:contact}).contact_json).permission_scope,'property_enquiry_only');
 console.log('Inquiry backfill PostgreSQL engine: scoped evidence, exact reference, manual preservation, idempotence and rollback passed.');
}finally{await db.close()}
