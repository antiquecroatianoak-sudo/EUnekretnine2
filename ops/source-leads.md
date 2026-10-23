# Otkrivanje novih izvora za oba toka (6364306499 B)

## Utvrđeno stanje prije ove promjene
- **`discovery.yml`** (svakih 6 sati) pokreće `registry_discovery.py` i `discovery.py`. Prvi obilazi samo izvore iz tablice `sources`, koju vraća radnja `registry`, i to samo na njihovim hostovima (`safe_url` odbija druge domene). Drugi ima fiksne `SOURCES/HOSTS`.
- **Nijedan konfigurirani tok ne pronalazi nove domene.** `sources` se puni samo ručno: u repozitoriju postoji samo `app.py` za lokalnu bazu, nema API radnje za dodavanje.
- **Dohvat poznatih izvora nije dokaz pronalaska novih.**

## Novi ograničeni mehanizam (`source_leads.py`)
Mehanizam ne koristi tražilicu, API ključ ni plaćenu uslugu. Tok:

1. **Trag.** Tijekom obilaska registra bilježe se samo vanjske HTTPS poveznice čiji tekst ili putanja navodi:
   - prodaju ili dražbu, za tok nekretnina;
   - otkup ili potražnju, za tok kupaca.

   Riječi su na jezicima EU27, bez prioriteta među državama. Društvene mreže i opći servisi se preskaču.
2. **Dokaz.** Uz svaki trag čuva se stranica na kojoj je viđen, tekst poveznice i datum (do 5 zapisa). Iz vršne domene bilježi se okvirna država.
3. **Deduplikacija.** Po domeni. Domene koje su već u `sources` se izostavljaju. Ponovni nalaz ažurira `last_seen`, ali nikad ne briše ručnu ocjenu ni bilješku.
4. **Provjera.** Najviše 10 tragova po pokretanju, uz isti `Fetcher` kao registar (`robots.txt`, razmak između zahtjeva, samo javni HTTPS). Ishodi:
   - 401, 403, 451 ili stranica s prijavom → `blokirano`; ništa se ne zaobilazi;
   - zabrana u `robots.txt` → `robots_zabrana`;
   - greška → `nedostupno`, s ponovnim pokušajem nakon 7 dana;
   - inače klasifikacija prema znakovima oglasa (structured data, cijene, površine) ili potražnje: `kandidat_nekretnine`, `kandidat_kupci` ili `nije_relevantno`.
5. **Trajni checkpoint.** `data/source_leads.json` sprema workflow zajedno s kandidatima. Neprovjereni tragovi zadržavaju status za sljedeće pokretanje.
6. **Pregled i uključivanje.** Ovo je namjerno ručni korak. Trag nikad automatski ne postaje izvor. Kad vlasnik ili pregledatelj odobri `kandidat_*` (provjeri uvjete korištenja i zakonitost dohvata), dodaje se u `sources`.
7. **Nastavak postojećim tokom.** Odobreni izvor sljedeći prolaz obrađuje kao i druge: generički adapter i postojeći testovi, upis kandidata, priprema za pregled, a zatim uparivanje.

## Stvarne prepreke
- **Nema tražilice bez ključa ili plaćene usluge.** Bez nje se otkrivaju samo izvori povezani s već praćenim stranicama. Pokrivenost novih država ovisi o tome na što poznati izvori upućuju.
- **Prvi stvarni tragovi nastaju tek na `main`.** `discovery.yml` radi samo ondje, nakon pregleda i spajanja. U ovoj grani mehanizam je testiran lažnim dohvatom (`test_source_leads.py`), ne stvarnim obilaskom.
- **Ovo okruženje ne može samo provjeriti tragove.** Mrežni proxy ograničava pristup stranicama.
- **Odobrenje izvora i provjera uvjeta korištenja** ostaju ljudski korak. Automatsko uključivanje novih domena u obilazak značilo bi preuzimanje podataka bez provjere dopuštenosti.
