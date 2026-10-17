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


## Uparivanje prema zahtjevu kupca (17.10.2026.)

- Kartice Nekretnine i Investitori omogućuju unos i uređivanje postojećih zapisa.
- Kupac ima profil (građevinska tvrtka, privatna osoba, investicijska tvrtka ili drugo), države, gradove/regije, vrste nekretnina, prihvatljiva stanja (uključujući obnovu i rušenje), površinu, ukupni budžet i opcionalni prag jednostavnog ROI-ja ili dokaz gradnje.
- Prazna vrsta/stanje kupca znači nepoznat zahtjev; za prihvaćanje svega treba označiti sve mogućnosti. Prazan grad/regija znači bez dodatnog ograničenja. Ne tumačimo slobodne napomene kao provjerene kriterije: one zadržavaju kandidata na ručnoj provjeri.
- Budžet se uspoređuje s cijenom + obnovom/rušenjem/radovima + ostalim troškovima. Nepoznat iznos ostaje NULL, a ne izmišljena nula. Jednostavni ROI ovisi o unesenoj procjeni i obuhvaćenim troškovima; nije prognoza dobiti.
- Razlozi, nedostajući podaci i odbijeni kriteriji prikazuju se uz svaki par. Ocjena je udio zadovoljenih strukturiranih kriterija; nije vjerojatnost kupnje.
- Potvrđeno podudaranje kriterija dodatno zahtijeva označen potvrđen zahtjev kupca s URL-om izvora i datumom ne starijim od 90 dana te dokaz pravne provjere nekretnine. To nisu automatski verificirani dokazi niti potvrda interesa za konkretnu kupnju. Nedostajuće informacije daju status kandidata; nepodudaranje ili neaktivna nekretnina daju odbijeni rezultat.
- Rezultati se ponovno računaju nakon spremanja kupca/nekretnine, uvoza i učitavanja prikaza. Ne šalju se poruke, ponude niti se zaključuju poslovi. Uvoz više ne stvara red obavijesti samo na osnovi države i budžeta. Zastarjeli redovi spremni za obavijest označavaju se za ponovnu provjeru kada nema odgovarajućeg para.
- Lokalna nadogradnja baze dodaje stupce i tablicu match_results bez brisanja postojećih redova. Stari zapisi zahtijevaju dopunu kriterija i dokaza. Nova tablica ima uključen RLS u PostgreSQL-u i nema javnih Data API politika; aplikacija koristi postojeću izravnu poslužiteljsku vezu. Nadogradnja nije izvršena na udaljenom Supabase projektu ovim commitom.
- Testovi: `python -m unittest discover -p 'test_*.py'`. SQLite testovi i Streamlit AppTest pokrivaju unos, izmjenu, budžet s troškovima, uvjete, dokaze, stare zapise, transakcije i osvježavanje rezultata. Stvarni Supabase PostgreSQL i objava na Streamlitu ostaju neprovjereni.

Automatsko pronalaženje nekretnina i novih kupaca na internetu, provjera njihovog stvarnog interesa i neprekidni rad na poslužitelju još nisu implementirani. Ova nadogradnja uparuje podatke koje je sustav već dobio.
