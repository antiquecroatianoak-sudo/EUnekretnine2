// Pair API in supabase/functions/sites-platform/index.js against a database prepared by test_pair_records.py
// (real exported schema + ops/pair-records.sql). Needs PAIR_DB_URL and PG_MODULE (path to postgres@3.4.7).
import {strict as assert} from 'node:assert';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
const dir=new URL('./supabase/functions/sites-platform/',import.meta.url),copy=new URL('.pair-api-test.mjs',dir);
globalThis.Deno={env:{get:()=>process.env.PAIR_DB_URL},serve:()=>{}};
writeFileSync(copy,readFileSync(new URL('index.js',dir),'utf8').replace("from 'npm:postgres@3.4.7'",'from '+JSON.stringify(pathToFileURL(process.env.PG_MODULE).href))+'\nexport {dispatch};');
let dispatch;try{({dispatch}=await import(copy.href))}finally{rmSync(copy)}
const {digest,PAIR_CONDITION,MATCH,CANDIDATE,PHASE}=await import('./supabase/functions/sites-platform/domain.mjs');
const sql=postgres(process.env.PAIR_DB_URL,{max:1,onnotice:()=>{}});
const run=a=>sql.begin(tx=>dispatch(tx,a));
const today=new Date().toISOString().slice(0,10),notes='Samo uz tramvajsku prugu';
try{
 const [p]=await sql`insert into properties(country,city,title,source,price,area,renovation,other_costs,property_type,condition,status,source_checked_on,legal,legal_evidence_url)
  values('Hrvatska','Zagreb','TEST zemljište','https://example.org/listing/1',100000,600,0,0,'Zemljište','Neizgrađeno','Aktivno',${today},'Uredno','https://example.org/legal') returning id`;
 const criteria={property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:'https://example.org/demand',checked_at:new Date().toISOString(),
  notes_check:{digest:digest(notes),checked_at:new Date().toISOString(),evidence:'Zahtjev pročitan na izvoru 22.10.'}};
 const [i]=await sql`insert into investors(name,country,min_budget,max_budget,preferred_countries,notes,verified,criteria_json) values('TEST kupac','US',null,null,'Hrvatska',${notes},1,${JSON.stringify(criteria)}) returning id`;
 const ids={property_id:Number(p.id),investor_id:Number(i.id)};
 await run({action:'refresh'});
 let d=await run({action:'pair',...ids});
 let r=JSON.parse(d.current.result_json);
 // Review 6344298344: the confirmed wording of the note does not make this property a match.
 assert.equal(r.status,CANDIDATE);assert.deepEqual(r.missing,[PAIR_CONDITION]);assert.equal(r.phase,PHASE.BUYER);
 assert.equal(d.record.status,CANDIDATE);assert.equal(d.tasks.length,1);assert.equal(d.tasks[0].status,'Otvoreno');
 // Task -> question draft (never sent) -> answer with evidence -> check.
 await run({action:'pair_question',...ids,requirement:PAIR_CONDITION,addressed_to:'Prodavatelj',body:'Koliko je parcela udaljena od tramvajske pruge?'});
 d=await run({action:'pair',...ids});assert.equal(d.tasks[0].status,'U provjeri');assert.equal(d.answers[0].status,'Nacrt');
 await assert.rejects(run({action:'pair_answer',...ids,requirement:PAIR_CONDITION,body:'Uz prugu je',verified:true}),/dokaz, izvor i datum/);
 await run({action:'pair_answer',...ids,requirement:PAIR_CONDITION,body:'Uz prugu je',verified:false});
 d=await run({action:'pair',...ids});assert.equal(JSON.parse(d.current.result_json).status,CANDIDATE,'an unverified answer does not close the item');
 await assert.rejects(run({action:'pair_stage',...ids,stage:'Potvrđen interes',evidence:'x',source:'x',stage_on:today}),/stvarnu priliku/);
 await run({action:'pair_answer',...ids,requirement:PAIR_CONDITION,body:'Parcela je 120 m od pruge.',evidence:'Situacijski nacrt prodavatelja',source:'Prodavatelj',channel:'E-pošta',answered_on:today,verified:true,outcome:'zadovoljava'});
 d=await run({action:'pair',...ids});r=JSON.parse(d.current.result_json);
 assert.equal(r.status,MATCH);assert.equal(r.phase,PHASE.REAL,'a real opportunity, interest still unconfirmed');
 assert.equal(d.tasks[0].status,'Provjereno');assert(!d.stages.length,'matching never records interest');
 // A verified negative answer must remove the current MATCH and block confirmed interest.
 await run({action:'pair_answer',...ids,requirement:PAIR_CONDITION,body:'NIJE uz prugu, udaljena je 20 km',evidence:'Karta i udaljenost 20 km',source:'Prodavatelj',answered_on:today,verified:true,outcome:'ne zadovoljava'});
 d=await run({action:'pair',...ids});assert.equal(d.current,null);assert.equal(d.record.in_latest_calculation,false);
 await assert.rejects(run({action:'pair_stage',...ids,stage:'Potvrđen interes',evidence:'x',source:'x',stage_on:today}),/stvarnu priliku/);
 // A correction is a new answer; the old negative evidence remains in the append-only history.
 await run({action:'pair_answer',...ids,requirement:PAIR_CONDITION,body:'Ispravak: zadovoljava',evidence:'Ispravljena karta',source:'Prodavatelj',answered_on:today,verified:true,outcome:'zadovoljava'});
 d=await run({action:'pair',...ids});assert.equal(JSON.parse(d.current.result_json).status,MATCH);
 // Manual refresh and discovery refresh use precisely the same conditions, including legacy source locations.
 const {sourceConditions,SOURCE_CONDITIONS}=await import('./supabase/functions/sites-platform/domain.mjs');
 const raw={...criteria,preferred_locations:['Uz tramvajsku prugu']};raw.source_conditions_check={digest:digest(sourceConditions(raw)),checked_at:new Date().toISOString(),evidence:'Provjeren izvorni zahtjev'};
 await sql`update investors set criteria_json=${JSON.stringify(raw)} where id=${i.id}`;
 await run({action:'refresh'});d=await run({action:'pair',...ids});
 assert.equal(JSON.parse(d.current.result_json).status,CANDIDATE);assert(JSON.parse(d.current.result_json).missing.includes(SOURCE_CONDITIONS[1][1]));
 const manual=d.current.result_json;
 const {refreshSuggestions:commonRefresh}=await import('./supabase/functions/discovery-sync/refresh-suggestions.mjs');
 await sql.begin(tx=>commonRefresh(tx));d=await run({action:'pair',...ids});assert.deepEqual(JSON.parse(d.current.result_json),JSON.parse(manual));
 await sql`update investors set criteria_json=${JSON.stringify(criteria)} where id=${i.id}`;await run({action:'refresh'});
 // Separate stages with their own evidence, guarded by the database.
 await assert.rejects(run({action:'pair_stage',...ids,stage:'Realiziran posao',evidence:'x',source:'x',stage_on:today}),/potvrđen interes/);
 await run({action:'pair_stage',...ids,stage:'Potvrđen interes',evidence:'Kupac odgovorio na prezentaciju 22.10.',source:'Kupac',stage_on:today});
 // A property change invalidates the pair evidence: the item reopens with the documented reason, history is kept.
 await sql`update properties set area=450 where id=${p.id}`;await run({action:'refresh'});
 d=await run({action:'pair',...ids});
 assert.equal(JSON.parse(d.current.result_json).status,CANDIDATE);
 assert.equal(d.tasks[0].status,'Otvoreno');assert.match(d.tasks[0].status_reason,/Dokaz više ne vrijedi/);
 assert.equal(d.stages[0].stage,'Potvrđen interes','recorded interest is not erased by a recalculation');
 assert(d.history.length>=3&&d.answers.length===5,'history and the evidence log are kept');
 await assert.rejects(run({action:'pair',property_id:'x',investor_id:1}),/Nevaljana oznaka/);
 // discovery-sync recalculation: a pair that drops out is deleted from match_results, but its record and tasks are kept.
 const {refreshSuggestions}=await import('./supabase/functions/discovery-sync/refresh-suggestions.mjs');
 const RealDate=Date, frozen=Date.parse(d.current.result_json&&d.current.updated);
 globalThis.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[frozen]))}static now(){return frozen}};
 try{await sql`update properties set property_type='Kuća' where id=${p.id}`;await run({action:'refresh'});}finally{globalThis.Date=RealDate}

 await assert.rejects(run({action:'pair_stage',...ids,stage:'Potvrđen interes',evidence:'x',source:'x',stage_on:today}),/stvarnu priliku/);
 await sql.begin(tx=>refreshSuggestions(tx));
 assert.equal((await sql`select count(*)::int as n from match_results`)[0].n,0);
 d=await run({action:'pair',...ids});
 assert.equal(d.record.in_latest_calculation,false);assert.equal(d.tasks.length,0);
 assert.equal((await sql`select count(*)::int as n from site_private.pair_task_archive`)[0].n,2,'review tasks archived');
 await sql`update properties set property_type='Zemljište',area=600 where id=${p.id}`;await sql.begin(tx=>refreshSuggestions(tx));
 d=await run({action:'pair',...ids});
 assert.equal(d.record.in_latest_calculation,true);assert.equal(d.current&&JSON.parse(d.current.result_json).status,MATCH,'the same verified evidence counts again for the unchanged facts');
 assert.equal(d.tasks.length,2,'the archived tasks are restored, not duplicated');assert.notEqual(d.tasks[0].status,'Otvoreno','the item is closed again by the unchanged evidence');
 assert.equal((await sql`select count(*)::int as n from site_private.pair_task_archive`)[0].n,0);
 console.log('Pair API checks passed: task, draft question, unverified and verified answers, pair-bound evidence, interest guard, invalidation on property change, record kept when discovery-sync drops a pair.');
}finally{await sql.end()}
