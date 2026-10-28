import {validateRequirements,validateFacts,readFacts,compareRequirements,requirementLabel,AREA_BASIS,basisArea} from './facts.mjs';
import {validateTravel,travelOutcome} from './travel.mjs';
export const TYPES=['Zemljište','Kuća','Stan','Zgrada','Poslovni prostor'];
export const CONDITIONS=['Useljivo','Za obnovu','Za rušenje','Neizgrađeno'];
export const COUNTRIES=Object.fromEntries(['AT|Austrija','BE|Belgija','BG|Bugarska','HR|Hrvatska','CY|Cipar','CZ|Češka','DK|Danska','EE|Estonija','FI|Finska','FR|Francuska','DE|Njemačka','GR|Grčka','HU|Mađarska','IE|Irska','IT|Italija','LV|Latvija','LT|Litva','LU|Luksemburg','MT|Malta','NL|Nizozemska','PL|Poljska','PT|Portugal','RO|Rumunjska','SK|Slovačka','SI|Slovenija','ES|Španjolska','SE|Švedska'].map(s=>s.split('|')));
export const MATCH='Podudaranje kriterija',CANDIDATE='Kandidat - potrebna provjera',REJECT='Ne odgovara kriterijima';
export const country=v=>COUNTRIES[String(v||'').trim().toUpperCase()]||String(v||'').trim();
export const norm=v=>String(v||'').toLocaleLowerCase('hr').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
export const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export const validUrl=v=>{try{return typeof v==='string'&&['https:','http:'].includes(new URL(v).protocol)}catch{return false}};
export const criteria=i=>{try{const c=typeof i.criteria_json==='string'?JSON.parse(i.criteria_json):i.criteria_json||{};return c&&typeof c==='object'&&!Array.isArray(c)?c:{_invalid:true}}catch{return {_invalid:true}}};
// Content fingerprint: FNV-1a over UTF-16 units of whitespace-normalised text (same as matching.digest).
export function digest(v){const s=String(v??'').replace(/\s+/g,' ').trim();let h=0x811c9dc5;for(let k=0;k<s.length;k++){h^=s.charCodeAt(k);h=Math.imul(h,0x01000193)>>>0}return h.toString(16).padStart(8,'0')}
// A recorded check counts only for the exact checked text, within 90 days and with evidence.
export function checkValid(check,text,now=Date.now()){
 if(!check||typeof check!=='object')return false;const t=Date.parse(check.checked_at);
 return check.digest===digest(text)&&/(Z|[+-]\d\d:\d\d)$/.test(check.checked_at||'')&&Number.isFinite(t)&&t<=now&&now-t<=90*86400000&&typeof check.evidence==='string'&&check.evidence.trim().length>0;
}
// Original source wording that the structured criteria cannot express.
export const sourceConditions=c=>JSON.stringify([c.property_types??null,c.preferred_locations??null,c.locations??null,c.required_criteria??null,c.required??null]);
export function validateCriteria(c){
 for(const [k,allowed] of [['property_types',TYPES],['conditions',CONDITIONS]])if(!Array.isArray(c[k]??[])||(c[k]??[]).some(v=>!allowed.includes(v)))throw Error('Nepoznati kriteriji: '+k);
 for(const k of ['cities','regions'])if(!Array.isArray(c[k]??[])||(c[k]??[]).some(v=>typeof v!=='string'||!v.trim()))throw Error('Lokacije moraju biti popis naziva.');
 for(const k of ['min_area','max_area','min_roi'])if(c[k]!=null&&!num(c[k]))throw Error('Nevaljana granica: '+k);
 if(c.min_area!=null&&c.max_area!=null&&c.min_area>c.max_area)throw Error('Nevaljan raspon površine.');
 if(c.requires_buildable!=null&&typeof c.requires_buildable!=='boolean')throw Error('Nevaljan uvjet gradnje.');
 if(c.requirements!=null)validateRequirements(c.requirements);
 if(c.area_basis!=null&&!Object.hasOwn(AREA_BASIS,c.area_basis))throw Error('Nepoznata osnova površine.');
 if(c.travel!=null)validateTravel(c.travel);
 if(c.area_hard!=null&&typeof c.area_hard!=='boolean')throw Error('Nevaljana oznaka tvrde granice površine.');
 if(c.source_url&&!validUrl(c.source_url))throw Error('Potreban je valjan URL dokaza zahtjeva kupca.');
}
// Property facts a pair-specific check is bound to: any change to them makes the check stale.
export const PAIR_FACTS=['id','country','region','city','title','property_type','condition','area','price','price_basis','renovation','other_costs','legal','legal_evidence_url','buildable','planning_evidence_url','source','available_until','bid_deadline_at','auction_at','risk_notes'];
const fact=v=>v==null?null:typeof v==='number'?v:v instanceof Date?v.toISOString():String(v);
// Text a pair check covers: the buyer's condition wording plus the property facts it was checked against.
// The id is compared as text because the database driver returns bigint ids as strings.
// Specialised facts (facts.mjs) join the text only when present, so checks recorded before them keep their digest.
export const pairText=(requirement,p)=>{const v=[String(requirement??''),...PAIR_FACTS.map(k=>k==='id'&&p.id!=null?String(p.id):fact(p[k]))],f=readFacts(p);
 if(f===null)v.push({facts_invalid:String(p.facts_json)});else if(Object.keys(f).length)v.push({facts:f});return JSON.stringify(v)};
