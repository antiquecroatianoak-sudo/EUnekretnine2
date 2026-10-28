# Kvaliteta podudaranja i pouzdan rad aplikacije
Datum: 28.10.2026., Europe/Zagreb.

## Mjerodavan cilj vlasnika
Kvalitetniji parovi, ne veći broj parova. Uz to: pouzdano učitavanje i spremanje, učinkovitost i preglednost. Ne optimizirati broj kandidata ni postotak podudarnosti kao zamjenu za kvalitetu.

## Provjereni izvori i ograničenja
- https://sothebysrealty.gr/areas/paxos/ — odvojene površine objekta i zemljišta, izričite oznake Sold, nepoznata cijena prikazana kao Price on request.
- https://developments.es/en/costa_del_sol/ — filtri lokacije, vrste, površine, faze gradnje i završetka; reference, tlocrti, cjenik i brošure. Dohvat prikazuje i predloške dinamičkih podataka; nije potvrđena funkcionalnost svih filtara ni podataka. Stranica upozorava da su lokacije približne.
- https://www.luxuryestate.com/united-arab-emirates — razvrstane vrste i izvorni predstavnik oglasa. Koristiti samo za ideje prikaza; UAE ne proširuje EU27 opseg.
- https://steramflats.com/en/best-property-listing-platforms-5/ — marketinški pregled portala; nije neovisna potvrda njihove kvalitete niti dokaz rezultata uparivanja.
- Prethodni plan #46 i PR #48 potvrđuju ranije dogovorene dodatke. Točni URL-ovi prve ranije skupine još nisu obnovljeni iz dostupne povijesti ni plana; ne tvrditi da su svi ponovno pregledani. Drugi Google ad iz zadnje skupine nema utvrđen odredišni URL.

## Redoslijed bez dupliciranja postojećeg rada
| Prioritet | Promjena i korist | Postojeći rad | Kriterij dovršenosti |
|---|---|---|---|
| 1 | Pouzdano i brže spremanje/refresh, uz očuvanje dokaza i povijesti | PR #50 | Neovisno pregledana jednakost sa starim putem, aktualni CI i potvrđena objava backenda; bez preskakanja potrebne invalidacije |
| 2 | Dokazivo precizniji podatkovni ugovor: površina zemljišta/objekta/korisna, osnova površine i sastav prodaje | PR #48 moduli 1/4 | Nekompatibilne ili nepoznate osnove ne prikazivati kao potvrđeno podudaranje; čuvati izvor i ručne dopune; testirati na realističnim parovima |
| 3 | Razlikovanje prodaje i zakupa te uvjeti po vrsti/namjeni nekretnine; faza gradnje/rok samo gdje je tražen i dokumentiran | PR #48 sektorski uvjeti, dopune nakon pregleda | Tvrd uvjet, preferencija i nepoznato odvojeni; ne izmišljati kriterije iz marketinga, sjedišta ili nedohvaćenog izvora |
| 4 | Jedinstven pregled para: kriterij, zahtjev, podatak i rezultat uz izvor, datum i otvorenu provjeru | Tablica/izvori već objavljeni PR #54; završni pregled #47 još draft | Dopuniti postojeći prikaz dokazima gdje ih API daje; ne izmišljati numeričku pouzdanost ni potvrdu interesa; mobilna provjera |
| 5 | Red dopune prema utjecaju na odluku: prvo nedostaci koji mogu odbaciti ili razjasniti par | PR #48 modul 2 | Jasna konkretna polja/strana/izvor, bez automatskog prihvaćanja ili slanja; ne dodavati isti red paralelno |
| 6 | Browser regresije spremanja/ponovnog učitavanja, grešaka i mobilnog prikaza | PR #53 | Pregled i CI na aktualnom headu; koristiti stvarnu izoliranu bazu, ne produkcijske upise |

## Mjerenje kvalitete prije promjene evaluatora
Pripremiti referentni skup realističnih, anonimiziranih ili sintetičkih parova s očekivanim ishodom i razlogom. Oznake: jasno odgovara kriterijima, jasno odstupa, nedovoljno podataka. Nema oznake interesa bez dokaza.
- Usporediti postojeći i novi evaluator na istim ulazima.
- Brojati pogrešno pozitivna i pogrešno negativna podudaranja te ispravno zadržana nepoznata stanja. Potvrditi da strože tumačenje ne odbacuje opravdan par.
- Pokriti: ista brojka različite površine; rasponi i granice/tolerancije; prodaja/zakup; pojedinačna jedinica/cijeli projekt; pogrešna država potražnje; nepoznat budžet; uvjeti namjene/gradnje; neaktivan/istekao oglas; zastarjeli/proturječni dokazi; kontakt za konkretni zapis; više neovisnih zahtjeva jednog kupca.
- Prvo primjeri i očekivanja, zatim promjena. Bez referentnih oznaka ne tvrditi da je kvaliteta izmjereno porasla.

## Očuvati postojeća pravila
Budžet informativan; nepoznata dostupnost sama ne isključuje oglas; dokumentirano neaktivne/istekle ponude isključene; upotrebljiv kanal obje strane i izvorne agencije; nepoznato odvojeno od odstupanja; bez automatskih poruka, novih računa ili troškova.

## Stanje ove cjeline
Proveden je ponovni pregled četiriju dostupnih javnih poveznica i usporedba s planom #46, PR-ovima i glavnim zapisom. Ovim dokumentom nisu promijenjeni evaluator, baza, UI ili produkcijska objava. Sljedeća implementacijska cjelina je neovisni pregled PR #50; potom preciznost iz PR #48 nakon njegovih ovisnosti, bez dvostruke implementacije.
