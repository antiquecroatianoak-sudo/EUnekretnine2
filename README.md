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

## Automatska provjera izmjena

Workflow `Provjera aplikacije i PostgreSQL uparivanja` pokreće se pri izmjeni main grane i na pull requestu. Izolirana PostgreSQL 17 testna baza koristi TLS i privremene testne podatke, bez pristupa stvarnoj Supabase bazi. Dva integracijska testa provjeravaju uvoz, deduplikaciju, ažuriranje kriterija, RLS nove tablice, ponovljivu nadogradnju i rollback. Bez TEST_POSTGRES_URL preskaču se uz vidljivu oznaku; lokalni prolaz nije potvrda tih PostgreSQL testova. Ovaj workflow provjerava kod; ne pronalazi nove oglase niti pokreće produkcijski sustav.

## Prvi izvori automatskog dohvata (17.10.2026.)

Prvi stvarni dohvat dao je 494 kandidata: 475 redaka nekretnina iz Finina javnog CSV-a s budućim rokom nadmetanja, 4 hrvatska natječaja prodaje, 8 objava španjolskih državnih dražbi, 5 objava izravnih prodaja i 2 javna zahtjeva kupaca. Broj kandidata nije broj potvrđenih aktivnih pojedinačnih nekretnina. Natječaj može obuhvaćati više predmeta, RSS može sadržavati stare objave, a ni budući rok ne isključuje povlačenje prodaje. Pravni status, aktualnost, nedostajući troškovi i interes za konkretnu kupnju nisu automatski potvrđeni.

Izvori:
- https://ponip.fina.hr/ocevidnik-web/preuzmi/csv (CSV poveznica objavljena u službenom Očevidniku; ID nadmetanja određuje zapis)
- https://hr-nekretnine.hr/natjecaji/ (filtriraju se prodaje, ne zakup i zapošljavanje)
- https://www.hacienda.gob.es/_layouts/15/rsssubastas.aspx?hiloid=12
- https://www.hacienda.gob.es/_layouts/15/rssventasdirectas.aspx?hiloid=15
- https://gradzilla.hr/trazimo-zemljista/ (zemljišta 300–1500 m² u zoni tramvaja; kartu treba ručno provjeriti, budžet nije objavljen)
- https://www.immoexpert.hr/ (zemljišta u Zagrebu za gradnju stanova i ureda; budžet nije objavljen)

Ranija poveznica rssabintestatos nije uključena: sadržaj se odnosi na raspodjelu ostavine. Francuski izvor za nekretnine je cessions.immobilier-etat.gouv.fr, a ne prodaje pokretnina Enchères du Domaine; konektor još nije implementiran. Slovenija, Italija, Nizozemska i ostale države još nemaju testirane konektore u ovom dohvatu. Nema općeg automatskog pretraživanja novih tvrtki ili privatnih osoba: prate se dva već pronađena javna zahtjeva.

`python discovery.py` osvježava `data/discovered_candidates.json`. Dohvat je ograničen na registrirane domene, veličinu i vrijeme; poštuje dostupna robots pravila HTML izvora. Javne CSV/RSS izvoze obrađuje izravno. Pri pogrešci zadržava zadnje uspješne zapise s izvornim last_seen i bilježi pogrešku. Pogrešan format ili krivi RSS ne smije dati uspješan prazan rezultat. Nestanak zapisa znači samo da nije u posljednjem dohvatu, a ne da je prodan. Pripremljeni raspored na GitHubu radi svakih šest sati i sprema snapshot u isti privatni repozitorij. GitHub može odgoditi raspored; nije zajamčena točnost pokretanja u minutu. Provjeriti stvarni ishod workflowa prije tvrdnje da je automatizacija aktivna.

Aplikacija pri učitavanju uvozi snapshot u tablice `source_candidates` i `discovery_runs`. Prikaz Izvori pokazuje nalaze, datume, nepoznanice i pogreške. Gumb za pripremu zapisa stvara najviše jedan nacrt po kandidatu, s nepoznatom pravnom provjerom ili nepotvrđenim kupcem. Ne prepisuje ručno uređene zapise. Kandidati sami ne stvaraju obavijesti. Nove tablice imaju RLS u PostgreSQL-u; produkcijska baza nije izmijenjena ovim commitom. Bez aktivne objavljene aplikacije ili drugog procesa povezanog s bazom snapshot ostaje spremljen u GitHubu i ne znači da je udaljena baza već osvježena.

Ovaj raspored može dohvaćati poznate javne izvore neovisno o mobitelu nakon potvrđenog aktiviranja na GitHubu. To nije potvrda da je cijela aplikacija već objavljena ili da automatski ostvaruje prodaje.