// Separate stages of a pair; computed matching never reaches confirmed interest or a closed deal.
export const PHASE={REJECT:'Ne odgovara potrebama kupca',PROPERTY:'Mogući par – dopuna podataka o nekretnini',BUYER:'Nekretnina provjerena – usklađivanje s potrebama kupca',REAL:'Stvarna prilika – interes kupca još nije potvrđen'};
// The same property and buyer rules as site_private.property_eligible / investor_eligible
// (ops/pair-review-schema-2026-10-22.json). A pair the database would refuse as a real
// opportunity stays a visible candidate with these open items instead of being dropped.
export const ACTIVE_STATUSES=['Aktivno','Provjereno','Novo - aktivna dražba'];
export const SOURCE_FRESH='Aktualnost izvora nekretnine nije potvrđena unutar 30 dana',ACTIVE_CHECK='Potrebna potvrda aktivnosti oglasa';
export const GUARD_REFUSED='Baza nije prihvatila stvarnu priliku: provjeriti zapis nekretnine i kupca';
export const BUYER_RECORD='Zapis zahtjeva kupca u standardnom obliku (vrste, stanje, izvor, datum)';
const stampOf=v=>v instanceof Date?v.getTime():Date.parse(v??'');
// Mirrors `source_checked_on::timestamptz` between now()-30 days and now().
export function sourceFresh(p,now=Date.now()){const t=stampOf(p.source_checked_on);return Number.isFinite(t)&&t<=now&&now-t<=30*86400000}
export function storedBuyerEligible(i,c,now=Date.now()){
 const t=Date.parse(c.checked_at);
 return i.verified==1&&String(i.preferred_countries||'').trim()!==''&&/^https?:\/\/[^/ ]+/.test(c.source_url||'')&&/(Z|[+-]\d\d:\d\d)$/.test(c.checked_at||'')
  &&Number.isFinite(t)&&t<=now&&now-t<=90*86400000&&Array.isArray(c.property_types)&&c.property_types.length>0&&c.property_types.every(v=>TYPES.includes(v))
  &&Array.isArray(c.conditions)&&c.conditions.length>0&&c.conditions.every(v=>CONDITIONS.includes(v));
}
export const PAIR_CONDITION='Ispunjenje dodatnih uvjeta kupca za ovu nekretninu';
// Original buyer conditions reported by suggestions(): [wording to confirm, fulfilment for one property].
export const SOURCE_CONDITIONS=[['Provjera izvornog opisa vrste i namjene nekretnine','Ispunjenje izvornog opisa vrste i namjene za ovu nekretninu'],
 ['Provjera izvornih lokacijskih uvjeta kupca','Ispunjenje izvornih lokacijskih uvjeta kupca za ovu nekretninu'],
 ['Provjera dodatnih izvornih uvjeta kupca','Ispunjenje dodatnih izvornih uvjeta kupca za ovu nekretninu']];
