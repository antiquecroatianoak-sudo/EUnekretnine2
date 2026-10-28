# Dopune partnerskih agencija — modul 7 (28.10.2026.)

**Stanje:** ugovor, interni staging, pregled operatera, migracija i testovi su implementirani i lokalno testirani. **Vanjski pristup je isključen** (uputa 6446803748): nema obrasca, javne rute ni slanja ključa partneru. Za vanjsko otvaranje potrebna je vlasnikova odluka o novoj publici, kanalu i uvjetima.

## Tok
1. **Pristup (`partner_grant_create`):** operater bira agenciju, zapise i polja. Trajanje je 1–30 dana.
   - Zapisi moraju biti vlastiti oglasi te agencije (izvorni oglas iz izvora kataloga „Agencija…”). Tuđi ili nepoznati zapisi odbijaju se.
   - Ključ nastaje u pregledniku operatera i prikazuje se jednom. Na poslužitelj ide samo njegov SHA-256 sažetak; ključ se nigdje ne sprema.
2. **Prijedlog (`partner_stage`):** dostupan samo preko potpisanog gatewaya (interni staging i testovi). Vlasnička ruta `/api/platform` ga ne prosljeđuje.
   - Nepoznat ključ, tuđa agencija, zapis izvan pristupa i nepostojeći zapis dobivaju **isti odgovor**, pa partner ne može saznati postoje li drugi zapisi.
   - Istekao ili opozvan pristup i nedopušteno polje imaju vlastitu poruku.
   - **Vrijednosti:** URL-ovi su samo tekst (https, bez korisničkih podataka) i nikad se ne otvaraju. Datumi su YYYY-MM-DD, iznosi pozitivni brojevi, a podaci facts-v1 prolaze isti validator. Datoteke se ne primaju.
   - **Partnerski podatak** je uvijek `origin: partner` i `status: nepotvrđeno`. Dokaz koji partner upiše u sam podatak se odbacuje; potvrdu daje samo operater u uređivaču zapisa.
   - **Ograničenje:** najviše 50 prijedloga po pristupu na sat. Isti otvoreni prijedlog ne sprema se dvaput (ponavljanje, dvostruki klik).
3. **Pregled (`partner_proposals`, panel „Prijedlozi partnera”):** prikazuje sadašnju i predloženu vrijednost, dokaz partnera kao običan tekst i oznaku ako se zapis promijenio nakon prijedloga.
4. **Odluka (`partner_decide`):**
   - Prijedlog i zapis zaključavaju se (`FOR UPDATE`). Odluka je konačna.
   - **Prihvat** vrijedi samo ako je vrijednost polja jednaka onoj na koju se prijedlog odnosi. Inače prijedlog postaje „zastarjelo” i ništa se ne upisuje.
   - Prihvat mijenja samo to jedno polje, kroz isti validator zapisa (`propertyInput`). Upisuje stavku povijesti, a parovi se ponovno izračunavaju.
   - Prihvat nije dopušten nakon isteka ili opoziva pristupa; odbijanje jest.
   - Prihvaćen URL dokaza ne mijenja pravni status zapisa; to i dalje radi operater.

## Baza (`20261028100000_partner_proposals.sql`)
- **Tablice** u `site_private`: `partner_grants`, `partner_proposals` i `partner_audit`. Migracija je aditivna i ponovljiva; RLS je uključen, a prava za `public`, `anon` i `authenticated` su opozvana.
- **`partner_audit`** je append-only (okidač odbija `UPDATE` i `DELETE`). Bilježi izradu i opoziv pristupa, staging, odbijen pristup, ograničenje, prihvat, odbijanje i zastarjelost.
- **Povrat:** tablice mogu ostati neiskorištene. Brisanje je zasebna, izričita odluka.

## Ograničenja
- Ponovni izračun nakon prihvata je globalan (isti kao kod spremanja zapisa), a ne samo za pogođene parove.
- Pristup bez važećeg ključa ne ostavlja zapis u auditu jer nema pristupa na koji bi se vezao.

## Testovi
- **`test_partner_api.mjs`** (izolirana baza preko `test_pair_records.py`):
  - pristup: dodjela, tuđi zapis i nepostojeća agencija, ključ se ne sprema;
  - odbijanje bez otkrivanja, validacija i XSS kao tekst;
  - deduplikacija, prisilno nepotvrđen partnerski podatak;
  - prihvat bez promjene ostalih polja i ručnih podataka;
  - zastarjeli upis; istodobni prihvat dvaju prijedloga i istog prijedloga dvaput;
  - promjena agencije nakon dodjele; opoziv i istek; ograničenje;
  - append-only audit, RLS i prava.
  - Mutacijske provjere (uklonjena provjera verzije, agencije, ograničenja, zaključavanja, deduplikacije, opoziva i prisilnog statusa) ruše test.
- **`check-offer-workflow-dom.jsx`:** panel na stvarnom odgovoru API-ja. Dokaz se prikazuje kao tekst, bez poveznica i oznaka. Zastarjeli prijedlog nije moguće prihvatiti. Odbijanje šalje točnu radnju. Izrada pristupa šalje samo sažetak, a ključ se ne šalje. Nema radnje slanja.
- **`test-platform-route.mjs`:** vlasnička ruta prosljeđuje pregledne radnje, a `partner_stage` ne.
