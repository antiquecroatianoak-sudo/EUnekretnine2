// Click check of the final review / offer panel and the buyer requests panel (jsdom), plan #46.
// With WORKFLOW_RESPONSE set (written by test_offer_workflow.mjs on an isolated database) the real API responses
// are rendered; otherwise a small synthetic TEST ONLY response. Run through ops/run-dom-check.sh.
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');const {act}=await import('react');
const {OfferWorkflow}=await import('../app/offer-workflow.tsx');const {FactsEditor,RequirementsTable}=await import('../app/facts-editor.tsx');const {BuyerRequests}=await import('../app/buyer-requests.tsx');
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],button=t=>$$('button').find(b=>b.textContent.trim()===t);
const wait=()=>act(async()=>{await new Promise(r=>setTimeout(r,20))});
async function setValue(el,v){const proto=el.tagName==='SELECT'?window.HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;
 await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);el.dispatchEvent(new window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))})}
const field=label=>$$('label.field').find(l=>l.querySelector('span')?.textContent===label)?.querySelector('input,select,textarea');
// Synthetic fallback in the shape of the real response.
const presentation={code:'EU-TEST',title:'Odabrana nekretnina za vaše potrebe',subtitle:'Povjerljivi pregled investicijske prilike',description:'Okvirni opis nekretnine za procjenu interesa (nije ponuda):\nVrsta nekretnine: Zemljište',request:['Vrsta: Zemljište'],reasons:['Odgovara traženoj državi'],availability:'Dostupnost i uvjete potrebno je potvrditi prije odluke.',next:'',photos:'Fotografije nisu priložene.',withheld:[]};
const synthetic={workflow:{property:{id:'1',title:'TEST ONLY Lukavec',source:'https://example.org/l/1',legal_evidence_url:'https://example.org/legal'},investor:{id:'2',name:'TEST ONLY kupac',criteria_json:JSON.stringify({request_label:'Zemljište',source_url:'https://example.org/d/1'})},
 result:{status:'Podudaranje kriterija'},stored:{status:'Podudaranje kriterija'},sides:{met:['Država'],deviates:[],missing:{property:[],buyer:[],pair:[],other:[]}},tasks:[],change:{kind:'Novo',detail:'Prvi put u izračunu'},
 readiness:{ready:true,blockers:[],fit:100,reliability:'Provjere para su dovršene; interes nije potvrđen'},contacts:{seller:{label:'Izravan kontakt',name:'TEST ONLY'},buyer:{label:'Kontakt preko agencije',name:'TEST ONLY agencija kupca'}},business_phase:true,
 offers:[{id:'10',number:1,presentation,current:true,approved:true,approved_on:'2026-10-27',responses:[{id:'12',offer_id:'10',response:'Zainteresiran',body:'Zanima nas.',evidence:'E-pošta',channel:'E-pošta',respondent:'TEST ONLY',responded_on:'2026-10-27',version_current:true}]},
  {id:'11',number:2,presentation:{...presentation,code:'EU-TEST2'},current:true,approved:false,approved_on:null,responses:[]}],
 effective:{response:{id:'12',type:'response',offer_id:'10',version:1,response:'Zainteresiran',responded_on:'2026-10-27',version_current:true},ambiguous:false,reason:null},
 history:[{id:'9',type:'response',offer_id:'10',response:'Interes povučen',body:'Povlačimo.',responded_on:new Date().toISOString().slice(0,10),version_current:true},{id:'12',type:'response',offer_id:'10',response:'Zainteresiran',responded_on:'2026-10-27',version_current:true},
  {id:'8',type:'handoff',offer_id:'10',version:1,agency_name:'TEST ONLY stara agencija',sharing_permission:'Suglasnost',fee_payer:'Agencija',fee_due:'Tek nakon uspješno dovršene prodaje',fee_terms:'2 %',status:'Interni paket — nije poslan',prepared_at:'2026-10-26T10:00:00Z',validity:{valid:false,reasons:['Važeći odgovor kupca (2026-10-27) je: Interes povučen'],checked_at:'2026-10-27T10:00:00Z'},buyer_response:{},contacts:{},documents:{}},
  {id:'13',type:'handoff',offer_id:'10',version:1,validity:{valid:true,reasons:[],checked_at:'2026-10-27T10:00:00Z'},agency_name:'TEST ONLY agencija',agency_channel:'Portal',mandate_evidence:'Ugovor',sharing_permission:'Suglasnost',fee_terms:'2 %',fee_evidence:'Dodatak',open_questions:'Nema',fee_payer:'Agencija',fee_due:'Tek nakon uspješno dovršene prodaje',status:'Interni paket — nije poslan',prepared_at:'2026-10-27T10:00:00Z',property:{title:'TEST ONLY Lukavec'},buyer:{name:'TEST ONLY kupac'},criteria:{},buyer_response:{response:'Zainteresiran'},contacts:{},documents:{}}]},
 requests:{identity_id:'2',count:2,items:[{id:'2',root:true,name:'TEST ONLY kupac',country:'US',preferred_countries:'Hrvatska',request_label:'Izvorni profil',criteria_json:'{}',verified:1},{id:'3',root:false,name:'TEST ONLY kupac',country:'US',preferred_countries:'Hrvatska',request_label:'Kuća',criteria_json:JSON.stringify({buyer_identity_id:'2',request_label:'Kuća',property_types:['Kuća'],conditions:['Za obnovu']}),verified:0}]},
 secrets:['Lukavec','example.org']};
