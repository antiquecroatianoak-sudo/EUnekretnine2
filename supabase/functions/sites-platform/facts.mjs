// Versioned data contract for specialised property facts and documented buyer requirements (plan #46 addendum,
// module 1, ops/buyer-workflow-enhancements-plan.md). Unknown is never false or zero, a requirement is never ignored:
// what cannot be compared stays a visible open item. Mirrored by facts.py; ops/facts-vectors-v1.json holds the shared
// test vectors. Copies: every directory that holds domain.mjs.
export const FACTS_VERSION='facts-v1';
export const FACT_STATUS=['potvrđeno','nepotvrđeno','proturječno'];
export const FACT_ORIGIN=['izvor','ručno','partner','predloženo'];
// Units convert only within one dimension; m² and ha are both areas, kW and MW both power.
export const UNITS={m2:['area',1],ha:['area',10000],m:['length',1],kW:['power',1],MW:['power',1000],kom:['count',1]};
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
// The latest calendar date anywhere (UTC+14) at `now`: an entered observation date after it has not happened yet. Input
// allows the whole of "today" in every time zone; matching compares with the UTC date (compareRequirement).
export const latestDay=now=>new Date(now+14*3600000).toISOString().slice(0,10);
// Definitions only: which facts exist, their type and unit dimension. How a sector uses them (modules 4 and 5) is
// decided by the documented requirement of a concrete request, never by a default.
export const FACTS={
 land_total:{label:'Ukupno oglašeno zemljište',type:'number',dim:'area',meaning:'Sva oglašena površina zemljišta, bez obzira na vlasništvo ili zakup'},
 land_owned:{label:'Zemljište u vlasništvu uključeno u prodaju',type:'number',dim:'area',meaning:'Samo zemljište koje prodavatelj posjeduje i koje ulazi u prodaju'},
 land_leased:{label:'Zakupljeno zemljište',type:'number',dim:'area',meaning:'Zemljište u zakupu; nije vlasništvo kupca nakon kupnje'},
 building_area:{label:'Površina zgrada',type:'number',dim:'area',meaning:'Bruto površina zgrada'},
 usable_area:{label:'Korisna površina',type:'number',dim:'area',meaning:'Korisna (neto) površina'},
 rooms:{label:'Broj soba / smještajnih jedinica',type:'number',dim:'count',integer:true,max:5000,meaning:'Dokumentirani broj soba ili smještajnih jedinica'},
 hotel_category:{label:'Dokumentirana kategorija smještaja',type:'number',dim:'count',integer:true,min:1,max:5,meaning:'Službena kategorija (broj zvjezdica) prema rješenju'},
 operating_months:{label:'Mjeseci rada godišnje',type:'number',dim:'count',integer:true,max:12,meaning:'Sezonalnost: broj mjeseci u kojima objekt radi'},
 renovation_needed:{label:'Potrebna obnova',type:'boolean',meaning:'Dokumentirana potreba obnove prije rada'},
 clear_height:{label:'Dokumentirana svijetla visina',type:'number',dim:'length',max:60,meaning:'Svijetla visina skladišta; osnova mjerenja navodi se u dokazu'},
 power:{label:'Priključna električna snaga',type:'number',dim:'power',max:1000000,meaning:'Odobrena priključna snaga (granica u kW)'},
 truck_access:{label:'Pristup kamionima / utovar',type:'boolean',meaning:'Dokumentiran pristup teretnim vozilima ili utovarna rampa'},
 water_rights:{label:'Dokumentirana prava na vodu',type:'boolean',meaning:'Pravo korištenja vode prema dokumentu'},
 farm_production:{label:'Namjena / proizvodnja farme',type:'enum',values:['ratarstvo','voćarstvo','vinogradarstvo','maslinarstvo','stočarstvo','mješovita proizvodnja'],meaning:'Dokumentirana poljoprivredna proizvodnja'},
 operating:{label:'Objekt posluje',type:'boolean',meaning:'Objekt je u radu (posluje) prema dokazu'},
 includes_buildings:{label:'Prodaja uključuje zgrade',type:'boolean',meaning:'Zgrade su dokumentirano dio prodaje i cijene'},
 includes_equipment:{label:'Prodaja uključuje opremu',type:'boolean',meaning:'Oprema je dokumentirano dio prodaje i cijene'},
 includes_business:{label:'Prodaja uključuje poslovanje',type:'boolean',meaning:'Poslovanje (društvo, ugovori, licencije) dokumentirano ulazi u prodaju'},
 subtype:{label:'Podvrsta / namjena',type:'enum',values:['hotel','turistički smještaj','skladište / logistika','industrijski objekt','farma','mješovita imovina'],
  meaning:'Opcionalna podvrsta uz pet osnovnih vrsta; ne mijenja osnovnu vrstu nekretnine'}};
