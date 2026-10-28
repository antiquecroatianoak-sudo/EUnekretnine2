# Površine i sastav prodaje — modul 4 (28.10.2026.)

**Stanje:** implementirano i izolirano testirano. Nije pregledano ni objavljeno. Nema nove migracije; koristi se `facts_json` iz modula 1.

## Odvojene mjere (facts-v1)
- **Mjere s jedinicom i značenjem:** ukupno oglašeno zemljište (`land_total`), zemljište u vlasništvu uključeno u prodaju (`land_owned`), zakupljeno zemljište (`land_leased`), površina zgrada (`building_area`) i korisna površina (`usable_area`).
- **Sastav prodaje:** `includes_buildings`, `includes_equipment` i `includes_business` (da/ne, s dokazom). Ništa se ne pretpostavlja iz opisa.
- **Izvorni `area`** ostaje nepromijenjen, s nepoznatom („legacy”) osnovom.

## Osnova tražene površine
`criteria.area_basis` može biti „zemljište ukupno”, „zemljište u vlasništvu”, „površina zgrada” ili „korisna površina”.
- **S osnovom:** zahtjev se uspoređuje samo s potvrđenom mjerom te osnove.
  - Tolerancija −15 %/+25 % primjenjuje se jer je mjera usporediva; `area_hard` granicu drži strogom.
  - Nula je vrijednost: samo zakup daje 0 ha u vlasništvu.
  - Nepotvrđena, proturječna ili istekla mjera je otvorena stavka.
- **Bez osnove (postojeći zahtjevi):** uspoređuje se oglašena površina kao dosad. Postojeći parovi se ne snižavaju zbog novog polja. Hoće li se nepoznata osnova kasnije tretirati kao dopuna, vlasnikova je odluka.
- **Usklađenost sastava:** ako vlasništvo i zakup ne daju ukupno oglašeno (0,5 %), ili je vlasništvo veće od ukupnog, mjera zemljišta nije pouzdana. Ostaje otvorena stavka s napomenom. Preklapajuće mjere se nikad ne zbrajaju.
- **Primjer iz plana:** 150 ha ukupno = 110 ha u vlasništvu + 40 ha u zakupu.
  - Kupac koji traži 150 ha u vlasništvu ne dobiva podudaranje (110 ha je ispod 127,5 ha, čak i uz toleranciju).
  - Uz osnovu „zemljište ukupno” podudaranje postoji.
- **Parser (modul 3)** predlaže kanonsku osnovu. Zemljište bez navoda o vlasništvu predlaže kao „ukupno”, uz nisku pouzdanost i pitanje.

## Valjanost i povijest
- Promjena bitne mjere mijenja `pairText` (ranije provjere para više ne vrijede) i fingerprint ponude u PR-u #47 (novo odobrenje).
- `refresh` ne mijenja `facts_json`; to je testirano.

## Testovi
- **`ops/facts-vectors-v1.json` → `area_cases`:** 11 slučajeva s jednakim rezultatom u JS-u i Pythonu (paritet provjerava `test_facts.py`):
  - ha i m²;
  - djelomično vlasništvo i samo zakup;
  - neusklađen zbroj i vlasništvo veće od ukupnog;
  - nepotvrđena mjera;
  - tolerancija i `area_hard`;
  - korisna površina naspram površine zgrada;
  - stari zahtjev bez osnove.
- **`test_facts_api.mjs`:** stvarni `dispatch`, isti parovi s osnovom „vlasništvo” i „ukupno”, `refresh` čuva ručno upisane podatke.
- **Mutacije padaju:** zanemaren sastav, nula kao nepoznato, zanemarena osnova, nepretvorena jedinica.

## Otvoreno
- **Više čestica** po nekretnini, s pojedinačnim mjerama, i **različita cijena za dio paketa** traže zaseban model. Ovdje nisu riješeni.
- **Sektorski kriteriji** (modul 5) koriste ove mjere.