const real=process.env.WORKFLOW_RESPONSE&&existsSync(process.env.WORKFLOW_RESPONSE);
const fixture=real?JSON.parse(readFileSync(process.env.WORKFLOW_RESPONSE,'utf8')):synthetic;
const posts=[];let respond=b=>b.action==='workflow'?fixture.workflow:b.action==='buyer_requests'?fixture.requests:{id:99};
globalThis.fetch=async(url,o={})=>{const b=JSON.parse(o.body);posts.push(b);const out=respond(b);return out?.error?{ok:false,json:async()=>out}:{ok:true,json:async()=>out}};
let root=createRoot($('#root'));
const w=fixture.workflow,approved=w.offers.find(o=>o.approved&&o.current),unapproved=w.offers.find(o=>!o.approved&&o.current);
await act(async()=>{root.render(<OfferWorkflow propertyId={w.property.id} investorId={w.investor.id}/>)});await wait();
assert.deepEqual(posts[0],{action:'workflow',property_id:Number(w.property.id),investor_id:Number(w.investor.id)});
const text=document.body.textContent;
for(const t of ['Završni pregled i ponuda','ODGOVARA','ODSTUPA','NEDOSTAJE','Kanal prodavatelja','Kanal kupca','Ocjena bodovanih kriterija'])assert(text.includes(t),t);
assert(text.includes(w.readiness.fit+' %'),'fit is shown separately');assert(text.includes(w.readiness.reliability),'reliability is shown separately');
// Each version's preview never shows identifiers; the agency package and contacts stay outside it.
const versions=$('select[aria-label="Verzija prezentacije"]');
for(const o of w.offers){await setValue(versions,o.id);const preview=$('.offer-preview').textContent;
 for(const s of [...fixture.secrets,'TEST ONLY','agencija'])assert(!preview.includes(s),'preview of version '+o.number+' leaks '+s);}
// Unapproved current version: approval only after the explicit review checkbox.
if(unapproved){await setValue(versions,unapproved.id);const approve=button('Spremi završno odobrenje');assert.equal(approve.disabled,true);
 await act(async()=>{$$('label.checkbox input')[0].click()});assert.equal(button('Spremi završno odobrenje').disabled,!w.readiness.ready);
 assert.equal(button('Pripremi paket za agenciju').disabled,true,'no hand-over from an unapproved version');}
