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
4. Par prelazi u potvrđen tek nakon prikupljanja i provjere svih nužnih nedostajućih podataka i stvarnog interesa. Za svaki odgovor bilježe se dokaz, izvor, datum i status.
5. Razlikuju se tri stupnja koji se ne spajaju:
   - **podudaranje kriterija**;
   - **potvrđen interes**;
   - **realiziran posao**.
6. Nedostajući podaci nikad ne postaju nule ni potvrđene činjenice.

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

## Stanje provedbe (22.10.2026., audit 6342938279)
- `fab8cdd`: Sites obrazac i aktivni `investorInput` prihvaćaju nepoznat budžet (NULL) i sjedište izvan EU-a. EU interes ostaje zaseban. Profil „Javno tijelo” se čuva.
- `6bb9f65`: dokaziva provjera dodatnih uvjeta (`notes_check`, `source_conditions_check`), s datumom, dokazom i otiskom sadržaja (isti u `domain.mjs` i `matching.py`). Bilješke se ne brišu, a svaka promjena teksta vraća ručnu provjeru.
- `e99d45d`: siguran opis za kupca (`sites-review/lib/teaser.mjs`): samo dopuštena polja, provjera curenja, pregled prije kopiranja, bez slanja.
- **Blokirano, točke 3 i 4 audita:** API i detalj para (pitanja, odgovori, dokaz, status), potvrda interesa i realizacija odvojene od `i.verified` i `MATCH`, te trajna povijest para. Prema issueu #1, `match_review_tasks` je izravno primijenjena funkcija baze. Ona, kao i veze `match_results`, nije u repozitoriju, a ovo okruženje nema pristup bazi. Gradnja bez stvarne sheme mogla bi duplicirati ili prekinuti postojeće provjere. Treba pokrenuti `ops/pair-review-schema-export.sql` (samo čitanje) i rezultat prenijeti u repozitorij. Nakon toga slijedi aditivna migracija s regresijama za očuvanje ručnih provjera, nepotvrđene odgovore koji ne zatvaraju provjeru i to da ponovni izračun ne briše povijest.
- Mjesta koja mijenja trajna evidencija:
  - `refreshSuggestions` (`supabase/functions/discovery-sync/refresh-suggestions.mjs`) briše parove kojima se `updated` razlikuje od zadnjeg izračuna;
  - `refresh` u `sites-platform/index.js` prepisuje rezultat;
  - `reconcile_listing_lifecycle` arhivira u `excluded_match_history` samo istekle i uklonjene parove.

## Ograničenja
- Ništa od navedenog ne šalje poruke niti otkriva podatke.
- Promjene baze idu tek nakon čitanja stvarnog stanja i neovisnog pregleda.
- Promjena preglednog Sites izvora ne ažurira objavljenu aplikaciju.
