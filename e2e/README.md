# Ruff i provjere u pregledniku (28.10.2026.)

Odobrenje vlasnika: komentar 6464301339. Zaseban mali PR. Postojeće provjere baze, API-ja i DOM-a ostaju nepromijenjene i ne zamjenjuju se. Alati su besplatni, rade na standardnim GitHub runnerima i ne traže nove račune ni servise.

## Ruff (`ruff.toml`, workflow `lint-browser.yml`)
- **Verzija:** `ruff==0.14.3`, fiksirana u workflowu.
- **Pravila:** samo stvarne greške.
  - `E9`: sintaksa.
  - `F`: nedefinirana imena, redefinicije, neiskorištene varijable, neispravni formatni nizovi.
  - `PLE`: pylint greške.
- **Bez stilskih pravila i formatiranja.** `F401` (neiskorišten import) je izostavljen kako ne bi preplavio nalaze koji nisu greške.
- **Stanje na `main`-u:** bez nalaza.
- **Negativna kontrola** u CI-ju: datoteka s nedefiniranim imenom mora pasti.
- **`B023`** je isprobano pa izostavljeno: jedini nalaz (`test_source_leads.py`) je lažno pozitivan, jer se lambda poziva unutar iste iteracije.

## Preglednik (Playwright 1.56.1, Chromium)
- **Što se testira:** stvarna komponenta `sites-review/app/platform.tsx`, bundlana esbuildom.
- **Poslužitelj (`e2e/server.mjs`).** Samo testni; nije dio aplikacije i ne objavljuje se.
  - Na `/api/platform` odgovara stvarnim `dispatch` iz `supabase/functions/sites-platform/index.js` nad izoliranom bazom `e2e_*`.
  - Baza je izvezena shema plus `ops/pair-records.sql` (`e2e/prepare_db.py`) i nekoliko TEST ONLY zapisa.
- **Prijava.** Produkcijska prijava se ne zaobilazi. Testni poslužitelj nema prijavu jer nema produkcijske rute; `sites-review/app/api/*` i prijava ostaju nepromijenjeni.
- **Simulacija kvara.** `/__test/fault` postoji samo na testnom poslužitelju i simulira neuspjelo ili nevaljano čitanje.
- **Provjere:**
  1. Katalog, brojevi i mogući parovi učitavaju se iz stvarnog API-ja.
  2. Novi zapis se sprema, ostaje nakon punog ponovnog učitavanja i čita se iz baze.
  3. **Greška nije nula.**
     - Neuspjelo čitanje pokazuje grešku s ponovnim pokušajem, nikad prazne podatke ni „0”.
     - Nakon uspješnog učitavanja, nevaljan odgovor ostavlja učitane zapise vidljive.
  4. **Mobitel (390 × 844):** bez vodoravnog pomicanja stranice; gumb za spremanje obrasca je unutar ekrana.
- **Negativna kontrola** (lokalno): poslužitelj koji ne sprema ruši test 2.
- **Snimke** su artefakt workflowa (TEST ONLY podaci, čuvaju se 7 dana).

## Ograničenja (iskreno)
- **Globalni stylesheet** kanonskog Sitesa (layout, tema) nije u ovom repozitoriju.
  - Testna stranica dodaje samo pozicioniranje pozadine; ostalo dolazi iz stilova same komponente.
  - Zato nema pikselnih baseline usporedbi: pokazivale bi izgled koji nije produkcijski.
  - Vizualna provjera zasad je geometrijska (preljev i položaj ključnih kontrola) uz snimke za ručni pregled.
  - Kad globalni stylesheet uđe u repozitorij, mogu se dodati baseline snimke.
- **Istek čitanja** (45 s) pokriva `sites-review/scripts/test-platform-http.mjs` iz #51; ovdje se ne čeka 45 s.
- **Kontrast i raspored** u stvarnom pregledniku ostaju za kanonski stylesheet. Axe (#52) pokriva strukturne provjere.

## Lokalno
`bash e2e/run.sh <deps> <artefakti>` uz `TEST_POSTGRES_URL`, `E2E_DB_URL` (baza `e2e_*`) i `PG_MODULE`. U `<deps>` su `playwright@1.56.1`, `esbuild@0.25.11`, `react@19.2.6`, `react-dom@19.2.6` i `lucide-react@1.31.0`.