// Approved version with the latest written interest: response form and hand-over.
await setValue(versions,approved.id);
assert(!button('Spremi završno odobrenje'),'an approved version is not re-approved');
assert($$('a').some(a=>a.textContent.includes('Prikaz za ispis / PDF')&&a.getAttribute('href').includes('offer_id='+approved.id)&&a.rel.includes('noopener')));
await act(async()=>{button('Upiši pisani odgovor').click()});
assert.equal(button('Spremi odgovor').disabled,true,'opening is never a response: written confirmation required');
await setValue(field('Odgovor kupca'),'Ne odgovara');await setValue(field('Tko je odgovorio (kupac ili ovlaštena agencija)'),'TEST ONLY kupac');
await setValue($('label.field textarea'),'Lokacija ne odgovara.');await setValue(field('Dokaz pisanog odgovora (referenca poruke ili dokumenta)'),'E-pošta TEST 2');await setValue(field('Kanal primitka'),'E-pošta');
await act(async()=>{$$('label.checkbox input').at(-1).click()});
await act(async()=>{button('Spremi odgovor').click()});await wait();
const sent=posts.find(b=>b.action==='offer_response');
assert.equal(sent.offer_id,approved.id);assert.equal(sent.response,'Ne odgovara');assert.equal(sent.written,true);assert.equal(sent.evidence,'E-pošta TEST 2');
assert.equal('kind' in sent,false);assert.equal('supersedes' in sent,false,'a non-interest response never replaces others');
// Renewed interest on a day that already has non-interest responses must name the ones it replaces.
const todayNegatives=w.history.filter(e=>e.type==='response'&&e.response!=='Zainteresiran'&&e.responded_on===new Date().toISOString().slice(0,10));
assert(todayNegatives.length>0,'fixture has a same-day non-interest response');
await act(async()=>{button('Upiši pisani odgovor').click()});
await setValue(field('Odgovor kupca'),'Zainteresiran');
const replace=$('fieldset.offer-supersede');assert(replace,'same-day responses are offered for explicit replacement');
assert.equal(replace.querySelectorAll('input').length,todayNegatives.length);
await setValue(field('Tko je odgovorio (kupac ili ovlaštena agencija)'),'TEST ONLY kupac');await setValue($('label.field textarea'),'Ponovno zainteresirani.');
await setValue(field('Dokaz pisanog odgovora (referenca poruke ili dokumenta)'),'E-pošta TEST 3');await setValue(field('Kanal primitka'),'E-pošta');
await act(async()=>{replace.querySelector('input').click()});
await act(async()=>{$$('label.checkbox input').at(-1).click()});
await act(async()=>{button('Spremi odgovor').click()});await wait();
const renewed=posts.filter(b=>b.action==='offer_response').at(-1);
assert.deepEqual(renewed.supersedes,[todayNegatives[0].id]);assert.equal(renewed.response,'Zainteresiran');
// Packages: history is kept; validity comes from the server; a revoked package is unmistakably not for hand-over.
const packages=w.history.filter(e=>e.type==='handoff'),shown=$$('details.package');
assert.equal(shown.length,packages.length,'every package stays in history');
assert(packages.some(h=>h.validity?.valid===true)&&packages.some(h=>h.validity?.valid===false),'fixture has a valid and a revoked package');
for(const h of packages){const el=shown.find(d=>d.querySelector('summary').textContent.includes(h.agency_name)&&d.querySelector('summary').textContent.includes(h.validity.valid?'valjan za predaju':'NE ZA PREDAJU'));assert(el,'package '+h.id+' shown with its validity');
 for(const t of ['Agencija i ovlasti','Dopuštenje dijeljenja','Naknada','Tek nakon uspješno dovršene prodaje','Pisani odgovor kupca','Ništa nije poslano'])assert(el.textContent.includes(t),t);
 assert(!el.querySelector('textarea'),'package is readable sections, not a raw JSON box');
 const download=[...el.querySelectorAll('button')].at(-1).textContent;
 if(h.validity.valid)assert.equal(download,'Preuzmi interni paket (JSON)');
 else{assert.equal(download,'Preuzmi arhivsku kopiju — NE ZA PREDAJU');for(const r of h.validity.reasons)assert(el.textContent.includes(r),r);assert(el.textContent.includes('OPOZVAN / ZASTARIO — NE ZA PREDAJU'));}}
