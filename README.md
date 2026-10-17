# EU investicijska platforma — nastavak postojećeg prototipa

Sačuvani su postojeći moduli i SQLite format. Dodana je podrška za Supabase PostgreSQL, provjereni paketni uvoz, evidencija dokaza i transakcijski red obavijesti. Ovo nije dovršena implementacija svih deset vizualnih primjera.

## Postavljanje istog projekta
1. Otvorite GitHub račun i privatni repozitorij `eu-investicijska-platforma` ako repozitorij ovog projekta već ne postoji. U korijen prenesite sadržaj ove mape, uključujući `.github/workflows/import.yml`.
2. U Supabaseu otvorite Free projekt u EU regiji. U `Connect` izaberite `Session pooler`. Sačuvajte PostgreSQL vezu privatno; lozinku u URL-u pravilno URL-kodirajte.
3. Na Streamlit Community Cloud povežite GitHub, odaberite taj repozitorij, granu `main`, ulaznu datoteku `app.py` i Python 3.12. U `Advanced settings / Secrets` postavite `DATABASE_URL = "<privatna PostgreSQL veza>"`. Provjerite da je aplikacija privatna prije unosa podataka.
4. Pokrenite Deploy. Aplikacija pri prvom spajanju izrađuje tablice. Trenutačna SQLite baza nije uključena u arhivu; ako postoje lokalni podaci, potrebno ih je migrirati prije prelaska.
5. U GitHub Settings → Secrets and variables → Actions dodajte isti `DATABASE_URL`. Workflow `Integracija provjerenih podataka` pokreće se ručno i uvozi `data/verified.json`. Početni paket namjerno je prazan.

## Stvarno stanje automatizacije
- Uvoz provjerenog JSON paketa postoji; automatsko pronalaženje dražbi još nije implementirano.
- Nema dnevnog rasporeda dok nisu povezani i testirani izvori Francuske i Nizozemske.
- `checked_at` traži ISO datum s vremenskom zonom; zapis mora sadržavati izvor, dokaz, aktivnost oglasa, pravni status i troškove. `Uredno` dodatno traži URL pravnog dokaza, procjena URL dokaza procjene.
- Uvoz evidentira cijeli dostavljeni zapis, izbjegava duplikate po URL-u i sprema podatke i red obavijesti u istoj transakciji.
- Red obavijesti nastaje tek za pravno označen uredan zapis s procjenom i potencijalnim podudaranjem prema državi/budžetu potvrđenog investitora. To nije dokaz interesa investitora. Slanje obavijesti nije uključeno.
- Podatke provjerava osoba; kod ne potvrđuje istinitost dokumentacije.
- Karta i automatska provjera pravnog stanja nisu implementirane.
- Posredovanje i komercijalno kontaktiranje čekaju pravno razjašnjenje HGK / Your Europe Advice 478010.

## Provjera
`python -m unittest discover -p test_import.py`

Prošla su četiri SQLite testa: integracija i deduplikacija, blokiranje obavijesti bez pravne provjere, odbijanje nevaljanog paketa te poništavanje transakcije nakon pogreške. Streamlit prikaz i Supabase veza još nisu testirani u stvarnom hostingu.
