# Nastavak nakon PR5 — 24.10.2026.

Vlasnik je obnovio rad i zatražio redovito spremanje. Nastavni PR6: codex/eu-buyer-criteria. Početni checkpoint je na GitHubu; novi kod još nije primijenjen u produkciji.

Pripremljena migracija: supabase/migrations/20261024113202_buyer_source_criteria.sql. Prenosi dodatne kriterije iz buyerDraft, čuva ručne null/false/[] i brisanje ključa, globalno sjedište razlikuje od EU interesa, ne produžuje ljudsku provjeru novim dohvatom i štiti zatvorene pozive. Testovi na izoliranoj izvezenoj shemi PostgreSQL/PGlite prolaze. Neovisni pregled našao je još dva rubna slučaja (izostala država interesa i izostali budžet između dvaju poznatih iznosa); ispravci i nove regresije su u tijeku. Migracija nije odobrena za primjenu samim lokalnim prolazom testova.

Aktualni source_leads.json u mainu ima osam kandidatskih domena za nekretnine. Tri Grekodom jezične domene nisu novi neovisni izvori; matični Grekodom već je u bazi kao sources.id77. Ostali kandidati: NESTOR, ADAMANT, Immolution, Raiffeisen Immobilien i Zweitwohnsitze. Primarne javne stranice potvrđuju prodajne oglase. Robots.txt svih pet pri ovoj provjeri odgovorio je HTTP200 i dopuštao korijen za EUPropertyResearch/1.0; to ne potvrđuje dopuštenje baš svih detaljnih ruta niti uvjete ponovne uporabe. Nisu automatski dodani u aktivno pronalaženje.

Preostaje dovršiti ispravke i neovisni pregled migracije, spremiti izvještaj o izvorima te provjeriti dostupnost vlasnikove prijavljene UI sesije. Pristup bazi nije potvrda pristupa prijavljenom računu. Nema kontakata, slanja ponuda ni izmjena drugih aplikacija. Budžet ne utječe na uspješnost podudaranja; nepotpuni parovi služe ručnoj dopuni.

## PAUZA na izričit zahtjev vlasnika

Rad je zaustavljen; nastaviti tek kad vlasnik zatraži. PR5 ostaje ranije objavljen; PR6 je nacrt i njegova migracija nije primijenjena.

Zadnji potvrđeni GitHub checkpoint prije ove bilješke: b7f96f2acdcc7c0814504ef52ea38e51a1a34165. Uz ovu bilješku spremamo i trenutačni nedovršeni kod, ne kao gotov paket.

VAŽNO: raniji prolaz osnovnih testova nije konačni prolaz. Najnovije prošireno pokretanje `node sites-review/scripts/test-source-buyer-sync.mjs /workspace/scratch/2cca7d24bbc8/qa` završilo je ERR_ASSERTION: `900 !== 1200`. Točan uzrok tek treba utvrditi; ne primjenjivati migraciju dok se ne ispravi i svi relevantni testovi prođu. Lokalno dodane zaštite za izostalu državu interesa, izostali budžet, nevaljane tipove kriterija, ljudsku provjeru i ACL zahtijevaju završni neovisni pregled.

Sljedeće: locirati neuspjelu tvrdnju i ispraviti očuvanje kriterija; ponoviti regresije; završiti neovisni pregled i GitHub CI. Procjena pri pauzi: još 20–30 minuta aktivnog rada za ovu cjelinu, okvirno, nije rok. Nakon toga preostaju dovršeni izvještaj/provjera novih izvora i provjera vlasnikova prijavljenog računa. Probni pregled objavljene aplikacije u odvojenom pregledniku završio je na zaslonu za prijavu; prijavljeni prikaz još nije potvrđen. Ne znači da je vlasnik odjavljen na telefonu.

Poslovna pravila: budžet nije obvezan i ne utječe na uspješnost/podudarnost; nepotpuni potencijalni parovi ostaju za ručnu provjeru i dopunu. Ne aktivirati izvore niti tvrditi da je produkcija ažurirana ovim nacrtom.

## Nastavak — završne lokalne provjere

Vlasnik je ponovno zatražio nastavak. Neuspjeh `900 !== 1200` bio je nedosljedan valjani test: minimum 1200 uz maksimum 1100. Ispravljen valjani primjer na 1200–1500; dodane zasebne regresije za obrnuti raspon (stare valjane vrijednosti ostaju), jednake granice i samo jednu poznatu granicu. Cijeli test-source-buyer-sync.mjs sada prolazi u izoliranoj PGlite bazi. Prošli i test_verification, test_public_land, test_domain_input, test-platform-view, test-pair-review, test-teaser. Projektni AGENTS.md trajno bilježi obvezne provjere budućeg kodiranja.

GitHub CI za 112bb683833351fe0bc1212878383338c6394649 pri zadnjoj provjeri još in_progress (run 40101457795); nije potvrđen konačan prolaz. Prošireni lokalni testovi nisu dokaz primjene u produkciji. Migracija nije primijenjena, PR6 nije spojen. Preostaju završni pregled kombiniranja novih i zadržanih granica kriterija, provjera GitHub CI, izvještaj izvora i prijavljeni UI.

## Zaštita konačnog raspona nakon spajanja podataka

Dodana je provjera efektivnog raspona nakon kombiniranja novih izvornih i zadržanih/ručnih granica. Ako novi minimum prijeđe zadržani ili ručni maksimum, vraćaju se prethodne obje granice, a odbijene vrijednosti ne ulaze u provenijenciju. Testovi pokrivaju nepotpun izvorni raspon, ručni maksimum i sljedeću valjanu izmjenu nakon odbijene; svi lokalni SQL testovi prolaze. GitHub run 40101585988 za prethodni checkpoint još je bio in_progress; novo stanje mora ponovno proći CI. Produkcijska migracija nije primijenjena.
