// facts-v1 through supabase/functions/sites-platform/index.js dispatch on an isolated database prepared by
// test_pair_records.py (real exported schema + ops/pair-records.sql + the facts migration). TEST ONLY fixtures.
import {strict as assert} from 'node:assert';
import {readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
const dir=new URL('./supabase/functions/sites-platform/',import.meta.url),copy=new URL('.facts-api-test.mjs',dir);
globalThis.Deno={env:{get:k=>k==='SUPABASE_DB_URL'?process.env.PAIR_DB_URL:undefined},serve:()=>{}};
writeFileSync(copy,readFileSync(new URL('index.js',dir),'utf8').replace("from 'npm:postgres@3.4.7'",'from '+JSON.stringify(pathToFileURL(process.env.PG_MODULE).href))+'\nexport {dispatch};');
let dispatch;try{({dispatch}=await import(copy.href))}finally{rmSync(copy)}
const {MATCH,CANDIDATE,digest,pairText}=await import('./supabase/functions/sites-platform/domain.mjs');
// prepare:false as in the Edge function (index.js database()); a schema change must not hit a cached plan.
const sql=postgres(process.env.PAIR_DB_URL,{max:1,prepare:false,onnotice:()=>{}});
const run=a=>sql.begin(tx=>dispatch(tx,a));
const contact=u=>JSON.stringify({mode:'direct',name:'TEST ONLY',contact_url:u,evidence_url:u,record_reference:u,permitted:true});
const today=new Date().toISOString().slice(0,10),now=new Date().toISOString();
const fact=(value,unit)=>({value,...(unit?{unit}:{}),origin:'izvor',status:'potvrđeno',evidence:'TEST ONLY oglas',observed_on:today});
try{
 const migrations=new URL('./supabase/migrations/',import.meta.url),file=readdirSync(migrations).find(f=>f.endsWith('_property_facts.sql'));
 // Before the migration a save without facts works unchanged; the column is optional for older records.
 const listing='https://example.org/test-only/farm/1';
 const record={title:'TEST ONLY farma',country:'Hrvatska',city:'Osijek',source:listing,price:900000,area:1500000,renovation:0,other_costs:0,property_type:'Zemljište',condition:'Neizgrađeno',
  status:'Aktivno',legal:'Uredno',legal_evidence_url:'https://example.org/test-only/legal',contact_json:contact(listing),activity_evidence:null};
 const {id}=await run({action:'save_property',record});
 await sql`update properties set source_checked_on=${today} where id=${id}`;
 const migration=readFileSync(new URL(file,migrations),'utf8');await sql.unsafe(migration);await sql.unsafe(migration);
 assert.equal((await sql`select facts_json from properties where id=${id}`)[0].facts_json,null,'existing rows keep NULL');
 // Buyer with a documented mandatory requirement; separate request with a wish.
 const demand='https://example.org/test-only/demand/1';
 const [b]=await sql`insert into investors(name,country,preferred_countries,notes,verified,criteria_json,contact_json) values('TEST ONLY kupac','US','Hrvatska','',1,
  ${JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:demand,checked_at:now,requirements:[{key:'land_owned',op:'min',value:150,unit:'ha',mandatory:true,quote:'kupnja 150 ha'}]})},${contact(demand)}) returning id`;
 await run({action:'refresh'});
 let pair=await run({action:'pair',property_id:id,investor_id:b.id});
 let r=JSON.parse(pair.current.result_json);
 assert.equal(r.status,CANDIDATE);assert(r.gaps.property.includes('Uvjet zahtjeva: Zemljište u vlasništvu uključeno u prodaju'),'unknown fact is an open property item');
 assert(pair.tasks.some(t=>t.requirement==='Uvjet zahtjeva: Zemljište u vlasništvu uključeno u prodaju'),'and a review task');
 // Facts saved through the editor path: 150 ha advertised = 110 owned + 40 leased.
 const facts={land_total:fact(150,'ha'),land_owned:fact(110,'ha'),land_leased:fact(40,'ha')};
 const saved=(await sql`select * from properties where id=${id}`)[0];
 await run({action:'save_property',id,record:{...saved,facts_json:JSON.stringify(facts),contact_json:contact(listing)}});
 assert.deepEqual(JSON.parse((await sql`select facts_json from properties where id=${id}`)[0].facts_json),facts);
 pair=await run({action:'pair',property_id:id,investor_id:b.id});
 assert.equal(pair.current,null,'mandatory 150 ha owned is not met by 110 ha owned: the pair leaves the calculation');
 await assert.rejects(run({action:'save_property',id,record:{...saved,facts_json:JSON.stringify({stars:fact(4,'kom')}),contact_json:contact(listing)}}),/Nepoznat podatak/);
 // A wish never blocks: the same buyer with the requirement as a wish is a real opportunity.
 await sql`update investors set criteria_json=${JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:demand,checked_at:now,requirements:[{key:'land_owned',op:'min',value:150,unit:'ha',mandatory:false,quote:'po mogućnosti 150 ha'}]})} where id=${b.id}`;
 await run({action:'refresh'});
 pair=await run({action:'pair',property_id:id,investor_id:b.id});r=JSON.parse(pair.current.result_json);
 assert.equal(r.status,MATCH);assert(r.info.some(v=>/želja nije ispunjena/.test(v)));
 // Module 4: a request with an owned-land basis is compared with the owned area; refresh never changes stored facts.
 await sql`update investors set criteria_json=${JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:demand,checked_at:now,min_area:1500000,area_basis:'zemljište u vlasništvu'})} where id=${b.id}`;
 const factsBefore=(await sql`select facts_json from properties where id=${id}`)[0].facts_json;
 await run({action:'refresh'});
 assert.equal((await sql`select facts_json from properties where id=${id}`)[0].facts_json,factsBefore,'refresh keeps manually entered facts');
 assert.equal((await run({action:'pair',property_id:id,investor_id:b.id})).current,null,'150 ha owned requested, 110 ha owned: no pair');
 await sql`update investors set criteria_json=${JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:demand,checked_at:now,min_area:1500000,area_basis:'zemljište ukupno'})} where id=${b.id}`;
 await run({action:'refresh'});
 r=JSON.parse((await run({action:'pair',property_id:id,investor_id:b.id})).current.result_json);
 assert(r.reasons.includes('Površina (zemljište ukupno)'),'the advertised total is 150 ha');
 // 6464745746 P1: a future observation date is refused on input; a stored one keeps the data but never meets a
 // mandatory requirement (open property item), even when the value would meet it.
 const future={...fact(160,'ha'),observed_on:'2099-01-01'},req150=[{key:'land_owned',op:'min',value:150,unit:'ha',mandatory:true,quote:'kupnja 150 ha'}];
 const cur=(await sql`select * from properties where id=${id}`)[0];
 await assert.rejects(run({action:'save_property',id,record:{...cur,facts_json:JSON.stringify({land_owned:future}),contact_json:contact(listing)}}),/u budućnosti/);
 await sql`update properties set facts_json=${JSON.stringify({land_owned:future})} where id=${id}`;
 await sql`update investors set criteria_json=${JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:demand,checked_at:now,requirements:req150})} where id=${b.id}`;
 await run({action:'refresh'});
 r=JSON.parse((await run({action:'pair',property_id:id,investor_id:b.id})).current.result_json);
 assert.equal(r.status,CANDIDATE);assert(r.gaps.property.includes('Uvjet zahtjeva: Zemljište u vlasništvu uključeno u prodaju'));
 assert.equal(r.requirements[0].state,'future');assert.equal(JSON.parse((await sql`select facts_json from properties where id=${id}`)[0].facts_json).land_owned.observed_on,'2099-01-01','stored data is kept');
 await sql`update properties set facts_json=${JSON.stringify({land_owned:fact(160,'ha')})} where id=${id}`;await run({action:'refresh'});
 assert.equal(JSON.parse((await run({action:'pair',property_id:id,investor_id:b.id})).current.result_json).status,MATCH,'the same fact observed today meets it');
 // 6464745746 P2: an inverted mandatory range (2 ha min above 10 000 m² max) is refused on input; a stored one is an
 // open buyer item, never a rejection of the property or a match.
 const inverted=[{key:'land_owned',op:'min',value:2,unit:'ha',mandatory:true,quote:'najmanje 2 ha'},{key:'land_owned',op:'max',value:10000,unit:'m2',mandatory:true,quote:'najviše 10.000 m2'}];
 const inv=(await sql`select * from investors where id=${b.id}`)[0];
 await assert.rejects(run({action:'save_investor',id:b.id,record:{...inv,criteria_json:JSON.stringify({...JSON.parse(inv.criteria_json),requirements:inverted})}}),/obrnut raspon/);
 await sql`update investors set criteria_json=${JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:demand,checked_at:now,requirements:inverted})} where id=${b.id}`;
 await run({action:'refresh'});
 r=JSON.parse((await run({action:'pair',property_id:id,investor_id:b.id})).current.result_json);
 assert.equal(r.status,CANDIDATE);assert(r.gaps.buyer.includes('Uvjet zahtjeva: Zemljište u vlasništvu uključeno u prodaju'));assert(!r.rejected.length);
 assert.deepEqual(r.requirements.map(q=>q.state),['inverted','inverted']);
 // 6479674515: an empty enum requirement is refused on save (profile and separate request), nothing is written; a
 // stored one is an open buyer item, never a rejection of the property.
 const emptyScope=[{key:'sale_scope',op:'includes',value:[],mandatory:true,quote:'jedan stan'}];
 const before=(await sql`select criteria_json from investors where id=${b.id}`)[0].criteria_json,countBefore=(await sql`select count(*)::int n from investors`)[0].n;
 const inv2=(await sql`select * from investors where id=${b.id}`)[0];
 await assert.rejects(run({action:'save_investor',id:b.id,record:{...inv2,criteria_json:JSON.stringify({...JSON.parse(inv2.criteria_json),requirements:emptyScope})}}),/barem jednu vrijednost/);
 await assert.rejects(run({action:'save_request',investor_id:b.id,label:'Prazan opseg',preferred_countries:'Hrvatska',criteria:{property_types:['Zemljište'],conditions:['Neizgrađeno'],requirements:emptyScope}}),/barem jednu vrijednost/);
 await assert.rejects(run({action:'save_request',investor_id:b.id,label:'Prazna želja',preferred_countries:'Hrvatska',criteria:{property_types:['Zemljište'],conditions:['Neizgrađeno'],requirements:[{...emptyScope[0],mandatory:false}]}}),/barem jednu vrijednost/);
 assert.equal((await sql`select criteria_json from investors where id=${b.id}`)[0].criteria_json,before,'refused save leaves the record');
 assert.equal((await sql`select count(*)::int n from investors`)[0].n,countBefore,'no request row written');
 await sql`update properties set facts_json=${JSON.stringify({sale_scope:fact('jedinica')})} where id=${id}`;
 await sql`update investors set criteria_json=${JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:demand,checked_at:now,requirements:emptyScope})} where id=${b.id}`;
 await run({action:'refresh'});
 r=JSON.parse((await run({action:'pair',property_id:id,investor_id:b.id})).current.result_json);
 assert.equal(r.status,CANDIDATE);assert(r.gaps.buyer.includes('Uvjet zahtjeva: Opseg prodaje'));assert(!r.rejected.length,'no false rejection');
 assert.equal(r.requirements[0].state,'unspecified');
 // Digest stability: a verified pair answer recorded on a property without facts stays valid after the migration.
 const plain=(await sql`select * from properties where id<>${id} limit 1`)[0];
 if(plain)assert.equal(pairText('x',plain),pairText('x',{...plain,facts_json:null}));
 console.log('facts-v1 API: ok');
}finally{await sql.end()}
