// Real click check of the "Mogući parovi" entry in the rendered Dashboard (jsdom).
// Not part of the app build and not added to package.json. To run, in a folder with
// react@19.2.6, react-dom@19.2.6, lucide-react@1.31.0, jsdom@26.1.0 and esbuild installed:
//   esbuild <sites-review>/app/platform.tsx --bundle --platform=node --format=esm --jsx=automatic \
//     --alias:@/lib=<sites-review>/lib --external:react --external:react-dom --external:lucide-react --outfile=app.mjs
//   esbuild check-possible-pairs-dom.jsx --bundle --platform=node --format=esm --jsx=automatic \
//     --external:jsdom --external:react --external:react-dom --external:./app.mjs --external:./domain-server.mjs --outfile=check.mjs
//   cp <repo>/supabase/functions/sites-platform/domain.mjs domain-server.mjs && node check.mjs
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');const {act}=await import('react');
const {default:Dashboard}=await import('./app.mjs');
const r=(status,score)=>JSON.stringify({status,score,reasons:[],missing:[],rejected:[]});
function dataset(withCandidates){return {properties:[{id:1,title:'Zemljište Galway',country:'Irska',region:'Galway'},{id:2,title:'Stan Split',country:'Hrvatska',city:'Split'},{id:3,title:'Kuća Ljubljana',country:'Slovenija'}],
 investors:[{id:10,name:'Galway County Council'},{id:11,name:'Investitor d.o.o.'}],sources:[],source_candidates:[],discovery_runs:[],
 match_results:[...(withCandidates?[{property_id:1,investor_id:10,result_json:r('Kandidat - potrebna provjera',60)},{property_id:3,investor_id:11,result_json:r('Kandidat - potrebna provjera',40)}]:[]),
  {property_id:2,investor_id:11,result_json:r('Podudaranje kriterija',100)},{property_id:2,investor_id:10,result_json:r('Ne odgovara kriterijima',20)}]};}
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const button=text=>$$('button').find(b=>b.textContent.includes(text));
const setValue=async(el,v)=>{await act(async()=>{const set=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;set.call(el,v);el.dispatchEvent(new window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))})};
async function mount(withCandidates){
 document.body.innerHTML='<div id="root"></div>';
 globalThis.fetch=async()=>({ok:true,json:async()=>dataset(withCandidates)});
 const root=createRoot($('#root'));await act(async()=>{root.render(<Dashboard userName='Luka'/>)});await act(async()=>{await new Promise(r=>setTimeout(r,20))});
 return root;
}
// 1. Count on the overview and a click after stale filters on the matches page.
let root=await mount(true);
let entry=button('Mogući parovi');assert(entry,'button on overview');
assert.equal(entry.querySelector('.nav-count').textContent,'2');
assert.match(entry.getAttribute('aria-label'),/2 za provjeru/);
// Criteria matches stay "Podudaranja kriterija": evaluate never confirms a buyer's interest.
assert(document.body.textContent.includes('Podudaranja kriterija')&&document.body.textContent.includes('Interes kupca još nije potvrđen'));
assert(!document.body.textContent.includes('Potvrđena podudaranja'),'no label suggests confirmed interest');
await act(async()=>{$$('nav button').find(b=>b.textContent.startsWith('Podudaranja')).click()});
await setValue($('input[aria-label="Pretraživanje"]'),'split');
await setValue($('select[aria-label="Država"]'),'Hrvatska');
await setValue($('select[aria-label="Status podudaranja"]'),'Podudaranje kriterija');
assert.equal($$('.match-card').length,1,'stale filters show only the confirmed match');
await act(async()=>{button('Mogući parovi').click()});
assert.equal($('h1').textContent,'Podudaranja');
assert.equal($('select[aria-label="Status podudaranja"]').value,'Kandidat - potrebna provjera');
assert.equal($('input[aria-label="Pretraživanje"]').value,'');
assert.equal($('select[aria-label="Država"]').value,'Sve države');
assert.deepEqual($$('.match-card h3').map(h=>h.textContent),['Zemljište Galway','Kuća Ljubljana']);
assert(!$$('.match-card .pill').some(p=>p.textContent==='Podudaranje kriterija'),'no confirmed match in the candidate view');
// From the overview too.
await act(async()=>{$$('nav button').find(b=>b.textContent.startsWith('Pregled')).click()});
await act(async()=>{button('Mogući parovi').click()});
assert.equal($$('.match-card').length,2);
await act(async()=>root.unmount());
// 2. Zero candidates: count 0, the list is empty and never falls back to other statuses.
root=await mount(false);
entry=button('Mogući parovi');
assert.equal(entry.querySelector('.nav-count').textContent,'0');
assert.match(entry.title,/nema mogućih parova/);
await act(async()=>{entry.click()});
assert.equal($$('.match-card').length,0);
assert.equal($('select[aria-label="Status podudaranja"]').value,'Kandidat - potrebna provjera');
await act(async()=>root.unmount());
// 3. Audit 6342938279 point 1: a public buyer with a US seat and unknown budget can be saved unchanged.
const posts=[];
const kerry={id:12,name:'Kerry County Council',country:'US',min_budget:null,max_budget:null,preferred_countries:'Irska',notes:'Javni oglas',verified:0,
 criteria_json:JSON.stringify({property_types:['Zemljište'],buyer_kind:'Javno tijelo',call_closed:'Rok istekao',call_deadline:'2026-07-10'})};
