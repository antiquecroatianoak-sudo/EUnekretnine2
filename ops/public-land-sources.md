# Javni kupci zemljišta — svih 27 država

Obuhvat je svih 27 država članica ravnopravno, bez geografskog prioriteta. Evidencija je `data/public_land_registry.json`, a prikaz po državama je u kartici Izvori.

## Što se uvozi
- Samo službeni poziv države, regije, grada, općine ili javnog fonda koji javno traži zemljište (`buy_request`, `public_authority`), prepoznat pregledanom formulacijom stranice (`PUBLIC_LAND_CALLS`).
- Ne uvoze se: prodaja javnog zemljišta (prodajni izraz uz poziv odbija zapis), posredovanje, najave projekata ni opće stranice.
- Rok, programski iznos i najmanja površina bilježe se samo kad su objavljeni, uvijek s izvornim isječkom (`*_evidence`). Datum se smatra rokom samo neposredno iza izraza za rok, pa datum objave nije rok.
- Programski iznos (`programme_budget`) nije budžet po lokaciji: `budget` ostaje prazan, pa par ostaje kandidat i ne može postati potvrđen posao.
- Zatvoren poziv ili istekao objavljeni rok daju `source_listing_state='expired'` s dokazom. Postojeća funkcija `site_private.sync_source_listing` tada lifecycle označava isteklim, a `reconcile_listing_lifecycle` uklanja parove. Otvoren poziv izričito dobiva `active`, pa ponovno otvoren poziv zamjenjuje raniju oznaku isteka.

## Statusi izvora
`uvoz_testiran` se upisuje samo uz stvarno pokretanje (run/job) koje je uvezlo zapis u bazu. Rezultat provjere koja samo čita (`probe_public_land.py`) je `dohvat_testiran`. Konfiguriran, pronađen, zatvoren i izvan opsega su zasebni statusi; ništa od toga nije tvrdnja o potpunoj pokrivenosti.

## Provjera i uvoz
1. Pull request: `public-land-probe.yml` stvarno dohvaća svaki konfigurirani poziv uz robots.txt, razmak između zahtjeva i ograničenje na isti host. Ne koristi OIDC, tajne ni bazu. Izvještaj je u sažetku posla i artefaktu `public-land-probe`.
2. Novi izvor ulazi u bazu tek nakon pregleda: `ops/register-public-land-sources.sql` (nije primijenjen).
3. Na main grani `public-land-check` uvozi samo registrirane izvore. Već uvezeni izvori moraju ostati registrirani; konfigurirani neregistrirani izvori ispisuju se kao neuvezeni, bez pogreške.

## Objava funkcija
`registry-discovery/index.js` sada uvozi `merge.mjs` (isto spajanje, izdvojeno radi testa očuvanja ručnih izmjena). Pri objavi treba uključiti `merge.mjs`; ponašanje se ne mijenja. SQL funkcije u bazi nisu mijenjane.

## TED
TED je samo dopunski izvor. Direktiva 2014/24/EU (čl. 10.a) izuzima stjecanje zemljišta iz javne nabave, pa TED nije baza kupnje zemljišta; adapter nije uključen.
