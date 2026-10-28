// Module 2: data-completion queue through supabase/functions/sites-platform/index.js dispatch on an isolated database
// prepared by test_pair_records.py (real exported schema + ops/pair-records.sql). TEST ONLY fixtures; nothing is sent.
import {strict as assert} from 'node:assert';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {default:postgres}=await import(pathToFileURL(process.env.PG_MODULE).href);
const dir=new URL('./supabase/functions/sites-platform/',import.meta.url),copy=new URL('.completion-api-test.mjs',dir);
globalThis.Deno={env:{get:k=>k==='SUPABASE_DB_URL'?process.env.PAIR_DB_URL:undefined},serve:()=>{}};
writeFileSync(copy,readFileSync(new URL('index.js',dir),'utf8').replace("from 'npm:postgres@3.4.7'",'from '+JSON.stringify(pathToFileURL(process.env.PG_MODULE).href))+'\nexport {dispatch};');
let dispatch;try{({dispatch}=await import(copy.href))}finally{rmSync(copy)}
const {SOURCE_FRESH}=await import('./supabase/functions/sites-platform/domain.mjs');
const sql=postgres(process.env.PAIR_DB_URL,{max:1,prepare:false,onnotice:()=>{}});
const run=a=>sql.begin(tx=>dispatch(tx,a));
const contact=u=>JSON.stringify({mode:'direct',name:'TEST ONLY',contact_url:u,evidence_url:u,record_reference:u,permitted:true});
const today=new Date().toISOString().slice(0,10),old=new Date(Date.now()-40*86400000).toISOString().slice(0,10),now=new Date().toISOString();
try{
 // A: legal proof missing (only open item). B: legal proof missing and stale source check. C: complete (real opportunity).
 // D: Dutch property with legal proof missing (automatic registry adapter exists).
 const prop=async(name,{country='Hrvatska',checked=today,legal=false}={})=>{const u='https://example.org/test-only/'+name;
  const [p]=await sql`insert into properties(country,city,title,source,price,area,renovation,other_costs,property_type,condition,status,source_checked_on,legal,legal_evidence_url,contact_json)
   values(${country},'Grad',${'TEST ONLY '+name},${u},100000,600,0,0,'Zemljište','Neizgrađeno','Aktivno',${checked},${legal?'Uredno':'Nepoznato'},${legal?'https://example.org/test-only/legal':null},${contact(u)}) returning id`;return Number(p.id)};
 const A=await prop('A'),B=await prop('B',{checked:old}),C=await prop('C',{legal:true}),D=await prop('D',{country:'Nizozemska'});
 // Buyer X has two separate requests; buyer Y one. All verified, Hrvatska + Nizozemska, land.
 const inv=async(name,extra={})=>{const u='https://example.org/test-only/demand/'+name;
  const [i]=await sql`insert into investors(name,country,preferred_countries,notes,verified,criteria_json,contact_json) values(${'TEST ONLY '+name},'US','Hrvatska, Nizozemska','',1,
   ${JSON.stringify({property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:u,checked_at:now,...extra})},${contact(u)}) returning id`;return Number(i.id)};
 const X1=await inv('X1'),X2=await inv('X2',{buyer_identity_id:String(X1),request_label:'Drugi zahtjev'}),Y=await inv('Y');
 // An agency listing that is A's own source; B gets no agency (a portal link alone is not an agency link).
 const [ag]=await sql`insert into sources(country,name,url,category) values('HR','TEST ONLY agencija','https://example.org/test-only/agency','Agencija za nekretnine') returning id`;
 await sql`insert into source_candidates(id,source_id,kind,title,country,url,body_json,last_seen,property_id) values('agency-a',${'registry-'+ag.id},'property','TEST ONLY','HR','https://example.org/test-only/A','{"facts":{}}',${now},${A})`;
 await run({action:'refresh'});
 const pairs=await run({action:'pairs'});
 const q=await run({action:'completion_queue',limit:200});
 // Every stored pair is covered; nothing is hidden or added.
 assert.equal(q.totals.pairs,pairs.match_results.length);assert.equal(q.totals.requests,3);assert.equal(q.totals.buyers,2,'two requests of one buyer are one buyer');
 const item=(side,record,label)=>q.items.find(i=>i.side===side&&String(i.record_id)===String(record)&&i.label===label);
 const legalA=item('property',A,'Dokaz pravne provjere');
 assert.deepEqual(legalA.counts,{pairs:3,requests:3,buyers:2,sole_blocker_pairs:3});
 assert(legalA.why[0].startsWith('Jedina otvorena stavka za 3'));assert.equal(legalA.stale,false);
 assert.equal(legalA.agency?.name,'TEST ONLY agencija','agency only through the record\'s own source listing');
 const legalB=item('property',B,'Dokaz pravne provjere'),freshB=item('property',B,SOURCE_FRESH);
 assert.equal(legalB.counts.sole_blocker_pairs,0,'two open items: neither alone closes the pair');assert.equal(legalB.agency,null);
 assert.equal(freshB.stale,true);
 assert(!q.items.some(i=>String(i.property_id)===String(C)&&i.side==='property'),'a complete property has no property item');
 // Unique items, stable order: sole blockers first.
 assert.equal(new Set(q.items.map(i=>i.key)).size,q.items.length);
 for(let k=1;k<q.items.length;k++){const a=q.items[k-1].counts,b=q.items[k].counts;assert(a.sole_blocker_pairs>b.sole_blocker_pairs||a.sole_blocker_pairs===b.sole_blocker_pairs&&(a.buyers>b.buyers||a.buyers===b.buyers&&a.pairs>=b.pairs))}
 // Paging: one item per page gives exactly the same sequence, without duplicates or gaps, and no overall limit.
 const paged=[];let page={next:0};while(page.next!==null){page=await run({action:'completion_queue',offset:page.next,limit:1});paged.push(...page.items)}
 assert.deepEqual(paged.map(i=>i.key),q.items.map(i=>i.key));
 // Agency filter and groups.
 const byAgency=await run({action:'completion_queue',agency_id:ag.id});
 assert(byAgency.items.length>0&&byAgency.items.every(i=>i.agency?.id==ag.id));assert.equal(q.agencies[0].name,'TEST ONLY agencija');
 // Prior checks follow the property's country: manual in HR, the automatic adapter in NL.
 assert.match(legalA.prior_checks[1],/Hrvatska.*ručna provjera/);assert.match(item('property',D,'Dokaz pravne provjere').prior_checks[1],/Nizozemska.*Kadaster/);
 // Question drafts are drafts: never sent, a seller question never names the buyer.
 for(const i of q.items.filter(i=>i.side==='property')){assert.equal(i.draft.status,'Nacrt — ne šalje se');assert.equal(i.draft.addressed_to,'Prodavatelj');assert(!/TEST ONLY (X|Y)/.test(i.draft.body))}
 // Read-only: no write and no activity entry.
 assert.equal((await sql`select count(*)::int n from activity`)[0].n,0);
 await assert.rejects(run({action:'completion_queue',limit:201}),/Nevaljana stranica/);await assert.rejects(run({action:'completion_queue',side:'x'}),/Nevaljana strana/);
 // With COMPLETION_RESPONSE_OUT set, the real response is saved for check-offer-workflow-dom.jsx.
 if(process.env.COMPLETION_RESPONSE_OUT)writeFileSync(process.env.COMPLETION_RESPONSE_OUT,JSON.stringify({queue:q,agency_page:byAgency,agency_id:Number(ag.id)}));
 console.log('completion queue API: ok');
}finally{await sql.end()}
