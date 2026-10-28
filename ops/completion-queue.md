# Red dopuna podataka — modul 2 (28.10.2026.)

**Stanje:** implementirano i izolirano testirano. Nije pregledano ni objavljeno. Nema migracije.

## Što radi
Radnja `completion_queue` (samo čitanje) i panel „Red dopuna podataka” u sučelju. Izvor su isključivo spremljeni parovi i njihove zabilježene otvorene stavke (`result_json.gaps`). Nema nove evaluacije, uvoznika ni kartezijskog umnoška.

**Stavka:** strana (nekretnina, zahtjev ili par), zapis i otvorena stavka. Za svaku se zasebno broje:
- zahvaćeni parovi;
- zahtjevi;
- različiti kupci (`buyer_identity_id`, pa više zahtjeva istog kupca ne napuhuje broj);
- parovi kojima je ta stavka jedina otvorena (`sole_blocker_pairs`).

**Prikazuje se:**
- zašto je stavka visoko u redu;
- koje zapise zahvaća;
- je li dokaz zastario ili nepotvrđen.

**Redoslijed** je stabilan: jedina blokada, različiti kupci, parovi, zatim ključ. Stranice (`offset`/`limit` do 200, `next`) idu bez ukupnog limita.

**Pravila:**
- Ništa se ne skriva i ništa ne postaje valjana prilika.
- Nepoznato ostaje nepoznato.
- Budžet ne sudjeluje.

## Agencije
- **Veza s agencijom** postoji samo kad je izvor samog zapisa oglas te agencije (`withAgencies`). Kontakt ni mandat se ne pretpostavljaju.
- **Grupe po agenciji** broje samo stavke i zapise. Podaci kupaca ostaju uz pojedinu stavku i ne spajaju se među klijentima.

## Nacrt pitanja
- **Što se nudi:** interni nacrt (`questionDraft`) sa statusom „Nacrt — ne šalje se” i prethodne provjere prema AGENTS.md (25.10.):
  1. izvorni oglas i dokumentacija;
  2. službena evidencija **države nekretnine** (NL i FR imaju automatski adapter, ostale države ručna provjera);
  3. tek zatim upit.
- **Što se ne nudi:** radnja slanja ne postoji. Pitanje prodavatelju ne navodi kupca.

## Testovi i mjerenje
- **`test_completion_api.mjs`** (izolirana baza, stvarni `dispatch`) provjerava:
  - pokrivenost svih spremljenih parova;
  - dva zahtjeva istog kupca kao jednog kupca;
  - točne brojeve i jedinu blokadu;
  - oznaku zastarjelog izvora;
  - vezu s agencijom samo kroz vlastiti izvor;
  - filtar i grupe;
  - provjere prema državi;
  - nacrte bez imena kupca;
  - stranicu po stranicu jednako kao cijeli popis;
  - da nema upisa.
- **DOM** (stvarni odgovor): nastavak bez gubitka stavki, nacrt bez radnje slanja, filtar agencije, pogreška s ponovnim pokušajem.
- **Mjerenje** (`ops/bench-read-path/completion.mjs`): 23.520 spremljenih parova, 294 stavke. Svaka stranica traje 0,8–1,1 s uz 12 upita, bez obzira na veličinu.
