# Neovisni pregled PR48 — partnerski prijedlog nakon promjene agencije

Provjera: 28.10.2026. 15:10 Europe/Zagreb. Pregledani head #48 `13a37f504d948107eb7bc5c81fdb80bafe412381`; isti put prihvata potvrđen u #55 `fa8004fd440804ad8057b0cbf81012931bdf2e2d`.

## P2: ponovna provjera ovlasti pri prihvatu
`supabase/functions/sites-platform/partner.mjs`, `partner_decide`: nakon zaključavanja prijedloga/pristupa/zapisa provjerava istek/opoziv i `baseValue` ciljnog polja, ali ne poziva `authorize` niti ponovno potvrđuje `agencyOf`.

Reprodukcija koju treba potvrditi izoliranim API/DB testom:
1. Agencija A ima pristup cijeni svojeg oglasa, predaje prijedlog.
2. Oglas u source_candidates prijeđe agenciji B (ili izgubi dokaz veze), a cijena ostane ista.
3. Operater prihvaća stari prijedlog agencije A.
Očekivanje: označiti zastarjelo/odbijeno uz audit; bez promjene cijene i bez refresha. Trenutni put dopušta prihvat jer gleda samo staru cijenu.

Izvršena provjera stvarne funkcije `partner()` s determinističkim nadomjesnim tagged-template tx slojem: validan stari grant/proposal, nepromijenjena cijena, sadašnja agencija B. Povrat `prihvaćeno`, jedan poziv UPDATE properties, nula upita veze s agencijom. Ovo potvrđuje izostanak provjere u kontrolnom toku; NIJE test PostgreSQL transakcija ili konkurentnosti. Lokalno nisu dostupni PostgreSQL, TEST_POSTGRES_URL ni PG_MODULE.

Postojeći test `test_partner_api.mjs` provjerava promjenu agencije prije NOVOG staginga, ne između staginga i prihvata. Dodati taj prozor te konkurentnu promjenu agency/source veze u izoliranoj bazi. Provjeru učiniti pod odgovarajućim zaključavanjem, čuvati nepromijenjena ručna polja i append-only audit. Lista prijedloga treba označiti izgubljenu vezu kao zastarjelu, bez otkrivanja drugih zapisa. Vanjski pristup ostaje OFF.

## Izvršene regresije na #48
- `node test_facts.mjs`: passed (vektori, budući datumi, obrnuti rasponi, kopije, digest i evaluacija).
- `python -m unittest test_facts`: 5 passed, uključuje JS/Python paritet.
- `node sites-review/scripts/test-request-parser.mjs`: passed (granice i isključenja HR/EN/DE).
Ovo je dio pregleda, ne odobrenje cijelog #47/#48 niti potvrda migracije/objave.
