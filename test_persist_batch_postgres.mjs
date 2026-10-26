import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {persistBatch} from './supabase/functions/registry-discovery/persist-batch.mjs';
const require=createRequire(process.argv[2]+'/package.json'),{PGlite}=require('@electric-sql/pglite');
const db=new PGlite();let calls=0;
async function tx(parts,...values){calls++;const params=[],query=parts.reduce((s,p,i)=>s+(i?(params.push(values[i-1]),'$'+params.length):'')+p,'');return (await db.query(query,params)).rows}
try{
 await db.exec(`create schema site_private;
 create table source_candidates(id text primary key,source_id text,kind text,title text,country text,url text,body_json text,last_seen text,property_id bigint);
 create table sync_log(id text primary key,n int default 0);
 create function site_private.sync_source_listing(cid text) returns text language plpgsql as $$begin insert into sync_log(id,n) values(cid,1) on conflict(id) do update set n=sync_log.n+1;return 'synced';end$$;`);
 const source={id:1,country:'HR',url:'https://example.org/'};
 const row=(n,extra={})=>({id:'test-'+n,source_id:'registry-1',kind:'property',title:'TEST ONLY listing '+n,country:'HR',url:'https://example.org/'+n,first_seen:'2026-10-20T00:00:00Z',last_seen:'2026-10-26T00:00:00Z',verified:false,facts:{area:100},...extra});
 let result=await persistBatch(tx,Array.from({length:100},(_,n)=>row(n)),source);
 assert.deepEqual(result,{inserted:100,updated:0});assert.equal(calls,3,'100 records take only three database round trips');
 assert.equal((await db.query('select count(*)::int n from source_candidates')).rows[0].n,100);
 await db.query('update source_candidates set body_json=$1,property_id=42 where id=$2',[JSON.stringify({...row(0),verified:true,status:'Ručno provjereno',facts:{area:100,manual_note:'KEEP',source_listing_state:'removed'}}),'test-0']);
 calls=0;
 result=await persistBatch(tx,[row(0,{id:'new-id',url:'https://example.org/0/'}),row(100),row(100,{id:'duplicate-url',title:'TEST ONLY latest detail'})],source);
 assert.deepEqual(result,{inserted:1,updated:2});assert.equal(calls,3);
 const retained=(await db.query("select * from source_candidates where id='test-0'")).rows[0],body=JSON.parse(retained.body_json);
 assert.equal(retained.property_id,42);assert.equal(body.verified,true);assert.equal(body.facts.manual_note,'KEEP');assert.equal(body.facts.source_listing_state,'removed');
 assert.equal((await db.query("select title from source_candidates where id='test-100'")).rows[0].title,'TEST ONLY latest detail');
 assert.equal((await db.query("select count(*)::int n from source_candidates where id in ('new-id','duplicate-url')")).rows[0].n,0);
 const before=retained.body_json;
 await persistBatch(tx,[row(0,{last_seen:'2026-10-21T00:00:00Z',title:'STALE'})],source);
 assert.equal((await db.query("select body_json from source_candidates where id='test-0'")).rows[0].body_json,before,'old reply never overwrites fresh state');
 calls=0;assert.deepEqual(await persistBatch(tx,[],source),{inserted:0,updated:0});assert.equal(calls,0);
 console.log('Batch persistence PostgreSQL checks passed: 100 rows/3 calls, URL deduplication, existing ID/entity/manual review/closure preservation and stale-write guard.');
}finally{await db.close()}