// The condition text a pair-specific item is checked against; null for items closed by updating a record.
export function conditionText(label,i){
 if(label===PAIR_CONDITION)return String(i.notes||'');
 return SOURCE_CONDITIONS.some(([,f])=>f===label)?sourceConditions(criteria(i)):null;
}
// The latest verified or rejected answer per pair and item decides; a later rejection withdraws a verification,
// an unverified answer changes nothing.
export function pairCheckMap(rows){
 const out=new Map(),seen=new Set();
 for(const r of [...rows].sort((a,b)=>Date.parse(b.recorded_at)-Date.parse(a.recorded_at)||Number(b.id)-Number(a.id))){
  if(r.status!=='Provjereno'&&r.status!=='Odbačeno')continue;
  const pair=r.property_id+'-'+r.investor_id,key=pair+'\n'+r.requirement;if(seen.has(key))continue;seen.add(key);
  if(r.status!=='Provjereno'||!r.digest)continue;
  if(!out.has(pair))out.set(pair,{});
  out.get(pair)[r.requirement]={digest:r.digest,checked_at:new Date(r.answered_on||r.recorded_at).toISOString(),evidence:r.evidence,outcome:r.outcome||'nepoznato'};
 }
 return out;
}
// Verification establishes that an answer is reliable, not that it satisfies the requirement.
export function checkCondition(r,label,text,p,checks,now){
 const c=checks[label];
 if(!checkValid(c,pairText(text,p),now)||!['zadovoljava','ne zadovoljava'].includes(c?.outcome))gap(r,label,'pair');
 else if(c.outcome==='ne zadovoljava')r.rejected.push(label);
}
// Draft questions only: the system never sends them. A question to the seller never names the buyer.
const QUESTIONS=[[/^Cijena nekretnine$/,'Koja je tražena cijena nekretnine i što uključuje (porezi, pristojbe, drugi troškovi)? Ako se prodaje na dražbi, koja je početna ili minimalna ponuda?'],
 [/^Površina/,'Kolika je površina nekretnine ili zemljišta prema službenoj evidenciji (m²)?'],
 [/pravne/,'Možete li dostaviti izvadak iz zemljišne knjige ili drugi dokument o vlasništvu, teretima i eventualnim sporovima?'],
 [/gradnje/,'Koja je namjena prema važećem prostornom planu i postoje li lokacijska ili građevinska dozvola?'],
 [/Aktualnost|aktivnosti oglasa|rok dostupnosti/,'Je li nekretnina još uvijek dostupna i do kada vrijedi ponuda ili rok za ponude?'],
 [/^Stanje/,'U kakvom je stanju nekretnina (useljiva, za obnovu, za rušenje, neizgrađena)?'],
 [/^Vrsta nekretnine$/,'O kojoj se vrsti nekretnine radi i kako je upisana u službenim evidencijama?'],
 [/^(Grad|Regija|Država)$/,'U kojoj se općini i regiji nekretnina nalazi?'],
 [/ROI/,'Postoji li procjena tržišne vrijednosti ili dokumentirani troškovi obnove?'],
 [/^Ispunjenje/,'Molimo podatke o lokaciji, okruženju i namjeni nekretnine potrebne za provjeru dodatnih uvjeta (konkretan uvjet upisati ručno, bez podataka o kupcu).']];
const BUYER_QUESTIONS=[[/napomena|izvorn/,'Možete li potvrditi točan sadržaj svojih dodatnih uvjeta (lokacija, namjena, ostalo) i od kada vrijede?'],
 [/zahtjev kupca|kriteriji/,'Možete li potvrditi trenutne kriterije traženja (države, vrste nekretnina, stanje, površina) i izvor zahtjeva?'],
 [/javnog poziva/,'Je li javni poziv još otvoren i do kada?']];
