# Sektorski kriteriji — modul 5 (28.10.2026.)

**Stanje:** implementirano i izolirano testirano. Nije pregledano ni objavljeno. Nema nove migracije; koristi se `facts_json` iz modula 1.

## Sadržaj
- **Sektorski podaci** u facts-v1 registru (JS i Python identično):
  - hotel: broj soba, dokumentirana kategorija, posluje, mjeseci rada (sezonalnost), potrebna obnova;
  - skladište: korisna površina, svijetla visina (osnova mjerenja u dokazu), pristup kamionima, priključna snaga;
  - farma: namjena proizvodnje, zemljište u vlasništvu i zakupu, prava na vodu, zgrade i oprema uključene u prodaju.

  Podvrsta je neovisna o osnovnoj vrsti, pa je mješovita imovina moguća.
- **Validacija raspona** u osnovnoj jedinici dimenzije: kategorija 1–5, cijeli brojevi za sobe i mjesece, mjeseci 0–12, visina do 60 m, snaga do 1000 MW. Kriva jedinica ili nemoguća vrijednost ne prolazi.
- **Dokaz.** Prijedlog (podrijetlo „predloženo”, npr. iz parsera ili partnera) ne može biti potvrđen podatak. Marketinški navod postaje dokaz tek nakon pregleda, s pravim podrijetlom i dokazom.
- **Primjena:**
  - Primjenjuju se samo uvjeti dokumentiranog zahtjeva (`criteria.requirements`). Zahtjev bez sektorskog uvjeta nije penaliziran, pa se postojeći parovi ne snižavaju.
  - Nepoznato nije ispunjeno; proturječan podatak ostaje otvoren.
  - Promjena podvrste ili mjere mijenja `pairText` i poništava ranije provjere para.
- **Predlošci sektora** u uređivaču uvjeta samo navode tipična polja kao prazne želje bez vrijednosti. Ništa ne postaje obavezno predloškom.
- **Tablica para** prikazuje traženo, stvarno, dokaz i stanje, a ocjenu odvojeno od pouzdanosti (moduli 1 i PR #47).
- **Anonimna ponuda** dobiva samo potvrđene podatke kao općenite retke: sobe u razredima po 10, snaga po 100 kW, površine u razredima iz `areaText`, kategorija uz napomenu o provjeri, ostalo da/ne.
  - Nepotvrđeni, istekli i proturječni podaci se ne prikazuju.
  - Svaki redak prolazi istu provjeru identifikatora kao opis nekretnine.
  - Točne vrijednosti (npr. 43 sobe) ostaju interne.

## SQL
SQL guardovi ne odlučuju o ovim kriterijima. Guard odbija samo `MATCH`, a evaluacija u JS-u prije toga postavlja otvorene stavke ili odbijanje. Zato SQL testni vektori nisu potrebni. Kad bi neki od ovih kriterija ušao u SQL, trebali bi isti vektori.

## Testovi
- **Vektori (`ops/facts-vectors-v1.json`)** za JS i Python:
  - mješovita imovina;
  - sezonski hotel kao želja;
  - alternative proizvodnje;
  - nevaljani podaci: kategorija 6 i 0, 12,5 soba, 13 mjeseci, potvrđeni prijedlog, nepoznata proizvodnja, visina 80 m, snaga iznad 1000 MW;
  - nevaljan zahtjev (kategorija 7).
- **Paritet registra** JS/Python uključuje raspone.
- **Prezentacija:** točni retci, nepotvrđeni i istekli podaci izostavljeni, točan broj soba nije prikazan, HTML sekcija postoji.
- **DOM:** predložak sektora dodaje prazne želje bez duplikata.
