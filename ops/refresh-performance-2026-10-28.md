# Spori refresh nakon spremanja — nalaz i popravak (28.10.2026.)

Nalog: PR #47, komentar 6464121625. Spremanje zapisa, odgovori, provjere izvora i uvoz pokreću zajednički `refreshSuggestions` u istoj transakciji, pa spori refresh zadržava sučelje nakon spremanja.

## Uzrok (izmjereno, `ops/bench-read-path/`)
1. **Pisanja.** Svaki refresh ponovno upisuje svaki par u `match_results`, i kad se rezultat nije promijenio. Svaki upis okida tri triggera: guard, `pair_records` i zadatke provjere. Za 300 × 80 parova to je oko 80 s, od čega su gotovo sve pisanja.
2. **Evaluacija.** Svaki par prolazi `suggestion()`. Kupac s drugom vrstom nekretnine uvijek završava s `null`, ali se ipak parsira.
   - Za svaki par se iznova parsiraju `criteria_json` i oba kontakta.
   - `object(i.notes)` poziva `JSON.parse` nad slobodnim tekstom, što baca iznimku za gotovo svaki par.

## Popravak (bez promjene pravila ni podataka)
- **Predfiltar po državi i vrsti.** Proširen je dosadašnji predfiltar po državi. Par bez podudarne preslikane vrste uvijek završava s `null`, jer su i sve ranije provjere `null`; zato se ne evaluira.
- **Parsiranje jednom.** JSON zapisa parsira se jednom po refreshu, u zamrznute objekte. Funkcije `criteria()` i `contactData()` već prihvaćaju objekt. Nevaljani JSON zadržava izvorni tekst i dosadašnje rukovanje.
- **`object()`.** Tekst koji ne počinje s `{` vraća `{}` bez bacanja iznimke. Za 20 rubnih slučajeva rezultat je identičan starom.
- **Neizmijenjeni kandidati se ne prepisuju.** Kandidat čiji je spremljeni `result_json` identičan ostaje u bazi kakav jest.
  - Svaka stvarna prilika (`MATCH`) uvijek se ponovno šalje guardu.
  - Brisanje parova koji su ispali iz izračuna radi kao prije.
  - Posljedica: `match_results.updated` i `pair_records.last_evaluated_at` kandidata označavaju zadnju promjenu rezultata, a ne zadnji izračun. UI prikazuje `updated` kao „Spremljeno”, a `last_evaluated_at` ne koristi.
- **Kopije.** `discovery-sync` kopije `suggestions.mjs` i `refresh-suggestions.mjs` ostaju identične.

## Testovi
`test_refresh_equivalence.mjs` (izolirana baza, preko `test_pair_records.py`) uspoređuje izvorni refresh s `main`-a (`ops/refresh-reference-b5a507b.mjs`, doslovna kopija) i novi refresh. Oba kreću iz istog stanja, u transakcijama s rollbackom. Provjerava:
- iste rezultate bez prethodnog stanja i nakon promjene podataka;
- da ponovljeni refresh ne prepisuje nijednog kandidata i ne dodaje povijest, a `MATCH` ipak ponovno šalje guardu;
- da se parovi kupca koji je promijenio državu brišu.

Mutacije padaju: preskakanje i `MATCH` redaka, zaboravljeni preskočeni redovi, predfiltar bez aliasa vrsta i nepreslikana vrsta nekretnine.

## Mjerenje
Refresh u transakciji s rollbackom.

| Scenarij | `main` | popravak |
|---|---|---|
| 12.000 nekretnina × 80 kupaca, 5 vrsta, kupac traži jednu vrstu | 26,2–26,9 s | 6,9–7,3 s |
| Ponovljeni refresh, 300 × 80 svi kandidati (23.520 spremljenih parova) | 34,3 s | 1,6 s |
| Prvi refresh s 23.520 novih parova | 82 s | bez promjene (pisanja su stvarno potrebna) |

## Ograničenja
- **Preostalih ~7 s** čine jedna evaluacija vidljivosti nekretnina (~2,4 s) i stvarna evaluacija podudarnih parova. Nisu otklonjeni.
- **Sinkroni refresh.** Refresh i dalje radi sinkrono u transakciji spremanja. Asinkroni ili inkrementalni refresh samo za promijenjeni zapis bio bi veća promjena i traži poseban dogovor.
- **Produkcija.** Učinak na produkciji potvrđuje se nakon objave.
