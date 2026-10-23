# Nastavak nakon PR-a #3 — vidljivost mogućih parova, površina, izvori, poslovna faza

Polazište: `main` na `034d81e`. Upute su iz PR-a #3: 6361512242, 6364207005, 6364306499, 6366535035, 6366561469 i 6369410657. Odobrenje vlasnika dano je u Claude Code sesiji 23.10.2026.

Pravila rada:
- Nema mergea ni objave prije neovisnog pregleda.
- Nema nove migracije ako nije nužna.
- Ne mijenjaju se Košarica, građevinska aplikacija ni privatnost.
- Nikoga se ne kontaktira.

## Matrica zahtjev → kod → test → status
Ovaj dokument se ažurira sa svakim commitom ove grane. Status „u tijeku” znači da još nema koda ni testa.

| # | Zahtjev | Datoteke | Test | Status |
|---|---|---|---|---|
| V1 | Mogući parovi vidljivi čak i kad pun `read` ne uspije ili je prevelik; greška nije prazan rezultat | `sites-platform/index.js` (`pairs`, `sources`, `read` s `counts`/`truncated`), `route.ts`, `platform.tsx` (`fetchJson`, `loadPairs`, `matchSection`) | `test_pair_api.mjs` (pairs/read/sources), DOM 7a–7c, test rute | izvedeno |
| V2 | Dijagnostika: koliko parova nastaje, zašto se isključuju (opravdano ili gubitak) i koliko ih je skriveno filtrom | `suggestions.mjs` (`EXCLUDED`, `why`, `pairFunnel`), `index.js` (`pair_diagnostics`), `platform-view.mjs` (`pairsView`, `funnelRows`) | `test_public_land.mjs`, `test_pair_api.mjs` (zbroj = svi parovi, samo brojevi), `test-platform-view.mjs`, DOM 7e–7f | izvedeno |
| V3 | Stvarna nula ima objašnjenje; nepotpun kandidat ostaje vidljiv sa zadacima | `platform-view.mjs` (`pairsExplanation`), `platform.tsx` | `test-platform-view.mjs`, DOM 7d; kandidat sa zadacima već u `test_pair_api.mjs` (6361220363) | izvedeno |
| A | Površina −15 % / +25 % (nadomješta ±25 % iz 6364306499), uz izričitu tvrdu granicu kupca | `areaFit` u svim kopijama `domain.mjs`, `area_fit` u `matching.py`; `suggestion()` (i stari `min_area_m2`); Sites obrazac i Streamlit obrazac (`area_hard`). SQL čuvari ne provjeravaju površinu, pa tu nema promjene. | `test_domain_input.mjs`, `test_matching.py`, `test_matching_ui.py`, DOM 3 | izvedeno |
| B | Otkrivanje novih izvora za oba toka, ili precizno dokumentirana prepreka | `registry_discovery.py`, `discovery.yml` | — | u tijeku |
| C | Odgođena poslovna faza, zadano isključena i reverzibilna | `sites-platform/index.js` (`settings()` iz `BUSINESS_PHASE`, u `read` i `pairs`), `platform.tsx` (`TeaserPreview businessPhase`) | `test_pair_api.mjs` (zadano isključeno, uključivanje bez promjene podataka), DOM 5 | izvedeno |
| D | `ops/potential-pairs.md` usklađen s PR-om #2 i #3 te Sitesom v7; povijesno stanje označeno | dokumentacija | — | u tijeku |

## V — nalaz o vidljivosti (bez pristupa produkciji)
Uzrok praznog prikaza ne mogu reproducirati bez produkcije. Kod je imao tri slabe točke koje do njega mogu dovesti; ovaj paket uklanja svaku.

1. **Jedan veliki `read`.** Učitavao je do 10 000 punih redaka iz svake tablice, uključujući sve `source_candidates.body_json` i cijeli `activity` (vidi 6369410657). Ako taj odgovor padne ili istekne, sučelje nije imalo ništa: popis parova ovisio je isključivo o njemu.
   - Sada parovi stižu zasebnom malom radnjom `pairs`.
   - `read` šalje samo najnovijih 500 izvora i 500 aktivnosti, uz stvarne brojeve (`counts`) i oznaku skraćenosti (`truncated`).
   - Izvori se učitavaju po stranicama kroz radnju `sources`.
