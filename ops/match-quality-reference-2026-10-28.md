# Referentni regresijski skup kvalitete parova (28.10.2026.)

Nalog vlasnika: komentar 6470902546 u antiquecroatianoak-sudo/EUnekretnine2#47. Prema `ops/matching-quality-roadmap-2026-10-28.md`: prvo primjeri i očekivanja, tek zatim promjena evaluatora.

Ovim radom **evaluator i runtime nisu mijenjani**.

## Što je dodano
- **`ops/match-quality-reference-v1.json`** — 37 sintetičkih TEST ONLY parova (q34–q37 iz revizije, `ops/audit-map-2026-10-28.md`). Svaki ima skupinu, opis, očekivani ishod, očekivani razlog (oznaka kriterija) i obrazloženje.
  - Ishodi: **odgovara** (jasno odgovara kriterijima), **odstupa** (jasno odstupa), **nedovoljno** (nedovoljno podataka).
  - Oznaka interesa ne postoji jer nema dokaza interesa.
- **`test_match_quality.mjs`** — svaki slučaj prolazi kroz stvarni `evaluate()` iz `domain.mjs`, s osnovnim zapisima koji sami za sebe odgovaraju. Provjerava se ishod i razlog: odbijanje mora biti zbog očekivanog kriterija, otvorena stavka mora biti očekivana. Pokreće se u CI-ju.
- **`test_match_quality.py`** — isti slučajevi kroz `matching.py`, uz usporedbu s JS-om. Usporedba obuhvaća 24 slučaja; kontakt postoji samo u JS evaluatoru.

## Što postojeći testovi već pokrivaju (nije dupliciran)
| Tema | Gdje |
|---|---|
| Osnova površine na razini podataka: vlasništvo/zakup/ukupno, ha/m², tolerancija na usporedivoj mjeri, tvrda granica uz osnovu, korisna nasuprot bruto | `ops/facts-vectors-v1.json` `area_cases` (JS i Python kroz `evaluate`) |
| Usporedba uvjeta: nepoznato, nepotvrđeno, proturječno, isteklo, budući datum, nula kao vrijednost, enum, obrnut raspon | `ops/facts-vectors-v1.json` `compare`, `range_cases` |
| Obavezan uvjet i želja, nevaljani podaci | `test_facts.py` `test_evaluate_semantics`, `test_facts.mjs` |
| Oglasi za najam/zakup isključeni pri uvozu | `test_agency_listings.py`, `test_bulgarian_listing.py`, `test_catalogue_navigation.py` |
| Ručni odgovori, digest dokaza i nevaženje nakon promjene | `test_pair_api.mjs`, `test_offer_workflow.mjs` |
| Spremanje više zahtjeva istog kupca | `test_offer_workflow.mjs` |

## Dodane praznine (cijeli par kroz evaluator)
| Skupina | Slučajevi | Očekivano |
|---|---|---|
| Osnova površine | q01–q03: površina zgrada naspram velike parcele; nepoznata tražena osnova; bruto naspram korisne | odstupa / nedovoljno / nedovoljno — oglašena površina nikad ne zamjenjuje traženu mjeru |
| Prodaja, zakup, sastav | q04–q08: „bez zakupa” uz potvrđen zakup, nepoznat zakup, potvrđenu nulu; zgrade nisu dio prodaje; želja „poslovanje” nepoznata | odstupa / nedovoljno / odgovara / odstupa / odgovara |
| Jedinica ili cijeli projekt | q09, q26–q33: obavezna jedinica uz nepoznat opseg; potvrđen cijeli projekt; potvrđena jedinica unutar i izvan granica; proturječan i budući opseg; želja; legacy bez uvjeta; cijeli projekt uz ha/m² | nedovoljno / odstupa (bez površine kao razloga) / odgovara / odstupa / nedovoljno / nedovoljno / odstupa / odstupa / odgovara |
| Tvrdo, želja, nepoznato | q10–q14: tolerancija +25 %; tvrda granica; samo sjedište; sjedište ≠ interes; budžet ispod cijene | odgovara / odstupa / nedovoljno / odstupa / odgovara |
| Proturječni i zastarjeli dokazi | q15–q22: proturječan podatak; istekao podatak; izvor star 40 dana; zahtjev star 100 dana; pravne komplikacije; „Uredno” bez dokaza; istekao rok; nepotvrđena dostupnost | nedovoljno ×4 / odstupa / nedovoljno / odstupa / nedovoljno |
| Više zahtjeva istog kupca | q23–q24: isti `buyer_identity_id`, različiti kriteriji | odgovara / odstupa — svaki zahtjev se ocjenjuje svojim kriterijima |
| Kontakt za konkretan zapis | q25: kontakt dokazan za drugi oglas | nedovoljno (samo JS) |

