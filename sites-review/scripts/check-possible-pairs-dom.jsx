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
// Each test section installs a mock of the full read and of storing actions. The installed mock is wrapped so
// responses also offer text() (the dashboard parses text to report invalid bodies), and the separate `pairs` read
// is answered from the same mocked dataset without being recorded as a storing action.
let mockFetch,pairsMode='ok';
const respond=r=>({status:r.ok?200:500,...r,text:r.text||(async()=>JSON.stringify(await r.json()))});
Object.defineProperty(globalThis,'fetch',{configurable:true,set:v=>{mockFetch=v},get:()=>async(url,options={})=>{
 let body=null;try{body=JSON.parse(options.body||'null')}catch{}
 if(options.method==='POST'&&body?.action==='pairs'){
  if(pairsMode==='fail')return respond({ok:false,status:504,json:async()=>({error:'Gateway timeout'})});
  const d=await (await mockFetch(url,{})).json();
  return respond({ok:true,json:async()=>({match_results:d.match_results,properties:d.properties,investors:d.investors,totals:{properties:d.properties.length,investors:d.investors.length}})});
 }
 return respond(await mockFetch(url,options));
}});
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
assert.equal($('input[name="area_hard"]').checked,false,'area tolerance applies unless the buyer set a hard limit');
await act(async()=>{$('input[name="area_hard"]').click()});
await act(async()=>{$$('button').find(b=>b.textContent.includes('Spremi promjene')).click()});
await act(async()=>{await new Promise(r=>setTimeout(r,20))});
const record=posts.find(p=>p.action==='save_investor')?.record;
assert(record,'save request sent');
assert.equal(record.country,'US');assert.equal(record.min_budget,null);assert.equal(record.max_budget,null);
const kept=JSON.parse(record.criteria_json);assert.equal(kept.call_closed,'Rok istekao');assert.equal(kept.buyer_kind,'Javno tijelo');assert.equal(kept.area_hard,true,'an explicit hard area limit is saved');
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
 const d=dataset(true);d.properties[1]={...d.properties[1],title:'Zemljište Galway Oranmore Road 12',country:'Irska',source:'https://www.daft.ie/x/5412345',city:'Oranmore',region:'Galway',property_type:'Zemljište',area:6120,price:243500,price_basis:'Asking price'};return {ok:true,json:async()=>d}};
root=createRoot($('#root'));await act(async()=>{root.render(<Dashboard userName='Luka'/>)});await act(async()=>{await new Promise(r=>setTimeout(r,20))});
await act(async()=>{button('Podudaranja').click()});
// A presentation is prepared only from a real opportunity (owner 6344490047), not from a possible pair.
assert($$('.match-card').filter(c=>[...c.querySelectorAll('button')].some(b=>b.textContent==='Nacrt prezentacije')).every(c=>c.textContent.includes('Podudaranje kriterija')));
const galway=$$('.match-card').find(c=>c.textContent.includes('Oranmore Road'));
await act(async()=>{[...galway.querySelectorAll('button')].find(b=>b.textContent==='Nacrt prezentacije').click()});
// Review 6344298344 point 5: the free-text region field is not used; a region needs explicit confirmation.
assert($('textarea[aria-label="Opis za kupca"]').value.includes('Okvirna lokacija: Irska\n'));
await setValue($('input[name="teaser_region"]'),'County Galway');
assert($('textarea[aria-label="Opis za kupca"]').value.includes('Okvirna lokacija: Irska\n'),'typing alone does not confirm');
await act(async()=>{$('input[name="teaser_region_confirmed"]').click()});
const summary=$('textarea[aria-label="Opis za kupca"]').value;
assert(summary.includes('Okvirna lokacija: County Galway, Irska')&&summary.includes('Površina: 6.100 – 6.200 m²')&&summary.includes('Tražena cijena: 200.000 – 250.000 €'));
for(const secret of ['Oranmore','Road','daft','5412345','243.500'])assert(!summary.includes(secret),'leaked '+secret);
const copyButton=$$('button').find(b=>b.textContent==='Kopiraj opis');
assert.equal(copyButton.disabled,true,'copy needs a review first');
await act(async()=>{$('input[name="teaser_reviewed"]').click()});
await act(async()=>{$$('button').find(b=>b.textContent==='Kopiraj opis').click()});
await act(async()=>{await new Promise(r=>setTimeout(r,10))});
assert.equal(copied,summary);assert(document.body.textContent.includes('Ništa nije poslano'));assert.equal(posts.length,0,'nothing is sent');
await act(async()=>root.unmount());
// 6. Pair detail: task -> question draft -> answer with evidence; nothing is sent, only stored through the API.
posts.length=0;document.body.innerHTML='<div id="root"></div>';
const gapsResult=JSON.stringify({status:'Kandidat - potrebna provjera',phase:'Mogući par – dopuna podataka o nekretnini',score:60,reasons:['Država','Vrsta nekretnine'],missing:['Dokaz pravne provjere','Aktualnost izvora nekretnine nije potvrđena unutar 30 dana','Ispunjenje dodatnih uvjeta kupca za ovu nekretninu'],rejected:[],info:['Ukupni trošak iznad navedenog budžeta kupca (informativno)'],
 gaps:{property:['Dokaz pravne provjere','Aktualnost izvora nekretnine nije potvrđena unutar 30 dana'],buyer:[],pair:['Ispunjenje dodatnih uvjeta kupca za ovu nekretninu']}});
