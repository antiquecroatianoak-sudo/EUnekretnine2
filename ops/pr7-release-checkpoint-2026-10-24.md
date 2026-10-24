# PR7 — provjereno stanje prije objave, 24.10.2026.

PR6 i produkcijsku migraciju ne ponavljati.

- Popravci glavne cijene, zemlje nekretnine i kanonskog identiteta spremljeni su u grani codex/new-agency-import. Sjedište kupca nije geografski kriterij: test uparivanja potvrđuje da se koristi preferred_countries, a ne country kupca; nepoznata zemlja potražnje ostaje dopuna.
- Lokalno prošlo 75 testova: python -m unittest test_primary_agency_listing test_agency_listings test_registry_discovery test_population_refresh test_matching.
- Stvarna read-only proba 40107212842: svih pet glavnih oglasa parsirano s AT i očekivanim cijenama EUR: NESTOR 8500000, ADAMANT 125000, Immolution 549000, Raiffeisen 175000, Zweitwohnsitze 397000 (neto, dodatni porez i troškovi zahtijevaju provjeru). Otkrivanje kataloga vraća konkretne oglase i red za nastavak; nije dokaz cjelovitosti portala.
- Raiffeisen podrška je izričito ograničena na provjereni par 7000 Eisenstadt. Konfiguracija dodatno ograničava putanju; druge lokacije ne aktivirati bez dokaza zemlje i parsera.
- Nepodržani detalji i najam ostaju za provjeru i ne prekidaju druge valjane prodajne oglase. Prodaja iznajmljene nekretnine nije automatski odbačena.
- PR još nije spojen; pet izvora još nije registrirano/aktivirano u produkciji u trenutku ovog zapisa. Preostaje konačni CI, spajanje, primjena ops/activate-reviewed-agencies.sql i provjera stvarno spremljenih redova i duplikata.
- Automatski pregled odbio je prijedlog dodatnog raspoređenog smoke testa jer ga je procijenio kao proširenje trajnih ovlasti. .github/workflows/discovery.yml NIJE promijenjen. Aktivacija koristi postojeći autorizirani postupak uvoza; nema novog rasporeda ni proširenja ovlasti.
- Prioritet prikupljanja kupaca s kriterijima i nastavak obiju baza zapisani su u AGENTS.md. Ovaj PR ne tvrdi da su novi investitori ili nove potražnje već prikupljeni.
- Vlasnik je ponovno izričito odobrio samostalan nastavak do objave i periodično spremanje napretka; neće odgovarati uz otvoren razgovor. Ne tražiti novu prijavu.
