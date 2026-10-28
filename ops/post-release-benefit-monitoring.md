# Praćenje stvarne koristi nakon objave
Vlasnikov nalog: 28.10.2026. Automatski pratiti stvarnu korist; kvalitetniji parovi su važniji od većeg broja. Proširuje postojeći read-only zadatak „Napredak EU platforme”, ne otvara drugi uvoz niti drugi proces objave.

## Postupak svakog prolaza
1. Potvrdi stvarne Sites i Edge verzije, commitove i vremena objave. Usporedi s prošlim zapisom istog zadatka i PROJECT_STATE.md.
2. Izvrši [benefit-monitor.sql](benefit-monitor.sql) read-only. Provjeri greške i trajanje kroz postojeće server logove, agregirano po funkciji/verziji i jednakim vremenskim prozorima do 24h.
3. Supabase query_logs: izvor function_edge_logs ima atribute function_id, version, response.status_code i execution_time_ms. Računaj n, 5xx, 4xx odvojeno te p50/p95. Autorizacijske greške i ručne dijagnostičke pozive ne prikazuj kao neuspjelo korisničko spremanje. Zbirka svih radnji nije specifično mjerenje spremanja.
4. Sites worker logovi: razlikuj /api/platform od prijave, statike i browser probe. Ne zapisuj IP, headere, kolačiće, tokene, osobne podatke, query stringove ni sirove logove u GitHub/izvještaj.
5. Usporedi verzije samo kad su uzorak i vrsta opterećenja usporedivi. Ispod 20 zahtjeva po uspoređivanoj verziji ili bez novog prometa navedi „premalo podataka”. Ni uz dovoljan uzorak vremenska povezanost nije dokaz da je promjena uzrokovala korist.
6. Kvaliteta: referentni testni skup odvoji od produkcijskih ljudskih ocjena. Broj parova, prosječan score, dovršena pojedinačna provjera, interes kupca i prodaja nisu ista metrika. Bez eksplicitno označenih stvarnih parova nema procjene preciznosti niti stope pogrešnih pozitivnih rezultata.
7. Ne izvodi testne upise niti pokreći refresh/uvoz radi monitoringa. Pad broja parova ili rast nedostataka prvo istraži u izvorima/podacima i novoj verziji, bez automatskog slabljenja pravila.
8. Izvijesti: potvrđena korist / moguća korist / regresija / nedovoljno podataka, s dokazom i otvorenim ograničenjima. Obavijesti o potvrđenoj važnoj promjeni ili prepreci; kod rutinskog prolaza bez novih dokaza ne šalji ponovljene općenite poruke.

## Početni agregirani zapis
Vrijeme SQL mjerenja: 2026-10-28 14:08:22 UTC.
- 180 spremljenih kandidata; 0 MATCH; 9.00 prosječno otvorenih stavki; 1620 otvorenih zadataka; 0 događaja parova u prethodna24h.
- Zadnji izračun evidentiran 2026-10-28 13:03:29 UTC. To je prije objave sites-platform22: ovaj zapis ne dokazuje ponašanje novog refresha.
- Logs prethodna24h za sites-platform: v20 n=2, v21 n=8; v22 nije imao uzorak. Premalo podataka za usporedbu brzine ili pouzdanosti; ne zaključivati poboljšanje.
- U posljednja3h Sites vratio4 događaja označena greškom; sva4 su404 na /signin-with-chatgpt tijekom browser provjera. Nisu dokaz četiri neuspjela spremanja niti dokaz da prijava na korisnikovu uređaju ne radi. Sažetak za daljnju provjeru, bez sirovih zahtjeva.
- UI brzina na mobitelu, zasebno vrijeme spremanja i produkcijska preciznost još nisu izmjereni. Praćenje servera ne zamjenjuje te podatke.

## Privatnost i granice
Koristi postojeće autorizirane GitHub/Sites/Supabase alate i agregate, bez nove analitičke usluge, kolačića ili praćenja ponašanja korisnika. Nema automatskog rollbacka, objave, izmjene pravila, upisa u bazu ili kontakata iz ovog nadzornog zadatka. Otkriveni kvar predaj postojećem odvojenom zadatku razvoja/pregleda. Čuvaj povijest i svaki prolaz veži uz verziju i prozor mjerenja.