export const OPS={number:['min','max'],boolean:['equals'],enum:['includes']};
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
function checkValue(def,value,unit,where){
 if(def.type==='number'){if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error(where+': vrijednost mora biti nenegativan broj.');
  if(!UNITS[unit]||UNITS[unit][0]!==def.dim)throw Error(where+': jedinica mora biti dimenzije '+def.dim+'.');
  // Range checks in the base unit of the dimension; a wrong unit or an impossible value never passes.
  const b=value*UNITS[unit][1];if(def.integer&&!Number.isInteger(b))throw Error(where+': vrijednost mora biti cijeli broj.');
  if(def.min!=null&&b<def.min||def.max!=null&&b>def.max)throw Error(where+': vrijednost izvan dopuštenog raspona.')}
 else if(def.type==='boolean'){if(typeof value!=='boolean')throw Error(where+': vrijednost mora biti da/ne.')}
 else for(const v of Array.isArray(value)?value:[value])if(!def.values.includes(v))throw Error(where+': nepoznata vrijednost.');
}
// Property facts: {key: {value, unit?, origin, status, evidence, observed_on, valid_until?}}. A confirmed fact needs evidence.
// With `now` (new input) an observation date in the future is refused; stored records are read without it, so an older
// record keeps its data and history and the comparison leaves such a fact open (state 'future').
export function validateFacts(raw,{now}={}){
 const f=typeof raw==='string'?JSON.parse(raw):raw;
 if(!f||typeof f!=='object'||Array.isArray(f))throw Error('Podaci nekretnine moraju biti objekt.');
 const out={};
 for(const [k,v] of Object.entries(f)){
  const def=FACTS[k];if(!def)throw Error('Nepoznat podatak nekretnine: '+k);
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error(def.label+': neispravan zapis.');
  checkValue(def,v.value,v.unit,def.label);
  if(def.type==='enum'&&Array.isArray(v.value))throw Error(def.label+': nekretnina ima jednu podvrstu.');
  if(!FACT_STATUS.includes(v.status)||!FACT_ORIGIN.includes(v.origin))throw Error(def.label+': status i podrijetlo su obavezni.');
  if(v.status==='potvrđeno'&&!text(v.evidence,2000))throw Error(def.label+': potvrđen podatak traži dokaz.');
  // A proposal (parser, partner draft) is never confirmed as such: a reviewed fact names its real origin.
  if(v.status==='potvrđeno'&&v.origin==='predloženo')throw Error(def.label+': prijedlog ne može biti potvrđen podatak.');
  if(v.evidence!=null&&!text(v.evidence,2000))throw Error(def.label+': neispravan dokaz.');
  if(!day(v.observed_on))throw Error(def.label+': datum opažanja YYYY-MM-DD je obavezan.');
  if(now!=null&&v.observed_on>latestDay(now))throw Error(def.label+': datum opažanja ne smije biti u budućnosti.');
  if(v.valid_until!=null&&(!day(v.valid_until)||v.valid_until<v.observed_on))throw Error(def.label+': neispravan rok važenja.');
  out[k]={value:v.value,...(v.unit?{unit:v.unit}:{}),origin:v.origin,status:v.status,...(v.evidence?{evidence:v.evidence.trim()}:{}),observed_on:v.observed_on,...(v.valid_until?{valid_until:v.valid_until}:{})};
 }
 return out;
}
// min above max for the same fact, compared in the base unit of its dimension (2 ha > 10 000 m²). Returns the keys.
export function invertedRanges(list){
 const out=[];for(const key of new Set((list||[]).map(q=>q.key))){const lo=list.find(q=>q.key===key&&q.op==='min'),hi=list.find(q=>q.key===key&&q.op==='max');
  if(lo&&hi&&UNITS[lo.unit]&&UNITS[hi.unit]&&lo.value*UNITS[lo.unit][1]>hi.value*UNITS[hi.unit][1])out.push({key,min:lo,max:hi})}
 return out;
}
// Buyer requirements: [{key, op, value, unit?, mandatory, quote}], each documented by the source wording it comes from.
// `strict` (new input): a mandatory min above a mandatory max is refused. Stored requests are read without it and the
// comparison keeps such a range open (state 'inverted') instead of rejecting properties.
export function validateRequirements(list,{strict=false}={}){
 if(!Array.isArray(list)||list.length>50)throw Error('Zahtjevi moraju biti popis (najviše 50).');
 const seen=new Set();
 const out=list.map((q,n)=>{
  const where='Zahtjev '+(n+1),def=FACTS[q?.key];if(!def)throw Error(where+': nepoznat podatak.');
  if(!OPS[def.type].includes(q.op))throw Error(where+': nevaljana usporedba.');
  checkValue(def,q.value,q.unit,where);
  if(typeof q.mandatory!=='boolean')throw Error(where+': odredi je li uvjet obavezan ili želja.');
  if(!text(q.quote,500))throw Error(where+': potreban je izvorni navod zahtjeva.');
  const id=q.key+'\n'+q.op;if(seen.has(id))throw Error(where+': isti uvjet je naveden dvaput.');seen.add(id);
  return {key:q.key,op:q.op,value:q.value,...(q.unit?{unit:q.unit}:{}),mandatory:q.mandatory,quote:q.quote.trim()};
 });
 if(strict)for(const r of invertedRanges(out))if(r.min.mandatory&&r.max.mandatory)throw Error(FACTS[r.key].label+': najmanja vrijednost veća je od najveće (obrnut raspon).');
 return out;
}
export function readFacts(row){const v=row?.facts_json;if(v==null||v==='')return {};try{return validateFacts(v)}catch{return null}}
const base=(value,unit)=>value*UNITS[unit][1];
// One requirement against the property's facts: met / unmet (comparable and confirmed), otherwise unknown, conflict or
// expired. Nothing is inferred from a missing or unconfirmed fact.
export function compareRequirement(q,facts,today){
 const def=FACTS[q.key],f=facts?.[q.key],label=def.label;
 const out={key:q.key,label,mandatory:q.mandatory,op:q.op,requested:q.value,unit:q.unit??null,quote:q.quote,actual:f?.value??null,actual_unit:f?.unit??null,evidence:f?.evidence??null};
 if(!f)return {...out,state:'unknown'};
 if(f.status==='proturječno')return {...out,state:'conflict'};
 if(f.status!=='potvrđeno')return {...out,state:'unknown'};
 if(f.observed_on>today)return {...out,state:'future'};
 if(f.valid_until&&f.valid_until<today)return {...out,state:'expired'};
 let fits;
 if(def.type==='number'){const a=base(f.value,f.unit),b=base(q.value,q.unit);fits=q.op==='min'?a>=b:a<=b}
 else if(def.type==='boolean')fits=f.value===q.value;
 else fits=(Array.isArray(q.value)?q.value:[q.value]).includes(f.value);
 return {...out,state:fits?'met':'unmet'};
}
// A wish that contradicts another requirement of the same fact, or a mandatory bound whose counterpart is also
// mandatory, is 'inverted': no property can meet it, so it stays open (buyer side) and is never a green or red result.
export function compareRequirements(requirements,facts,now=Date.now()){
 const today=new Date(now).toISOString().slice(0,10),inv=invertedRanges(requirements||[]);
 const inverted=q=>inv.some(r=>r.key===q.key&&(!q.mandatory||(q.op==='min'?r.max:r.min).mandatory));
 return (requirements||[]).map(q=>inverted(q)?{...compareRequirement(q,facts,today),state:'inverted'}:compareRequirement(q,facts,today));
}
// Labels evaluate() records for each state; a wish only ever adds information.
export const requirementLabel=r=>'Uvjet zahtjeva: '+r.label;
export const STATE_GAP={unknown:'Podatak nekretnine nije potvrđen',conflict:'Proturječan podatak nekretnine',expired:'Zastario podatak nekretnine',future:'Datum opažanja podatka je u budućnosti',inverted:'Proturječan raspon u zahtjevu kupca'};

