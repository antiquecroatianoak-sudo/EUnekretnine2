# Nastavak nakon PR5 — 24.10.2026.

Vlasnik je obnovio rad i zatražio redovito spremanje. Nastavni PR6: codex/eu-buyer-criteria. Početni checkpoint je na GitHubu; novi kod još nije primijenjen u produkciji.

Pripremljena migracija: supabase/migrations/20261024113202_buyer_source_criteria.sql. Prenosi dodatne kriterije iz buyerDraft, čuva ručne null/false/[] i brisanje ključa, globalno sjedište razlikuje od EU interesa, ne produžuje ljudsku provjeru novim dohvatom i štiti zatvorene pozive. Testovi na izoliranoj izvezenoj shemi PostgreSQL/PGlite prolaze. Neovisni pregled našao je još dva rubna slučaja (izostala država interesa i izostali budžet između dvaju poznatih iznosa); ispravci i nove regresije su u tijeku. Migracija nije odobrena za primjenu samim lokalnim prolazom testova.

Aktualni source_leads.json u mainu ima osam kandidatskih domena za nekretnine. Tri Grekodom jezične domene nisu novi neovisni izvori; matični Grekodom već je u bazi kao sources.id77. Ostali kandidati: NESTOR, ADAMANT, Immolution, Raiffeisen Immobilien i Zweitwohnsitze. Primarne javne stranice potvrđuju prodajne oglase. Robots.txt svih pet pri ovoj provjeri odgovorio je HTTP200 i dopuštao korijen za EUPropertyResearch/1.0; to ne potvrđuje dopuštenje baš svih detaljnih ruta niti uvjete ponovne uporabe. Nisu automatski dodani u aktivno pronalaženje.

Preostaje dovršiti ispravke i neovisni pregled migracije, spremiti izvještaj o izvorima te provjeriti dostupnost vlasnikove prijavljene UI sesije. Pristup bazi nije potvrda pristupa prijavljenom računu. Nema kontakata, slanja ponuda ni izmjena drugih aplikacija. Budžet ne utječe na uspješnost podudaranja; nepotpuni parovi služe ručnoj dopuni.
