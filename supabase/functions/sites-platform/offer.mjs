import {buyerTeaser,areaText,teaserLeaks} from './teaser.mjs';
import {readFacts,UNITS,factCurrent} from './facts.mjs';
import {criteria,MATCH,CANDIDATE,REJECT,contactRoute,TYPES,CONDITIONS,num} from './domain.mjs';
// Only fixed sentences reach the buyer: evaluate() labels are mapped, never copied.
const FIT={'Država':'Odgovara traženoj državi','Vrsta nekretnine':'Odgovara traženoj vrsti nekretnine','Stanje / obnova / rušenje':'Odgovara traženom stanju',
 'Površina':'Površina je unutar dopuštenog raspona','Regija':'Odgovara traženoj regiji','Grad':'Odgovara traženoj lokaciji','Potvrđena mogućnost gradnje':'Mogućnost gradnje navedena je uz dokument (potrebna stručna provjera)'};
// The buyer's own structured criteria, rephrased from allowlisted values; free-text labels and notes are never included.
export function requestSummary(i){
 const c=criteria(i),out=[];
 const types=(Array.isArray(c.property_types)?c.property_types:[]).filter(v=>TYPES.includes(v)),conditions=(Array.isArray(c.conditions)?c.conditions:[]).filter(v=>CONDITIONS.includes(v));
 if(types.length)out.push('Vrsta: '+types.join(', '));
 if(conditions.length)out.push('Stanje: '+conditions.join(', '));
 const low=num(c.min_area)?areaText(c.min_area):null,high=num(c.max_area)?areaText(c.max_area):null;
 if(low||high)out.push('Površina: '+(low&&high?'okvirno '+low+' do '+high:low?'od okvirno '+low:'do okvirno '+high));
 return out;
}
// Module 5: confirmed specialised facts as generalised lines (bands, never exact identifying values); unconfirmed, not yet observed,
// conflicting or expired facts are left out, and every line passes the same identifier checks as the teaser.
const band=(v,step,unit)=>{const lo=Math.floor(v/step)*step;return (lo?lo+' – ':'do ')+(lo+step)+' '+unit};
const yes=v=>v?'da':'ne';
const FACT_LINES={subtype:f=>'Podvrsta: '+f.value,farm_production:f=>'Proizvodnja: '+f.value,rooms:f=>'Smještajni kapacitet: '+band(f.value,10,'soba'),
 hotel_category:f=>'Kategorija prema dokumentu: '+f.value+'★ (potrebna provjera)',operating:f=>'Objekt posluje: '+yes(f.value),
 operating_months:f=>'Sezona rada: '+(f.value>=12?'cijela godina':f.value+' mjeseci'),renovation_needed:f=>'Potrebna obnova: '+yes(f.value),
 clear_height:f=>'Svijetla visina: od približno '+Math.floor(f.value*UNITS[f.unit][1])+' m',power:f=>'Priključna snaga: '+band(f.value*UNITS[f.unit][1],100,'kW'),
 truck_access:f=>'Pristup kamionima / utovar: '+yes(f.value),water_rights:f=>'Prava na vodu prema dokumentu: '+yes(f.value),
 includes_buildings:f=>'Prodaja uključuje zgrade: '+yes(f.value),includes_equipment:f=>'Prodaja uključuje opremu: '+yes(f.value),includes_business:f=>'Prodaja uključuje poslovanje: '+yes(f.value),
 land_total:f=>'Zemljište ukupno: '+areaText(f.value*UNITS[f.unit][1]),land_owned:f=>'Zemljište u vlasništvu: '+areaText(f.value*UNITS[f.unit][1]),
 land_leased:f=>'Zemljište u zakupu: '+areaText(f.value*UNITS[f.unit][1]),building_area:f=>'Površina zgrada: '+areaText(f.value*UNITS[f.unit][1]),usable_area:f=>'Korisna površina: '+areaText(f.value*UNITS[f.unit][1])};
