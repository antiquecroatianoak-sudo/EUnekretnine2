# Dopuna plana #46 — šest nastavnih modula (vlasnik, 27.10.2026.)

**Izvor:** PR #47, komentar 6446741323. Mjerodavan je izvorni tekst u komentaru; ovo je radni sažetak sa statusom.

**Odnos prema osnovi:** osnovni tijek plana #46 je kod predan na pregled u PR-u #47. Nalazi pregleda 6446780533 ispravljeni su u `730acb7` i čekaju ponovni pregled. Ništa nije objavljeno. Moduli ispod su zaseban nastavak, ne već dovršene funkcije.
- Svaki modul ide kao mali draft PR nad stabilnom osnovom.
- Nema dupliciranja ni paralelnog uređivanja istih dijelova.

**Polazište zapisano u nalogu:** `main` `18a43f0`. Audit je rađen na `c5656e3`, a provjereni head osnove je `c9e2ff5`. Već objavljeni uvoz (registry-discovery, PR45) se ne ponavlja.

## Opseg i granice
Opseg vrijede za sve module:
- **Bez proširenja:** nema promjene publike, novih računa, plaćenih servisa ni kontaktiranja ljudi.
- **Poslovna faza** ostaje isključena.
- **Postojeća pravila** ostaju: EU27; sjedište nije potražnja; budžet je informativan; nepoznata dostupnost je označena; zatvoreni oglasi su isključeni; postoje oba kontaktna kanala; zahtjevi istog kupca su neovisni; paginacija nema ukupni limit.
- **Promjene baze:** migracije su samo aditivne i ponovljive, s očuvanjem ručnih polja. Za svaku postoje povrat i mogućnost isključenja modula.
- **Nepoznato** nije `false`, nula ni ispunjen uvjet. Nepodržan dokumentirani uvjet ostaje vidljiva stavka ručne provjere.
- **Valjanost provjera:** promjena bitne nove činjenice, zahtjeva ili dokaza poništava pair-specific provjere i odobrenja (`pairText`/digest). Promjena metapodatka dohvata ih ne poništava.

## Moduli

