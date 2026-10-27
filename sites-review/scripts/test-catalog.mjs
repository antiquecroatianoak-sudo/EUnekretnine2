// Runs the production keyset queries in an isolated PostgreSQL engine (PGlite); no live records.
// Usage: node sites-review/scripts/test-catalog.mjs /absolute/folder/with/node_modules
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {catalogPage} from '../../supabase/functions/sites-platform/catalog.mjs';
import {suggestion} from '../../supabase/functions/sites-platform/suggestions.mjs';
const require=createRequire(process.argv[2]+'/package.json'),{PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
// Adapter changes only parameter transport; catalogPage's SQL executes unchanged in PostgreSQL.
const fragment=Symbol('SQL');
const raw=text=>({[fragment]:true,compile:()=>text});
function tx(parts,...values){
 if(typeof parts==='string')return raw('"'+parts.replaceAll('"','""')+'"');
 const f={[fragment]:true,compile(params){return parts.reduce((s,p,i)=>s+(i?(values[i-1]?.[fragment]?values[i-1].compile(params):(params.push(values[i-1]),'$'+params.length)):'')+p,'')}};
 f.then=(resolve,reject)=>{const params=[],query=f.compile(params);return db.query(query,params).then(r=>r.rows).then(resolve,reject)};return f;
}
tx.unsafe=raw;
try{
 await db.exec(`create schema site_private;
 create table source_candidates(id text primary key,property_id bigint,investor_id bigint,kind text,url text,body_json text);
 create table site_private.listing_lifecycle(candidate_id text,state text);
 create function site_private.safe_stamp(v text) returns timestamptz language sql stable as 'select v::timestamptz';
 create function site_private.safe_json(v text) returns jsonb language sql immutable as 'select v::jsonb';
 create table properties(id bigint primary key,title text,country text,city text,region text,legal text,price real,bid_deadline_at timestamptz,available_until text,status text,source text);
 create table investors(id bigint primary key,name text,country text,preferred_countries text,verified int);
 insert into properties select n,'TEST ONLY '||n,'Hrvatska','Zagreb','Grad Zagreb','Uredno',100000,null,null,'Aktivno','https://example.org/listing/'||n from generate_series(1,10125) n;
 insert into investors select n,'TEST ONLY '||n,'US','Hrvatska',1 from generate_series(1,10042) n;
 insert into source_candidates(id,property_id,investor_id) values('expired','2',null);insert into site_private.listing_lifecycle values('expired','expired');`);
 await db.exec('alter table properties add column auction_at timestamptz');
 for(const table of ['properties','investors']){
  let after=0,through=null,ids=[];
  do{const page=await catalogPage(tx,{table,after,through,limit:137});
   assert(page.items.length<=137);assert.equal(page.total,table==='properties'?10124:10042);
   ids.push(...page.items.map(r=>Number(r.id)));through=page.through;after=page.next;
  }while(after!==null);
  assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,table==='properties'?10124:10042);
  assert(ids.includes(table==='properties'?10125:10042),'records beyond 10,000 are reachable');
 }
 let page=await catalogPage(tx,{table:'properties',limit:3});
 await db.exec(`delete from properties where id=1;insert into properties values(10126,'NEW','Hrvatska','Zagreb','','Uredno',2,null,null,'Aktivno','https://example.org/listing/10126',null)`);
 const next=await catalogPage(tx,{table:'properties',after:page.next,through:page.through,limit:3});
 assert.deepEqual(next.items.map(r=>Number(r.id)),[5,6,7],'deletion before cursor cannot skip a row');
 assert.equal(next.through,10125,'new insert waits until refresh');
 page=await catalogPage(tx,{table:'properties',query:'TEST ONLY 10125',country:'Hrvatska'});
 assert.equal((await catalogPage(tx,{table:'properties',record_id:10125})).items[0].id,10125);
 assert.equal(page.total,1);assert.equal(Number(page.items[0].id),10125,'search reaches beyond the initial page');
 assert.equal((await catalogPage(tx,{table:'properties',query:"' or 1=1 --"})).total,0,'query is literal, not SQL');
 assert.equal((await catalogPage(tx,{table:'properties',query:'%'})).total,0,'wildcards are literal');
 await assert.rejects(catalogPage(tx,{table:'properties',after:-1}));
 await assert.rejects(catalogPage(tx,{table:'secrets'}));await assert.rejects(catalogPage(tx,{table:'properties',record_id:'bad'}));
 await assert.rejects(catalogPage(tx,{table:'properties',limit:10001}));
 const testContact=source=>({mode:'direct',name:'TEST ONLY',contact_url:source,evidence_url:source,record_reference:source,permitted:true});
 const now=Date.now(),p={contact_json:testContact('https://example.org/10125'),...page.items[0],source:'https://example.org/10125',area:1000,renovation:0,other_costs:0,property_type:'Zemljište',condition:'Neizgrađeno',legal_evidence_url:'https://example.org/legal',source_checked_on:new Date(now).toISOString(),status:'Aktivno'};
 const i={contact_json:testContact('https://example.org/buyer'),...(await catalogPage(tx,{table:'investors',query:'TEST ONLY 10042'})).items[0],criteria_json:{property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:'https://example.org/buyer',checked_at:new Date(now).toISOString()}};
 assert.equal(Number(p.id),10125);assert.equal(Number(i.id),10042);
 assert.equal(suggestion(p,i,now).status,'Podudaranje kriterija','real evaluator accepts reachable records beyond both old caps');
 // Legacy/manual auction rows may have no source candidate and no other
 // deadline. A stale Aktivno label cannot keep an elapsed auction visible.
 await db.exec('begin');
 for(const [interval,visible] of [['-1 second',0],['0 seconds',0],['1 day',1]]){
  await db.query('update properties set auction_at=now()+$1::interval where id=10126',[interval]);
  assert.equal((await catalogPage(tx,{table:'properties',record_id:10126})).total,visible,'auction '+interval);
 }
 await db.exec('update properties set auction_at=null where id=10126');
 assert.equal((await catalogPage(tx,{table:'properties',record_id:10126})).total,1,'unknown auction date remains visible');
 await db.exec("update properties set auction_at=now()+interval '1 day',bid_deadline_at=now()-interval '1 second' where id=10126");
 assert.equal((await catalogPage(tx,{table:'properties',record_id:10126})).total,0,'future auction never overrides an elapsed bidding deadline');
 await db.exec('rollback');
 console.log('Catalog PostgreSQL checks passed: 10,125 properties and 10,042 buyers, complete keyset traversal, lifecycle exclusion, no duplicates/skips, high-water insert boundary, full search and matching beyond 10,000.');
}finally{await db.close()}
