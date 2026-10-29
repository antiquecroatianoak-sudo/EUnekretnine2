# Vrijeme putovanja — modul 6 (28.10.2026.)

**Stanje:** ugovor, red, cache i testni adapter su implementirani i testirani. Modul je **isključen**: nema odobrenog servisa za rute bez novih troškova ili računa (uputa 6446803748). Za produkcijski izračun potrebna je vlasnikova odluka o servisu, uvjetima i privatnosti; do tada se ništa ne izračunava.

## Ugovor (`travel.mjs`, `travel.py`)
- **Uvjet zahtjeva** (`criteria.travel`): odredište s nazivom i koordinatama, način putovanja, najviše minuta, obaveznost i izvorni navod. Pretpostavka prometa je opcionalna.
  - Odredište mora biti točna lokacija (POI ili adresa). Središte grada nije dovoljno.
  - Polazište je samo precizna lokacija same nekretnine (POI, adresa ili čestica). Okvirna točka nije polazište.
- **Uparivanje nikad ne zove servis.** Obavezan uvjet bez spremljenog rezultata je otvorena stavka para („… nije izračunato”). Želja samo dodaje informaciju. Zračna udaljenost nikad ne zamjenjuje vrijeme vožnje.
- **Ishod** dolazi samo iz spremljenog rezultata. Zastario rezultat, greška ili 429 znače „nije izračunato”.

## Red i cache (`TravelQueue`)
- **Ključ** čine polazište i odredište zaokruženi na približno 10 m, način putovanja i verzija modula. Promjena lokacije daje novi ključ.
- **Cache** ima TTL.
- **Deduplikacija:** istodobni isti zadaci računaju se jednom.
- **Paralelizam** je ograničen.
- **Ponovni pokušaj** s eksponencijalnim backoffom na timeout ili 429. Greška se ne cachira kao rezultat, a neispravan odgovor se ne ponavlja.
- **Izvan uvoza i uparivanja:** red se nikad ne pokreće u njima.
- **Testni adapter** je deterministički i označen „TEST ONLY”. Služi samo za testove reda; nikad nije produkcijsko vrijeme putovanja.

## Privatnost i tajne
- Koordinate, POI, ruta i vanjski URL ne ulaze u anonimnu ponudu ni u metapodatke; testirano.
- Modul ne čita varijable okruženja ni ključeve i nema mrežni poziv. Budući produkcijski adapter mora ključ držati samo na poslužitelju.

## Testovi
- **`test_travel.mjs`:** validacija, uparivanje bez poziva, ishodi, red (deduplikacija, TTL, istek, promjena lokacije, backoff, 429, neispravan odgovor, paralelizam, neprecizno polazište), privatnost, jednake kopije.
- **`test_travel.py`:** isto ponašanje u Pythonu, s usporedbom oznaka s JS-om.
