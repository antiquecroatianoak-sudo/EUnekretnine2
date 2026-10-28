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

## Novi prioritet vlasnika — kvaliteta parova i funkcioniranje aplikacije
- 28.10.2026.: važnija je kvaliteta podudaranja, ne njihov broj. Uključiti učinkovitost, pouzdano učitavanje/spremanje i jasniji grafički prikaz.
- Ponovno proučene četiri dostupne javne stranice; ideje i redoslijed usklađeni s postojećim #47/#48/#50/#53 u [planu kvalitete](ops/matching-quality-roadmap-2026-10-28.md).
- Točne poveznice prve ranije skupine ostaju nepotvrđene; ne tvrditi potpun pregled obje skupine. Ova cjelina sprema analizu/prijedlog; nije novi deploy niti promjena evaluatora.
- Sljedeći korak: pregled #50 za pouzdano/brže spremanje; kriterije kvalitete i referentne primjere pripremiti prije promjene evaluatora iz #48. Tablica i izvori iz #54 već su objavljeni, ne ponavljati ih kao novi rezultat.

## Potvrđeni nastavak pregleda i objave — 28.10.2026.
- #50 pregledan, spojen mergeom `2e919ae306febf25e795b6446157a65677a0e3c3`. Objavljeni sites-platform v22 i discovery-sync v20. Readback obje funkcije potvrđuje nove refresh-suggestions/suggestions; ostali živi moduli i auth sačuvani. Nije bilo migracije.
- CI na #50 headu `5ea915e6da86b874a59f0fadd53d757fda59fcbd`: 40663479727 i 40663479751 success. Dodatna neovisna usporedba 588 sintetičkih ulaza (40 nenultih kandidata) potvrdila je jednake stare/nove rezultate i sigurnost predfiltra/parsiranih ulaza. Lokalni PostgreSQL nije dostupan; izolirani DB test je CI, ne lokalna tvrdnja.
- Read-only broj nakon objave: 180 spremljenih kandidata, 0 MATCH. Stvarno trajanje spremanja nakon objave nije izmjereno; ne tvrditi postotak ubrzanja.
- #53 pregledan i spojen mergeom `5659b025dec4bfa6f0a5441d32b96e54b8ad3668`. CI na headu `f1ca47f551dfa18fbe2e83d7ac99362b443e1f28`: 40665855842 (Ruff/browser), 40665855783 i 40665855797 success. To je CI promjena, bez nove Sites objave. Globalni Sites CSS i produkcijska prijava ostaju izvan tog testa.
- Komunikacija Claude: nalog na #47 komentar `6470902546`; stvarni primitak/pristup potvrdio komentarom `6470916686`. Radi zasebnu `feature/match-quality-regression` iz #48: dopuna referentnih testova i integracija objavljene tablice #54/maina. Ne smije dirati kanonski Sites izvor/zvuk ni #50; ChatGPT radi pregled/objavu.
- Pregled #47 je započet (workflow/offer/teaser, auth-rute, dokazne veze, serijalizacija, anonimni ispis); još nije označen dovršenim, spojen ili objavljen. #48 i nova Claudeova integracija i dalje trebaju neovisni pregled i aktualni CI.
- Sljedeći korak: dovršiti pregled #47 i #48 te uskladiti s novim mainom i Claudeovom integracijom; zatim migracije/Edge/Sites iz istog pregledanog stanja uz zadržanu poslovnu fazu OFF, travel OFF i external partner OFF. Ne predstavljati sve module kao objavljene na temelju #50.


## Neovisni pregled nastavka — 28.10.2026. 15:08 Europe/Zagreb
- Potvrđen PR55 `feature/match-quality-regression`, draft nad #48, head `fa8004fd440804ad8057b0cbf81012931bdf2e2d`; konkretno praćenje dodano postojećem zadatku. Predaja nije odobrenje niti objava.
- Na #48 headu `13a37f504d948107eb7bc5c81fdb80bafe412381` stvarno izvršeni `node test_facts.mjs` PASS, `python -m unittest test_facts` 5/5 PASS i `node sites-review/scripts/test-request-parser.mjs` PASS. Ciljani raniji nalazi datuma/raspona/parsera imaju prolazne regresije; pregled cijelog sustava nije dovršen.
- Novi P2 blokator prihvata partnera nakon promjene izvorne agencije poslan #48/6471206531. Dokaz i ograničenja: [ops/review-partner-acceptance-2026-10-28.md](ops/review-partner-acceptance-2026-10-28.md), commit49a6700c7fa592c80f0275cd64c261c522adf2b0. Probe stvarne funkcije s nadomjesnim tx slojem potvrđuje izostanak provjere agency veze pri prihvatu; lokalni PostgreSQL/konkurentni test nije izvršen. Claude treba dodati izoliranu API/DB regresiju, popravak ovlasti/stale i utrku promjene veze. Nije potvrđen primitak ovog novog nalaza.
- Sljedeće: pregledati Claudeov popravak i integraciju #50/#53 u ovisne grane, dovršiti #47/#48/#55 pregled i testove. Nema mergea/objave tih planova prije zatvaranja nalaza. Vanjski pristup, putovanje i poslovna faza ostaju OFF.