document.body.innerHTML='<div id="root"></div>';
globalThis.fetch=async(url,options={})=>{if(options.method==='POST'){posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({id:12})}}
 const d=dataset(true);d.investors=[...d.investors,kerry];return {ok:true,json:async()=>d}};
root=createRoot($('#root'));await act(async()=>{root.render(<Dashboard userName='Luka'/>)});await act(async()=>{await new Promise(r=>setTimeout(r,20))});
await act(async()=>{$$('nav button').find(b=>b.textContent.startsWith('Investitori')).click()});
const card=$$('.buyer-card').find(c=>c.textContent.includes('Kerry County Council'));
await act(async()=>{card.querySelector('.card-button').click()});
assert.equal($('input[name="country"]').value,'US','seat outside the EU is shown, not replaced');
assert.equal($('select[name="buyer_kind"]').value,'Javno tijelo');
assert.equal($('input[name="min_budget"]').value,'');assert.equal($('input[name="max_budget"]').value,'');
await act(async()=>{$$('button').find(b=>b.textContent.includes('Spremi promjene')).click()});
await act(async()=>{await new Promise(r=>setTimeout(r,20))});
const record=posts.find(p=>p.action==='save_investor')?.record;
assert(record,'save request sent');
assert.equal(record.country,'US');assert.equal(record.min_budget,null);assert.equal(record.max_budget,null);
const kept=JSON.parse(record.criteria_json);assert.equal(kept.call_closed,'Rok istekao');assert.equal(kept.buyer_kind,'Javno tijelo');
const {investorInput}=await import('./domain-server.mjs');
assert.equal(investorInput(record).max_budget,null,'the server-side validation accepts the same record');
await act(async()=>root.unmount());
// 4. Audit 6342938279 point 2: a note check needs evidence and is bound to the exact note text.
posts.length=0;
document.body.innerHTML='<div id="root"></div>';
const noted={...kerry,id:13,name:'Investitor s bilješkom',country:'Irska',notes:'Samo uz prugu',criteria_json:JSON.stringify({property_types:['Zemljište']})};
globalThis.fetch=async(url,options={})=>{if(options.method==='POST'){posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({id:13})}}
 const d=dataset(true);d.investors=[...d.investors,noted];return {ok:true,json:async()=>d}};
