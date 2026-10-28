// Limited local parser for a buyer's request written as plain text (plan #46 addendum, module 3, local-parser-v1).
// It proposes, it never decides: every proposed value carries the exact source quote it comes from, a confidence and
// open ambiguities, and nothing is saved until an operator confirms it in the request form. It never sets
// verification, contacts, legal status, mandate or interest. The text is data, never an instruction. Unrecognised
// sentences stay listed as unsupported; general understanding of free text is not claimed.
import {TYPES,CONDITIONS,COUNTRIES} from './domain.mjs';
export const PARSER_VERSION='local-parser-v1';
const norm=v=>String(v||'').toLocaleLowerCase('hr').normalize('NFKD').replace(/[̀-ͯ]/g,'');
const clean=v=>String(v||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ');
// Vocabulary (HR, EN, DE, IT, FR, ES samples). A word maps to one of the five base types; hotel/warehouse/farm are
// subtypes (facts-v1) whose base type is left to the operator, because such assets are often mixed.
const TYPE_WORDS=[[/\b(zemljist|gradevinsk\w* (zemljist|parcel)|parcel|plot|land\b|grundstuck|bauland|terren|terrain)/,'Zemljište'],
 [/\b(kuc[aeiu]|kuca|house|villa|haus|casa\b|maison|vivienda unifamiliar)/,'Kuća'],[/\b(stan(a|ove|ovi)?\b|apartment|flat\b|wohnung|appartament|appartement|piso\b)/,'Stan'],
 [/\b(zgrad|building(?! (land|plot|site))|gebaude|edifici|immeuble|stambeno-poslovn)/,'Zgrada'],[/\b(poslovn\w* prostor|ured\b|office|commercial|gewerbe|buro|ufficio|local comercial|lokala?\b)/,'Poslovni prostor']];
const SUBTYPE_WORDS=[[/\b(hotel|hostel|aparthotel)/,'hotel'],[/\b(turisticki smjestaj|holiday rental|ferienwohn|kamp\b|camping)/,'turistički smještaj'],
 [/\b(skladist|logisti|warehouse|lager|magazzin|entrepot)/,'skladište / logistika'],[/\b(industrij|factory|fabrik|tvornic|pogon)/,'industrijski objekt'],
 [/\b(farm|poljoprivredn|gospodarstv|bauernhof|agricol|ferme|finca)/,'farma']];
const CONDITION_WORDS=[[/\b(useljiv|ready to move|move-in|bezugsfertig|abitabil)/,'Useljivo'],[/\b(za obnovu|potrebn\w* obnov|renovat|refurb|sanierung|ristruttur|a renovar)/,'Za obnovu'],
 [/\b(za rusenje|rusenj|demoli|abriss)/,'Za rušenje'],[/\b(neizgraden|greenfield|unbebaut|unbuilt|vacant land)/,'Neizgrađeno']];
// EU27 names in Croatian (COUNTRIES), English and a few native forms. Bare ISO codes are not used ("IT" is not Italy).
const EN={AT:'austria',BE:'belgium',BG:'bulgaria',HR:'croatia',CY:'cyprus',CZ:'czech',DK:'denmark',EE:'estonia',FI:'finland',FR:'france',DE:'germany',GR:'greece',HU:'hungary',IE:'ireland',IT:'italy',LV:'latvia',LT:'lithuania',LU:'luxembourg',MT:'malta',NL:'netherlands',PL:'poland',PT:'portugal',RO:'romania',SK:'slovakia',SI:'slovenia',ES:'spain',SE:'sweden'};
const NATIVE={HR:'hrvatsk',DE:'deutschland',IT:'itali',ES:'espan',FR:'francais',AT:'osterreich',SI:'slovenij',HU:'magyar',PL:'polsk',IE:'irsk',NL:'nederland'};
const SEAT=/\b(sjedist|sa sjedistem|registriran|headquarter|based in|seat\b|sitz\b|sede\b|siege\b|domicil)/;
const NEG_REQ=/\b(nije uvjet|nije nuzno|nije obavezn|not required|no requirement|kein muss|non necessari)/;
const MANDATORY=/\b(obavezn|mora\b|moraju|nuzno|uvjet\b|must|required|mandatory|zwingend|obbligatori|obligatoire)/;
const WISH=/\b(pozeljn|po mogucnosti|idealno|preferably|ideally|nice to have|wunschenswert|preferibil|de preference)/;
// Numbers: "15.000", "15 000", "1,5", "1.234,5". A lone ",ddd" or ".ddd" is ambiguous between decimals and thousands.
function number(raw){
 const s=raw.replace(/\s/g,'');
 if(/^\d{1,3}(\.\d{3})+,\d+$/.test(s))return {value:Number(s.replace(/\./g,'').replace(',','.')),ambiguous:false};
 if(/^\d{1,3}(,\d{3})+\.\d+$/.test(s))return {value:Number(s.replace(/,/g,'')),ambiguous:false};
 if(/^\d{1,3}(\.\d{3}){2,}$/.test(s))return {value:Number(s.replace(/\./g,'')),ambiguous:false};
 if(/^\d{1,3}(,\d{3}){2,}$/.test(s))return {value:Number(s.replace(/,/g,'')),ambiguous:false};
 if(/^\d{1,3}[.,]\d{3}$/.test(s))return {value:Number(s.replace(/[.,]/,'')),ambiguous:true,alt:Number(s.replace(',','.'))};
 if(/^\d+,\d+$/.test(s))return {value:Number(s.replace(',','.')),ambiguous:false};
 if(/^\d+(\.\d+)?$/.test(s))return {value:Number(s),ambiguous:false};
 return null;
}
const NUM='(\\d{1,3}(?:[ .,]\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';
const AREA_UNIT='(m2|m²|sqm|m\\^2|kvadrat\\w*|square met\\w*|quadratmeter\\w*|ha\\b|hektar\\w*|hectar\\w*|ettar\\w*)';
const unitOf=u=>/^(ha|hektar|hectar|ettar)/i.test(u)?'ha':'m2';
const toM2=(v,u)=>u==='ha'?v*10000:v;
// Sentence-level spans, so every quote is a verbatim substring of the source text.
// A dot or comma between digits (15.000, 1,5) is part of a number, not the end of a sentence.
function sentences(text){const out=[];const re=/(?:(?<=\d)[.,](?=\d)|[^.!?;\n])+(?:[.!?;]|\n|$)/g;let m;while((m=re.exec(text))){const s=m[0].trim();if(s)out.push(s)}return out}
// Separate requests are explicit: numbered items, "Zahtjev 2", "Request B" or blank-line separated blocks. Bullets
// usually list features of one request, so they never split.
export function splitRequests(text){
 const t=clean(text).replace(/\r\n?/g,'\n');
 const marked=t.split(/\n(?=\s*(?:\d+[.)]\s|zahtjev\s+\w+\s*[:.)-]|request\s+\w+\s*[:.)-]|anfrage\s+\w+\s*[:.)-]))/i).map(s=>s.trim()).filter(Boolean);
 const blocks=(marked.length>1?marked:t.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean));
 return blocks.length?blocks:[t.trim()].filter(Boolean);
}
function parseOne(block){
 const fields={},evidence={},confidence={},ambiguities=[],unsupported=[],requirements=[];
 const put=(k,v,quote,conf='visoka')=>{fields[k]=v;evidence[k]=quote;confidence[k]=conf};
 const types=new Set(),subtypes=new Set(),conditions=new Set(),countries=new Set(),seat=new Set();
 const used=new Set();
 for(const s of sentences(block)){
  const n=norm(s);let hit=false;
  const isSeat=SEAT.test(n),notRequired=NEG_REQ.test(n);
  // Countries: the seat sentence names the seat, which is never demand.
  for(const [iso,name] of Object.entries(COUNTRIES)){const words=[norm(name).slice(0,6),EN[iso],NATIVE[iso]].filter(Boolean);
   if(words.some(w=>n.includes(w))){(isSeat?seat:countries).add(iso);hit=true;(isSeat?evidence.seat_quote=s:evidence['country_'+iso]=s)}}
  if(isSeat)hit=true;
  for(const [re,t] of TYPE_WORDS)if(re.test(n)){types.add(t);evidence['type_'+t]??=s;hit=true}
  for(const [re,t] of SUBTYPE_WORDS)if(re.test(n)){subtypes.add(t);evidence['subtype_'+t]??=s;hit=true}
  for(const [re,c] of CONDITION_WORDS)if(re.test(n)){conditions.add(c);evidence['condition_'+c]??=s;hit=true}
  // Areas: ranges, lower and upper bounds, with negations ("ne manje od" is a lower bound).
  const rangeRe=new RegExp('(?:od|from|zwischen|tra|between|izmedu)?\\s*'+NUM+'\\s*'+AREA_UNIT+'?\\s*(?:-|–|do|to|bis|a|and|i)\\s*'+NUM+'\\s*'+AREA_UNIT,'i');
  const minRe=new RegExp('(?:najmanje|barem|minimalno|min\\.?|ne manje od|(?<!ne )vise od|preko|at least|minimum|over|(?<!not )more than|not less than|mindestens|ab|almeno|al menos)\\s*'+NUM+'\\s*'+AREA_UNIT,'i');
  const maxRe=new RegExp('(?:najvise|maksimalno|max\\.?|ne vise od|(?<!ne )manje od|ispod|do|up to|at most|maximum|under|not more than|(?<!not )less than|hochstens|bis|fino a|hasta)\\s*'+NUM+'\\s*'+AREA_UNIT,'i');
  const anyRe=new RegExp(NUM+'\\s*'+AREA_UNIT,'i');
  let m;
  const area=(raw,unit)=>{const x=number(raw);if(!x)return null;if(x.ambiguous)ambiguities.push('Broj „'+raw+'” može značiti '+x.value+' ili '+x.alt+'; potvrdi vrijednost.');return {m2:toM2(x.value,unitOf(unit)),ambiguous:x.ambiguous}};
  if((m=n.match(rangeRe))&&m[4]){const a=area(m[1],m[2]||m[4]),b=area(m[3],m[4]);
   if(a&&b){if(a.m2>b.m2)ambiguities.push('Obrnut raspon površine u navodu „'+s+'”; ne ispravlja se automatski.');
    else{put('min_area',a.m2,s,a.ambiguous||b.ambiguous?'niska':'visoka');put('max_area',b.m2,s,a.ambiguous||b.ambiguous?'niska':'visoka')}hit=true}}
  else if((m=n.match(minRe))){const a=area(m[1],m[2]);if(a){put('min_area',a.m2,s,a.ambiguous?'niska':'visoka');hit=true}}
  else if((m=n.match(maxRe))){const a=area(m[1],m[2]);if(a){put('max_area',a.m2,s,a.ambiguous?'niska':'visoka');hit=true}}
  else if((m=n.match(anyRe))){const a=area(m[1],m[2]);if(a){ambiguities.push('Površina „'+m[0].trim()+'” bez oznake najmanje/najviše/oko; granicu odredi ručno.');hit=true}}
  if(evidence.min_area===s||evidence.max_area===s){
   const basis=/\b(zemljist|parcel|plot|land|grundstuck|terren)/.test(n)?'zemljište':/\b(korisn|neto|usable|net\b|nutzflache)/.test(n)?'korisna površina':/\b(bruto|zgrad|building|gross)/.test(n)?'površina zgrada':null;
   if(basis)put('area_basis',basis,s,'srednja');else ambiguities.push('Osnova tražene površine (zemljište, zgrada ili korisna) nije navedena u „'+s+'”.');
   if(/\b(vlasnistv|owned|eigentum)/.test(n))ambiguities.push('Navod traži površinu u vlasništvu; zakupljena se ne smije računati (modul 4).');
  }
  // Leasehold negation: "bez zakupa" is a requirement; "zakup nije uvjet" is not.
  if(/\b(bez zakup|no lease|without lease|ohne pacht)/.test(n)){requirements.push({key:'land_leased',op:'max',value:0,unit:'ha',mandatory:!WISH.test(n),quote:s});hit=true}
  // Specialised requirements (facts-v1) with explicit mandatory/wish wording; otherwise the operator decides.
  const req=(key,op,value,unit)=>{const mandatory=notRequired?null:MANDATORY.test(n)?true:WISH.test(n)?false:null;
   if(notRequired){ambiguities.push('„'+s+'” navodi da uvjet nije obavezan; nije predložen kao uvjet.');return}
   if(mandatory===null)ambiguities.push('Za „'+s+'” nije navedeno je li uvjet obavezan; predložen je kao želja.');
   requirements.push({key,op,value,...(unit?{unit}:{}),mandatory:mandatory===true,quote:s})};
  if((m=n.match(/(\d+)\s*(?:soba|sobe|room|zimmer|camere|chambres|habitaciones|smjestajnih jedinica)/))){req('rooms','min',Number(m[1]),'kom');hit=true}
  if((m=n.match(/(\d)\s*(?:\*|zvjezdic|stars?\b|sterne|stelle|etoiles|estrellas)/))){req('hotel_category','min',Number(m[1]),'kom');hit=true}
  if((m=n.match(new RegExp(NUM+'\\s*(kw|mw)\\b')))){const x=number(m[1]);if(x){req('power','min',x.value,m[2]==='mw'?'MW':'kW');hit=true}}
  if((m=n.match(new RegExp(NUM+'\\s*m\\b[^.]*\\b(visin|height|hohe|altezza|hauteur)')))||(m=n.match(new RegExp('(?:visin\\w*|height|hohe)[^\\d]{0,20}'+NUM+'\\s*m\\b')))){const x=number(m[1]);if(x){req('clear_height','min',x.value,'m');hit=true}}
  if(/\b(kamion|truck|lkw|utovarn\w* ramp|loading dock|camion)/.test(n)){req('truck_access','equals',true);hit=true}
  if(/\b(pravo na vodu|prava na vodu|water rights|wasserrecht|izvor vode)/.test(n)){req('water_rights','equals',true);hit=true}
  // Budget: total amounts are informative; a price per m² is never a total budget.
  if((m=n.match(new RegExp('(?:€|eur|euro)\\s*'+NUM+'\\s*(mil|mio|million|milijun\\w*)?|'+NUM+'\\s*(mil|mio|million|milijun\\w*|tis|k\\b)?\\s*(?:€|eur|euro)')))){
   const raw=m[1]||m[3],mult=/^(mil|mio|million|milijun)/.test(m[2]||m[4]||'')?1e6:/^(tis|k)$/.test(m[4]||'')?1e3:1,x=number(raw);
   if(x){if(/(\/\s*m|po m|per m|pro m|al m)/.test(n.slice(m.index,m.index+m[0].length+12)))ambiguities.push('„'+s+'” navodi cijenu po m², ne ukupni budžet; ostaje samo informativna.');
    else{const v=x.value*mult;if(/\b(do|najvise|max|up to|bis|fino a|hasta)\b/.test(n))put('max_budget',v,s,x.ambiguous?'niska':'srednja');else if(/\b(od|najmanje|min|from|ab)\b/.test(n))put('min_budget',v,s,x.ambiguous?'niska':'srednja');
     else ambiguities.push('Iznos u „'+s+'” nije jasno donja ni gornja granica budžeta; budžet je ionako samo informativan.')}hit=true}}
  // Instruction-like text inside the request is data: noted, never followed.
  if(/\b(ignore|zanemari|instruction|uput[ae] (sustavu|modelu)|system prompt|mark (as )?verified|oznaci (kao )?provjeren)/.test(n))ambiguities.push('Tekst sadrži nešto nalik uputi („'+s.slice(0,80)+'”); tretira se kao podatak i ne izvršava se.');
  if(!hit)unsupported.push(s);
 }
 if(types.size)put('property_types',[...types],[...types].map(t=>evidence['type_'+t]).join(' … '),types.size>1?'srednja':'visoka');
 if(subtypes.size){requirements.push({key:'subtype',op:'includes',value:[...subtypes],mandatory:false,quote:[...subtypes].map(t=>evidence['subtype_'+t]).filter((v,i,a)=>a.indexOf(v)===i).join(' … ')});
  ambiguities.push('Podvrsta ('+[...subtypes].join(', ')+') predložena je kao jedna želja s alternativama; osnovnu vrstu nekretnine potvrdi ručno, objekt može biti mješovit.');}
 if(types.size>1)ambiguities.push('Navedeno je više vrsta ('+[...types].join(', ')+'); provjeri jesu li alternative ili zasebni zahtjevi.');
 if(conditions.size)put('conditions',[...conditions],[...conditions].map(c=>evidence['condition_'+c]).join(' … '),'srednja');
 if(countries.size)put('preferred_countries',[...countries].map(c=>COUNTRIES[c]),[...countries].map(c=>evidence['country_'+c]).join(' … '),'visoka');
 if(seat.size){put('seat_country',[...seat].map(c=>COUNTRIES[c]).join(', '),evidence.seat_quote,'srednja');if(!countries.size)ambiguities.push('Navedeno je samo sjedište; ono nije država potražnje.');}
 if(fields.property_types?.some(t=>!TYPES.includes(t))||fields.conditions?.some(c=>!CONDITIONS.includes(c)))throw Error('Interna greška rječnika.');
 if(requirements.length){const seen=new Set();fields.requirements=requirements.filter(q=>{const k=q.key+'\n'+q.op;if(seen.has(k)){ambiguities.push('Uvjet „'+q.quote+'” ponavlja se; zadržan je prvi navod.');return false}seen.add(k);return true});evidence.requirements=fields.requirements.map(q=>q.quote).join(' … ');confidence.requirements='srednja'}
 return {fields,evidence,confidence,ambiguities:[...new Set(ambiguities)],unsupported};
}
export function parseRequestText(text){
 const source=clean(text);
 if(!source.trim())return {version:PARSER_VERSION,requests:[],source:''};
 if(source.length>8000)throw Error('Tekst zahtjeva je predug (najviše 8000 znakova).');
 const blocks=splitRequests(source);
 return {version:PARSER_VERSION,source,requests:blocks.map((block,n)=>({index:n+1,block,...parseOne(block)})),
  notes:blocks.length>1?['Tekst je podijeljen na '+blocks.length+' zasebna zahtjeva prema oznakama ili praznim redovima; provjeri podjelu prije spremanja.']:[]};
}
// Every proposed value must be backed by quotes that occur verbatim in the source text.
export function quotesInSource(parsed){return parsed.requests.every(r=>Object.values(r.evidence).every(q=>String(q).split(' … ').every(part=>parsed.source.includes(part))))}