## Rezultat (stvarni prolaz, 28.10.2026.)
| Kategorija (37 podržanih slučajeva) | Broj |
|---|---|
| ispravno | 37 |
| pogrešno pozitivno (par prikazan kao „odgovara” bez osnove) | 0 |
| pogrešno negativno (opravdan ili otvoren par odbijen) | 0 |
| nedovoljno umjesto odluke | 0 |

- **JS i Python:** jednaki ishodi na sva 36 slučajeva usporedbe. Uz to `test_evaluator_parity.py` uspoređuje 1.500 perturbiranih parova.
- **Opseg tvrdnje.** Ovo je referentni skup sintetičkih slučajeva, ne označeni uzorak stvarnog tržišta. **Ne tvrdi se izmjerena preciznost ni odziv na stvarnim oglasima.** Tvrdi se samo da evaluator na ovim definiranim slučajevima daje očekivani ishod i razlog.

## Nalaz q09 — riješen ugovorom `sale_scope` (nalog 6471298345)
Očekivanja su zapisana i predana prije promjene evaluatora (zaseban commit). Zatim je dodan podatak facts-v1 `sale_scope` (vidi `ops/facts-v1.md`). Ispod je izvorni opis nalaza.

### Izvorni opis
**q09 — jedinica ili cijeli projekt.**
- **Primjer:** projekt od 40 stanova oglašen s 6.000 m² ukupne površine i cijenom „od”; kupac traži jedan stan od 80–120 m².
- **Očekivano:** nedovoljno podataka. Nije poznato prodaje li se cijeli projekt ili pojedinačne jedinice.
- **Sadašnji ishod (JS i Python):** odstupa (Površina). To je **pogrešno negativno** ako se prodaju jedinice.
- **Uzrok:** podatkovni ugovor nema polje opsega prodaje. Barem jedan konektor (`property_connector.py`) izričito ne preuzima razvojne cjenike u rasponu; nije provjereno da to vrijedi za sve izvore i ručni unos.
- **Prijedlog za odluku (nije implementiran):** podatak facts-v1 `sale_scope` (`jedinica` / `cijeli projekt`, uz dokaz).
  - Za zahtjev s granicama površine i nepoznatim opsegom na oglasu koji ima obilježja projekta, površina ostaje otvorena stavka.
  - S potvrđenim opsegom „jedinica” uspoređuje se površina jedinice.
  - To je promjena ugovora i evaluatora, pa prvo traži odluku vlasnika i zaseban mali commit s testom.
- **Do tada:** q09 je zabilježen sa stvarnim ishodom; ne broji se u podržane slučajeve i ne skriva se.

## Mutacije (uklanjanje čuvara mora srušiti skup)
**Ruše test (`domain.mjs`):**
- osnova površine ignorirana;
- nepoznata osnova pada na oglašenu površinu;
- tvrda granica ignorirana;
- tolerancija +25 % uklonjena;
- nepoznat obavezan uvjet računat kao ispunjen;
- obavezni uvjeti ignorirani;
- par bez država interesa;
- budžet blokira;
- zastarjeli izvor;
- zastarjeli zahtjev;
- pravni status bez dokaza;
- istekla ponuda;
- nepoznata dostupnost isključuje;
- kontakt drugog zapisa prihvaćen.

**Ruše test (`facts.mjs`):** istekli podatak računat kao važeći; proturječan podatak računat kao potvrđen.

**Ruše test (`matching.py`):** zastarjeli izvor; nepoznat obavezan uvjet računat kao ispunjen.

**Ne ruši (opravdano):** samo uklanjanje stanja „proturječno”. Ishod ostaje isti („nedovoljno” kao nepotvrđeno); razliku stanja već provjeravaju vektori facts-v1 (`compare`: „conflicting fact”).

## Ograničenja
- Slučajevi su sintetički i anonimni. Za izmjerenu preciznost potreban je označen skup stvarnih parova, koji ne postoji.
- Najam i zakup cijelog oglasa provjeravaju se pri uvozu, ne u evaluatoru. Ovdje je pokriven samo zakup zemljišta unutar prodaje.
- Python evaluator ne provjerava kontakte, pa je q25 samo u JS-u.
