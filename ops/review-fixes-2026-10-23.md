# Ispravci PR-a #2 — lokalno pripremljeno 23.10.2026.

Polazište: `22cf738f3c84db66f7db56b9ee200d813c2abe26`, grana `claude/eu-public-land-27`, repozitorij `antiquecroatianoak-sudo/EUnekretnine2`.

## Ispravljeno i lokalno provjereno

- Provjerenost odgovora i ispunjenje uvjeta odvojeni su. `outcome` ima tri vrijednosti: `zadovoljava`, `ne zadovoljava`, `nepoznato`. Provjeren negativan odgovor odbacuje par; stari odgovori bez ishoda ostaju nepoznati, bez pretpostavljanja pozitivnog ishoda. Datum samog odgovora ograničava aktualnost dokaza.
- Ručno osvježavanje, uređivanje zapisa, spremanje odgovora i discovery koriste istu implementaciju `refreshSuggestions`, s istim lokacijskim, izvornim i lifecycle provjerama. Zasebno isporučene kopije testiraju se na jednakost.
- Aktualni rezultati čiste se prema ID-ovima stvarno prihvaćenih upisa, umjesto datuma. Čuvar koji odbije novi upis ne može ostaviti prethodni MATCH, čak ni ako se dva izračuna dogode u istoj milisekundi.
- API ponovno računa parove prije spremanja interesa. Povijest, odgovori i arhivirani zadaci ostaju; ispravak negativnog odgovora novi je zapis.
- Sučelje zasebno šalje ishod i provjerenost. Kad par više nije u aktualnom izračunu, detalj ne prikazuje staru stvarnu priliku kao važeću.
- Rang povoljnosti prikazuje se samo za MATCH ponude istom kupcu, iste države, grada, vrste, stanja i razreda površine (faktor 1,5), s izričitom osnovom tražene cijene. Mjera je EUR/m²; troškovi ostaju zasebni. Nepoznata osnova i početne dražbene ponude ne ulaze u tu usporedbu. Rang nije tvrdnja o cijelom tržištu niti zamjena za kriterije ili procjenu troškova.
- Izvoz sheme dopunjen je stvarnim definicijama `safe_json`, `safe_stamp`, `title_property_type`, pročitanim iz postojećeg projekta. Uklonjene su njihove testne zamjene. SQL test provjere koristi stvarni status kandidata umjesto nedopuštenog TEST statusa i uključen je u test migracije.
- CI prijedlog dodaje DOM test i pokretanje testova pri pushu na ovu granu. Taj CI još nije izvršen.

## Rezultati

- Python: 99 pronađenih testova, **94 prošla, 5 preskočeno** jer lokalni standardni PostgreSQL preko TLS-a nije dostupan.
- Svih pet Node skripti prolazi, uključujući negativan/nepoznat ishod, izvorne lokacijske uvjete, jednakost kopija i odvojeno rangiranje.
- React/jsdom test prolazi, uključujući zaseban negativan ishod uz provjeren odgovor.
- Dodatna lokalna PostgreSQL provjera putem **PGlite 0.5.11**: izvoz bez zamjena, `pair-records.sql`, `test-pair-records.sql`, `test-verification-policy.sql` i stvarni `dispatch`/`refreshSuggestions` iz `test_pair_api.mjs` prolaze. PGlite **nije zamjena za standardni PostgreSQL 17/TLS CI**.
- Šest starih adaptera provjereno stvarnim dohvatom, bez upisa u produkciju: Fina 447, Državne nekretnine 4, španjolske dražbe 8, španjolska izravna prodaja 5, Gradzilla 1 i Immoexpert 1. Ukupno 466 kandidata. Zapis je u `ops/legacy-source-probe-2026-10-23.json`. Uspješan dohvat nije potvrda dostupnosti, zakonitosti ili stvarne prilike.
- Deset stvarnih grupa sa sjedištem izvan EU i javnim izvorima u `data/global_investor_review_cases.json`: GIC, CPP Investments, Mapletree, Blackstone, Brookfield Asset Management, Hines, Greystar, KKR, Starwood Capital i ICG. Testovi potvrđuju prihvaćanje sjedišta i NULL budžeta te neovisnost sjedišta od sintetičkog EU mandata. **To su profili za provjeru, ne deset potvrđenih aktualnih mandata ili podudaranja.** Nisu uvezeni u produkciju.

## Što još ograničava dovršetak

1. Automatska provjera odbila je stvaranje GitHub tree objekta, navodeći da prijenos izvornog koda i izvoza sheme u udaljeni repozitorij nije dovoljno izričito odobren. Nije stvoren ni objavljen novi remote commit. Za spremanje ovih ispravaka na istu granu PR-a potrebno je izričito odobrenje korisnika; odbijanje se ne zaobilazi.
2. Nakon toga izvršiti standardni PostgreSQL 17/TLS CI na konačnom SHA, provjeriti logove i pregledati konačni diff.
3. Neovisni pregled prije eventualnog spajanja ostaje uvjet. Migracija nije primijenjena na produkciju.
4. Sites je još pregledna kopija. Pri prijenosu treba otvoriti kanonski aktualni Sites izvor, prenijeti samo pregledane promjene, sačuvati gumb Mogući parovi i provjeriti nacrt prije objave. Produkcijska aplikacija nije promijenjena.
5. `claude-code-action` ostaje neaktivan prijedlog. Izrada ovih ispravaka ne predstavlja Claude integraciju. Sigurna autorizacija vlasnika nije potvrđena; token se ne izmišlja, ne čita i ne stavlja u izvorni kod.
6. Postojeći cron može provjeravati konfigurirane javne izvore. Tvrdnja da svako otkrivanje novih izvora nužno zahtijeva plaćenu uslugu nije potvrđena. Ovaj paket ne uvodi novu plaćenu uslugu.

Ništa nije spojeno, objavljeno ni primijenjeno na produkciji. Nikome nisu poslane poruke.