// Module 4: which measured area a request means. Requests without a basis keep the advertised area (legacy).
export const AREA_BASIS={'zemljište ukupno':'land_total','zemljište u vlasništvu':'land_owned','površina zgrada':'building_area','korisna površina':'usable_area'};
const usable=(f,today)=>f&&f.status==='potvrđeno'&&!(f.observed_on>today)&&!(f.valid_until&&f.valid_until<today);
// Land composition: owned + leased must agree with the advertised total (0.5 %); measures are never summed into one.
export function landComposition(facts,today){
 const [t,o,l]=['land_total','land_owned','land_leased'].map(k=>usable(facts?.[k],today)?facts[k].value*UNITS[facts[k].unit][1]:null);
 if(o!=null&&t!=null&&o>t*1.005)return {consistent:false,note:'Zemljište u vlasništvu veće je od ukupno oglašenog'};
 if(t==null||o==null||l==null)return {consistent:null};
 return Math.abs(o+l-t)<=t*0.005?{consistent:true}:{consistent:false,note:'Vlasništvo i zakup ne zbrajaju se u ukupno oglašeno zemljište'};
}
// The area a request is compared with: m² of the confirmed fact for its basis, or null (open item) with the reason.
export function basisArea(basis,facts,today){
 const key=AREA_BASIS[basis],f=facts?.[key];
 if(!usable(f,today))return {area:null,reason:f?.status==='proturječno'?'conflict':f&&f.status==='potvrđeno'?(f.observed_on>today?'future':'expired'):'unknown'};
 if(key==='land_owned'||key==='land_total'){const c=landComposition(facts,today);if(c.consistent===false)return {area:null,reason:'composition',note:c.note}}
 return {area:f.value*UNITS[f.unit][1],reason:null};
}

// Module 5: fields a sector usually documents; listing them never makes them mandatory or required.
export const SECTOR_TEMPLATES={hotel:['subtype','rooms','hotel_category','operating','operating_months','renovation_needed'],
 'skladište / logistika':['subtype','usable_area','clear_height','truck_access','power'],
 farma:['subtype','farm_production','land_owned','land_leased','water_rights','includes_buildings','includes_equipment']};