root=createRoot($('#root'));await act(async()=>{root.render(<Dashboard userName='Luka'/>)});await act(async()=>{await new Promise(r=>setTimeout(r,20))});
await act(async()=>{$$('nav button').find(b=>b.textContent.startsWith('Investitori')).click()});
await act(async()=>{$$('.buyer-card').find(c=>c.textContent.includes('Investitor s bilješkom')).querySelector('.card-button').click()});
assert(document.body.textContent.includes('Dodatni uvjeti još nisu provjereni'));
await act(async()=>{$('input[name="notes_confirm"]').click()});
await act(async()=>{$('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}))});
assert(document.body.textContent.includes('upiši bilješku i dokaz provjere'),'no evidence, no check');assert.equal(posts.length,0);
await setValue($('input[name="notes_evidence"]'),'E-pošta ureda 21.10.');
await act(async()=>{$$('button').find(b=>b.textContent.includes('Spremi promjene')).click()});
await act(async()=>{await new Promise(r=>setTimeout(r,20))});
const noteRecord=posts.find(p=>p.action==='save_investor').record,noteCheck=JSON.parse(noteRecord.criteria_json).notes_check;
const server=await import('./domain-server.mjs');
assert.equal(noteRecord.notes,'Samo uz prugu');assert.equal(noteCheck.evidence,'E-pošta ureda 21.10.');
assert.equal(noteCheck.digest,server.digest('Samo uz prugu'));assert(!('notes_confirm' in noteRecord)&&!('notes_evidence' in noteRecord),'draft-only fields are not sent');
assert(server.checkValid(noteCheck,'Samo uz prugu')&&!server.checkValid(noteCheck,'Samo uz prugu i Trešnjevka'));
server.investorInput(noteRecord);
await act(async()=>root.unmount());
// 5. Audit 6342938279 point 5: buyer summary is previewed, copied only after review, never sent.
posts.length=0;let copied=null;
Object.defineProperty(globalThis.navigator,'clipboard',{value:{writeText:async t=>{copied=t}},configurable:true});
document.body.innerHTML='<div id="root"></div>';
globalThis.fetch=async(url,options={})=>{if(options.method==='POST'){posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({})}}
 const d=dataset(true);d.properties[0]={...d.properties[0],title:'Zemljište Galway Oranmore Road 12',source:'https://www.daft.ie/x/5412345',city:'Oranmore',property_type:'Zemljište',area:6120,price:243500};return {ok:true,json:async()=>d}};
root=createRoot($('#root'));await act(async()=>{root.render(<Dashboard userName='Luka'/>)});await act(async()=>{await new Promise(r=>setTimeout(r,20))});
await act(async()=>{button('Mogući parovi').click()});
const galway=$$('.match-card').find(c=>c.textContent.includes('Oranmore Road'));
await act(async()=>{[...galway.querySelectorAll('button')].find(b=>b.textContent==='Nacrt prezentacije').click()});
// Review 6344298344 point 5: the free-text region field is not used; a region needs explicit confirmation.
assert($('textarea[aria-label="Opis za kupca"]').value.includes('Okvirna lokacija: Irska\n'));
await setValue($('input[name="teaser_region"]'),'County Galway');
assert($('textarea[aria-label="Opis za kupca"]').value.includes('Okvirna lokacija: Irska\n'),'typing alone does not confirm');
await act(async()=>{$('input[name="teaser_region_confirmed"]').click()});
const summary=$('textarea[aria-label="Opis za kupca"]').value;
assert(summary.includes('Okvirna lokacija: County Galway, Irska')&&summary.includes('Površina: 6.100 – 6.200 m²'));
for(const secret of ['Oranmore','Road','daft','5412345','243.500'])assert(!summary.includes(secret),'leaked '+secret);
const copyButton=$$('button').find(b=>b.textContent==='Kopiraj opis');
assert.equal(copyButton.disabled,true,'copy needs a review first');
await act(async()=>{$('input[name="teaser_reviewed"]').click()});
await act(async()=>{$$('button').find(b=>b.textContent==='Kopiraj opis').click()});
await act(async()=>{await new Promise(r=>setTimeout(r,10))});
assert.equal(copied,summary);assert(document.body.textContent.includes('Ništa nije poslano'));assert.equal(posts.length,0,'nothing is sent');
await act(async()=>root.unmount());
console.log('React click checks passed: count 2 and 0, stale filters cleared, only candidates shown, criteria matches not labelled as confirmed interest; US-seat buyer with unknown budget saved unchanged; note check needs evidence and binds to the note text; buyer presentation previewed, region only after confirmation, identifier-free, copied after review, not sent.');
