# EU Investicijske prilike — glavni zapis stanja

Provjereno: 28. 10. 2026. 14:49:18 (Europe/Zagreb).

## Identitet i granice
- Projekt: EU27 nekretnine i dokumentirana potražnja kupaca.
- GitHub: `antiquecroatianoak-sudo/EUnekretnine2`; ciljna grana `main`.
- Objavljena aplikacija: https://eu-investicijske-prilike-luka.lushlily1.chatgpt.site
- Sites projekt: `appgprj_6ad3d11946fc8191bd34af0ad4f2cdd8`. Kanonski Sites izvor je zaseban repozitorij; GitHub kopija sučelja je `sites-review/`.
- Košarica i građevinski materijal imaju zasebne repozitorije i objave. Njihove podatke i zadatke ne unositi ovdje.
- Poslovna pravila i njihove novije dopune: [AGENTS.md](AGENTS.md). Arhitektura i provjere: [README.md](README.md).

## Dogovoreno
- Najviši prioritet je ispravno pronalaženje parova i očuvanje podataka. Grafičke promjene ne smiju mijenjati evaluator.
- Svi EU27, sve vrste i rasponi cijena; budžet kupca je informativan. Sjedište kupca nije lokacija potražnje.
- Nepoznata dostupnost ostaje označena i sama ne isključuje oglas. Potvrđeno neaktivni i istekli oglasi ne ulaze u operativne parove.
- Dokazani kontakt za oba konkretna zapisa, uključujući izvornu agenciju; kontakt nije dokaz interesa ni pravne urednosti.
- Posredovanje vodi licencirana agencija. Naknada od agencije tek nakon uspješno dovršene prodaje; poslovna faza nije uključena ovim radom.
- Vlasnik je u ovom razgovoru odobrio doradu tablice/izvora, prijenos sedam datoteka te dovršetak objave bez ponovljenih potvrda za iste korake. To nije opća dozvola za slanje poruka, troškove ili javno dijeljenje.

