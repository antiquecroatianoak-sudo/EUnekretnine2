// Refresh performance fix: the country+type prefilter and skipping unchanged candidate writes must store exactly
// what main's refresh stores. Both versions run from the same state in rolled-back transactions on an isolated
// database (real exported schema + ops/pair-records.sql) prepared by test_pair_records.py. TEST ONLY fixtures.
import {strict as assert} from 'node:assert';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
const dir=new URL('./supabase/functions/sites-platform/',import.meta.url),old=new URL('.refresh-main-test.mjs',dir);
// ops/refresh-reference-b5a507b.mjs is main's refresh at b5a507b, verbatim; it runs beside the same helper modules.
writeFileSync(old,readFileSync(new URL('./ops/refresh-reference-b5a507b.mjs',import.meta.url),'utf8'));
let before,after;
try{({refreshSuggestions:before}=await import(old.href));({refreshSuggestions:after}=await import('./supabase/functions/sites-platform/refresh-suggestions.mjs'))}finally{rmSync(old)}
const {MATCH,CANDIDATE}=await import('./supabase/functions/sites-platform/domain.mjs');
const sql=postgres(process.env.PAIR_DB_URL,{max:1,onnotice:()=>{}});
const contact=u=>JSON.stringify({mode:'direct',name:'TEST ONLY',contact_url:u,evidence_url:u,record_reference:u,permitted:true});
const today=new Date().toISOString().slice(0,10),now=new Date().toISOString();
const snapshot=async tx=>Object.fromEntries((await tx`select property_id,investor_id,result_json from match_results order by 1,2`).map(r=>[r.property_id+'-'+r.investor_id,r.result_json]));
const inRollback=async fn=>{let out;await sql.begin(async tx=>{out=await fn(tx);throw Error('rollback')}).catch(e=>{if(e.message!=='rollback')throw e});return out};
try{
 // Properties: base types, an alias type, an unknown type, several countries (name and ISO), with and without contact.
 const props=[['Zemljište','Hrvatska',true],['Kuća','Hrvatska',true],['Stambena zgrada','Hrvatska',true],['Dvorac','Hrvatska',true],['Zemljište','IE',true],
  ['Zemljište','Slovenija',true],['Stan','Hrvatska',true],['Zemljište','Hrvatska',false],['Poslovni prostor','Irska',true],['Zgrada','Hrvatska',true]];
 let n=0;for(const [type,country,withContact] of props){const u='https://example.org/test-only/p/'+(++n);
  await sql`insert into properties(country,city,title,source,price,price_basis,area,renovation,other_costs,property_type,condition,status,source_checked_on,legal,contact_json)
   values(${country},'Grad',${'TEST ONLY '+n},${u},${100000+n*1000},'asking',${500+n*10},0,0,${type},'Neizgrađeno','Aktivno',${today},'Nepoznato',${withContact?contact(u):null})`;}
 // Two properties with verified legal status can become real opportunities.
 await sql`update properties set legal='Uredno',legal_evidence_url='https://example.org/test-only/legal' where title in ('TEST ONLY 1','TEST ONLY 2','TEST ONLY 5')`;
 // Buyers: verified and unverified, alias types, countries only in criteria, invalid criteria, no contact, several countries.
 const buyers=[['Hrvatska',{property_types:['Zemljište','Kuća'],conditions:['Neizgrađeno']},1,true],
  ['Hrvatska, Irska',{property_types:['zemljišta'],conditions:['Neizgrađeno']},1,true],
  ['',{property_types:['Zgrada','Stan'],conditions:['Neizgrađeno'],preferred_countries:['HR']},0,true],
  ['Slovenija',{property_types:['residential_development_land'],conditions:['Neizgrađeno']},1,true],
  ['Hrvatska',{property_types:['Hotel']},1,true],['Hrvatska',null,1,true],['Hrvatska',{property_types:['Zemljište'],conditions:['Neizgrađeno']},1,false],
  ['Irska',{property_types:['Poslovni prostor'],conditions:['Neizgrađeno'],min_area:100000},1,true]];
 n=0;for(const [countries,c,verified,withContact] of buyers){const u='https://example.org/test-only/d/'+(++n);
  await sql`insert into investors(name,country,preferred_countries,notes,verified,criteria_json,contact_json) values(${'TEST ONLY kupac '+n},'US',${countries},'',${verified},
   ${c?JSON.stringify({...c,source_url:u,checked_at:now}):'{nije json'},${withContact?contact(u):null})`;}
 // 1. From the same empty state both versions store exactly the same results.
 const fromMain=await inRollback(async tx=>{await before(tx);return snapshot(tx)});
 const fromFix=await inRollback(async tx=>{await after(tx);return snapshot(tx)});
 assert.deepEqual(fromFix,fromMain,'same stored pairs and results as main');
 const statuses=Object.values(fromMain).map(v=>JSON.parse(v).status);
 assert(statuses.includes(MATCH)&&statuses.includes(CANDIDATE),'fixture has real opportunities and candidates');
 // 2. After a stored state and a data change, both versions again agree.
 await sql.begin(tx=>before(tx));
 await sql`update properties set price=price+5000,area=area*2 where title='TEST ONLY 1'`;
 await sql`update investors set criteria_json=${JSON.stringify({property_types:['Kuća'],conditions:['Neizgrađeno'],source_url:'https://example.org/test-only/d/1',checked_at:now})} where name='TEST ONLY kupac 1'`;
 assert.deepEqual(await inRollback(async tx=>{await after(tx);return snapshot(tx)}),await inRollback(async tx=>{await before(tx);return snapshot(tx)}),'same results after a change');
 // 3. A repeated refresh without changes rewrites no candidate and adds no history; real opportunities are re-checked.
 await sql.begin(tx=>after(tx));
 const stamp=async()=>Object.fromEntries((await sql`select property_id,investor_id,updated from match_results`).map(r=>[r.property_id+'-'+r.investor_id,r.updated]));
 const history=async()=>(await sql`select count(*)::int n from site_private.pair_history`)[0].n;
 const [s1,h1]=[await stamp(),await history()];
 await new Promise(r=>setTimeout(r,5));await sql.begin(tx=>after(tx));
 const [s2,h2]=[await stamp(),await history()],stored=await snapshot(sql);
 assert.equal(h2,h1,'no history for an unchanged refresh');
 const st3=Object.values(stored).map(v=>JSON.parse(v).status);
 assert(st3.includes(MATCH)&&st3.includes(CANDIDATE),'step 3 checks both a real opportunity and candidates: '+JSON.stringify(st3));
 for(const [k,v] of Object.entries(stored)){const st=JSON.parse(v).status;
  if(st===MATCH)assert.notEqual(s2[k],s1[k],'MATCH '+k+' is re-submitted to the guard');else assert.equal(s2[k],s1[k],'unchanged candidate '+k+' is not rewritten');}
 // 4. A removed pair is still deleted when other candidates were skipped as unchanged.
 await sql`update investors set preferred_countries='Malta' where name='TEST ONLY kupac 1'`;
 await sql.begin(tx=>after(tx));
 const [gone]=await sql`select id from investors where name='TEST ONLY kupac 1'`;
 assert(!Object.keys(await snapshot(sql)).some(k=>k.endsWith('-'+gone.id)),'pairs of a buyer who left the country are removed');
 assert.deepEqual(await snapshot(sql),await inRollback(async tx=>{await before(tx);return snapshot(tx)}),'final state equals main');
 console.log('refresh equivalence: ok');
}finally{await sql.end()}
