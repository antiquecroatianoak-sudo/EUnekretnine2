> Ažuriranje 23.10.2026.: ispravci pregleda 6344298344 i 6361220363 nalaze se na grani PR-a (`3af1428`, `1170b5d` i ispravak uskladivanja s bazom niže). Pojedinosti su u `ops/review-fixes-2026-10-23.md`. Ništa nije objavljeno.

# Trajni cilj: evidencija potencijalnih parova

Izričita uputa vlasnika, 22.10.2026. (komentar 6342865014 na PR #2). Vrijedi za sve buduće dorade. Ovo dopunjuje postojeći sustav; ne stvara se paralelna aplikacija ni duplikat baze bez razloga.

## Cilj
1. Sustav uspoređuje dvije izvorne baze, nekretnine/prodavatelje (`properties`) i kupce/investitore (`investors`), po parametrima.
2. Predloženi parovi trajno se evidentiraju odvojeno kao **potencijalni parovi** povezani s izvornim zapisima. Za svaki par evidencija sadrži:
   - razloge podudaranja;
   - poznata neslaganja;
   - sve nedostajuće potrebne parametre;
   - zadatke provjere.
3. Gumb „Mogući parovi” otvara tu evidenciju.
4. Nedostajući podaci nikad ne postaju nule ni potvrđene činjenice.

## Faze para (korekcija vlasnika 6344490047 i 6344511552, nadjačava starije značenje)
Faze se ne spajaju i svaka ima vlastiti dokaz.
1. **Mogući par – dopuna podataka o nekretnini.** Iz mogućeg para priprema se nacrt pitanja prodavatelju radi dopune podataka o nekretnini.
2. **Nekretnina provjerena – usklađivanje s potrebama kupca.** Podaci nekretnine su potpuni i provjereni. Otvorene su još samo stavke kupca ili para.
3. **Stvarna prilika – interes kupca još nije potvrđen.** Potpuna i provjerena nekretnina odgovara dokumentiranim potrebama kupca. U bazi je to status `Podudaranje kriterija`, a ne potvrđen interes.
4. **Nacrt prezentacije** samo za stvarnu priliku, za tog kupca. Tek se njome traži stvarni interes.
5. **Potvrđen interes** zaseban je zapis s dokazom. Nakon njega dolazi **realiziran posao**, također s dokazom.

### Pravila
- **Budžet kupca nije uvjet spajanja** ni razlog zadržavanja u nepotpunima. Kupac ga ne mora otkriti. Poznati budžet je samo informativan (`info`) i ne izmišlja se.
- **Cijena nekretnine ostaje temeljni podatak**, uz lokaciju, veličinu, stanje i druge kriterije. Bez cijene nekretnina nije potpuna.
- **Cijena se prikazuje uz osnovu:** tražena cijena ili početna/minimalna ponuda na dražbi, uz poznate troškove. Konačni iznos se ne izmišlja. Dražbena početna ponuda ne uspoređuje se kao konačna cijena.
- **Povoljnost ne nadomješta kriterije:** jeftina cijena ne nadomješta neslaganje lokacije, namjene ili stanja. Ne tvrdi se „najjeftinije na tržištu” bez dokaza.
- **Provjera stvarne namjene, lokacije i pravnog stanja ostaje,** kao i poznata neslaganja tih kriterija.
- **Uvjeti kupca provjeravaju se u dva koraka.** Provjera teksta uvjeta kupca potvrđuje samo **sadržaj zahtjeva**. Ispunjava li ga konkretna nekretnina, zasebna je stavka para. Zatvara je samo provjeren odgovor s dokazom vezan uz tekst uvjeta i činjenice te nekretnine. Svaka promjena nekretnine ili uvjeta poništava dokaz.
- **Ništa se ne šalje automatski.** Pitanja i prezentacija su nacrti za pregled.
- **Rang povoljnosti nije uveden.** Kad se uvede, ide odvojeno od odgovaranja potrebama, provjerenosti i interesa: samo usporedive ponude iste vrste, iste osnove cijene i istog područja.

## Proces dopune
- **Ciljana pitanja:** pripremaju se pitanja prodavatelju i/ili kupcu, s evidencijom odgovora (dokaz, izvor, datum, status).
- **Opis nekretnine za kupca:** priprema se općenit opis s poznatim relevantnim informacijama i samo okvirnom lokacijom. Opis ne smije sadržavati:
  - točnu adresu ni koordinate;
  - kontakte prodavatelja ili agenta;
  - poveznice na oglas ni izvore;
  - identifikacijske brojeve;
  - prepoznatljiv kopirani tekst.
- **Fotografije i prilozi:** prije uključivanja provjeravaju se vidljive oznake i metapodaci.
- **Odvojenost izvora:** puni izvori ostaju interno, odvojeni od vanjskog opisa. Pri sažimanju se ništa ne izmišlja.
- **Ograničenje anonimizacije:** ne jamči se da se javna nekretnina ne može prepoznati iz kombinacije obilježja.
- **Bez slanja i otkrivanja:** nikome se ne šalju poruke niti otkrivaju podaci bez konkretnog odobrenja primatelja, sadržaja i kanala.
- **Bez novih plaćenih integracija.**

## Procjena postojeće implementacije (repozitorij na `fe3890a`, dopunjeno na `e99d45d`)
| Zahtjev | Postoji | Nedostaje |
|---|---|---|
| Usporedba po parametrima | `evaluate` u Pythonu (`matching.py`) i JS-u (`domain.mjs`, `suggestions.mjs`): razlozi (`reasons`), nedostajući podaci (`missing`), neslaganja (`rejected`) | — |
| Trajna evidencija parova | `match_results` (par → `result_json`, `updated`) | **Nije trajna.** `refreshSuggestions` briše svaki par koji nije u zadnjem izračunu (`delete … where updated is distinct from stamp`), a `sites-platform` `refresh` ga prepisuje. Isključeni parovi idu samo u `site_private.excluded_match_history` (lifecycle), ne i pri promjeni kriterija. Nema trajnog ID-a ni povijesti para. |
| Zadaci provjere | `match_review_tasks` postoji samo u bazi (izravno primijenjeno, nije u repozitoriju ni u migracijama) | Njegovu stvarnu shemu i funkciju treba pročitati iz baze prije bilo kakve migracije. |
| Odgovori s dokazom/izvorom/datumom/statusom | `activity` (`stage`, `notes`, `date`) po nekretnini/kupcu | Nema veze s konkretnim parom ni s nedostajućim parametrom; nema polja za dokaz, izvor ni status odgovora. |
| Stupnjevi | `MATCH` / `CANDIDATE` / `REJECT`; faze `activity` (Kontakt, Pregovori, Realizirano) | „Potvrđen interes” i „realiziran posao” nisu stanja para; `MATCH` je samo podudaranje kriterija. |
| Gumb „Mogući parovi” | Pregledna kopija `sites-review` na `fe3890a` filtrira `match_results` sa statusom kandidat | Kad evidencija postane trajna, gumb treba čitati nju. |
| Pitanja i opis za kupca | — | Generator ciljanih pitanja iz `missing`, anonimizirani opis s pravilima redakcije i provjera priloga. |
| Zaštita od curenja identifikatora | — | Regresije: opis ne sadrži URL, adresu, koordinate, kontakte, ID-eve ni dugačke doslovne isječke izvora. |

## Plan u kompatibilnim koracima (svaki uz pregled prije objave)
1. **Pročitati stvarno stanje baze:** `match_results`, `match_review_tasks`, funkcije `sync_source_listing` i `fill_*` te broj zapisa. Zapisati ih kao reproducibilnu migraciju bez promjene ponašanja.
2. **Trajna evidencija:** nadograditi postojeće tablice (ili `match_review_tasks`, ako odgovara), ne uvoditi drugu bazu.
   - Par dobiva stabilan ključ (`property_id`, `investor_id`), prvi i zadnji izračun te povijest statusa.
   - Ponovni izračun ažurira par, a ne briše ga. Par koji više ne odgovara dobiva stanje s razlogom, a ručne bilješke ostaju.
   - Regresije: ručne provjere se čuvaju, a izračun nikad ne postavlja potvrđen interes.
3. **Zadaci provjere po nedostajućem parametru,** s odgovorom: dokaz, izvor, datum, status i tko je unio. Odgovor mijenja par samo kad je dokaz potpun. Regresije: nedostajući podatak ne postaje nula; nepotpun odgovor ne potvrđuje par.
4. **Stupnjevi** podudaranje kriterija → potvrđen interes → realiziran posao, kao zasebna stanja, svako uz vlastiti dokaz.
5. **Pitanja i anonimizirani opis za kupca:** samo priprema i pregled, bez slanja.
   - Opis se gradi iz dopuštenog popisa polja, a ne brisanjem iz punog teksta.
   - Lokacija je na razini regije ili grada.
   - Prilozi su isključeni dok se ne provjere.
   - Regresije curenja identifikatora.
6. **Gumb „Mogući parovi”** prelazi na trajnu evidenciju; broj i popis ostaju iz istog izvora.

## Stanje provedbe
- **Audit 6342938279.** `fab8cdd` (nepoznat budžet NULL, sjedište izvan EU), `6bb9f65` (provjera teksta uvjeta), `e99d45d` (opis za kupca), `ca87cf0` (oznaka „Podudaranja kriterija”).
- **Objavljeno (ChatGPT, 22.10.):** samo gumb „Mogući parovi” (`fe3890a` + `ca87cf0`), u kanonskom Sites izvoru `c29e0922`. Promjene `sites-review/` ovdje ne mijenjaju objavljenu aplikaciju. Pri prijenosu treba sačuvati već objavljeni gumb.
- **Dio A, `92c2713`, pregled 6344298344** (bez baze):
  - uvjeti po paru;
  - neobavezan budžet;
  - faze i `gaps` (nekretnina / kupac / par);
  - u nacrtu prezentacije: pravne komplikacije, osnova cijene i dražba, pošten interval površine, regija samo uz potvrdu.
- **Dio B, trajna evidencija prema stvarnoj shemi** (`ops/pair-review-schema-2026-10-22.json`):
  - `ops/pair-records.sql`, aditivno i ponovljivo:
    - `pair_records` i `pair_history`: par se ne briše pri ponovnom izračunu nego se označi;
    - `pair_answers`: nacrt pitanja i odgovori s dokazom, izvorom i datumom; zapisi se samo dodaju;
    - `pair_stages`: potvrđen interes, povučen interes i realizacija, s čuvarom redoslijeda;
    - `pair_task_archive`: zadaci para koji ispadne vraćaju se s ručnim statusima.
  - Zamjena dviju postojećih funkcija istog potpisa:
    - `sync_match_review_tasks` čuva ručne statuse (izvorna je svaki upsert vraćala na „Otvoreno”), a „Provjereno” koje je i dalje nedostatak ponovno otvara s razlogom;
    - `investor_eligible` ne traži budžet.
  - API u `sites-platform`: `pair`, `pair_question`, `pair_answer`, `pair_stage`. `refresh` i `refreshSuggestions` primjenjuju samo provjerene odgovore.
  - Sites kopija: „Detalj para” (zadatak → nacrt pitanja → odgovor s dokazom → provjera, faze, povijest); „Nacrt prezentacije” samo za stvarnu priliku.
- **Testovi:**
  - `ops/test-pair-records.sql` (rollback, može se pokrenuti i na produkciji nakon migracije);
  - `test_pair_records.py` gradi bazu iz izvezene sheme i pokreće migraciju, regresije i `test_pair_api.mjs` (pravi `dispatch` i `refreshSuggestions`);
  - DOM provjera tijeka.
- **Redoslijed objave** (nakon neovisnog pregleda):
  1. `ops/pair-records.sql`, pa `ops/test-pair-records.sql`;
  2. Edge funkcije `sites-platform` i `discovery-sync`, jer čitaju `site_private.pair_answers`, a bez migracije bi svako spremanje palo;
  3. Sites izvor.
- **Pregled 6361220363 (usklađivanje s bazom):** evaluator primjenjuje ista pravila kao `property_eligible` i `investor_eligible`:
  - svježina izvora do 30 dana;
  - dopušten status oglasa;
  - obavezan grad;
  - zapis kriterija kupca u standardnom obliku.
  Ono što bi baza odbila više se ne izračunava kao stvarna prilika, nego ostaje kandidat sa zadatkom dopune.
  - Provjera izvora upisuje se samo izričito: API `source_check` i obrazac u „Detalju para” (Streamlit: datum i dokaz). Traži se datum koji nije u budućnosti i dokaz, a dokaz se bilježi u `activity`. Obično spremanje nikad ne postavlja datum.
  - Ako čuvar ipak odbije izračunatu stvarnu priliku, par se sprema kao kandidat sa stavkom „Baza nije prihvatila stvarnu priliku…”. Rang povoljnosti računa se samo nad spremljenim stvarnim prilikama.
  - Lokalni uvoz s dokazom aktivnosti i datumom (`import_verified.py`) upisuje status „Aktivno” i datum provjere iz uvoza.
- **Testovi i shema (stanje 23.10.):**
  - Izvoz sheme sadrži stvarne `safe_json`, `safe_stamp` i `title_property_type`, pa testovi više nemaju zamjene.
  - `ops/test-verification-policy.sql` koristi stvarni status kandidata i pokreće se u testu migracije.
  - DOM provjera i test serverske rute pokreću se u CI-ju (`ops/run-dom-check.sh`).

## Ograničenja
- Ništa od navedenog ne šalje poruke niti otkriva podatke.
- Promjene baze idu tek nakon čitanja stvarnog stanja i neovisnog pregleda.
- Promjena preglednog Sites izvora ne ažurira objavljenu aplikaciju.