| # | Modul | Ovisi o | Planirano | Implementirano | Izolirano testirano | Neovisno pregledano | Objavljeno | Provjereno nakon objave |
|---|---|---|---|---|---|---|---|---|
| 1 | Zajednički podatkovni ugovor i kompatibilnost | osnova (#47) | da | da (`ops/facts-v1.md`) | da (lokalno; CI na PR-u #48) | ne | ne | ne |
| 2 | Prioriteti dopune podataka (radni red nedostataka) | 1 | da | da (`ops/completion-queue.md`) | da (lokalno; CI na PR-u #48) | ne | ne | ne |
| 3 | Zahtjev običnim tekstom — nacrt uz ljudsku potvrdu | 1 | da | da (`ops/request-parser.md`) | da (lokalno; CI na PR-u #48) | ne | ne | ne |
| 4 | Površine i sastav prodaje | 1 | da | ne | ne | ne | ne | ne |
| 5 | Sektorski kriteriji (hotel, skladište, farma) | 1, 4 | da | ne | ne | ne | ne | ne |
| 6 | Vrijeme putovanja — izoliran, zadano isključen | 1 | da | ne | ne | ne | ne | ne |
| 7 | Dopune partnerskih agencija — staging prijedloga | 1 | da | ne | ne | ne | ne | ne |
| 8 | Završna regresija i predaja | sve | da | ne | ne | ne | ne | ne |

Numeracija prati nalog: točke 2–7 su šest dodataka, a 1 i 8 su preduvjet i završna provjera.

### 1. Podatkovni ugovor
- **Shema:** verzionirana shema specijaliziranih činjenica i kriterija. Za svako polje: naziv, tip, jedinica, značenje, izvor i dokaz, datum opažanja i važenja, status potvrde i podrijetlo (izvor, ručno, partner, predloženo).
- **Razdvajanje:** zahtjev je odvojen od činjenice nekretnine, a želja od obveznog uvjeta.
- **Vrste:** pet osnovnih vrsta ostaje, uz opcionalne podvrste i namjene. Stara baza se ne preklasificira automatski. Mješovita imovina se ne zaključuje iz naziva.
- **Usklađenost:** polja prolaze kroz UI, API validaciju, spremanje, `source_candidates`, JS/Python evaluatore, SQL guardove te pregled i izvoz. Sve kopije `domain.mjs` ostaju usklađene. Stari payloadi ostaju čitljivi.
- **Rizici utvrđeni auditom:**
  - `property_types:['Hotel']` validacija odbija.
  - Proizvoljni `min_rooms` u `criteria_json` ne utječe na `evaluate`.
  - `owned_area` ne ulazi u `pairText`.

### 2. Prioriteti dopune
- **Izračun:** radni red nad stvarnim `missing`/`gaps`. Za svaki nedostatak: koliko perspektivnih parova blokira, uz odvojene brojeve parova, zahtjeva i jedinstvenih kupaca.
- **Prikaz:** zašto je stavka visoko, koji su zapisi zahvaćeni i je li dokaz zastario.
- **Rangiranje** ne skriva kandidate, ne potvrđuje priliku i ne koristi budžet.
- **Grupiranje** ide po dokazanoj izvornoj agenciji, uz odvojena dopuštenja klijenata.
- **Nacrt pitanja** je samo interni; ništa se ne šalje.
- **Izvedba:** batchevi i nastavak, bez kartezijskog umnoška i bez ukupnog limita.

### 3. Zahtjev običnim tekstom
- **Rezultat** je samo prijedlog zasebnog zahtjeva: navodi po polju, pouzdanost i nejasnoće, uz usporedbu i potvrdu operatora prije spremanja.
- **Bez automatskih oznaka:** ništa se ne označava kao verified, kontakt, mandat ili interes.
- **Što parser mora razlikovati:**
  - više mandata od alternativa;
  - lokaciju kupnje od sjedišta;
  - m² od ha;
  - ukupni iznos od EUR/m²;
  - negacije.
- **Tehnika:** bez novih računa i troškova. Ako LLM nije dopušten, koristi se pošten ograničen parser s oznakom nepodržanog.
- **Sigurnost:** tekst je nepouzdan podatak, nikad uputa.

### 4. Površine i sastav prodaje
- **Odvojene mjere:**
  - ukupno oglašeno zemljište;
  - zemljište u vlasništvu;
  - zakupljeno zemljište;
  - površina zgrada;
  - korisna površina.
- **Sastav prodaje:** popis uključene i isključene imovine, uz dokaze.
- **Regresija:** 150 ha = 110 ha u vlasništvu + 40 ha u zakupu. Kupac koji traži 150 ha vlasništva ne dobiva potvrdu.
- **Osnova površine:** zahtjev navodi osnovu tražene površine. Postojeći `area` ostaje s legacy/nepoznatom osnovom.
- **Tolerancija** −15 %/+25 % primjenjuje se samo na usporedivu mjeru.

### 5. Sektorski kriteriji
- **Primjena:** hotel, skladište/logistika i farma. Primjenjuju se samo kriteriji iz dokumentiranog zahtjeva.
- **Dosljednost:** zajednički registar definicija i identični testni vektori za JS, Python i SQL.
- **Tablica para:** traženo, stvarno, dokaz i status, a score odvojeno od pouzdanosti.
- **Ponuda** se proširuje samo allowlist sažecima.

### 6. Vrijeme putovanja
- **Početak:** ugovor i deterministički testni adapter. Produkcijski servis koristi se samo uz postojeći dopušten pristup bez troškova; inače je modul isključen, uz konkretan razlog.
- **Bez lažnog rezultata:** nepoznata ili neprecizna lokacija vodi na „nije izračunato”. Zračna udaljenost nije vrijeme vožnje.
- **Izvedba:** asinkroni red i cache (TTL, deduplikacija, backoff), izvan uvoza i uparivanja.
- **Privatnost:** koordinate, POI i ruta nikad ne idu u anonimnu ponudu.

### 7. Dopune partnerskih agencija
- **Prvi korak:** interni pregled prijedloga i testovi autorizacije. Privatni Sites i gateway ostaju privatni.
- **Odluka vlasnika:** vanjski obrazac zahtijeva njegovu izričitu odluku (nova publika). Do tada je implementacija isključena.
- **Tijek prijedloga:**
  - spremanje u staging/proposals uz verziju, autora, dokaz i status;
  - operator prihvaća transakcijski, uz provjeru aktualne verzije;
  - append-only audit;
  - ponovni izračun samo pogođenih parova.
- **Zaštite:** najmanje ovlasti, bez IDOR-a i cross-agency čitanja, bez ključeva na klijentu i bez javnih uploadova.

### 8. Završna regresija
- **Testovi:** izolirana baza i API, legacy fixtures, idempotencija i konkurentnost, anonimizacija i metadata te mobilni UI na 360/390 px.
- **Predaja:** svaki modul kao mali draft PR s punim SHA i povratnim koracima.
- **Objava:** radi je ChatGPT, nakon neovisnog pregleda.

## Redoslijed rada
1. PR #47 (osnova) dovršava se kroz neovisni pregled. Nalazi pregleda imaju prednost pred nastavkom.
2. Nastavna grana `feature/buyer-workflow-enhancements` izlazi iz `feature/buyer-offer-workflow`. Prvi PR: modul 1, zatim modul 2.
3. Moduli 3 i 4 slijede zasebno, zatim modul 5. Moduli 6 i 7 pripremaju se isključeni dok postoje otvorene odluke.

## Otvorene odluke za vlasnika
- **Modul 3:** je li dopuštena upotreba LLM-a za ekstrakciju. Bez toga ide ograničeni parser.
- **Modul 6:** postoji li dopušten servis za rute bez troškova.
- **Modul 7:** odobrenje vanjskog obrasca za agencije (nova publika).

## Upute nakon slanja plana
- **6446803748.** Modul 3 smije se raditi ograničenim lokalnim parserom uz ručnu potvrdu, bez LLM servisa. Moduli 6 i 7 dobivaju ugovor, testni adapter i interni staging; vanjski pristup i routing ostaju isključeni. Potrebe za pristupom navode se tek nakon pripreme.
- **6446917782 — PAUZA.** Vlasnik je zaustavio daljnju implementaciju. Nastavak samo po njegovoj novoj uputi.