globalThis.fetch=async(url,options={})=>{
 if(options.method==='POST'){const b=JSON.parse(options.body);posts.push(b);
  if(b.action==='pair')return {ok:true,json:async()=>({record:{first_seen_at:'2026-10-22T10:00:00Z',in_latest_calculation:true},history:[{id:1,recorded_at:'2026-10-22T10:00:00Z',event:'Prvi izračun',phase:'Mogući par – dopuna podataka o nekretnini'}],
   tasks:[{requirement:'Dokaz pravne provjere',status:'Otvoreno'},{requirement:'Aktualnost izvora nekretnine nije potvrđena unutar 30 dana',status:'Otvoreno'},{requirement:'Ispunjenje dodatnih uvjeta kupca za ovu nekretninu',status:'Otvoreno'}],answers:[],stages:[],current:{result_json:gapsResult}})};
  if(b.action==='source_check'&&!b.evidence)return {ok:false,json:async()=>({error:'Nedostaje ili je predug podatak: dokaz provjere izvora.'})};
  if(b.action==='pair_answer'&&b.verified&&!b.evidence)return {ok:false,json:async()=>({error:'Za provjeren odgovor potrebni su dokaz, izvor i datum.'})};
  return {ok:true,json:async()=>({id:1})}}
 const d=dataset(true);d.match_results[0].result_json=gapsResult;return {ok:true,json:async()=>d}};