2. **Odgovor koji nije JSON** (stranica gatewaya, prekinuto tijelo) prikazivao se kao sintaksna greška bez statusa.
   - Sada se prikazuje HTTP status i veličina odgovora, što je mjerljiv signal za timeout ili preveliko tijelo.
   - Brojač „Mogući parovi” prikazuje „?” umjesto 0 kad podaci nisu učitani.
3. **Par čija nekretnina ili kupac više nije na vidljivom popisu** tiho je nestajao iz `storedMatches`.
   - Sada ga `pairs` vraća s oznakom `visible`, a sučelje ga broji uz razlog.

Za stvarnu analizu „58 kandidata na 9 657 nekretnina i 74 kupca”: radnja `pair_diagnostics` (gumb „Zašto nema više parova?”) vraća lijevak samo kao brojeve, s istim uvjetima kao izračun. Svaki par završi u jednoj od kategorija:
- država izvan interesa kupca;
- isključen uz razlog iz `suggestion()` (npr. nepoznata vrsta nekretnine, vrsta nije tražena, nema URL izvora, „Ne odgovara: <kriterij>”);
- spremljen kao kandidat ili stvarna prilika.

Pregledatelj to može pokrenuti na produkciji bez izlaganja zapisa. Ništa se ne izmišlja niti pretvara u priliku radi broja.

## A — semantika površine (6366561469; ±25 % iz 6364306499 je nadomješteno)
- **Jedna ciljna površina** (`min_area = max_area = T`): prihvaća se `[0,85·T, 1,25·T]`, uključivo. Za 1000 m² to je 850–1250 m²; 849 i 1251 su izvan.
- **Raspon** `[min, max]`: prihvaća se `[0,85·min, 1,25·max]`.
- **Samo donja granica:** `≥ 0,85·min`. **Samo gornja granica:** `≤ 1,25·max`.
- **`area_hard: true`:** kupčeve granice ostaju tvrde, bez tolerancije. Postavlja se samo izričito u obrascu i nikad se ne pretpostavlja.
- **Usporedba:** skalirana (`površina·100` prema `granica·85` ili `granica·125`, uz relativni epsilon 1e-12), pa točne granice ne ovise o zaokruživanju.
- **Odstupanje:** `area_deviation` (postotak, jedna decimala) i tekst u `info`, i unutar i izvan tolerancije.
- **Nepoznata, nula, negativna ili nebrojčana površina** nikad nije 0. Ostaje otvorena stavka „Površina” na strani nekretnine.
- **Ostali kriteriji** (vrsta, stanje, lokacija, pravni status, aktivnost) i dalje vrijede. Sama površina nije dokaz podudaranja.

## C — odgođena poslovna faza (6364306499)
- **Zadano isključeno.** Uključuje se tek varijablom okoline Edge funkcije `BUSINESS_PHASE=on`, i to tek s početkom poslovanja. Isključuje se uklanjanjem varijable. Podaci i povijest se ne mijenjaju.
- **Dok je isključeno:**
  - nacrt prezentacije i dalje se može otvoriti i pregledati interno, ali kopiranje za slanje je onemogućeno i prikazana je napomena;
  - interni pregled, „Detalj para”, nacrti pitanja (koji se samo spremaju), odgovori s dokazom i ručni unos rade normalno.
- **Slanje ne postoji ni kad je faza uključena.** Sustav nema nijedan put slanja poruka ili e-pošte.
- **Kasniji proces, samo kao opis, bez koda i bez slanja:**
  1. dopuna podataka od prodavatelja;
  2. prezentacija kupcu bez točne lokacije, kontakta, poveznice i identifikatora;
  3. stvarni interes kupca, zabilježen s dokazom;
  4. predaja agenciji i ugovor o proviziji s agencijom.
  Ovo nije pravna potvrda niti odobrenje potpisivanja.
