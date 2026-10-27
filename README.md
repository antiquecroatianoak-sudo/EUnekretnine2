# EU Investicijske prilike

Privatna aplikacija za pregled nekretnina i dokumentirane potražnje kupaca u svih 27 država EU:
https://eu-investicijske-prilike-luka.lushlily1.chatgpt.site/

## Poslovni tijek

1. Pronaći nekretninu i kupca s relevantnim kriterijima te upotrebljivim kontaktom za oba zapisa. Kanal može biti izravan, preko izvorne agencije ili putem obrasca povezanog s konkretnim oglasom/potražnjom.
2. Pregledati mogući par: podudarnost, odstupanja, nedostajuće podatke i dokaze. Postotak nije vjerojatnost prodaje; kandidat nije potvrđena prilika ni interes kupca.
3. Pripremiti opći opis za provjeru interesa, bez točne adrese, izvora i kontakata stranaka. Poslovna faza je odvojena konfiguracija; aplikacija ne šalje poruke.
4. Nakon pisanog interesa i potrebnih provjera predati slučaj licenciranoj agenciji koja vodi komunikaciju, posredovanje i prodaju. Naknada se dogovara s agencijom i dospijeva tek nakon uspješno dovršene prodaje.

Mjerodavne projektne upute i njihove novije dopune nalaze se u [AGENTS.md](AGENTS.md). Partnerstvo, dopuštenje pristupa podacima, aktivacija uvoza, dostupnost, pravna provjera i interes kupca zasebne su činjenice.

## Aktualna arhitektura

- Objavljeno sučelje je Sites aplikacija. `sites-review/app` i `sites-review/lib` sadrže pregledavanu kopiju poslovnog sučelja za GitHub regresije; uskladiti je sa stvarnim Sites izvorom pri promjenama. Objavljeni izvor ima zaseban Sites Git repozitorij i vlastitu konfiguraciju objave.
- `sites-review/app/api/platform/route.ts` provjerava prijavu i izvor zahtjeva. Poslužiteljski gateway potpisuje zahtjeve Supabase funkciji `sites-platform`; privatni ključ ne ide u preglednik ni GitHub.
- Supabase PostgreSQL trajno sprema zapise, izvore, provjere i povijest. Sučelje učitava istu bazu i nakon zatvaranja preglednika ili nove objave. Ne oslanja se na localStorage za poslovne podatke.
- `supabase/functions/sites-platform` obrađuje čitanje i ručno spremanje; `registry-discovery` nastavlja registrirane izvore, a `discovery-sync` prenosi javni snapshot. Kritični moduli pravila postoje u sva tri paketa; promjene moraju ostati usklađene.
- `app.py`, `matching.py` i `storage.py` čuvaju zasebni Streamlit put i njegove regresije. SQLite je lokalna mogućnost; nije baza objavljene Sites aplikacije. Za Streamlit/PostgreSQL koristi se poslužiteljski `DATABASE_URL`. Ne stavljati tajnu u repozitorij.

## Trajnost i ponovljivi uvoz

- `properties`, `investors` i `source_candidates` čuvaju identitet i podatke. Ponovljeni dohvat ažurira izvorna polja prema evidenciji podrijetla; ručne dopune i eksplicitno očišćena polja moraju ostati sačuvani.
- `discovery_runs` čuva statuse izvora, redove za nastavak i konfiguraciju. Djelomičan dohvat nije dovršen katalog. Ne brisati checkpoint da bi se izvor prikazao uspješnim.
- `match_results` je trenutačni izračun. `site_private.pair_records`, `pair_history`, `pair_answers`, `pair_stages` i `pair_task_archive` čuvaju trajnu evidenciju i kad par ispadne iz izračuna. Ponovno uparivanje ne smije izbrisati odgovore, interes ili ručne zadatke.
- Ručne izmjene i osvježavanje parova izvršavaju se u transakciji. Pogreška mora poništiti cijelu radnju; uspjeh se prikazuje tek nakon odgovora poslužitelja.
- Potvrđeno zatvaranje postojećeg oglasa treba spremiti bez brisanja povijesti i odmah ga isključiti iz operativnih parova. Novi potvrđeno neaktivni oglasi se ne uvoze.
- Baza je trajna pohrana, ali trajnost nije zasebna sigurnosna kopija. Ovaj repozitorij nije izvoz svih produkcijskih podataka i ne dokazuje mogućnost oporavka nakon brisanja projekta.

