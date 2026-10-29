import {TYPES,CONDITIONS,country,num,validUrl} from './domain.mjs';
// Buyer-facing summary of a property, built only from an allowlist of structured fields.
// Title, source links, address, city, notes, contacts, IDs, evidence links and attachments
// are never read. Generalised values are rounded, never invented. Removing identifiers
// does not guarantee that a public listing cannot be recognised from its features.
const LEAK=[[/https?:\/\/|www\.|\b[\w-]+\.(?:hr|si|ie|com|eu|net|org|de|fr|it|es|at)\b/i,'poveznica'],[/[\w.+-]+@[\w-]+\.[\w.]+/,'e-pošta'],
 [/\+?\d[\d\s/-]{7,}\d/,'telefon ili broj'],[/\b\d{5,}\b/,'identifikacijski broj'],[/-?\d{1,2}\.\d{3,},\s*-?\d{1,3}\.\d{3,}/,'koordinate'],
 [/\b(?:ulica|ul\.|cesta|trg|street|road|avenue|straße|strasse|rue|via|calle)\b/i,'adresa'],[/\bk\.?\s?č\.?|\bčest\.?|\bparcel(?:a|e)?\s+(?:br|no)/i,'katastarska oznaka']];
const words=v=>String(v||'').toLocaleLowerCase('hr').normalize('NFKD').replace(/[̀-ͯ]/g,'').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
// The free-text region field is never trusted on its own: a region appears only when the reviewer
// confirms it as an administrative region in the preview, and it still passes the leak checks.
const confirmedRegion=v=>typeof v==='string'&&v.trim().length>1&&v.trim().length<=60&&!/\d/.test(v)&&!LEAK.some(([re])=>re.test(v))?v.trim():null;
const de=v=>new Intl.NumberFormat('hr-HR').format(v);
const ha=v=>String(v/10000).replace('.',',');
// An honest interval that contains the real value; small areas are never rounded up.
export function areaText(a){
 if(!num(a)||a<=0)return null;
 const step=a<1000?50:a<10000?100:a<100000?1000:10000,low=Math.floor(a/step)*step,high=low+step;
 if(a>=10000)return ha(low)+' – '+ha(high)+' ha';
 return (low?de(low)+' – ':'do ')+de(high)+' m²';
}
const band=v=>{const step=v<500000?50000:v<2000000?250000:1000000,low=Math.floor(v/step)*step;return de(low)+' – '+de(low+step)+' €'};
const AUCTION=/auction|dražb|drazb|početn|pocetn|starting|minim|pradin|ench[eè]re|mise [àa] prix|subast|\basta\b|versteiger|licitac|árver|arver|aukc|veiling/i;
// Which price is known: an auction's starting/minimum bid is never presented as the property's price.
export function priceKind(p){
 if(p.auction_at||p.bid_deadline_at||p.auction_reference||p.status==='Novo - aktivna dražba'||AUCTION.test(String(p.price_basis||'')))return 'auction';
 return /asking|tražen|trazen|prodajn|sale price|prix de vente/i.test(String(p.price_basis||''))?'asking':'unknown';
}
export function priceLine(p){
 if(!num(p.price)||p.price<=0)return null;
 const kind=priceKind(p);
 if(kind==='auction')return ['Početna / minimalna ponuda na dražbi',band(p.price)+' (konačna kupoprodajna cijena nije poznata)'];
 return [kind==='asking'?'Tražena cijena':'Cijena (osnova cijene nije navedena)',band(p.price)];
}
export function buyerTeaser(p,{region}={}){
 const lines=[],unknown=[];
 const add=(label,value)=>{if(value)lines.push(label+': '+value);else unknown.push(label.toLocaleLowerCase('hr'))};
 add('Vrsta nekretnine',TYPES.includes(p.property_type)?p.property_type:null);
 add('Stanje',CONDITIONS.includes(p.condition)?p.condition:null);
 const nation=country(p.country),place=nation&&confirmedRegion(region);
 add('Okvirna lokacija',nation?[place,nation].filter(Boolean).join(', '):null);
 add('Površina',areaText(p.area));
 const price=priceLine(p);if(price)lines.push(price.join(': '));else unknown.push('cijena');
 const costs=(num(p.renovation)?p.renovation:0)+(num(p.other_costs)?p.other_costs:0);
 if(costs>0)lines.push('Poznati dodatni troškovi (procjena): '+band(costs));
 if(p.buildable==='Da'&&validUrl(p.planning_evidence_url))lines.push('Mogućnost gradnje: navedena uz priloženi dokument; potrebna je stručna urbanistička provjera');
 else if(p.buildable==='Ne')lines.push('Mogućnost gradnje: prema provjeri nije moguća');
 // Known legal problems are disclosed, never hidden; a linked document is not proof of a clean title.
 lines.push('Pravni status: '+(p.legal==='Komplikacije'?'utvrđene su pravne komplikacije; kupcu se objašnjavaju prije bilo kakve odluke':
  p.legal==='Uredno'&&validUrl(p.legal_evidence_url)?'interno označen kao uredan uz priloženi dokument; prije kupnje potrebna je neovisna pravna provjera':'još nije potvrđen'));
 if(String(p.risk_notes||'').trim())lines.push('Zabilježeni rizici: postoje interne napomene o riziku; sažetak bez identifikatora dodaje se ručno nakon pregleda');
 if(unknown.length)lines.push('Nije poznato: '+unknown.join(', '));
 const text=['Okvirni opis nekretnine za procjenu interesa (nije ponuda):',...lines,'Točna lokacija, izvori i kontakti dijele se tek nakon potvrđenog interesa i odobrenja prodavatelja.'].join('\n');
 const leaks=teaserLeaks(text,p,place);
 // A summary that could carry an identifier is never offered for copying.
 return {text:leaks.length?'':text,leaks,withheld:['naslov','izvorni oglas i poveznice','adresa i grad','neprovjereno polje regije','koordinate','kontakti prodavatelja/agenta','bilješke','identifikacijski brojevi','prilozi i fotografije']};
}
export function teaserLeaks(text,p={},region=null){
 const found=LEAK.filter(([re])=>re.test(text)).map(([,label])=>label);
 // No run of three consecutive words from the original title or city.
 const t=words(text).join(' ');
 for(const field of [p.title,p.city,p.risk_notes]){const w=words(field);for(let k=0;k+3<=w.length;k++)if(t.includes(w.slice(k,k+3).join(' '))){found.push('izvorni tekst');break}}
 if(p.city&&words(p.city).length===1&&words(text).includes(words(p.city)[0])&&!words(region).includes(words(p.city)[0]))found.push('grad');
 return [...new Set(found)];
}