## Automatsko praćenje koristi i cjelovita revizija — 28.10.2026.
- Monitoring stvarne koristi je podešen u postojećem zadatku `6add082b3668819198304b5969498a19`, „Prati korist EU aplikacije”, dnevno09:00Europe/Zagreb od29.10.2026. Metodologija: [ops/post-release-benefit-monitoring.md](ops/post-release-benefit-monitoring.md), read-only [SQL](ops/benefit-monitor.sql). Zabilježen početni uzorak; nema dovoljno podataka za potvrdu učinka nove verzije.
- Vlasnik traži cjelovitu reviziju aktualnog koda i ispravke/uklanjanje dokazano nepotrebnog uz testove i objavu. Prioritet: točnost i kvaliteta parova, produktivan/pouzdan rad, aktualnost i automatizacija. To nije obećanje rada bez grešaka.
- Opseg proširen postojećem pozadinskom zadatku `6ae0c5e60da88191a00a805e16a27539`, bez novog paralelnog procesa. Mapa pregleda: uvoz→normalizacija/izvori→pohrana→zahtjevi→evaluator→dokazi/povijest→API/prijava→UI/greške→automatizacija/objava. Svako područje vezati uz commit/nalaz/test.
- Claudeu nalog #47/6471298345 za nastavak aktualne grane, q09 sale_scope i ciljane regresije. Ne miješati nepoznato s podudaranjem; sačuvati legacy/preferencije i informativni budžet.
- Potvrđeni #55 head53745aaa1f84199057c34c1e0ca30a315e125a5a (draft nad#48) i #56 head62aa6e984688852b56931c8b4cd1c5533adfef23 (testni CSS kvar, draft nadmain). Kanonski Sites CSS već ima horizontalni overflow za table-scroll. Stanja i CI ponovno provjeriti prije mutacija.
- Partner acceptance blokator naveden iznad ostaje prepreka objavi dok nije potvrđeno ispravljen. Ovaj nastavak nije objavio #47/#48/#55 niti novi evaluator.


## Pregled ispravaka i testnog CSS-a — 28.10.2026. 15:18 Europe/Zagreb
- #56 neovisno pregledan i spojen točnim headom `62aa6e984688852b56931c8b4cd1c5533adfef23`, merge `57dad46a0d6c2149bb1ea0718c7a80c9b4e97d80`. Samo testni server/README; asercije nisu oslabljene. CI40702964693/40702964807/40702964729 success. Kanonski Sites otvoren helperom read-only na objavljenom source `112809536f559ff844a8018262f1dc14cb8d6cc9`; potvrđeno `.table-scroll{overflow-x:auto}`. Nema produkcijske izmjene/objave zbog #56.
- Partner nalaz6471206531: ispravak `722c43b5780f0cd4ab3af0b30e5a48808fd15556` pregledan. Ponovna autorizacija, FOR SHARE veze i stale_reason u listi; stvarna funkcija uz nadomjesni tx sada za istu agenciju prihvaća, za drugu/uklonjenu daje stale, bez upisa/refresha. Izolirane DB regresije pročitane (premještaj/uklanjanje/konkurentna promjena/kontrola); CI40704221117/40704221218/40704221162 success. Lokalni PostgreSQL nije pokrenut; zaključavanje nije lokalno eksperimentalno potvrđeno. Ciljani nalaz zadovoljen tim dokazima, ne znači odobrenje cijelog paketa.
- Novi P2 anonimne prezentacije6471377815 reproduciran: budući observed_on ulazio je među potvrđene činjenice. Nalaz spremljen u ops/review-presentation-facts-2026-10-28.md (4733af0020049121d7314f988926b31f04ae4308). Claude ispravio u `d47ba09b2914c51ccf1eb9c5747a017e36798a24`, isti factCurrent za osnovu površine/izvoz. Stvarno izvršeni node test_facts.mjs i python -m unittest test_facts: PASS, 5 Python testova; uključeni presentation→HTML past/today/future/expiry i jednakost kopija. CI40704533601/40704533628 još u tijeku,40704533620 success pri provjeri. Cijeli CI na tom headu nije još potvrđen.
- Dodatno lokalno na #48/13a37f5: test-teaser, test-pair-review, test-platform-http, test-platform-view i test-platform-route PASS. Route traži esbuild korijen kao argument; nakon davanja instalirane ovisnosti prolazi. Nema lokalnog browser/DB dokaza iz tih testova.
- #47/#48/#55 nisu spojeni/objavljeni. Nastaviti neovisni pregled ostatka integracije i q09, potvrditi svježi puni head/CI prije mergea. Poslovna faza, routing i vanjski pristup OFF.