export function questionDraft(label,side){
 const list=side==='buyer'?BUYER_QUESTIONS:QUESTIONS;
 return {addressed_to:side==='buyer'?'Kupac':/Izvor oglasa/.test(label)?'Interni izvor':'Prodavatelj',body:(list.find(([re])=>re.test(label))?.[1])||'Molimo dodatne podatke potrebne za provjeru: '+label+'.'};
}
// Records an open item on the property, buyer or pair side; missing keeps the combined order.
export function gap(r,label,side){r.missing.push(label);r.gaps[side].push(label)}
export function settle(r){
 r.missing=[...new Set(r.missing)];for(const k of Object.keys(r.gaps))r.gaps[k]=[...new Set(r.gaps[k])];
 r.status=r.rejected.length?REJECT:r.missing.length?CANDIDATE:MATCH;
 r.phase=r.rejected.length?PHASE.REJECT:r.gaps.property.length?PHASE.PROPERTY:r.missing.length?PHASE.BUYER:PHASE.REAL;
 return r;
}
// Area tolerance (owner 6366561469; replaces the ±25 % of 6364306499). A property may be up to 15 % smaller
// than the buyer's lower bound and up to 25 % larger than the upper bound: target 1000 m² (min=max) accepts
// 850–1250 m² inclusive. A range widens both ends (min·0.85 … max·1.25); a one-sided bound widens only that
// side. `area_hard: true` keeps the buyer's own bounds strict. Unknown area is never 0: it stays an open item.
export const AREA_TOLERANCE={below:15,above:25};
const EPS=1e-12;
export function areaFit(area,c){
 if(!num(area)||area<=0)return null;
 const hard=c.area_hard===true,lo=c.min_area,hi=c.max_area;
 // Scaled comparisons (area·100 vs bound·85 / bound·125) avoid 1000·0.85 rounding at the exact limits.
 const okLow=lo==null||(hard?area>=lo:area*100>=lo*(100-AREA_TOLERANCE.below)*(1-EPS));
 const okHigh=hi==null||(hard?area<=hi:area*100<=hi*(100+AREA_TOLERANCE.above)*(1+EPS));
 const deviation=lo!=null&&area<lo?100*(area-lo)/lo:hi!=null&&area>hi?100*(area-hi)/hi:0;
 return {fits:okLow&&okHigh,deviation:Math.sign(deviation)*Math.round(Math.abs(deviation)*10)/10,hard};
}
const pct=v=>(v>0?'+':v<0?'−':'')+String(Math.abs(v)).replace('.',',')+' %';
export function evaluate(p,i,now=Date.now(),pairChecks={},sourceRaw=null){
 let c=criteria(i),reasons=[],rejected=[],info=[],passed=0,checks=0;
 const r={reasons,missing:[],rejected,gaps:{property:[],buyer:[],pair:[]},info};
 const check=(label,buyerKnown,propertyKnown,fits)=>{checks++;if(!buyerKnown)gap(r,label,'buyer');else if(!propertyKnown)gap(r,label,'property');else if(fits){reasons.push(label);passed++}else rejected.push(label)};
 try{validateCriteria(c);if(c._invalid)throw Error()}catch{gap(r,'Ispravni strukturirani kriteriji kupca','buyer');c={}}
 if(!contactRoute(p))gap(r,SELLER_CONTACT,'property');
 if(!contactRoute(i))gap(r,BUYER_CONTACT,'buyer');
 r.contact_eligible=!!contactRoute(p)&&!!contactRoute(i);
 const countries=String(i.preferred_countries||'').split(',').map(v=>v.trim()).filter(Boolean);
 check('Država',countries.length>0,!!p.country,countries.map(v=>norm(country(v))).includes(norm(country(p.country))));
 const total=['price','renovation','other_costs'].every(k=>num(p[k]))?p.price+p.renovation+p.other_costs:null;
 // The property's price is a core fact; the buyer's budget is optional and never blocks a pair.
 if(!num(p.price)||p.price<=0)gap(r,'Cijena nekretnine','property');
 const budget=num(i.min_budget)&&num(i.max_budget)&&i.max_budget>0&&i.max_budget>=i.min_budget;
 if(budget&&total!==null&&total>i.max_budget)info.push('Ukupni trošak iznad navedenog budžeta kupca (informativno)');
 else if(budget&&total!==null&&total<i.min_budget)info.push('Ukupni trošak ispod navedenog budžeta kupca (informativno)');
 for(const [k,f,label,allowed] of [['property_types','property_type','Vrsta nekretnine',TYPES],['conditions','condition','Stanje / obnova / rušenje',CONDITIONS]])check(label,!!c[k]?.length,allowed.includes(p[f]),c[k]?.includes(p[f]));
 for(const [k,f,label] of [['cities','city','Grad'],['regions','region','Regija']])if(c[k]?.length)check(label,true,!!p[f],c[k].map(norm).includes(norm(p[f])));
 if(c.min_area!=null||c.max_area!=null){
  // Module 4: a documented basis compares the request with that confirmed measure (comparable, so the tolerance
  // applies); a known zero is a value. Without a basis the advertised area is used, as before.
  let fit,label='Površina';
  if(c.area_basis){const b=basisArea(c.area_basis,readFacts(p)||{},new Date(now).toISOString().slice(0,10));label='Površina ('+c.area_basis+')';if(b.note)info.push(b.note);
   fit=b.area==null?null:b.area>0?areaFit(b.area,c):{fits:c.min_area==null||c.min_area<=0,deviation:-100,hard:c.area_hard===true}}
  else fit=areaFit(p.area,c);
  check(label,true,fit!==null,fit?.fits);
  if(fit){r.area_deviation=fit.deviation;
   if(fit.deviation&&fit.fits)info.push('Površina '+pct(fit.deviation)+' od tražene granice, unutar tolerancije −15 %/+25 %');
   else if(!fit.fits)info.push('Površina '+pct(fit.deviation)+' od tražene granice, izvan '+(fit.hard?'tvrde granice kupca':'tolerancije −15 %/+25 %'));}
 }
 else if(!num(p.area)||p.area<=0)gap(r,'Površina nekretnine','property');
 if(c.requires_buildable){check('Potvrđena mogućnost gradnje',true,['Da','Ne'].includes(p.buildable),p.buildable==='Da'&&validUrl(p.planning_evidence_url));if(p.buildable==='Da'&&!validUrl(p.planning_evidence_url)){rejected.splice(rejected.indexOf('Potvrđena mogućnost gradnje')>>>0,1);gap(r,'Dokaz mogućnosti gradnje','property')}}
 const roi=num(p.estimated_value)&&total!==null&&total>0?100*(p.estimated_value-total)/total:null;
 if(c.min_roi!=null)check('Minimalni jednostavni ROI',true,roi!==null&&validUrl(p.valuation_evidence_url),roi!==null&&roi>=c.min_roi);
 const checked=Date.parse(c.checked_at),age=now-checked;
 if(!i.verified||!Number.isFinite(checked)||!/(Z|[+-]\d\d:\d\d)$/.test(c.checked_at||'')||age<0||age>90*86400000||!validUrl(c.source_url))gap(r,'Potvrđen zahtjev kupca s izvorom i provjerom unutar 90 dana','buyer');
 // Checking the wording of the buyer's notes confirms what they ask for, not that this property meets it.
 if(String(i.notes||'').trim()){if(!checkValid(c.notes_check,i.notes,now))gap(r,'Dodatni uvjeti iz napomena za ručnu provjeru','buyer');else checkCondition(r,PAIR_CONDITION,i.notes,p,pairChecks,now)}
 const original=sourceRaw||c;
 const applies=[(original.property_types||[]).some(v=>!TYPES.includes(v)),original.preferred_locations?.length||original.locations?.length,original.required_criteria?.length||(original.required&&Object.keys(original.required).length)];
 for(const [n,[wording,fulfilment]] of SOURCE_CONDITIONS.entries())if(applies[n]){
  if(!checkValid(original.source_conditions_check,sourceConditions(original),now))gap(r,wording,'buyer');
  else checkCondition(r,fulfilment,sourceConditions(original),p,pairChecks,now);
 }
 if(c.call_closed||i._call_facts?.source_listing_state==='expired'||i._call_facts?.source_listing_state==='removed')rejected.push('Javni poziv kupca je zatvoren ili istekao');
 for(const d of [c.call_deadline,i._call_facts?.deadline])if(d){
  if(!Number.isFinite(Date.parse(d)))gap(r,'Valjan rok javnog poziva kupca','buyer');
  else if(String(d).slice(0,10)<new Date(now).toISOString().slice(0,10))rejected.push('Javni poziv kupca je zatvoren ili istekao');
 }
 // Documented requirements (facts-v1): a mandatory one is a criterion like any other, an unconfirmed, conflicting or
 // expired fact keeps it open; a wish only adds information. None is skipped.
 if(c.requirements?.length){
  const facts=readFacts(p);if(facts===null)gap(r,'Ispravni strukturirani podaci nekretnine','property');
  r.requirements=compareRequirements(c.requirements,facts||{},now);
  for(const q of r.requirements){const label=requirementLabel(q);
   if(q.mandatory)check(label,true,q.state==='met'||q.state==='unmet',q.state==='met');
   else info.push(label+(q.state==='met'?' — želja ispunjena':q.state==='unmet'?' — želja nije ispunjena (informativno)':' — želja, podatak nije potvrđen'));}
 }
 // Travel time (module 6, off): matching never calls a service. A mandatory travel requirement stays an open pair
 // item until a stored result exists; a wish only informs. A straight-line distance is never used instead.
 for(const t of c.travel||[]){const o=travelOutcome(t,null,now),label='Vrijeme putovanja do „'+t.destination.name+'” ('+t.mode+')';
  if(t.mandatory)gap(r,label+' nije izračunato','pair');else info.push(label+' — želja; '+o.reason);}
 if(!validUrl(p.source))gap(r,'Izvor oglasa','property');
 if(!String(p.city||'').trim())gap(r,'Grad nekretnine','property');
 if(!sourceFresh(p,now))gap(r,SOURCE_FRESH,'property');
 if(!ACTIVE_STATUSES.includes(p.status))gap(r,ACTIVE_CHECK,'property');
 if(!storedBuyerEligible(i,sourceRaw||criteria(i),now))gap(r,BUYER_RECORD,'buyer');
 if(p.legal==='Komplikacije')rejected.push('Pravne komplikacije');else if(p.legal!=='Uredno'||!validUrl(p.legal_evidence_url))gap(r,'Dokaz pravne provjere','property');
 const deadline=p.available_until||p.bid_deadline_at;let expired=false;
 if(deadline){const stamp=Date.parse(deadline);if(!Number.isFinite(stamp))gap(r,'Valjan rok dostupnosti','property');else expired=/^\d{4}-\d{2}-\d{2}$/.test(deadline)?String(deadline)<new Date(now).toISOString().slice(0,10):stamp<now}
 if(['prodano','povuceno','rok istekao','zatvoreno'].some(v=>norm(p.status).startsWith(v))||expired)rejected.push('Nekretnina više nije aktivna');
 return settle({...r,score:checks?Math.round(100*passed/checks):0,total_cost:total,roi});
}
// Buyer draft from a discovered source candidate (6369690655 point 2). Every known criterion and call fact is kept;
// an unknown budget stays NULL (never 0); the seat is not the EU interest. Interest comes only from the source:
// published preferred countries, or the location of a public buy request (as site_private.sync_source_listing).
export const BUYER_FACTS=['property_types','conditions','cities','regions','min_area','max_area','requires_buildable','area_hard','preferred_locations','locations','required_criteria','required','original_property_types','min_area_m2','max_area_m2'];
const euCountry=v=>Object.values(COUNTRIES).includes(country(v))?country(v):null;
export function buyerDraft(r,f={}){
 const c=Object.fromEntries(BUYER_FACTS.filter(k=>f[k]!=null).map(k=>[k,f[k]]));
 Object.assign(c,{source_url:r.url,checked_at:r.last_seen,candidate_source_id:r.id});
 if(f.buyer_type==='public_authority')c.buyer_kind='Javno tijelo';
 if(f.listing_kind)c.listing_kind=f.listing_kind;
 if(f.deadline)c.call_deadline=f.deadline;
 if(['expired','removed'].includes(f.source_listing_state))c.call_closed=f.source_status_evidence||f.source_listing_state;
 const listed=(Array.isArray(f.preferred_countries)?f.preferred_countries:String(f.preferred_countries||'').split(',')).map(euCountry).filter(Boolean);
 const publicDemand=['buy_request','public_buy_request'].includes(f.transaction_type)||f.listing_kind==='public_buy_request'||f.buyer_type==='public_authority';
 const interest=[...new Set(listed.length?listed:publicDemand&&euCountry(r.country)?[euCountry(r.country)]:[])];
 c.interest_basis=listed.length?'Države navedene u izvoru':interest.length?'Lokacija objavljene potražnje':'Interes za države EU nije naveden u izvoru';
 // A per-m² price or a programme total is not the buyer's budget.
 const budget=num(f.budget)&&!['EUR/m2','EUR/m²','€/m²'].includes(f.budget_unit)&&!('unit_budget' in f)?f.budget:null;
 return {name:r.title,country:country(f.seat_country||f.headquarters_country||r.country),min_budget:null,max_budget:budget,preferred_countries:interest.join(','),
  notes:('Javni zahtjev; provjeri lokaciju i sve uvjete. '+(f.location_note||'')+' '+(f.development_note||'')).trim(),verified:0,criteria_json:JSON.stringify(c)};
}
export function propertyInput(input){
 const out={};const texts=['price_basis','country','city','region','title','property_type','condition','source','legal','status','buildable','planning_evidence_url','legal_evidence_url','valuation_evidence_url','available_until','risk_notes'];
 for(const k of texts)if(k in input){if(input[k]!=null&&typeof input[k]!=='string')throw Error('Nevaljano polje: '+k);out[k]=input[k]?.trim()||null;if(out[k]?.length>4000)throw Error('Predug podatak: '+k)}
 for(const k of ['price','area','renovation','other_costs','estimated_value'])if(k in input){if(input[k]!=null&&!num(input[k]))throw Error('Nevaljan broj: '+k);out[k]=input[k]??null}
 // Only when sent: records saved without specialised facts never touch the facts_json column.
 if(Object.hasOwn(input,'facts_json'))out.facts_json=input.facts_json==null||input.facts_json===''?null:JSON.stringify(validateFacts(input.facts_json));
 if(!out.title||!validUrl(out.source)||!Object.values(COUNTRIES).includes(country(out.country)))throw Error('Unesi naziv, državu EU i valjan URL izvornog oglasa.');
 if(out.property_type&&!TYPES.includes(out.property_type))throw Error('Nepoznata vrsta nekretnine.');
 if(out.condition&&!CONDITIONS.includes(out.condition))throw Error('Nepoznato stanje nekretnine.');
 if(!['Nepoznato','Uredno','Komplikacije'].includes(out.legal))throw Error('Odaberi pravni status.');
 if(out.buildable&&!['Nepoznato','Da','Ne'].includes(out.buildable))throw Error('Nevaljana mogućnost gradnje.');
 for(const k of ['planning_evidence_url','legal_evidence_url','valuation_evidence_url'])if(out[k]&&!validUrl(out[k]))throw Error('Dokazi moraju biti valjani URL-ovi.');
 if(out.legal==='Uredno'&&!out.legal_evidence_url)throw Error('Za status Uredno potreban je dokaz pravne provjere.');
 if(out.estimated_value!=null&&!out.valuation_evidence_url)throw Error('Za tržišnu procjenu potreban je URL dokaza.');
 if(out.buildable==='Da'&&!out.planning_evidence_url)throw Error('Za potvrđenu gradnju potreban je URL dokaza.');
 if(out.available_until&&(!/^\d{4}-\d{2}-\d{2}$/.test(out.available_until)||!Number.isFinite(Date.parse(out.available_until))||new Date(out.available_until).toISOString().slice(0,10)!==out.available_until))throw Error('Rok mora biti valjan datum YYYY-MM-DD.');
 return {...out,...contactInput(input),updated:new Date().toISOString()};
}
export function investorInput(input){
 const out={};for(const k of ['name','country','preferred_countries','notes']){if(typeof input[k]!=='string'||input[k].length>8000)throw Error('Nevaljano polje: '+k);out[k]=input[k].trim()}
 // The seat may be outside the EU; EU interest is preferred_countries and stays separate.
 if(!out.name||!out.country||out.country.length>80)throw Error('Unesi naziv kupca i sjedište.');
 // Unknown budget stays NULL; only known bounds are validated.
 const low=input.min_budget??null,high=input.max_budget??null;
 if((low!=null&&!num(low))||(high!=null&&(!num(high)||high<=0))||(low!=null&&high!=null&&high<low))throw Error('Unesi valjan raspon budžeta ili ostavi nepoznat iznos prazan.');
 const c=criteria(input);validateCriteria(c);if(c._invalid)throw Error('Nevaljani kriteriji.');
 for(const k of ['notes_check','source_conditions_check']){const v=c[k];if(v==null)continue;const t=Date.parse(v?.checked_at);
  if(typeof v!=='object'||!/^[0-9a-f]{8}$/.test(v.digest||'')||!/(Z|[+-]\d\d:\d\d)$/.test(v.checked_at||'')||!Number.isFinite(t)||t>Date.now()+60000||typeof v.evidence!=='string'||!v.evidence.trim()||v.evidence.length>2000)throw Error('Nevaljana provjera dodatnih uvjeta.')}
 if(c.checked_at&&(!/(Z|[+-]\d\d:\d\d)$/.test(c.checked_at)||!Number.isFinite(Date.parse(c.checked_at))||Date.parse(c.checked_at)>Date.now()))throw Error('Datum provjere nije valjan.');
 if(![0,1,false,true].includes(input.verified))throw Error('Nevaljana potvrda zahtjeva.');
 if(input.verified&&(!validUrl(c.source_url)||!c.checked_at||!out.preferred_countries||!c.property_types?.length||!c.conditions?.length))throw Error('Za potvrđen zahtjev navedi izvor, datum i kriterije.');
 return {...out,...contactInput(input),min_budget:low,max_budget:high,verified:input.verified?1:0,criteria_json:JSON.stringify(c)};
}