// Business phase off: no responses or hand-over can be started.
posts.length=0;respond=b=>b.action==='workflow'?{...fixture.workflow,business_phase:false}:{id:99};
await act(async()=>{root.unmount()});root=createRoot($('#root'));
await act(async()=>{root.render(<OfferWorkflow propertyId={w.property.id} investorId={w.investor.id}/>)});await wait();
assert(document.body.textContent.includes('Poslovna faza je odgođena'));
await setValue($('select[aria-label="Verzija prezentacije"]'),approved.id);
assert.equal(button('Upiši pisani odgovor').disabled,true);assert.equal(button('Pripremi paket za agenciju').disabled,true);
// Escaping: markup in stored text is shown as text.
respond=b=>b.action==='workflow'?{...fixture.workflow,offers:[{...approved,presentation:{...approved.presentation,description:'<img src=x onerror="globalThis.hacked=1">'}}]}:{id:99};
await act(async()=>{root.unmount()});root=createRoot($('#root'));
await act(async()=>{root.render(<OfferWorkflow propertyId={w.property.id} investorId={w.investor.id}/>)});await wait();
assert(!$('.offer-preview img')&&!globalThis.hacked,'stored text is never rendered as markup');
// A refused or malformed load is an error with a retry, never an empty panel.
respond=b=>({error:'Nekretnina ili zahtjev više nisu dostupni u operativnom katalogu.'});
await act(async()=>{root.unmount()});root=createRoot($('#root'));
await act(async()=>{root.render(<OfferWorkflow propertyId={w.property.id} investorId={w.investor.id}/>)});await wait();
assert(document.body.textContent.includes('više nisu dostupni')&&button('Pokušaj ponovno'));
respond=b=>({id:1});await act(async()=>{button('Pokušaj ponovno').click()});await wait();
assert(document.body.textContent.includes('neočekivan odgovor'));

// Buyer requests: the original profile is read-only; a new request is saved with its own criteria.
posts.length=0;respond=b=>b.action==='buyer_requests'?fixture.requests:{id:77};
await act(async()=>{root.unmount()});root=createRoot($('#root'));
const profile=fixture.requests.items.find(r=>r.root);
await act(async()=>{root.render(<BuyerRequests investorId={profile.id}/>)});await wait();
assert.equal($$('.request-card').length,fixture.requests.items.length);
assert($$('.request-card')[0].textContent.includes('IZVORNI PROFIL'));assert(!$$('.request-card')[0].querySelector('button'),'the original profile cannot be edited here');
assert(document.body.textContent.includes('sjedište nije potražnja'));
await act(async()=>{button('Dodaj zaseban zahtjev').click()});
assert.equal(field('Izvor ovog zahtjeva (URL dokaza)').value,'','a new request starts without any source');
await setValue(field('Naziv zahtjeva'),'Stan u Splitu');await setValue(field('Države interesa (zarezom)'),'Hrvatska');
await act(async()=>{$$('fieldset')[0].querySelectorAll('input')[2].click()});await act(async()=>{$$('fieldset')[1].querySelectorAll('input')[0].click()});
await setValue(field('Površina od (m²)'),'60');await setValue(field('Površina do (m²)'),'60');
// A documented requirement (facts-v1) with its source quote; unit and value are explicit, never defaulted to 0.
await act(async()=>{button('Dodaj uvjet').click()});
await setValue($('select[aria-label="Podatak"]'),'land_owned');
await setValue($('input[aria-label="Tražena vrijednost"]'),'150');await setValue($('select[aria-label="Tražena vrijednost – jedinica"]'),'ha');
await setValue($('input[aria-label="Izvorni navod"]'),'kupnja 150 ha u vlasništvu');
await act(async()=>{button('Spremi zahtjev i ponovno izračunaj').click()});await wait();
const saved=posts.find(b=>b.action==='save_request');
assert.deepEqual({...saved,criteria:{...saved.criteria}},{action:'save_request',investor_id:Number(profile.id),request_id:null,label:'Stan u Splitu',preferred_countries:'Hrvatska',notes:'',verified:false,min_budget:null,max_budget:null,
 criteria:{property_types:['Stan'],conditions:['Useljivo'],min_area:60,max_area:60,cities:[],regions:[],source_url:null,
  requirements:[{key:'land_owned',op:'min',unit:'ha',mandatory:true,quote:'kupnja 150 ha u vlasništvu',value:150}]}},'unknown budget stays empty, equal bounds kept, no inherited source, documented requirement');