## Dostupnost i podudaranja

- Nepoznata dostupnost ili neuspjela mrežna provjera ostaje označena kao **Dostupnost nije potvrđena**. Sama po sebi ne isključuje oglas.
- Potvrđeno prodano, povučeno, zatvoreno i istek dokumentiranog roka isključuju oglas iz operativnog kataloga i parova. Buduća aukcija ne poništava istek drugog dokumentiranog roka.
- Pravno stanje s dokumentiranim komplikacijama isključuje priliku. Nepoznata pravna provjera ostaje nedostatak, bez izmišljanja urednog stanja.
- Zemlja sjedišta kupca ne određuje državu potražnje. Za par se koristi izričito navedena lokacija interesa. Nepoznat ili premašen budžet nije tvrdi filtar.
- Direktan kontakt klijenta nije potreban ako izvorna agencija ili portal omogućuje dokazani kanal za konkretan zapis. Opći kontakt portala bez te veze nije dovoljan.
- Nema ukupnog ograničenja broja uvezenih zapisa ili dostupnih nekretnina/kupaca. Granice pojedinog zahtjeva, stranice, vremena i veličine odgovora služe obradi u paketima. Nastavak mora biti dostupan; djelomičnost se prikazuje izričito.

## Automatizacija i objava

`.github/workflows/discovery.yml` redovno radi svakih šest sati (`17 */6 * * *`, UTC). GitHub raspored može kasniti. Uvoz radi bez otvorenog mobitela, čuva napredak, sprema nalaze i prenosi ih u bazu. Zadaci za profile, skupine nekretnina i nacionalnu dopunu imaju vlastite provjere.

Samo uključena oznaka izvora nije dokaz uspješnog dohvata. HTTP zabrane, robots pravila, rate-limit odgode, nedostajući adapteri i transportne greške moraju ostati vidljivi. Ne zaobilaziti zaštite niti pretpostavljati dopuštenje ili partnerstvo.

GitHub uvoznici koriste kratkotrajni OIDC identitet vezan uz nepromjenjive ID-eve repozitorija/vlasnika, main, točan workflow i javnu vidljivost postojećeg repozitorija. Prebacivanje vidljivosti zahtijeva usklađenu provjeru; ne oslabljivati ostale uvjete identiteta.

Spajanje GitHub PR-a samo po sebi ne objavljuje Sites sučelje ili Supabase funkcije. Te komponente treba zasebno objaviti iz provjerenog koda i potvrditi objavljenu verziju.

## Provjere

Instalacija Python ovisnosti: `python -m pip install -r requirements.txt`.

- `python -m unittest discover -p 'test_*.py'` — parseri, SQLite, obrasci, ponovljivi upisi i poslovna pravila. PostgreSQL testovi bez `TEST_POSTGRES_URL` vidljivo se preskaču.
- `.github/workflows/tests.yml` — puni CI s izoliranim PostgreSQL 17 preko TLS-a, istim `postgres@3.4.7` klijentom kao funkcije, stvarnim API radnjama i DOM provjerama sučelja. Ne koristi produkcijske zapise.
- `node sites-review/scripts/test-catalog.mjs <test-deps>` — stvarni SQL za više od 10.000 nekretnina i kupaca, pretragu, nastavak i istekle oglase.
- `node sites-review/scripts/test-source-buyer-sync.mjs <test-deps>` — očuvanje ručnih kriterija, podrijetla i neobveznog budžeta pri osvježavanju izvora.
- `bash ops/run-dom-check.sh <test-deps>` — prikaz stvarnih redaka mogućih prilika, obrasci, greške i API putovi. CI priprema potrebne testne ovisnosti.

Dodatni SQL i operativni zapisi nalaze se u `ops/`. Povijesni brojevi i stare procjene u tim zapisima nisu trenutačno stanje baze. Aktualne brojke potvrditi čitanjem baze i stvarnim ishodom workflowa. GitHub snapshot ne predstavlja sigurnosnu kopiju cijele Supabase baze.