export function factsSummary(p,now=Date.now()){
 const facts=readFacts(p)||{},today=new Date(now).toISOString().slice(0,10);
 return Object.entries(facts).filter(([k,f])=>FACT_LINES[k]&&factCurrent(f,today)).map(([k,f])=>FACT_LINES[k](f)).filter(l=>l&&!/null|undefined/.test(l)&&!teaserLeaks(l,p).length);
}
export function presentation(p,i,r,code){
 const t=buyerTeaser(p);if(!t.text||t.leaks.length)throw Error('Nacrt sadrži moguće identifikatore: '+t.leaks.join(', '));
 return {code,title:'Odabrana nekretnina za vaše potrebe',subtitle:'Povjerljivi pregled investicijske prilike',description:t.text,
  request:requestSummary(i),
  facts:factsSummary(p),
  reasons:[...new Set((r.reasons||[]).map(v=>FIT[v]).filter(Boolean))],
  availability:'Dostupnost i uvjete potrebno je potvrditi prije odluke.',
  next:'Ako želite više podataka, navedite oznaku i verziju ove prezentacije. Pisani interes prethodi daljnjem postupku preko agencije.',
  photos:'Fotografije nisu priložene: prilažu se tek nakon provjere prava korištenja i anonimizacije.',
  withheld:t.withheld};
}
// Version of the evaluation rules an approval was given under; a rule change requires a new review.
export const EVAL_VERSION='pair-rules-2026-10-27';
// Pair evidence an approval covers: verified answers, review tasks and the fresh result. Timestamps that only
// record when something was touched (updated_at, recorded_at, info notes) are left out so they cannot void approvals.
export function evidenceSnapshot(answers,tasks,result){
 return {version:EVAL_VERSION,
  answers:[...answers].map(a=>({id:String(a.id),requirement:a.requirement,status:a.status,digest:a.digest??null,evidence:a.evidence??null,outcome:a.outcome??null,answered_on:a.answered_on==null?null:String(a.answered_on instanceof Date?a.answered_on.toISOString().slice(0,10):a.answered_on)})).sort((a,b)=>a.id.localeCompare(b.id)),
  tasks:[...tasks].map(t=>({requirement:t.requirement,status:t.status,evidence:t.evidence??null,checked_at:t.checked_at instanceof Date?t.checked_at.toISOString():t.checked_at??null})).sort((a,b)=>a.requirement.localeCompare(b.requirement)),
  result:{status:result.status,score:result.score??null,reasons:result.reasons||[],missing:result.missing||[],rejected:result.rejected||[]}};
}
// A complete, deterministic snapshot of both records and the pair evidence is hashed with SHA-256;
// a changed field or changed evidence cannot reuse an approval.
export async function fingerprint(p,i,evidence=null){
 const stable=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 const value=JSON.stringify(stable(evidence?[p,i,evidence]:[p,i]));const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
// `fresh` is the result recomputed now with the current rules; `stored` is the last accepted calculation.
// Both must confirm a real opportunity. The score (fit) is reported separately from reliability.
export function reviewReadiness(p,i,fresh,stored=fresh){
 const blockers=[...(fresh.rejected||[]),...(fresh.missing||[])];
 if(fresh.status!==MATCH)blockers.push('Par prema aktualnim pravilima još nije stvarna provjerena prilika');
 else if(stored?.status!==MATCH)blockers.push('Spremljeni izračun nije potvrdio stvarnu priliku; pokreni ponovni izračun');
 if(!contactRoute(p))blockers.push('Provjeriti kontakt prodavatelja ili njegove agencije');
 if(!contactRoute(i))blockers.push('Provjeriti kontakt kupca ili njegove agencije');
 return {ready:blockers.length===0,blockers:[...new Set(blockers)],fit:Number.isFinite(fresh.score)?fresh.score:null,status:fresh.status,
  reliability:blockers.length?'Potrebna dopuna / provjera':'Provjere para su dovršene; interes nije potvrđen'};
}
// Criteria by side for the final review: met, deviating and missing items, never merged into one number.
export function reviewSides(r){
 const gaps=r.gaps||{};
 return {met:r.reasons||[],deviates:r.rejected||[],missing:{property:gaps.property||[],buyer:gaps.buyer||[],pair:gaps.pair||[],other:(r.missing||[]).filter(v=>![...(gaps.property||[]),...(gaps.buyer||[]),...(gaps.pair||[])].includes(v))}};
}
export const requestIdentity=i=>String(criteria(i).buyer_identity_id||i.id);
export const RESPONSES=['Zainteresiran','Trebam dodatne podatke','Ne odgovara','Interes povučen'];
export const INTEREST='Zainteresiran';
// The business-valid response follows the documented chronology (responded_on), never the order of entry.
// Responses on the latest day decide together: when they disagree, interest counts only if it explicitly
// supersedes each other response of that day; otherwise the state is ambiguous and no interest is valid.
export function effectiveResponse(responses){
 const list=(responses||[]).filter(r=>r&&RESPONSES.includes(r.response)&&/^\d{4}-\d{2}-\d{2}$/.test(String(r.responded_on||'')));
 if(!list.length)return {response:null,ambiguous:false,reason:'Nema pisanog odgovora'};
 const last=list.reduce((m,r)=>r.responded_on>m?r.responded_on:m,'');
 const day=list.filter(r=>r.responded_on===last);
 if(day.length===1)return {response:day[0],ambiguous:false,reason:null};
 const positive=day.filter(r=>r.response===INTEREST);
 // Without interest that day there is nothing to confirm: the last recorded non-interest response stands.
 if(!positive.length)return {response:day.at(-1),ambiguous:false,reason:null};
 const cleared=new Set(positive.flatMap(r=>(r.supersedes||[]).map(String)));
 if(day.every(r=>r.response===INTEREST||cleared.has(String(r.id))))return {response:positive.at(-1),ambiguous:false,reason:null};
 return {response:null,ambiguous:true,reason:'Više različitih odgovora istog dana ('+last+'); novi interes mora izričito zamijeniti ostale odgovore tog dana.'};
}
const validDay=day=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
// A written response to one version. `after` is the day the version was approved: an earlier date cannot answer it.
export function responseInput(a,{now=Date.now(),after=null,previous=[]}={}){
 if(!RESPONSES.includes(a.response))throw Error('Odaberi izričit odgovor kupca.');
 const o={response:a.response};for(const k of ['body','evidence','channel','respondent']){if(typeof a[k]!=='string'||!a[k].trim()||a[k].length>8000)throw Error('Nedostaje podatak: '+k);o[k]=a[k].trim()}
 const day=String(a.responded_on||'');if(!validDay(day)||day>new Date(now).toISOString().slice(0,10))throw Error('Datum odgovora nije valjan.');
 if(after&&day<after)throw Error('Odgovor ne može prethoditi odobrenju ove verzije ('+after+').');
 if(a.written!==true)throw Error('Potreban je pisani odgovor uz dokaz.');
 // Renewed interest on the same day as another response must name the responses it replaces.
 let supersedes=[];
 if(a.supersedes!=null){
  if(o.response!==INTEREST||!Array.isArray(a.supersedes)||!a.supersedes.length||a.supersedes.length>50)throw Error('Zamjena ranijih odgovora moguća je samo uz novi izričit interes.');
  supersedes=[...new Set(a.supersedes.map(String))];
  for(const sid of supersedes){const r=previous.find(x=>String(x.id)===sid);if(!r||r.response===INTEREST||r.responded_on>day)throw Error('Zamijenjeni odgovor nije valjan raniji odgovor bez interesa.')}
 }
 return {...o,responded_on:day,written:true,...(supersedes.length?{supersedes}:{})};
}
export const HANDOFF_FIELDS=[['agency_name','Naziv ovlaštene agencije'],['agency_channel','Dogovoreni kanal agencije'],['mandate_evidence','Dokaz ovlasti / partnerstva agencije'],
 ['sharing_permission','Dokaz dopuštenja dijeljenja podataka s agencijom'],['fee_terms','Dogovoreni iznos ili način obračuna naknade'],['fee_evidence','Dokaz da je agencija prihvatila uvjete naknade'],['open_questions','Otvorena pitanja i ograničenja (ili izričito: nema)']];
export function handoffInput(a){
 const o={};for(const [k,label] of HANDOFF_FIELDS){if(typeof a[k]!=='string'||!a[k].trim()||a[k].length>8000)throw Error('Nedostaje podatak: '+label);o[k]=a[k].trim()}
 if(a.reviewed!==true||a.fee_accepted!==true)throw Error('Potvrdi završni pregled i prihvaćen dogovor s agencijom.');
 return {...o,fee_payer:'Agencija',fee_due:'Tek nakon uspješno dovršene prodaje',mediation:'Ovlaštena agencija vodi daljnju komunikaciju, posredovanje i prodaju.'};
}
// Readable sections of an internal agency package. Never part of the anonymous buyer presentation.
export function packageSections(h){
 const v=x=>x==null||x===''?'—':String(x),row=(label,value)=>[label,v(value)];
 const p=h.property||{},b=h.buyer||{},c=h.criteria||{},r=h.buyer_response||{};
 return [
  ['Agencija i ovlasti',[row('Agencija',h.agency_name),row('Kanal',h.agency_channel),row('Ovlast / partnerstvo',h.mandate_evidence),row('Dopuštenje dijeljenja',h.sharing_permission)]],
  ['Naknada',[row('Plaća',h.fee_payer),row('Dospijeće',h.fee_due),row('Uvjeti',h.fee_terms),row('Dokaz prihvaćanja',h.fee_evidence)]],
  ['Nekretnina (provjereni podaci)',[row('Naslov',p.title),row('Država / mjesto',[p.country,p.region,p.city].filter(Boolean).join(', ')),row('Vrsta / stanje',[p.property_type,p.condition].filter(Boolean).join(' · ')),
   row('Površina m²',p.area),row('Cijena EUR',p.price),row('Osnova cijene',p.price_basis),row('Pravni status',p.legal),row('Izvor',p.source),row('Izvor provjeren',p.source_checked_on)]],
  ['Dokumenti',[row('Pravna dokumentacija',h.documents?.legal),row('Prostorni plan / gradnja',h.documents?.planning),row('Izvorni oglas',h.documents?.source)]],
  ['Zahtjev kupca',[row('Kupac',b.name),row('Zahtjev',c.request_label||'Osnovni zahtjev'),row('Države interesa',b.preferred_countries),row('Vrste',(c.property_types||[]).join(', ')),
   row('Stanja',(c.conditions||[]).join(', ')),row('Površina',[c.min_area,c.max_area].some(x=>x!=null)?v(c.min_area)+' – '+v(c.max_area)+' m²':null),row('Izvor zahtjeva',c.source_url)]],
  ['Pisani odgovor kupca',[row('Odgovor',r.response),row('Datum',r.responded_on),row('Odgovorio',r.respondent),row('Kanal',r.channel),row('Dokaz',r.evidence),row('Tekst',r.body)]],
  ['Kontaktni kanali',[row('Prodavatelj',h.contacts?.seller?h.contacts.seller.label+': '+h.contacts.seller.name:'Nije potvrđen'),row('Kupac',h.contacts?.buyer?h.contacts.buyer.label+': '+h.contacts.buyer.name:'Nije potvrđen')]],
  ['Otvoreno',[row('Otvorena pitanja',h.open_questions),row('Status',h.validity?h.validity.valid?'Valjan za predaju (nije poslan)':'OPOZVAN / ZASTARIO — NE ZA PREDAJU: '+h.validity.reasons.join('; '):h.status)]]];
}
export const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function presentationHtml(o,{version=1,approved=false}={}){
 const e=escapeHtml,list=items=>'<ul>'+items.map(x=>'<li>'+e(x)+'</li>').join('')+'</ul>';
 return `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Povjerljiva prezentacija</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;background:#eeeae3;color:#15322d;font:16px/1.65 system-ui,sans-serif}.sheet{max-width:900px;margin:32px auto;background:#fff;padding:64px;border-top:12px solid #173e35}small,.eyebrow{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#65776b}h1{font:44px/1.15 Georgia,serif;max-width:650px;margin:24px 0}h2{font:26px Georgia,serif;border-top:1px solid #d9ddd8;padding-top:24px}.copy{white-space:pre-line}.badge{display:inline-block;background:#edf4ed;padding:8px 16px;border-radius:24px}.draft{background:#f8e6d8}.note{background:#f5f2e9;padding:20px;margin-top:30px}.toolbar{max-width:900px;margin:20px auto}button{padding:12px 20px;background:#173e35;color:white;border:0;cursor:pointer}@media (max-width:600px){.sheet{margin:0;padding:24px}h1{font-size:32px}}@media print{body{background:white}.sheet{margin:0;padding:15px;border-top-width:6px}.toolbar{display:none}h1{font-size:36px}section{break-inside:avoid}} </style></head><body><div class="toolbar"><button onclick="window.print()">Ispis / Spremi kao PDF</button></div><main class="sheet"><p class="eyebrow">${e(o.subtitle)}</p><span class="badge${approved?'':' draft'}">${approved?'Pregledano za procjenu interesa':'INTERNI NACRT — nije za slanje'}</span><h1>${e(o.title)}</h1><p><b>${e(o.code)}</b> · Verzija ${e(version)}</p><section><h2>Osnovna obilježja</h2><div class="copy">${e(o.description)}</div></section>${o.facts?.length?`<section><h2>Dodatna obilježja (potvrđeni podaci)</h2>${list(o.facts)}</section>`:''}${o.request?.length?`<section><h2>Vaš zahtjev</h2>${list(o.request)}</section>`:''}<section><h2>Zašto odgovara vašem zahtjevu</h2>${o.reasons.length?list(o.reasons):'<p>Podudaranje još zahtijeva provjeru.</p>'}</section>${o.photos?`<p><small>${e(o.photos)}</small></p>`:''}<div class="note"><b>Sljedeći korak</b><p>${e(o.next)}</p><small>${e(o.availability)}</small></div><p><small>Prezentacija ne potvrđuje pravnu urednost, raspoloživost niti zaključenje posla. Uklanjanje oznaka ne isključuje prepoznavanje javnog oglasa iz obilježja.</small></p></main></body></html>`;
}
// New and improved pairs from the permanent pair_history (newest first). Only real recorded transitions
// count: a recalculation without a change records no history and therefore never shows as improved.
const RANK={[REJECT]:0,[CANDIDATE]:1,[MATCH]:2};
const count=v=>{if(typeof v==='string'){try{v=JSON.parse(v)}catch{return null}}return Array.isArray(v)?v.length:v==null?0:null};
export function changeOf(rows,now=Date.now(),days=14){
 const [last,prev]=rows||[];if(!last)return null;
 const at=last.recorded_at instanceof Date?last.recorded_at:new Date(last.recorded_at),t=at.getTime();
 if(!Number.isFinite(t)||t>now+60000||now-t>days*86400000)return null;
 const stamp=at.toISOString();
 if(last.event==='Prvi izračun')return {kind:'Novo',at:stamp,detail:'Prvi put u izračunu'};
 if(last.event==='Ponovno u izračunu')return {kind:'Novo',at:stamp,detail:'Ponovno u izračunu nakon izostanka'};
 if(last.event!=='Promjena rezultata'||!prev||!(last.status in RANK)||!(prev.status in RANK))return null;
 if(RANK[last.status]>RANK[prev.status])return {kind:'Poboljšano',at:stamp,detail:prev.status+' → '+last.status};
 if(RANK[last.status]<RANK[prev.status])return null;
 const [m1,m0,r1,r0]=[count(last.missing),count(prev.missing),count(last.rejected),count(prev.rejected)];
 if([m1,m0,r1,r0].includes(null))return null;
 if(m1<=m0&&r1<=r0&&(m1<m0||r1<r0))return {kind:'Poboljšano',at:stamp,detail:(r1<r0?'manje odstupanja ('+r0+' → '+r1+')':'')+(r1<r0&&m1<m0?', ':'')+(m1<m0?'manje otvorenih provjera ('+m0+' → '+m1+')':'')};
 return null;
}
