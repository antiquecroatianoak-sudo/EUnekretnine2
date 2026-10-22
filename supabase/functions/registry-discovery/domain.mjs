export const TYPES=['Zemljište','Kuća','Stan','Zgrada','Poslovni prostor'];
export const CONDITIONS=['Useljivo','Za obnovu','Za rušenje','Neizgrađeno'];
export const COUNTRIES=Object.fromEntries(['AT|Austrija','BE|Belgija','BG|Bugarska','HR|Hrvatska','CY|Cipar','CZ|Češka','DK|Danska','EE|Estonija','FI|Finska','FR|Francuska','DE|Njemačka','GR|Grčka','HU|Mađarska','IE|Irska','IT|Italija','LV|Latvija','LT|Litva','LU|Luksemburg','MT|Malta','NL|Nizozemska','PL|Poljska','PT|Portugal','RO|Rumunjska','SK|Slovačka','SI|Slovenija','ES|Španjolska','SE|Švedska'].map(s=>s.split('|')));
export const MATCH='Podudaranje kriterija',CANDIDATE='Kandidat - potrebna provjera',REJECT='Ne odgovara kriterijima';
export const country=v=>COUNTRIES[String(v||'').trim().toUpperCase()]||String(v||'').trim();
export const norm=v=>String(v||'').toLocaleLowerCase('hr').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
export const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export const validUrl=v=>{try{return typeof v==='string'&&['https:','http:'].includes(new URL(v).protocol)}catch{return false}};
export const criteria=i=>{try{const c=typeof i.criteria_json==='string'?JSON.parse(i.criteria_json):i.criteria_json||{};return c&&typeof c==='object'&&!Array.isArray(c)?c:{_invalid:true}}catch{return {_invalid:true}}};
export function validateCriteria(c){
 for(const [k,allowed] of [['property_types',TYPES],['conditions',CONDITIONS]])if(!Array.isArray(c[k]??[])||(c[k]??[]).some(v=>!allowed.includes(v)))throw Error('Nepoznati kriteriji: '+k);
 for(const k of ['cities','regions'])if(!Array.isArray(c[k]??[])||(c[k]??[]).some(v=>typeof v!=='string'||!v.trim()))throw Error('Lokacije moraju biti popis naziva.');
 for(const k of ['min_area','max_area','min_roi'])if(c[k]!=null&&!num(c[k]))throw Error('Nevaljana granica: '+k);
 if(c.min_area!=null&&c.max_area!=null&&c.min_area>c.max_area)throw Error('Nevaljan raspon površine.');
 if(c.requires_buildable!=null&&typeof c.requires_buildable!=='boolean')throw Error('Nevaljan uvjet gradnje.');
 if(c.source_url&&!validUrl(c.source_url))throw Error('Potreban je valjan URL dokaza zahtjeva kupca.');
}
export function evaluate(p,i,now=Date.now()){
 let c=criteria(i),reasons=[],missing=[],rejected=[],passed=0,checks=0;
 const check=(label,known,fits)=>{checks++;if(!known)missing.push(label);else if(fits){reasons.push(label);passed++}else rejected.push(label)};
 try{validateCriteria(c);if(c._invalid)throw Error()}catch{missing.push('Ispravni strukturirani kriteriji kupca');c={}}
 const countries=String(i.preferred_countries||'').split(',').map(v=>v.trim()).filter(Boolean);
 check('Država',!!(countries.length&&p.country),countries.map(v=>norm(country(v))).includes(norm(country(p.country))));
 const total=['price','renovation','other_costs'].every(k=>num(p[k]))?p.price+p.renovation+p.other_costs:null;
 const budget=num(i.min_budget)&&num(i.max_budget)&&i.max_budget>0&&i.max_budget>=i.min_budget&&total!==null;
 check('Ukupni trošak unutar budžeta',budget,budget&&total>=i.min_budget&&total<=i.max_budget);
 for(const [k,f,label,allowed] of [['property_types','property_type','Vrsta nekretnine',TYPES],['conditions','condition','Stanje / obnova / rušenje',CONDITIONS]])check(label,!!c[k]?.length&&allowed.includes(p[f]),c[k]?.includes(p[f]));
 for(const [k,f,label] of [['cities','city','Grad'],['regions','region','Regija']])if(c[k]?.length)check(label,!!p[f],c[k].map(norm).includes(norm(p[f])));
 if(c.min_area!=null||c.max_area!=null)check('Površina',num(p.area)&&p.area>0,num(p.area)&&(c.min_area==null||p.area>=c.min_area)&&(c.max_area==null||p.area<=c.max_area));
 if(c.requires_buildable){check('Potvrđena mogućnost gradnje',['Da','Ne'].includes(p.buildable),p.buildable==='Da'&&validUrl(p.planning_evidence_url));if(p.buildable==='Da'&&!validUrl(p.planning_evidence_url)){rejected=rejected.filter(v=>v!=='Potvrđena mogućnost gradnje');missing.push('Dokaz mogućnosti gradnje')}}
 const roi=num(p.estimated_value)&&total!==null&&total>0?100*(p.estimated_value-total)/total:null;
 if(c.min_roi!=null)check('Minimalni jednostavni ROI',roi!==null&&validUrl(p.valuation_evidence_url),roi!==null&&roi>=c.min_roi);
 const checked=Date.parse(c.checked_at),age=now-checked;
 if(!i.verified||!Number.isFinite(checked)||!/(Z|[+-]\d\d:\d\d)$/.test(c.checked_at||'')||age<0||age>90*86400000||!validUrl(c.source_url))missing.push('Potvrđen zahtjev kupca s izvorom i provjerom unutar 90 dana');
 if(String(i.notes||'').trim())missing.push('Dodatni uvjeti iz napomena za ručnu provjeru');
 if(!validUrl(p.source))missing.push('Izvor oglasa');
 if(p.legal==='Komplikacije')rejected.push('Pravne komplikacije');else if(p.legal!=='Uredno'||!validUrl(p.legal_evidence_url))missing.push('Dokaz pravne provjere');
 const deadline=p.available_until||p.bid_deadline_at;let expired=false;
 if(deadline){const stamp=Date.parse(deadline);if(!Number.isFinite(stamp))missing.push('Valjan rok dostupnosti');else expired=/^\d{4}-\d{2}-\d{2}$/.test(deadline)?String(deadline)<new Date(now).toISOString().slice(0,10):stamp<now}
 if(['prodano','povuceno','rok istekao','zatvoreno'].some(v=>norm(p.status).startsWith(v))||expired)rejected.push('Nekretnina više nije aktivna');
 return {status:rejected.length?REJECT:missing.length?CANDIDATE:MATCH,score:checks?Math.round(100*passed/checks):0,reasons,missing,rejected,total_cost:total,roi};
}
export function propertyInput(input){
 const out={};const texts=['country','city','region','title','property_type','condition','source','legal','status','buildable','planning_evidence_url','legal_evidence_url','valuation_evidence_url','available_until','risk_notes'];
 for(const k of texts)if(k in input){if(input[k]!=null&&typeof input[k]!=='string')throw Error('Nevaljano polje: '+k);out[k]=input[k]?.trim()||null;if(out[k]?.length>4000)throw Error('Predug podatak: '+k)}
 for(const k of ['price','area','renovation','other_costs','estimated_value'])if(k in input){if(input[k]!=null&&!num(input[k]))throw Error('Nevaljan broj: '+k);out[k]=input[k]??null}
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
 return {...out,updated:new Date().toISOString()};
}
export function investorInput(input){
 const out={};for(const k of ['name','country','preferred_countries','notes']){if(typeof input[k]!=='string'||input[k].length>8000)throw Error('Nevaljano polje: '+k);out[k]=input[k].trim()}
 // The seat may be outside the EU; EU interest is preferred_countries and stays separate.
 if(!out.name||!out.country||out.country.length>80)throw Error('Unesi naziv kupca i sjedište.');
 // Unknown budget stays NULL; only known bounds are validated.
 const low=input.min_budget??null,high=input.max_budget??null;
 if((low!=null&&!num(low))||(high!=null&&(!num(high)||high<=0))||(low!=null&&high!=null&&high<low))throw Error('Unesi valjan raspon budžeta ili ostavi nepoznat iznos prazan.');
 const c=criteria(input);validateCriteria(c);if(c._invalid)throw Error('Nevaljani kriteriji.');
 if(c.checked_at&&(!/(Z|[+-]\d\d:\d\d)$/.test(c.checked_at)||!Number.isFinite(Date.parse(c.checked_at))||Date.parse(c.checked_at)>Date.now()))throw Error('Datum provjere nije valjan.');
 if(![0,1,false,true].includes(input.verified))throw Error('Nevaljana potvrda zahtjeva.');
 if(input.verified&&(!validUrl(c.source_url)||!c.checked_at||!out.preferred_countries||!c.property_types?.length||!c.conditions?.length))throw Error('Za potvrđen zahtjev navedi izvor, datum i kriterije.');
 return {...out,min_budget:low,max_budget:high,verified:input.verified?1:0,criteria_json:JSON.stringify(c)};
}

