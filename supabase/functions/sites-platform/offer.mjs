import {buyerTeaser} from './teaser.mjs';
import {criteria,MATCH,contactRoute} from './domain.mjs';
const FIT={'Država':'Odgovara traženoj državi','Vrsta nekretnine':'Odgovara traženoj vrsti nekretnine','Stanje / obnova / rušenje':'Odgovara traženom stanju','Površina':'Površina je unutar dopuštenog raspona','Regija':'Odgovara traženoj regiji','Grad':'Odgovara traženoj lokaciji'};
export function presentation(p,i,r,code){
 const t=buyerTeaser(p);if(!t.text||t.leaks.length)throw Error('Nacrt sadrži moguće identifikatore: '+t.leaks.join(', '));
 return {code,title:'Odabrana nekretnina za vaše potrebe',subtitle:'Povjerljivi pregled investicijske prilike',description:t.text,
  reasons:[...new Set((r.reasons||[]).map(v=>FIT[v]).filter(Boolean))],
  availability:'Dostupnost i uvjete potrebno je potvrditi prije odluke.',
  next:'Ako želite više podataka, navedite oznaku i verziju ove prezentacije. Pisani interes prethodi daljnjem postupku preko agencije.',
  withheld:t.withheld};
}
// A complete, deterministic snapshot is hashed with SHA-256; a changed field cannot reuse approval.
export async function fingerprint(p,i){
 const stable=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 const value=JSON.stringify(stable([p,i]));const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function reviewReadiness(p,i,r){
 const blockers=[...(r.rejected||[]),...(r.missing||[])];
 if(r.status!==MATCH)blockers.push('Par još nije stvarna provjerena prilika');
 if(!contactRoute(p)||!contactRoute(i))blockers.push('Provjeriti kontakte obiju strana');
 return {ready:blockers.length===0,blockers:[...new Set(blockers)],fit:Number.isFinite(r.score)?r.score:null,
  reliability:blockers.length?'Potrebna dopuna / provjera':'Provjere para su dovršene; interes nije potvrđen'};
}
export const requestIdentity=i=>String(criteria(i).buyer_identity_id||i.id);
export function responseInput(a,now=Date.now()){
 const values=['Zainteresiran','Trebam dodatne podatke','Ne odgovara','Interes povučen'];
 if(!values.includes(a.response))throw Error('Odaberi izričit odgovor kupca.');
 const o={response:a.response};for(const k of ['body','evidence','channel','respondent']){if(typeof a[k]!=='string'||!a[k].trim()||a[k].length>8000)throw Error('Nedostaje podatak: '+k);o[k]=a[k].trim()}
 const day=String(a.responded_on||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day>new Date(now).toISOString().slice(0,10))throw Error('Datum odgovora nije valjan.');
 if(a.written!==true)throw Error('Potreban je pisani odgovor uz dokaz.');return {...o,responded_on:day,written:true};
}
export function handoffInput(a){
 const o={};for(const k of ['agency_name','agency_channel','mandate_evidence','fee_terms','fee_evidence','open_questions']){if(typeof a[k]!=='string'||!a[k].trim()||a[k].length>8000)throw Error('Nedostaje podatak: '+k);o[k]=a[k].trim()}
 if(a.reviewed!==true||a.fee_accepted!==true)throw Error('Potvrdi završni pregled i prihvaćen dogovor s agencijom.');
 return {...o,fee_payer:'Agencija',fee_due:'Tek nakon uspješno dovršene prodaje',mediation:'Ovlaštena agencija vodi daljnju komunikaciju, posredovanje i prodaju.'};
}
export const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function presentationHtml(o,{version=1,approved=false}={}){
 const e=escapeHtml;return `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Povjerljiva prezentacija</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;background:#eeeae3;color:#15322d;font:16px/1.65 system-ui,sans-serif}.sheet{max-width:900px;margin:32px auto;background:#fff;padding:64px;border-top:12px solid #173e35}small,.eyebrow{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#65776b}h1{font:44px/1.15 Georgia,serif;max-width:650px;margin:24px 0}h2{font:26px Georgia,serif;border-top:1px solid #d9ddd8;padding-top:24px}.copy{white-space:pre-line}.badge{display:inline-block;background:#edf4ed;padding:8px 16px;border-radius:24px}.note{background:#f5f2e9;padding:20px;margin-top:30px}.toolbar{max-width:900px;margin:20px auto}button{padding:12px 20px;background:#173e35;color:white;border:0;cursor:pointer}@media print{body{background:white}.sheet{margin:0;padding:15px;border-top-width:6px}.toolbar{display:none}h1{font-size:36px}section{break-inside:avoid}} </style></head><body><div class="toolbar"><button onclick="window.print()">Ispis / Spremi kao PDF</button></div><main class="sheet"><p class="eyebrow">${e(o.subtitle)}</p><span class="badge">${approved?'Pregledano za procjenu interesa':'INTERNI NACRT — nije za slanje'}</span><h1>${e(o.title)}</h1><p><b>${e(o.code)}</b> · Verzija ${e(version)}</p><section><h2>Osnovna obilježja</h2><div class="copy">${e(o.description)}</div></section><section><h2>Zašto odgovara vašem zahtjevu</h2>${o.reasons.length?'<ul>'+o.reasons.map(x=>'<li>'+e(x)+'</li>').join('')+'</ul>':'<p>Podudaranje još zahtijeva provjeru.</p>'}</section><div class="note"><b>Sljedeći korak</b><p>${e(o.next)}</p><small>${e(o.availability)}</small></div><p><small>Prezentacija ne potvrđuje pravnu urednost, raspoloživost niti zaključenje posla. Uklanjanje oznaka ne isključuje prepoznavanje javnog oglasa iz obilježja.</small></p></main></body></html>`;
}