root=createRoot($('#root'));await act(async()=>{root.render(<Dashboard userName='Luka'/>)});await act(async()=>{await new Promise(r=>setTimeout(r,20))});
await act(async()=>{button('Mogući parovi').click()});
const pairCard=$$('.match-card').find(c=>c.textContent.includes('Zemljište Galway'));
assert(![...pairCard.querySelectorAll('button')].some(b=>b.textContent==='Nacrt prezentacije'),'no presentation from a possible pair');
await act(async()=>{[...pairCard.querySelectorAll('button')].find(b=>b.textContent==='Detalj para').click()});
await act(async()=>{await new Promise(r=>setTimeout(r,20))});
assert.deepEqual(posts.at(-1),{action:'pair',property_id:1,investor_id:10});
const dialog=$('[role="dialog"]');
for(const t of ['Podaci o nekretnini (pitanja prodavatelju)','Provjera za ovaj par','Podudaranje kriterija nije potvrđen interes','Ukupni trošak iznad navedenog budžeta kupca (informativno)'])assert(dialog.textContent.includes(t),t);
assert.equal($$('button').find(b=>b.textContent==='Zabilježi fazu uz dokaz').disabled,true,'no interest stage for a possible pair');
await act(async()=>{$$('button').filter(b=>b.textContent==='Nacrt pitanja')[0].click()});
const draftText=$('textarea[aria-label="Nacrt pitanja"]').value;
assert(draftText.includes('zemljišne knjige')&&!draftText.includes('Galway County Council'),'seller question never names the buyer');
await act(async()=>{$$('button').find(b=>b.textContent==='Spremi nacrt').click()});await act(async()=>{await new Promise(r=>setTimeout(r,10))});
assert.deepEqual(posts.find(b=>b.action==='pair_question'),{action:'pair_question',property_id:1,investor_id:10,requirement:'Dokaz pravne provjere',addressed_to:'Prodavatelj',body:draftText});
await act(async()=>{$$('button').filter(b=>b.textContent==='Upiši odgovor')[2].click()});
await setValue($('textarea[aria-label="Odgovor"]'),'Parcela je 120 m od pruge.');
await act(async()=>{$('input[name="answer_verified"]').click()});
await act(async()=>{$$('button').find(b=>b.textContent==='Spremi odgovor').click()});await act(async()=>{await new Promise(r=>setTimeout(r,10))});
assert(document.body.textContent.includes('potrebni su dokaz, izvor i datum'),'the server refusal is shown');
await setValue($('select[name="outcome"]'),'ne zadovoljava');
await setValue($('input[name="evidence"]'),'Situacijski nacrt');await setValue($('input[name="source"]'),'Prodavatelj');
await act(async()=>{$$('button').find(b=>b.textContent==='Spremi odgovor').click()});await act(async()=>{await new Promise(r=>setTimeout(r,10))});
const answer=posts.filter(b=>b.action==='pair_answer').at(-1);
assert.equal(answer.requirement,'Ispunjenje dodatnih uvjeta kupca za ovu nekretninu');assert.equal(answer.verified,true);assert.equal(answer.evidence,'Situacijski nacrt');assert.equal(answer.outcome,'ne zadovoljava','verification and fulfilment are separate UI fields');
// Review 6361220363: an explicit, evidenced source check; no date is filled in automatically.
assert.equal($$('button').filter(b=>b.textContent==='Zabilježi provjeru izvora').length,1,'offered only for the source item');
await act(async()=>{$$('button').find(b=>b.textContent==='Zabilježi provjeru izvora').click()});
assert.equal($('input[name="checked_on"]').value,'','no automatic date');
await setValue($('input[name="checked_on"]'),'2026-10-23');
await act(async()=>{$$('button').find(b=>b.textContent==='Spremi provjeru izvora').click()});await act(async()=>{await new Promise(r=>setTimeout(r,10))});
assert(document.body.textContent.includes('dokaz provjere izvora'),'the refusal without evidence is shown');
await setValue($('input[name="source_evidence"]'),'Oglas otvoren 23.10., aktivan');await setValue($('select[name="source_status"]'),'Aktivno');
await act(async()=>{$$('button').find(b=>b.textContent==='Spremi provjeru izvora').click()});await act(async()=>{await new Promise(r=>setTimeout(r,10))});
assert.deepEqual(posts.filter(b=>b.action==='source_check').at(-1),{action:'source_check',property_id:1,investor_id:10,checked_on:'2026-10-23',evidence:'Oglas otvoren 23.10., aktivan',status:'Aktivno'});
assert(posts.every(b=>['pair','pair_question','pair_answer','source_check'].includes(b.action)),'only storing actions, no sending');
await act(async()=>root.unmount());
// 7. Visibility (6361512242, 6364207005, 6369410657): a failed or oversized full read must not hide stored pairs,
// a failed pairs read is not a zero, a real zero is explained, hidden links are counted, diagnostics are counts only.
const mountWith=async(fn,mode='ok')=>{pairsMode=mode;posts.length=0;document.body.innerHTML='<div id="root"></div>';globalThis.fetch=fn;
 const r=createRoot($('#root'));await act(async()=>{r.render(<Dashboard userName='Luka'/>)});await act(async()=>{await new Promise(x=>setTimeout(x,30))});return r};
