// Real exported schema and PL/pgSQL in isolated PostgreSQL (PGlite), never production data.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(process.argv[2]+'/package.json'),{PGlite}=require('@electric-sql/pglite');
const root=new URL('../../',import.meta.url),schema=JSON.parse(readFileSync(new URL('ops/pair-review-schema-2026-10-22.json',root),'utf8'));
const db=new PGlite(),exec=s=>db.exec(s),query=(s,p=[])=>db.query(s,p),one=async(s,p=[])=>(await query(s,p)).rows[0];
try{
 await exec('create schema site_private;create role anon;create role authenticated;');
 const tables=new Map();
 for(const c of schema.columns){const key=c.table_schema+'.'+c.table_name;if(!tables.has(key))tables.set(key,[]);tables.get(key).push(c)}
 for(const [table,columns] of tables){const parts=[];for(const c of columns.sort((a,b)=>a.ordinal_position-b.ordinal_position)){
  const d=c.column_default;if(d?.startsWith('nextval(')){const name=d.split("'")[1];await exec(`create sequence if not exists ${c.table_schema}.${name}`)}
  parts.push(`"${c.column_name}" ${c.data_type}${c.is_nullable==='NO'?' not null':''}${d?' default '+d:''}`);
 }await exec(`create table ${table} (${parts.join(',')})`)}
 for(const c of [...schema.constraints].sort((a,b)=>Number(a.definition.includes('FOREIGN'))-Number(b.definition.includes('FOREIGN'))))await exec(`alter table ${c.table_name.includes('.')?c.table_name:'public.'+c.table_name} add constraint ${c.conname} ${c.definition.replace('REFERENCES match_results','REFERENCES public.match_results')}`);
 await exec(readFileSync(new URL('ops/source-sync-indexes-2026-10-24.sql',root),'utf8'));
 for(const f of schema.functions)await exec(f.definition);
 await exec(readFileSync(new URL('ops/source-sync-number-2026-10-24.sql',root),'utf8'));
 // Reproduce the actual deployed definition read before preparation, then apply only the reviewed draft.
 await exec(readFileSync(new URL('ops/source-sync-before-2026-10-24.sql',root),'utf8'));
 const dir=new URL('supabase/migrations/',root),migration=readFileSync(new URL(readdirSync(dir).find(p=>p.endsWith('_buyer_source_criteria.sql')),dir),'utf8');
 await exec(migration);await exec(migration); // repeatability
 for(const signature of ['site_private.source_country_name(text)','site_private.source_buyer_criteria(jsonb)','site_private.source_buyer_interest(jsonb,text)'])for(const role of ['anon','authenticated'])assert.equal((await one("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,signature])).allowed,false);
 assert.equal((await one("select prosecdef from pg_proc where oid='site_private.sync_source_listing(text)'::regprocedure")).prosecdef,false);

 const stamp=new Date().toISOString();
 const base={transaction_type:'buy_request',evidence_excerpt:'TEST ONLY explicitly published property acquisition request',property_types:['Zemljište'],conditions:['Neizgrađeno'],preferred_locations:['Galway coast'],locations:['Galway'],required_criteria:['Road access'],required:{power:true},original_property_types:['residential_development_land'],min_area_m2:900,max_area_m2:1100,area_hard:true,seat_country:'US',preferred_countries:['IE','HR'],buyer_type:'public_authority',listing_kind:'public_buy_request',deadline:'2099-04-30',budget:null};
 const upsert=async(id,f)=>query(`insert into source_candidates(id,source_id,kind,title,country,url,body_json,last_seen) values($1,'test','buyer','TEST ONLY public acquisition','IE',$2,$3,$4) on conflict(id) do update set body_json=excluded.body_json,last_seen=excluded.last_seen`,[id,'https://example.org/call/'+id,JSON.stringify({facts:f}),new Date().toISOString()]);
 const sync=async id=>one('select site_private.sync_source_listing($1) as result',[id]);
 const buyer=async id=>{const r=await one('select i.* from investors i join source_candidates s on s.investor_id=i.id where s.id=$1',[id]);return {...r,criteria:JSON.parse(r.criteria_json)}};
 await upsert('test-full',base);assert.equal((await sync('test-full')).result,'synced');
 let b=await buyer('test-full');assert.equal(b.country,'US');assert.equal(b.preferred_countries,'Irska,Hrvatska');assert.equal(b.max_budget,null);assert.equal(b.verified,0);
 for(const key of ['preferred_locations','locations','required_criteria','required','original_property_types','min_area_m2','max_area_m2','area_hard'])assert.deepEqual(b.criteria[key],base[key],key);
 assert.equal(b.criteria.call_deadline,'2099-04-30');assert.equal(b.criteria.buyer_kind,'Javno tijelo');
 const firstChecked=b.criteria.checked_at;
 await upsert('test-full',{...base,min_area_m2:1200,preferred_countries:['ES'],required_criteria:['Documented road']});await sync('test-full');b=await buyer('test-full');
 assert.equal(b.criteria.min_area_m2,1200);assert.equal(b.preferred_countries,'Španjolska');assert.equal(b.criteria.checked_at,firstChecked,'fetch never extends human verification');
 // Missing/invalid source interest preserves the last applied countries, not the publication country.
 await upsert('test-full',{transaction_type:base.transaction_type,evidence_excerpt:base.evidence_excerpt,preferred_countries:['not-a-country']});await sync('test-full');assert.equal((await buyer('test-full')).preferred_countries,'Španjolska');
 // An unknown budget between two known values must not mark the old auto budget as manual.
 await upsert('budget-gap',{...base,budget:100000});await sync('budget-gap');await upsert('budget-gap',base);await sync('budget-gap');await upsert('budget-gap',{...base,budget:200000});await sync('budget-gap');assert.equal((await buyer('budget-gap')).max_budget,200000);
 // Malformed facts cannot overwrite known requirements or create lifecycle/entity records.
 await upsert('malformed',base);await sync('malformed');let beforeMalformed=await buyer('malformed');
 await upsert('malformed',{...base,required_criteria:{bad:true},preferred_locations:{bad:true},required:['bad'],area_hard:'true',min_area_m2:'900',deadline:{bad:true}});await sync('malformed');let afterMalformed=await buyer('malformed');
 for(const k of ['required_criteria','preferred_locations','required','area_hard','min_area_m2','call_deadline'])assert.deepEqual(afterMalformed.criteria[k],beforeMalformed.criteria[k],k+' malformed source retained prior value');
 await upsert('invalid-top',[]);assert.equal((await sync('invalid-top')).result,'invalid_facts');assert.equal((await one("select count(*)::int n from site_private.listing_lifecycle where candidate_id='invalid-top'")).n,0);
 // Actual later human verification and evidence must remain exactly as entered.
 b=await buyer('test-full');const human={...b.criteria,checked_at:'2026-10-23T10:00:00Z',notes_check:{digest:'manual',checked_at:'2026-10-23T10:00:00Z',evidence:'HUMAN EVIDENCE'}};
 await query('update investors set verified=1,criteria_json=$1 where id=$2',[JSON.stringify(human),b.id]);await upsert('test-full',base);await sync('test-full');b=await buyer('test-full');assert.equal(b.verified,1);assert.equal(b.criteria.checked_at,human.checked_at);assert.deepEqual(b.criteria.notes_check,human.notes_check);
 // Explicit false, [] and removed keys are manual decisions, not missing data to refill.
 const manual={...b.criteria,area_hard:false,preferred_locations:[],min_area_m2:null};delete manual.required;
 await query('update investors set criteria_json=$1,preferred_countries=$2,max_budget=null,notes=$3 where id=$4',[JSON.stringify(manual),'Italija','MANUAL NOTE',b.id]);
 await upsert('test-full',{...base,min_area_m2:1600,area_hard:true,preferred_locations:['Paris'],preferred_countries:['FR'],budget:200000});await sync('test-full');b=await buyer('test-full');
 assert.equal(b.criteria.area_hard,false);assert.deepEqual(b.criteria.preferred_locations,[]);assert.equal(b.criteria.min_area_m2,null);assert(!('required' in b.criteria));assert.equal(b.preferred_countries,'Italija');assert.equal(b.notes,'MANUAL NOTE');
 // A source converging on the manual value must not remove its protection on the next fetch.
 await upsert('test-full',{...base,area_hard:false,preferred_locations:[],preferred_countries:['IT']});await sync('test-full');
 await upsert('test-full',base);await sync('test-full');b=await buyer('test-full');assert.equal(b.criteria.area_hard,false);assert.deepEqual(b.criteria.preferred_locations,[]);assert.equal(b.preferred_countries,'Italija');
 // Missing/null source facts never erase known source values or reopen a closed call.
 await upsert('closed',{...base,source_listing_state:'expired',source_status_evidence:'TEST call closed'});await sync('closed');
 await upsert('closed',{transaction_type:base.transaction_type,evidence_excerpt:base.evidence_excerpt});await sync('closed');
 b=await buyer('closed');assert.equal(b.criteria.call_closed,'TEST call closed');assert.deepEqual(b.criteria.required_criteria,['Road access']);assert.equal((await one("select state from site_private.listing_lifecycle where candidate_id='closed'")).state,'expired');
 await upsert('closed',{...base,source_listing_state:'active',deadline:'2099-05-01'});await sync('closed');assert((await buyer('closed')).criteria.call_closed,'active without reopening evidence is insufficient');
 await upsert('closed',{...base,source_listing_state:'active',deadline:'2099-05-01',reopen_evidence:'TEST explicit reopening notice'});await sync('closed');b=await buyer('closed');assert(!b.criteria.call_closed,'evidenced reopening may clear only an automatic closed flag');
 // Budget is optional; a manual clear of an automatically imported budget remains clear.
 await upsert('budget',{...base,budget:100000});await sync('budget');b=await buyer('budget');await query('update investors set max_budget=null where id=$1',[b.id]);await upsert('budget',{...base,budget:250000});await sync('budget');assert.equal((await buyer('budget')).max_budget,null);
 console.log('Source buyer SQL checks passed: all additional fields, global seat/EU interest, automatic updates, manual null/false/[]/deletion, provenance convergence, preserved human checks, optional budget, closed-call retention and evidenced reopening.');
}catch(e){console.error({message:e.message,detail:e.detail,where:e.where,code:e.code,query:e.query?.slice(0,180)});process.exitCode=1}finally{await db.close()}
