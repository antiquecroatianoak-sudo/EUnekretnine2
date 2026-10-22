import assert from 'node:assert/strict';
import {buyerTeaser,teaserLeaks,areaText,priceKind} from '../lib/teaser.mjs';
// Audit 6342938279 point 5: a buyer-facing summary without identifiers.
const property={id:48213,title:'Građevinsko zemljište Ulica Ivana Gundulića 14 Oranmore',country:'IE',region:'Galway',city:'Oranmore',
 property_type:'Zemljište',condition:'Neizgrađeno',area:6120,price:243500,price_basis:'Asking price',legal:'Uredno',legal_evidence_url:'https://example.ie/folio/GY12345F',
 buildable:'Da',planning_evidence_url:'https://example.ie/planning/2412345',source:'https://www.daft.ie/for-sale/site-oranmore/5412345',
 risk_notes:'Agent Mary Kelly +353 87 123 4567 mary@agent.ie, 53.2708, -8.9310',notes:'Pozvati vlasnika na 091 555 123'};
const t=buyerTeaser(property);
assert.deepEqual(t.leaks,[]);
for(const line of ['Vrsta nekretnine: Zemljište','Stanje: Neizgrađeno','Okvirna lokacija: Irska','Površina: 6.100 – 6.200 m²','Tražena cijena: 200.000 – 250.000 €','Mogućnost gradnje: navedena uz priloženi dokument','Zabilježeni rizici: postoje interne napomene'])
 assert(t.text.includes(line),line);
for(const secret of ['48213','Gundulića','Oranmore','Galway','daft','http','example.ie','GY12345F','Mary','353','@','53.2708','091','243.500','243500','6.120'])
 assert(!t.text.includes(secret),'leaked '+secret);
assert(t.withheld.includes('prilozi i fotografije'),'attachments are never included automatically');
// Review 6344298344 point 2: a linked document is not proof of a clean title, and known problems are shown.
assert(t.text.includes('Pravni status: interno označen kao uredan uz priloženi dokument; prije kupnje potrebna je neovisna pravna provjera'));
assert(!/provjeren dokumentacijom|potvrđena dokumentom/.test(t.text));
const legal=buyerTeaser({...property,legal:'Komplikacije'});
assert(legal.text.includes('Pravni status: utvrđene su pravne komplikacije'),'a known legal risk is never hidden');
assert(!legal.text.includes('još nije potvrđen'));
// Point 3: an auction's starting/minimum bid is labelled as such, with the final price unknown.
for(const p of [{price_basis:'Auction starting price; not current bid or total cost'},{price_basis:'Pradinė pardavimo kaina – početna cijena'},{price_basis:null,auction_at:'2026-11-20T10:00:00Z'},{price_basis:'Mise à prix'},{status:'Novo - aktivna dražba',price_basis:null}]){
 const a=buyerTeaser({...property,...p});assert.equal(priceKind({...property,...p}),'auction',JSON.stringify(p));
 assert(a.text.includes('Početna / minimalna ponuda na dražbi: 200.000 – 250.000 € (konačna kupoprodajna cijena nije poznata)'),JSON.stringify(p));
 assert(!a.text.includes('Tražena cijena'));
}
assert(buyerTeaser({...property,price_basis:null}).text.includes('Cijena (osnova cijene nije navedena): 200.000 – 250.000 €'),'an unknown basis is labelled, not assumed');
assert(buyerTeaser({...property,renovation:40000,other_costs:5000}).text.includes('Poznati dodatni troškovi (procjena): 0 – 50.000 €'));
// Point 4: the interval always contains the real area; small plots are not rounded up.
for(const [a,text] of [[10,'do 50 m²'],[49,'do 50 m²'],[50,'50 – 100 m²'],[120,'100 – 150 m²'],[999,'950 – 1.000 m²'],[6120,'6.100 – 6.200 m²'],[25300,'2,5 – 2,6 ha'],[184000,'18 – 19 ha']])
 assert.equal(areaText(a),text,String(a));
assert(buyerTeaser({...property,area:10}).text.includes('Površina: do 50 m²'));assert(!buyerTeaser({...property,area:10}).text.includes('oko'));
// Unknown data is reported as unknown, never as zero or a guess.
const sparse=buyerTeaser({country:'SI',property_type:'Zemljište'});
assert(sparse.text.includes('Nije poznato: stanje, površina, cijena'));
assert(sparse.text.includes('Pravni status: još nije potvrđen'));assert(!/\b0\b/.test(sparse.text));
assert(!buyerTeaser({...property,planning_evidence_url:''}).text.includes('Mogućnost gradnje'));
// Point 5: the free-text region is never used on its own; only a region the reviewer confirms is shown.
for(const region of ['Galway','Galway, tel 091 555 123','Ulica Galway','www.galway.ie','Zona 5'])
 assert(buyerTeaser({...property,region}).text.includes('Okvirna lokacija: Irska\n'),region);
assert(buyerTeaser(property,{region:'County Galway'}).text.includes('Okvirna lokacija: County Galway, Irska'));
for(const region of ['Galway, tel 091 555 123','Ulica Galway','www.galway.ie','Zona 5'])
 assert(!buyerTeaser(property,{region}).text.includes(region),'confirmed text still passes the leak checks: '+region);
// The leak check itself catches identifiers and copied source wording.
assert(teaserLeaks('Kontakt: info@agent.hr').includes('e-pošta'));
assert(teaserLeaks('Vidi https://www.njuskalo.hr/x').includes('poveznica'));
assert(teaserLeaks('Šifra 4471230').includes('identifikacijski broj'));
assert(teaserLeaks('Lokacija 45.8150, 15.9819').includes('koordinate'));
assert(teaserLeaks('Prodaje se građevinsko zemljište ulica',{title:'Prodaje se građevinsko zemljište uz more'}).includes('izvorni tekst'));
assert(teaserLeaks('Okvirna lokacija: Oranmore, Irska',{city:'Oranmore',region:'Galway'}).includes('grad'));
assert.deepEqual(buyerTeaser({...property,city:'Galway'},{region:'Galway'}).leaks,[],'a confirmed region with the same name as the city is allowed');
// If anything slips through, nothing is offered for copying.
const unsafe=buyerTeaser({...property,title:'Okvirni opis nekretnine za procjenu interesa'});
assert(unsafe.leaks.includes('izvorni tekst'));assert.equal(unsafe.text,'');
console.log('Buyer teaser checks passed: allowlist only, honest intervals, price basis, legal risks shown, confirmed region only.');
