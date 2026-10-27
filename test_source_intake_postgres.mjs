import assert from 'node:assert/strict';
import {registerSource,intakeStatus,activateSource} from './supabase/functions/registry-discovery/source-intake.mjs';
if(!process.env.TEST_POSTGRES_URL||!process.env.PG_MODULE)throw Error('Explicit isolated PostgreSQL test configuration required');
const postgres=(await import(process.env.PG_MODULE)).default;
const sql=postgres(process.env.TEST_POSTGRES_URL,{ssl:'require',max:1,prepare:false});
const schema='source_intake_test_'+Date.now();
try{
 await sql.unsafe('create schema '+schema);
 await sql.unsafe('set search_path to '+schema);
 await sql.unsafe('create table sources(id bigserial primary key,name text,url text,country text,category text,is_active boolean,inactive_reason text)');
 await sql.unsafe('create table discovery_runs(source_id text primary key,status text,checked_at text,body_json text)');
 await sql.unsafe('create table source_candidates(id text primary key,source_id text,kind text,last_seen text,country text,body_json text)');
 const stamp=new Date().toISOString(),value={kind:'property',name:'New Agency',url:'https://new.example/properties',found_on:'https://portal.example/property/1',checked_at:stamp};
 const a=await registerSource(sql,value);assert.equal(a.existing,false);assert.equal(a.source.is_active,false);
 const b=await registerSource(sql,{...value,name:'Do not overwrite',url:'https://www.new.example/other'});assert.equal(b.existing,true);assert.equal(b.source.name,'New Agency');
 await assert.rejects(()=>intakeStatus(sql,{id:999},{status:'ready',note:'No original source modification',checked_at:stamp}),/outside/);
 await assert.rejects(()=>activateSource(sql,a.source),/normal refresh/);
 const state={status:'Uspješno',checked_at:stamp,inserted_count:1,updated_count:1,error:null};
 await sql`insert into discovery_runs values(${'registry-'+a.source.id},'Uspješno',${stamp},${JSON.stringify(state)})`;
 await sql`insert into source_candidates values('sample',${'registry-'+a.source.id},'property',${stamp},'NL','{}')`;
 await assert.rejects(()=>activateSource(sql,a.source),/bound contact/);
 await sql`update source_candidates set body_json='{"facts":{"source_contact":{"represents_record":true}}}' where id='sample'`;
 const result=await activateSource(sql,a.source);assert.equal(result.activated,true);
 const [active]=await sql`select is_active from sources where id=${a.source.id}`;assert.equal(active.is_active,true);
 const [config]=await sql`select body_json::jsonb as value from discovery_runs where source_id=${'registry-config-'+a.source.id}`;assert.equal(config.value.shared_structured_property,true);
 const [n]=await sql`select count(*)::int as n from sources`;assert.equal(n.n,1);
 console.log('PostgreSQL intake: idempotent registration, old-source isolation, failed-proof rollback and confirmed activation passed');
}finally{
 await sql.unsafe('set search_path to public');
 await sql.unsafe('drop schema if exists '+schema+' cascade');
 await sql.end();
}