const other=fixture.requests.items.find(r=>!r.root);
await act(async()=>{$$('.request-card').find(c=>c.textContent.includes(other.request_label)).querySelector('button').click()});
assert.equal(field('Naziv zahtjeva').value,other.request_label);
await act(async()=>{button('Spremi zahtjev i ponovno izračunaj').click()});await wait();
assert.equal(posts.filter(b=>b.action==='save_request').at(-1).request_id,other.id,'editing targets the request, never the profile');
// Mobile: the panels declare single-column layouts below 600px (visual review on a real phone is still required).
assert(document.body.innerHTML.includes('@media(max-width:600px){.two-cols{grid-template-columns:1fr}'));
// facts-v1: a new property fact starts unconfirmed with today's date and no value (unknown is never 0);
// the pair table shows requested, actual, evidence and state, with wishes marked.
await act(async()=>{root.unmount()});root=createRoot($('#root'));
let factsValue='';const renderFacts=()=>root.render(<FactsEditor value={factsValue} onChange={v=>{factsValue=v;renderFacts()}}/>);
await act(async()=>{renderFacts()});
await setValue($('select[aria-label="Dodaj podatak"]'),'land_owned');
let stored=JSON.parse(factsValue);assert.deepEqual(Object.keys(stored),['land_owned']);assert.equal(stored.land_owned.status,'nepotvrđeno');assert.equal('value' in stored.land_owned,false);
assert.equal(stored.land_owned.observed_on,new Date().toISOString().slice(0,10));
await setValue($('input[aria-label="Zemljište u vlasništvu uključeno u prodaju"]'),'110');await setValue($('select[aria-label="Zemljište u vlasništvu uključeno u prodaju – jedinica"]'),'ha');
stored=JSON.parse(factsValue);assert.equal(stored.land_owned.value,110);assert.equal(stored.land_owned.unit,'ha');
await act(async()=>{button('Ukloni').click()});assert.equal(factsValue,'','removing the last fact stores no facts');
await act(async()=>{root.render(<RequirementsTable rows={[{key:'land_owned',op:'min',label:'Zemljište u vlasništvu uključeno u prodaju',mandatory:true,quote:'kupnja 150 ha',requested:150,unit:'ha',actual:110,actual_unit:'ha',evidence:'TEST ONLY oglas',state:'unmet'},
 {key:'rooms',op:'min',label:'Broj soba / smještajnih jedinica',mandatory:false,quote:'po mogućnosti 40 soba',requested:40,unit:'kom',actual:null,actual_unit:null,evidence:null,state:'unknown'}]}/>)});
const table=document.body.textContent;for(const t of ['≥ 150 ha','110 ha','TEST ONLY oglas','Ne odgovara','(želja)','Podatak nije potvrđen','„kupnja 150 ha”'])assert(table.includes(t),t);
await act(async()=>{root.unmount()});
console.log('Offer workflow DOM checks passed'+(real?' on the real API response':' (synthetic response; real response not supplied)')+': fresh review with separate fit and reliability, identifier-free previews, explicit approval and written responses, same-day renewal by explicit replacement, business phase gate, readable agency packages with revoked ones marked not for hand-over, escaped text, errors with retry, separate buyer requests.');
