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

## Pregled 6361220363 — usklađivanje evaluatora s bazom

- **Nalaz:** `propertyInput` ne sprema `source_checked_on`, a `evaluate` nije provjeravao svježinu izvora, status ni grad. Zato je izračunao MATCH koji `property_eligible` odbija, `guard_verified_pair` taj upis tiho ne prihvaća, a osvježavanje je par izbrisalo.
- **Ispravak:** isti uvjeti u svim kopijama `domain.mjs` i u `matching.py`:
  - nekretnina: `SOURCE_FRESH`, `ACTIVE_CHECK`, „Grad nekretnine”;
  - kupac: `BUYER_RECORD`, prema `investor_eligible` na spremljenim kriterijima.
- **Izričita provjera izvora:** API `source_check` (u dopuštenim radnjama rute), obrazac u „Detalju para” i Streamlit obrazac. Datum ne smije biti u budućnosti, a dokaz se upisuje u `activity`.
- **Zaštitna mreža pri osvježavanju:** stvarna prilika koju baza odbije sprema se kao kandidat s `GUARD_REFUSED`. Rang se ponovno računa samo nad spremljenim zapisima.
- **Regresije u `test_pair_api.mjs`** (pravi `dispatch` nad izvezenom shemom), redom:
  1. spremanje bez provjere daje kandidata sa zadatkom;
  2. provjera izvora daje stvarnu priliku bez budžeta;
  3. istek nakon 31 dana vraća kandidata uz sačuvanu povijest;
  4. čuvar koji odbije jeftiniju ponudu ne mijenja rang druge.
- **Negativne kontrole:** bez novih uvjeta u evaluatoru ili sa starim osvježavanjem test pada.
- **Ostale regresije:** Python paritet u `test_matching.py` i `test_matching_ui.py`; DOM provjera obrasca za provjeru izvora.

## Što još ograničava dovršetak

1. Ispravci su na grani PR-a (`3af1428`, `1170b5d`). Standardni CI s PostgreSQL 17 i TLS-om na `1170b5d` prošao je bez preskočenih testova.
2. Za ispravak pregleda 6361220363 rezultat CI-ja navodi se u komentaru PR-a uz konačni SHA.
3. Neovisni pregled prije eventualnog spajanja ostaje uvjet. Migracija nije primijenjena na produkciju.
4. Sites je još pregledna kopija. Pri prijenosu treba otvoriti kanonski aktualni Sites izvor, prenijeti samo pregledane promjene, sačuvati gumb Mogući parovi i provjeriti nacrt prije objave. Produkcijska aplikacija nije promijenjena.
5. `claude-code-action` ostaje neaktivan prijedlog. Izrada ovih ispravaka ne predstavlja Claude integraciju. Sigurna autorizacija vlasnika nije potvrđena; token se ne izmišlja, ne čita i ne stavlja u izvorni kod.
6. Postojeći cron može provjeravati konfigurirane javne izvore. Tvrdnja da svako otkrivanje novih izvora nužno zahtijeva plaćenu uslugu nije potvrđena. Ovaj paket ne uvodi novu plaćenu uslugu.

Ništa nije spojeno, objavljeno ni primijenjeno na produkciji. Nikome nisu poslane poruke.
