# Podatkovni ugovor facts-v1 — modul 1 (28.10.2026.)

Nalog: PR #47, komentar 6464121625; plan u `ops/buyer-workflow-enhancements-plan.md`.

**Stanje:** implementirano i izolirano testirano. Nije pregledano ni objavljeno. Migracija nije primijenjena.

## Sadržaj
- **Registar.** `facts.mjs` (kopije u svim direktorijima s `domain.mjs`) i `facts.py` definiraju za svaki podatak: tip, dimenziju jedinice, značenje i dopuštene usporedbe. `FACTS_VERSION=facts-v1`.
  - Pet osnovnih vrsta ostaje. `subtype` je opcionalna podvrsta i ne preklasificira postojeće zapise.
- **Podatak nekretnine** (`properties.facts_json`, nova aditivna kolona). Svaki zapis ima vrijednost, jedinicu, podrijetlo (izvor, ručno, partner, predloženo), status (potvrđeno, nepotvrđeno, proturječno), dokaz, datum opažanja i opcionalni rok važenja.
  - Potvrđen podatak traži dokaz.
  - Nepoznato se ne upisuje i nikad nije `false` ni nula.
- **Zahtjev kupca** (`criteria.requirements`). Svaki uvjet ima podatak, usporedbu, vrijednost, jedinicu, oznaku obavezno ili želja te izvorni navod.
  - Zahtjev je odvojen od činjenice nekretnine.
  - Kriteriji različitih zahtjeva se ne miješaju.

## Evaluacija (JS i Python, isti vektori)
- **Obavezan uvjet** je kriterij kao i ostali:
  - potvrđen i usporediv podatak → odgovara ili ne odgovara (ne odgovara odbija par);
  - nepotvrđen, proturječan ili istekao podatak, ili podatak koji nedostaje → otvorena stavka na strani nekretnine, uz zadatak provjere.
- **Želja** samo dodaje informaciju i nikad ne blokira par.
- **Datum opažanja u budućnosti (nalaz 6464745746, P1).**
  - Novi unos (`propertyInput`, prijedlog partnera) odbija `observed_on` iza najkasnijeg kalendarskog datuma na Zemlji (UTC+14), pa je cijeli „danas” u svakoj vremenskoj zoni dopušten.
  - Postojeći zapis s takvim datumom čita se bez promjene; podatak i povijest ostaju.
  - U usporedbi je stanje `future` sve dok je `observed_on` iza današnjeg UTC datuma: otvorena stavka nekretnine, nikad „odgovara”. Datum se nikad ne prepisuje na današnji.
  - Isto vrijedi za osnovu površine (modul 4).
- **Obrnut raspon (nalaz 6464745746, P2).** Najmanja i najveća vrijednost istog podatka uspoređuju se u osnovnoj jedinici dimenzije (2 ha > 10.000 m²).
  - Novi unos (`investorInput`, `save_request`, Streamlit obrazac) odbija obrnut raspon kad su obje granice obavezne.
  - Spremljeni zahtjev čita se blago, a usporedba ih označava stanjem `inverted`. Obavezna granica čiji je par također obavezan postaje otvorena stavka na strani kupca, nikad odbijanje nekretnine ni podudaranje.
  - Želja koja proturječi drugom uvjetu je samo informacija.
- **Jedinice** se pretvaraju samo unutar iste dimenzije (m² i ha, kW i MW). Tolerancija površine ovdje se ne primjenjuje.
- **Nevaljani podaci.** Nevaljani `facts_json` daje otvorenu stavku. Nevaljani `requirements` čine kriterije kupca nevaljanima (otvorena stavka). Ništa se ne preskače tiho.
- **Valjanost provjera.** `pairText` uključuje podatke samo kad postoje, pa digest postojećih provjera ostaje jednak. Promjena bitnog podatka poništava ranije provjere para; ponuda u PR-u #47 ionako veže odobrenje uz cijeli zapis.

## Objava i povrat
- **Redoslijed:**
  1. Migracija `supabase/migrations/20261028090000_property_facts.sql` (`add column if not exists`, ponovljiva).
  2. Edge funkcije (`sites-platform`, `discovery-sync`, `registry-discovery` — sve s novim `facts.mjs`).
  3. Sites.
- **Kad je dostupno:** `propertyInput` piše `facts_json` samo kad je poslan, a UI prikazuje uređivač podataka tek kad kolona postoji.
- **Povrat:** stari kod zanemaruje kolonu. Brisanje kolone je zasebna, izričita odluka.
- **SQL guardovi** nisu mijenjani. Guard odbija samo `MATCH`, a JS evaluacija prije toga postavlja otvorene stavke ili odbijanje.

## Testovi
- **`test_facts.mjs` i `test_facts.py`:** zajednički vektori (`ops/facts-vectors-v1.json`), paritet registra, stanja i `pair_text` između JS-a i Pythona, semantika evaluacije, stabilnost digesta i validacija unosa.
- **`test_facts_api.mjs`** (izolirana baza, stvarni `dispatch`):
  - ponovljena migracija;
  - spremanje prije i nakon migracije;
  - otvorena stavka i zadatak za nepoznat podatak;
  - 150 ha ukupno (110 ha vlasništvo + 40 ha zakup) ne zadovoljava traženih 150 ha vlasništva;
  - želja ne blokira par;
  - odbijen nepoznat ključ.
- **DOM:** uređivač zahtjeva (točan payload), uređivač podataka (nepoznato bez vrijednosti, uklanjanje) i tablica traženo/stvarno/dokaz/stanje.
- **Mutacije padaju:** nepotvrđeno računato kao potvrđeno, istekli podatak, želja kao obavezna, podaci uvijek u `pairText`, ha bez pretvorbe.

## Otvoreno
- **Moduli 4 i 5** (površine, sastav prodaje, sektorski kriteriji) koriste ovaj ugovor. Ovdje nema sektorske logike ni tolerancije.
- **Uvoznici** (`source_candidates` / `prepare`) još ne proizvode ove podatke. Modul 3 (parser teksta uz ručnu potvrdu) predlaže `requirements` sa statusom „predloženo”.
- **Izvoz i ponuda (PR #47)** prikazuju samo allowlist sažetke; sigurni sažeci podataka dolaze u modulu 5.
