// Data-completion work queue (plan #46 addendum, module 2). Built only from stored pairs and their recorded open
// items: no new evaluation, importer or property × buyer product. Ranking orders work; it hides no candidate, does
// not make a pair valid and never treats an unknown as met. The budget plays no part.
import {questionDraft,criteria,country,SOURCE_FRESH,ACTIVE_CHECK} from './domain.mjs';
import {requestIdentity} from './offer.mjs';
export const COMPLETION_VERSION='completion-v1';
// Countries with an enabled, verified national registry adapter (ops/national-enrichment.md); elsewhere manual.
export const REGISTRY_ADAPTERS={NL:'Kadaster / PDOK (automatski adapter)',FR:'IGN API Carto cadastre (automatski adapter)'};
const ISO=Object.fromEntries(['AT|Austrija','BE|Belgija','BG|Bugarska','HR|Hrvatska','CY|Cipar','CZ|Češka','DK|Danska','EE|Estonija','FI|Finska','FR|Francuska','DE|Njemačka','GR|Grčka','HU|Mađarska','IE|Irska','IT|Italija','LV|Latvija','LT|Litva','LU|Luksemburg','MT|Malta','NL|Nizozemska','PL|Poljska','PT|Portugal','RO|Rumunjska','SK|Slovačka','SI|Slovenija','ES|Španjolska','SE|Švedska'].map(v=>v.split('|').reverse()));
const STALE=[SOURCE_FRESH,ACTIVE_CHECK];
const parse=v=>{try{const o=typeof v==='string'?JSON.parse(v):v;return o&&typeof o==='object'&&!Array.isArray(o)?o:null}catch{return null}};
// Checks before any question, in the owner's order (AGENTS.md 25.10.): original listing, the registry of the
// PROPERTY's country, and only then a question to the seller or the agency. Nothing is sent.
export function priorChecks(item,property){
 if(item.side!=='property'||!property)return [];
 const name=country(property.country),iso=ISO[name]||null;
 return ['Izvorni oglas i njegova dokumentacija: '+(property.source||'izvor nije naveden'),
  'Službena evidencija države nekretnine ('+(name||'država nije poznata')+'): '+(iso&&REGISTRY_ADAPTERS[iso]?REGISTRY_ADAPTERS[iso]:'ručna provjera, automatski adapter nije uključen'),
  'Tek nakon toga upit prodavatelju ili njegovoj agenciji (nacrt, ne šalje se)'];
}
// rows: stored match_results visible in the catalogue; properties/investors: the records they link to.
export function completionQueue(rows,properties,investors){
 const P=new Map(properties.map(p=>[String(p.id),p])),I=new Map(investors.map(i=>[String(i.id),i]));
 const items=new Map(),all={pairs:new Set(),requests:new Set(),buyers:new Set()};
 for(const row of rows){
  const r=parse(row.result_json);if(!r||!r.gaps)continue;
  const pid=String(row.property_id),iid=String(row.investor_id),p=P.get(pid),i=I.get(iid);if(!p||!i)continue;
  const pair=pid+'-'+iid,buyer=requestIdentity(i),missing=new Set(r.missing||[]);
  all.pairs.add(pair);all.requests.add(iid);all.buyers.add(buyer);
  for(const side of ['property','buyer','pair'])for(const label of new Set(r.gaps[side]||[])){
   const record=side==='property'?pid:side==='buyer'?iid:pair,key=side+'\n'+record+'\n'+label;
   let it=items.get(key);
   if(!it)items.set(key,it={key,side,label,record_id:record,property_id:side==='buyer'?null:pid,investor_id:side==='property'?null:iid,
    pairs:new Set(),requests:new Set(),buyers:new Set(),sole:new Set(),matches_after:0,stale:STALE.includes(label)||/^Uvjet zahtjeva:/.test(label)&&r.requirements?.some(q=>q.state==='expired'&&label.endsWith(q.label))});
   it.pairs.add(pair);it.requests.add(iid);it.buyers.add(buyer);
   // A pair this item alone keeps open (no rejection, nothing else missing) becomes a real opportunity once filled.
   if(!(r.rejected||[]).length&&missing.size===1&&missing.has(label))it.sole.add(pair);
  }
 }
 const out=[...items.values()].map(it=>{
  const p=it.property_id?P.get(it.property_id):null,i=it.investor_id?I.get(it.investor_id):null;
  const draft=questionDraft(it.label,it.side==='pair'?'property':it.side);
  return {key:it.key,side:it.side,label:it.label,record_id:it.record_id,property_id:it.property_id,investor_id:it.investor_id,
   property:p?{id:p.id,title:p.title,country:p.country,city:p.city,source:p.source}:null,
   request:i?{id:i.id,name:i.name,label:criteria(i).request_label||null}:null,
   // A link exists only when the record's own source is that agency's listing (withAgencies); none is assumed.
   agency:(it.side==='buyer'?i:p)?.source_agency?{id:(it.side==='buyer'?i:p).source_agency.id,name:(it.side==='buyer'?i:p).source_agency.name}:null,
   counts:{pairs:it.pairs.size,requests:it.requests.size,buyers:it.buyers.size,sole_blocker_pairs:it.sole.size},stale:!!it.stale,
   why:[it.sole.size?'Jedina otvorena stavka za '+it.sole.size+' '+(it.sole.size===1?'par':'parova'):null,
    'Zahvaća '+it.pairs.size+' '+(it.pairs.size===1?'par':'parova')+', '+it.requests.size+' '+(it.requests.size===1?'zahtjev':'zahtjeva')+' i '+it.buyers.size+' '+(it.buyers.size===1?'kupca':'različitih kupaca'),
    it.stale?'Postojeći dokaz je zastario ili nije potvrđen':null].filter(Boolean),
   prior_checks:priorChecks(it,p),draft:{...draft,status:'Nacrt — ne šalje se'}};
 });
 // Stable order: sole blockers, distinct buyers, pairs, then the key. Ties never depend on load order.
 out.sort((a,b)=>b.counts.sole_blocker_pairs-a.counts.sole_blocker_pairs||b.counts.buyers-a.counts.buyers||b.counts.pairs-a.counts.pairs||(a.key<b.key?-1:a.key>b.key?1:0));
 return {items:out,totals:{pairs:all.pairs.size,requests:all.requests.size,buyers:all.buyers.size,items:out.length}};
}
export function completionPage(queue,a){
 const offset=Number(a.offset??0),limit=Number(a.limit??50),side=a.side??null,agency=a.agency_id==null||a.agency_id===''?null:Number(a.agency_id);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200)throw Error('Nevaljana stranica reda dopuna.');
 if(side!=null&&!['property','buyer','pair'].includes(side))throw Error('Nevaljana strana stavke.');
 if(agency!==null&&!Number.isSafeInteger(agency))throw Error('Nevaljana agencija.');
 const list=queue.items.filter(it=>(side==null||it.side===side)&&(agency===null||it.agency?.id!=null&&Number(it.agency.id)===agency));
 // Agency groups count items and records only; buyers' details stay with each item, never merged across clients.
 const groups=new Map();for(const it of queue.items)if(it.agency){const g=groups.get(it.agency.id)||{id:it.agency.id,name:it.agency.name,items:0,records:new Set()};g.items++;g.records.add(it.side+':'+it.record_id);groups.set(it.agency.id,g)}
 return {items:list.slice(offset,offset+limit),total:list.length,offset,limit,next:offset+limit<list.length?offset+limit:null,totals:queue.totals,
  agencies:[...groups.values()].map(g=>({id:g.id,name:g.name,items:g.items,records:g.records.size})).sort((a,b)=>b.items-a.items||String(a.name).localeCompare(String(b.name))),
  version:'completion-v1',computed_at:new Date().toISOString()};
}