## Potvrđeno implementirano, testirano, spojeno i objavljeno
| Promjena | Implementacija / spajanje | Provjera | Objava |
|---|---|---|---|
| Tablica Kriterij / Zahtjev kupca / Podatak nekretnine / Rezultat; tekst i simboli za odgovara, odstupa i nedostaje; izvor, agencija, kontaktni kanal, dostupnost i osnova cijene | [PR #54](https://github.com/antiquecroatianoak-sudo/EUnekretnine2/pull/54), head `68a8ca6ada152adbbae2c45c8ba61e40754a3e99`, merge `f92bbdfdfd710e442df5bb7d99e3fb242ef4823a` | Actions `40696783272` (aplikacija/PostgreSQL) i `40696783266` (sigurnost/pristupačnost): success na tom headu; lokalni build, DOM/API, prikaz parova, HTTP, izvori i teaser prolaze | Sites v24, source `a8530befe46d16151b971153178b24cc250b7069`, deployment `appgdep_6ae1f8a0e5a48191ab0be1e41fa61914`: succeeded |
| Prekid zastarjelih čitanja i ograničeno čekanje | PR #51 spojen | Ranije provjereno; ponovno provjeriti pri promjeni HTTP puta | Uključen u objavljeni izvor v24 |
| Gitleaks i axe-core | PR #52 spojen | Obje provjere uspješne na PR #54 | GitHub CI, nisu funkcije produkcijske aplikacije |

## Ograničenja provjera
- Vizualni pregled nove tablice u prijavljenom produkcijskom prikazu nije potvrđen: cloud preglednik prikazuje prijavnu stranicu; lokalni preview bio je nedostupan. Objavu potvrđuje Sites servis, ne vizualni test.
- Axe provjerava strukturu dashboarda i obrasca u jsdom-u. Kontrast, izgled, dodirne mete i čitač ekrana nisu time potvrđeni; incomplete stavke ostaju otvorene.
- Ovaj nastavak nije ponovno provjerio broj nekretnina, kupaca, parova niti svih uvoza. Ne prepisivati stare brojke kao aktualne.

## Otvoreno — nije spojeno niti objavljeno ovim radom
| Rad | Stanje provjereno na GitHubu | Sljedeći uvjet |
|---|---|---|
| [PR #50](https://github.com/antiquecroatianoak-sudo/EUnekretnine2/pull/50), ubrzanje spremanja/refresh | Otvoren draft; head `5ea915e6da86b874a59f0fadd53d757fda59fcbd` | Neovisno pregledati jednakost rezultata, dokaza, zadataka i povijesti; provjeriti aktualni CI prije spajanja i odvojene objave backenda |
| [PR #47](https://github.com/antiquecroatianoak-sudo/EUnekretnine2/pull/47), tijek zahtjeva/ponuda | Otvoren draft, head `09226a2c5e3f1e97d56e1e1d2603680da631a89b` | Pregled implementacije, SQL-a i objave; nije dovršen poslovni tijek u produkciji |
| [PR #48](https://github.com/antiquecroatianoak-sudo/EUnekretnine2/pull/48), moduli nastavka | Otvoren draft, head `13a37f504d948107eb7bc5c81fdb80bafe412381`; baza je #47 | Autorski navodi testiranje modula 1–7; neovisni pregled i završna regresija ostaju. Vrijeme putovanja i vanjski pristup agencijama isključeni |
| [PR #53](https://github.com/antiquecroatianoak-sudo/EUnekretnine2/pull/53), Ruff/Playwright | Otvoren draft, head `f1ca47f551dfa18fbe2e83d7ac99362b443e1f28` | Pregled i provjera aktualnog CI-ja; ne opisivati Playwright kao već uključen u main |
| PR #26, strogi uvjet dostupnosti | Stari otvoreni draft | Zastarjeli smjer u odnosu na noviju uputu vlasnika o nepoznatoj dostupnosti; ne spajati bez usklađenja |

## Sljedeći konkretan korak
Pregledati aktualni PR #50: usporediti referentni refresh i novi put, uključujući promjenu izvora bez promjene rezultata, ručne odgovore, dokaze, arhivirane/otvorene zadatke i povijest. Dovršeno tek nakon pregleda, uspješnih relevantnih provjera na točnom headu, spajanja i potvrđene zasebne objave; inače zabilježiti konkretan blokator. Zatim redom #53 i ovisni #47/#48.

## Provjera posljedica prije svake izmjene
| Dio tijeka | Što sačuvati / potvrditi |
|---|---|
| Uvoz | Identitet, država, kontakt, dostupnost, nastavak paketa, ručne dopune i podrijetlo |
| Baza i spremanje | Transakcije, evidencija, zaštita ponavljanja i potpuni rollback neuspjele radnje |
| Parovi | Jednakost kriterija/ocjena, informativni budžet, dokazi, zadaci i povijest |
| Sučelje | Stvarni podaci, nedostajuće odvojeno od odstupanja, greška odvojeno od nule, mobilna čitljivost |
| Objava | Točan commit i zasebne komponente Sites/Supabase; privatni pristup; potvrda servisa |

## Zapis nastavka
- 28.10.2026.: vlasnik zatražio trajne zasebne zapise, provjeru stvarnog stanja pri nastavku i procjenu posljedica promjene. Ovaj zapis uspostavljen; javne činjenice i tehničke reference, bez poslovnih podataka ili tajni.
- Pri sljedećoj cjelini dodati: odluka → promjena → dokaz provjere → objavljena verzija ili izričito nije objavljeno → sljedeći korak.

## Najnovija objava — tihi zvuk ikone, 28.10.2026.
- Vlasnik odobrio jednostavan tiši klik umjesto osobne snimke koja nije dostavljena kao audio datoteka.
- Objavljeno Sites v25, source `112809536f559ff844a8018262f1dc14cb8d6cc9`, deployment `appgdep_6ae1fd4d4f0481918aea3785e0e68c15`: succeeded.
- `components/icon-sound.tsx` sada koristi `/audio/quiet-click.wav` i glasnoću playera 0.3; generirani mono PCM klik traje 45 ms. Prethodno je koristio glass-shatter i 0.5.
- Provjere: WAV 44.1 kHz / 16-bit, ograničen vrh amplitude i nulti početak/završetak; diff i Vinext build uspješni. Stvarna čujnost na korisnikovu mobitelu nije provjerena.
- Logika hvatanja stvarnog klika na kontrole sa SVG ikonom, ignoriranje disabled kontrola, zajednički player i cleanup ostali su nepromijenjeni. Evaluator, baza i API nisu dirani.
- Ako se zvuk dalje podešava, mijenjati samo audio/glasnoću u kanonskom Sites izvoru; ne mijenjati pravila parova. Ranije opisan sljedeći glavni razvojni korak (#50) ostaje otvoren.