// Rank only current MATCH listings for the same buyer, city, type, condition and explicit asking-price basis.
// Auction starting bids and unknown bases never compete with asking prices. EUR is the system's currency.
export function rankAffordability(rows,props){
 const groups=new Map(),byId=new Map(props.map(p=>[String(p.id),p]));
 for(const row of rows){
  const r=JSON.parse(row.result_json),p=byId.get(String(row.property_id));
  r.affordability={rank:null,compared:0,label:'Nema dovoljno usporedivih ponuda'};
  const basis=norm(p?.price_basis);
  if(r.status===MATCH&&p&&['asking','asking_price','trazena cijena','trazena'].includes(basis)&&p.city&&num(p.area)&&p.area>0&&num(p.price)&&p.price>0&&(!p.currency||p.currency==='EUR')&&!p.auction_at&&!p.bid_deadline_at&&!/drazb|auction/i.test(p.status||'')){
   // Size band prevents comparing a small plot to a huge development site; building condition stays separate.
   const key=JSON.stringify([String(row.investor_id),norm(country(p.country)),norm(p.city),p.property_type,p.condition,Math.floor(Math.log(p.area)/Math.log(1.5))]);
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push({r,row,value:p.price/p.area});
  }
  row.result_json=JSON.stringify(r);
 }
 for(const group of groups.values()){
  if(group.length<2)continue;
  group.sort((a,b)=>a.value-b.value||String(a.row.property_id).localeCompare(String(b.row.property_id)));
  for(let n=0;n<group.length;n++){
   const item=group[n],rank=group.findIndex(x=>x.value===item.value)+1;
   item.r.affordability={rank,compared:group.length,price_per_m2:item.value,basis:'Tražena cijena EUR/m²',label:'Povoljnost '+rank+'/'+group.length+' među dostupnim usporedivim ponudama (tražena cijena/m²; dodatni troškovi zasebno)'};
   item.row.result_json=JSON.stringify(item.r);
  }
 }
 return rows;
}


