import assert from 'node:assert/strict';
import {buyerTeaser,teaserLeaks} from '../lib/teaser.mjs';
// Audit 6342938279 point 5: a buyer-facing summary without identifiers.
const property={id:48213,title:'Građevinsko zemljište Ulica Ivana Gundulića 14 Oranmore',country:'IE',region:'Galway',city:'Oranmore',
 property_type:'Zemljište',condition:'Neizgrađeno',area:6120,price:243500,legal:'Uredno',legal_evidence_url:'https://example.ie/folio/GY12345F',
 buildable:'Da',planning_evidence_url:'https://example.ie/planning/2412345',source:'https://www.daft.ie/for-sale/site-oranmore/5412345',
 risk_notes:'Agent Mary Kelly +353 87 123 4567 mary@agent.ie, 53.2708, -8.9310',notes:'Pozvati vlasnika na 091 555 123'};
const t=buyerTeaser(property);
assert.deepEqual(t.leaks,[]);
for(const line of ['Vrsta nekretnine: Zemljište','Stanje: Neizgrađeno','Okvirna lokacija: Galway, Irska','Površina: oko 6.100 m²','Okvirni cjenovni raspon: 200.000 – 250.000 €','Mogućnost gradnje: potvrđena dokumentom','Pravni status: provjeren dokumentacijom'])
 assert(t.text.includes(line),line);
for(const secret of ['48213','Gundulića','Oranmore','daft','http','example.ie','GY12345F','Mary','353','@','53.2708','091','243.500','243500','6.120'])
 assert(!t.text.includes(secret),'leaked '+secret);
assert(t.withheld.includes('prilozi i fotografije'),'attachments are never included automatically');
// Unknown data is reported as unknown, never as zero or a guess.
const sparse=buyerTeaser({country:'SI',property_type:'Zemljište'});
assert(sparse.text.includes('Nije poznato: stanje, površina, okvirni cjenovni raspon'));
assert(sparse.text.includes('Pravni status: još nije potvrđen'));assert(!/\b0\b/.test(sparse.text));
// A claimed status without evidence is not presented as verified.
assert(buyerTeaser({...property,legal_evidence_url:null}).text.includes('Pravni status: još nije potvrđen'));
assert(!buyerTeaser({...property,planning_evidence_url:''}).text.includes('Mogućnost gradnje'));
// Free-text region with a contact, number or address is dropped, not copied.
for(const region of ['Galway, tel 091 555 123','Ulica Galway','www.galway.ie','Zona 5']){
 const r=buyerTeaser({...property,region});assert(r.text.includes('Okvirna lokacija: Irska'),region);assert(!r.text.includes(region));
}
// The leak check itself catches identifiers and copied source wording.
assert(teaserLeaks('Kontakt: info@agent.hr').includes('e-pošta'));
assert(teaserLeaks('Vidi https://www.njuskalo.hr/x').includes('poveznica'));
assert(teaserLeaks('Šifra 4471230').includes('identifikacijski broj'));
assert(teaserLeaks('Lokacija 45.8150, 15.9819').includes('koordinate'));
assert(teaserLeaks('Prodaje se građevinsko zemljište ulica',{title:'Prodaje se građevinsko zemljište uz more'}).includes('izvorni tekst'));
assert(teaserLeaks('Okvirna lokacija: Oranmore, Irska',{city:'Oranmore',region:'Galway'}).includes('grad'));
// If anything slips through, nothing is offered for copying.
const unsafe=buyerTeaser({...property,title:'Okvirni opis nekretnine za procjenu interesa'});
assert(unsafe.leaks.includes('izvorni tekst'));assert.equal(unsafe.text,'');
console.log('Buyer teaser checks passed: allowlist only, rounded values, unknowns kept, no identifiers.');