const htmlTimeout={ok:false,status:504,json:async()=>{throw SyntaxError('Unexpected token <')},text:async()=>'<html>Gateway Timeout</html>'};
const split=async(fullOk,pairsOk,data=dataset(true))=>mountWith(async(url,options={})=>{
 if(options.method==='POST'){posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({funnel:{properties:3,investors:2,pairs:6,country_mismatch:3,suggested:{'Kandidat - potrebna provjera':2,'Podudaranje kriterija':1},excluded:{'Vrsta nekretnine nije među traženima':0},properties_without_type:0,properties_without_source:0,investors_without_types:0,investors_without_source:0},stored:{total:4,matches:1,candidates:3},checked_at:'2026-10-23T12:00:00Z'})}}
 if(options.cache==='no-store'&&!fullOk)return htmlTimeout;
 return {ok:true,json:async()=>data};
},pairsOk?'ok':'fail');
// (a) the full read fails with a non-JSON gateway page; pairs still load from their own read.
root=await split(false,true);
assert(document.body.textContent.includes('HTTP 504'),'the full-read failure is shown with its status');
assert.equal(button('Mogući parovi').querySelector('.nav-count').textContent,'2','pairs come from their own read');
await act(async()=>{button('Mogući parovi').click()});
assert.equal($$('.match-card').length,2,'possible pairs are listed although the full read failed');
assert(document.body.textContent.includes('Puni pregled nije učitan'));
await act(async()=>root.unmount());
// (b) pairs read fails, full read works: the full read still provides the list, with an explicit note.
root=await split(true,false);
assert.equal(button('Mogući parovi').querySelector('.nav-count').textContent,'2');
await act(async()=>{button('Mogući parovi').click()});
assert(document.body.textContent.includes('Mogući parovi nisu učitani zasebno'));assert.equal($$('.match-card').length,2);
await act(async()=>root.unmount());
// (c) both fail: never a zero.
root=await split(false,false);
assert.equal(button('Mogući parovi').querySelector('.nav-count').textContent,'?','an unknown count is not 0');
await act(async()=>root.unmount());
// (d) a real zero is explained.
root=await split(true,true,dataset(false));
await act(async()=>{button('Mogući parovi').click()});
assert.equal(button('Mogući parovi').querySelector('.nav-count').textContent,'0');
assert(document.body.textContent.includes('Nema mogućih parova za provjeru: spremljeno je 2 rezultata'),'a real zero says what is stored');
// (e) diagnostics are counts only, opened on request.
await act(async()=>{button('Zašto nema više parova?').click()});await act(async()=>{await new Promise(x=>setTimeout(x,10))});
assert.deepEqual(posts.at(-1),{action:'pair_diagnostics'});
assert(document.body.textContent.includes('Svi mogući parovi (nekretnina × kupac)')&&document.body.textContent.includes('Spremljeno u bazi: 4'));
await act(async()=>root.unmount());
// (f) a stored pair whose property left the visible list is counted, not silently dropped.
const withHidden=dataset(true);withHidden.properties[0]={...withHidden.properties[0],visible:false};
root=await split(true,true,withHidden);
await act(async()=>{button('Mogući parovi').click()});
assert.equal($$('.match-card').length,1);assert(document.body.textContent.includes('1 skriveno jer nekretnina je istekla ili uklonjena iz izvora'));
await act(async()=>root.unmount());
console.log('React click checks passed: count 2 and 0, stale filters cleared, only candidates shown, criteria matches not labelled as confirmed interest; US-seat buyer with unknown budget saved unchanged; note check needs evidence and binds to the note text; presentation only for real opportunities, region only after confirmation, identifier-free, copied after review, not sent; pair detail stores drafts, answers and source checks with evidence only; pairs load separately, failures are not zeros, a real zero is explained, hidden links are counted.');
