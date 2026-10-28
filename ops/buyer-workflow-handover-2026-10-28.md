# Predaja nastavka plana #46 — modul 8 (28.10.2026.)

**Stanje:** implementirano i testirano lokalno i u CI-ju. **Nije neovisno pregledano ni objavljeno.** Objavu radi ChatGPT nakon pregleda.

## PR-ovi i redoslijed spajanja
| Redoslijed | PR | Grana | Head pri predaji | Sadržaj |
|---|---|---|---|---|
| 1 | antiquecroatianoak-sudo/EUnekretnine2#50 | `fix/refresh-performance` (iz `main`) | `5ea915e6da86b874a59f0fadd53d757fda59fcbd` | brži refresh nakon spremanja; preskakanje samo uz dokazano aktualno izvedeno stanje |
| 2 | antiquecroatianoak-sudo/EUnekretnine2#47 | `feature/buyer-offer-workflow` | `09226a2c5e3f1e97d56e1e1d2603680da631a89b` | osnovni tijek plana #46 (uključuje `main` s #51 i #52) |
| 3 | antiquecroatianoak-sudo/EUnekretnine2#48 | `feature/buyer-workflow-enhancements` (nad #47) | vidi PR | moduli 1–7 i ova predaja |
| neovisno | antiquecroatianoak-sudo/EUnekretnine2#53 | `chore/ruff-playwright` (iz `main`) | `14998fa67cc99a06c42d0b7c2b7272e16537f6ed` | Ruff i Playwright provjere |

- Nakon spajanja #47 baza za #48 prebacuje se na `main`.
- #47 i #48 dijele `refresh-suggestions.mjs` s `main`-a. Ako se #50 spoji prvi, njegove izmjene ulaze u #47 i #48 običnim mergeom `main`-a.

## Moduli (#48)
| Modul | Commit | Uključeno | Migracija | Povrat |
|---|---|---|---|---|
| 1 facts-v1 | `f69b56a` | da (polje je neobavezno) | `20261028090000_property_facts.sql` | stupac `facts_json` ostaje neiskorišten; zapisi bez podataka nepromijenjeni |
| 2 red dopune | `cf8522d` | da (samo čitanje) | — | ukloniti radnju i panel |
| 3 lokalni parser | `7c0cbe3` | da (samo prijedlog, ručna potvrda) | — | ukloniti panel; spremljeni `source_text` ostaje podatak |
| 4 osnova površine | `c3c2c0f` | da (samo za zahtjeve s `area_basis`) | — | zahtjevi bez osnove rade kao prije |
| 5 sektorski uvjeti | `fa5285b` | da | — | predlošci samo popunjavaju polja |
| 6 vrijeme putovanja | `92fafbc` | **isključeno** (`TRAVEL_CONFIG.enabled=false`) | — | — |
| 7 prijedlozi partnera | `e442460` | interni staging; **vanjski pristup isključen** (`PARTNER_CONFIG.external=false`) | `20261028100000_partner_proposals.sql` | tablice ostaju neiskorištene; brisanje je zasebna odluka |
| nalazi pregleda | `a3372da` | da | — | — |

Poslovna faza (`BUSINESS_PHASE`) ostaje isključena.

## Objava (kad pregled prođe)
1. **Migracije prije koda.** Obje su aditivne i ponovljive. `save_property` s podacima facts-v1 traži stupac `facts_json`; radnje partnera traže tablice modula 7.
2. **Edge funkcije s istim kopijama:** `sites-platform`, `discovery-sync` i `registry-discovery`. Kopije `domain.mjs`, `facts.mjs` i `travel.mjs` moraju biti jednake; testovi to provjeravaju.
3. **Sites:** `sites-review/app/*` i `sites-review/lib/*`. Ruta `/api/platform` prosljeđuje samo radnje za pregled prijedloga partnera, nikad `partner_stage`.
4. **Nakon objave:** jedan ručni refresh, zatim provjera brojeva parova i zadataka prema `ops/read-path-2026-10-27.md`.

## Završna regresija (lokalno, head grane #48 nakon spajanja #47 i `main`-a)
| Provjera | Rezultat |
|---|---|
| `python -m unittest discover` — izolirane baze i API (parovi, ponude, čitanje, facts, red dopune, partneri, refresh ekvivalencija) | 303 OK |
| Node testovi iz CI-ja (14 skripti i `node --test`) | svi prolaze |
| PostgreSQL testovi uvoza i sinkronizacije (`test_source_intake_postgres`, `test-catalog`, `test-source-buyer-sync`…) | prolaze |
| DOM provjere na **stvarnim API odgovorima** (parovi, ponuda, red dopune, partneri) | 5/5 |
| `test-platform-http.mjs` (#51) | prolazi |
| axe (#52): Dashboard i obrazac | 0 kršenja |
| Mutacijske provjere (refresh, facts, parser, partneri) | sve mutacije ruše testove |
| Mobitel 360 i 390 px (Playwright, ad hoc): red dopune, prijedlozi partnera, editori facts-v1 sa stvarnim odgovorima | bez vodoravnog preljeva; dokaz partnera prikazan kao tekst |

Pokriveno po zahtjevu plana:
- legacy zapisi bez `facts_json`, prije i nakon migracije;
- idempotencija i konkurentnost (istodobni prihvat, deduplikacija, `FOR UPDATE`);
- anonimizacija prezentacije: bez koordinata, identifikatora i URL-ova.

## Otvoreno
- **Neovisni pregled** svih modula i nalaza (#47, #48, #50, #53).
- **Vanjski pristup partnera** (modul 7) i **servis za rute** (modul 6) traže vlasnikovu odluku o publici, servisu i troškovima.
- **Zvuk ikone od 0,5 s** (6464209664) je blokiran: `components/icon-sound.tsx` i izvorni WAV nisu u repozitoriju.
- **Pikselne baseline snimke** (#53) čekaju globalni stylesheet kanonskog Sitesa u repozitoriju.
- **Refresh** je i dalje sinkron u transakciji spremanja. Inkrementalni refresh traži poseban dogovor.
- **Pravilo suradnje u `AGENTS.md`** (6446389085) čeka izravnu potvrdu korisnika u sesiji.
