import {TYPES,CONDITIONS,country,num,validUrl} from './domain.mjs';
// Buyer-facing summary of a property, built only from an allowlist of structured fields.
// Title, source links, address, city, notes, contacts, IDs, evidence links and attachments
// are never read. Generalised values are rounded, never invented. Removing identifiers
// does not guarantee that a public listing cannot be recognised from its features.
const LEAK=[[/https?:\/\/|www\.|\b[\w-]+\.(?:hr|si|ie|com|eu|net|org|de|fr|it|es|at)\b/i,'poveznica'],[/[\w.+-]+@[\w-]+\.[\w.]+/,'e-pošta'],
 [/\+?\d[\d\s/-]{7,}\d/,'telefon ili broj'],[/\b\d{5,}\b/,'identifikacijski broj'],[/-?\d{1,2}\.\d{3,},\s*-?\d{1,3}\.\d{3,}/,'koordinate'],
 [/\b(?:ulica|ul\.|cesta|trg|street|road|avenue|straße|strasse|rue|via|calle)\b/i,'adresa'],[/\bk\.?\s?č\.?|\bčest\.?|\bparcel(?:a|e)?\s+(?:br|no)/i,'katastarska oznaka']];
const words=v=>String(v||'').toLocaleLowerCase('hr').normalize('NFKD').replace(/[̀-ͯ]/g,'').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
// Plain free text is only accepted for a region name without digits or contact patterns.
const safeRegion=v=>typeof v==='string'&&v.trim().length>1&&v.trim().length<=60&&!/\d/.test(v)&&!LEAK.some(([re])=>re.test(v))?v.trim():null;
const de=v=>new Intl.NumberFormat('hr-HR').format(v);
function areaText(a){
 if(!num(a)||a<=0)return null;
 if(a>=10000)return 'oko '+String(Math.round(a/1000)/10).replace('.',',')+' ha';
 const step=a<1000?50:100;return 'oko '+de(Math.max(step,Math.round(a/step)*step))+' m²';
}
function priceBand(p){
 if(!num(p)||p<=0)return null;
 const step=p<500000?50000:p<2000000?250000:1000000,low=Math.floor(p/step)*step;
 return de(low)+' – '+de(low+step)+' €';
}
export function buyerTeaser(p){
 const lines=[],unknown=[];
 const add=(label,value)=>{if(value)lines.push(label+': '+value);else unknown.push(label.toLocaleLowerCase('hr'))};
 add('Vrsta nekretnine',TYPES.includes(p.property_type)?p.property_type:null);
 add('Stanje',CONDITIONS.includes(p.condition)?p.condition:null);
 const nation=country(p.country),region=safeRegion(p.region);
 add('Okvirna lokacija',nation?[region,nation].filter(Boolean).join(', '):null);
 add('Površina',areaText(p.area));
 add('Okvirni cjenovni raspon',priceBand(p.price));
 if(p.buildable==='Da'&&validUrl(p.planning_evidence_url))lines.push('Mogućnost gradnje: potvrđena dokumentom (detalji nakon iskazanog interesa)');
 else if(p.buildable==='Ne')lines.push('Mogućnost gradnje: prema provjeri nije moguća');
 lines.push('Pravni status: '+(p.legal==='Uredno'&&validUrl(p.legal_evidence_url)?'provjeren dokumentacijom':'još nije potvrđen'));
 if(unknown.length)lines.push('Nije poznato: '+unknown.join(', '));
 const text=['Okvirni opis nekretnine za procjenu interesa (nije ponuda):',...lines,'Točna lokacija, izvori i kontakti dijele se tek nakon potvrđenog interesa i odobrenja prodavatelja.'].join('\n');
 const leaks=teaserLeaks(text,p);
 // A summary that could carry an identifier is never offered for copying.
 return {text:leaks.length?'':text,leaks,withheld:['naslov','izvorni oglas i poveznice','adresa i grad','koordinate','kontakti prodavatelja/agenta','bilješke','identifikacijski brojevi','prilozi i fotografije']};
}
export function teaserLeaks(text,p={}){
 const found=LEAK.filter(([re])=>re.test(text)).map(([,label])=>label);
 // No run of three consecutive words from the original title or city.
 const t=words(text).join(' ');
 for(const field of [p.title,p.city,p.risk_notes]){const w=words(field);for(let k=0;k+3<=w.length;k++)if(t.includes(w.slice(k,k+3).join(' '))){found.push('izvorni tekst');break}}
 if(p.city&&words(p.city).length===1&&words(text).includes(words(p.city)[0])&&!words(p.region).includes(words(p.city)[0]))found.push('grad');
 return [...new Set(found)];
}