// A contact is record-bound evidence, never inferred from a portal or a company name.
export const SELLER_CONTACT='Upotrebljiv kontakt prodavatelja ili njegove agencije';
export const BUYER_CONTACT='Upotrebljiv kontakt kupca/investitora ili njegove agencije';
export function contactData(row){try{const c=typeof row.contact_json==='string'?JSON.parse(row.contact_json):row.contact_json;return c&&typeof c==='object'&&!Array.isArray(c)?c:{}}catch{return {}}}
const contactUrl=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!/[\s\u0000-\u001f]/.test(v)}catch{return false}};
const contactText=v=>typeof v==='string'&&v.trim().length>0&&v.length<=2000&&!/[\u0000-\u001f]/.test(v);
export function contactRoute(row){
 const c=contactData(row),source=row.source||criteria(row).source_url;
 const endpoint=contactText(c.email)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)||contactText(c.phone)&&/^\+?[0-9 ()/.-]{7,30}$/.test(c.phone)&&c.phone.replace(/\D/g,'').length>=7||contactText(c.contact_url)&&contactUrl(c.contact_url);
 if(!['direct','agency'].includes(c.mode)||c.permitted!==true||!endpoint||!contactText(c.name)||!contactUrl(c.evidence_url)||!contactUrl(source)||c.record_reference!==source)return null;
 if(c.mode==='agency'&&(!contactText(c.agency_name)||c.represents_record!==true))return null;
 return {mode:c.mode,label:c.mode==='agency'?'Kontakt preko agencije':'Izravan kontakt',name:c.mode==='agency'?c.agency_name:c.name};
}
export function contactInput(input){
 if(!Object.hasOwn(input,'contact_json'))return {};
 if(input.contact_json==null||input.contact_json==='')return {contact_json:null};
 let raw=input.contact_json;try{raw=typeof raw==='string'?JSON.parse(raw):raw}catch{throw Error('Kontakt mora biti valjan JSON objekt.')}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Kontakt mora biti valjan JSON objekt.');
 const c=raw,out={};
 for(const k of ['mode','name','agency_name','record_reference','email','phone','contact_url','evidence_url','permission_scope','permission_quote','permission_basis','checked_at']){
  if(c[k]!=null&&typeof c[k]!=='string')throw Error('Nevaljano polje kontakta: '+k);
  if(c[k]?.length>2000||/[\u0000-\u001f]/.test(c[k]||''))throw Error('Nevaljano polje kontakta: '+k);
  if(c[k]?.trim())out[k]=c[k].trim();
 }
 for(const k of ['permitted','represents_record']){if(c[k]!=null&&typeof c[k]!=='boolean')throw Error('Nevaljana potvrda kontakta.');if(c[k]!=null)out[k]=c[k]}
 if(out.permission_scope&&out.permission_scope!=='property_enquiry_only')throw Error('Nepoznat opseg upita.');
 if(out.permission_scope&&(!out.permission_quote||!out.permission_basis||!/(Z|[+-]\d\d(?::?\d\d)?)$/.test(out.checked_at||'')||!Number.isFinite(Date.parse(out.checked_at))))throw Error('Za ograničeni upit potreban je izvorni dokaz i vrijeme provjere.');
 if(out.mode&&!['direct','agency'].includes(out.mode))throw Error('Odaberi izravan ili agencijski kontakt.');
 if(out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))throw Error('Nevaljana e-pošta kontakta.');
 if(out.phone&&(!/^\+?[0-9 ()/.-]{7,30}$/.test(out.phone)||out.phone.replace(/\D/g,'').length<7))throw Error('Nevaljan telefon kontakta.');
 for(const k of ['contact_url','evidence_url'])if(out[k]&&!contactUrl(out[k]))throw Error('Nevaljana poveznica kontakta.');
 if(out.permitted===true&&!contactRoute({...input,contact_json:out}))throw Error('Za potvrđen kontakt potrebni su kontaktni kanal, dokaz i povezanost s konkretnim zapisom.');
 return {contact_json:Object.keys(out).length?JSON.stringify(out):null};
}



