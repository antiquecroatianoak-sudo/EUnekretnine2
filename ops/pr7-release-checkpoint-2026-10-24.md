# Objavljeno — PR7 i PR8, 24.10.2026.

## Potvrđeno

- PR7 spojen: ce87b3ec6dd476709c8030fab778b9dee976793a. Završni CI 40107602332, stvarna proba 40107602274 i public-land 40107602281: success. Lokalno 75 relevantnih regresijskih testova prošlo.
- Registrirani izvori 102 NESTOR, 103 ADAMANT, 104 Immolution, 105 Raiffeisen — Eisenstadt i 106 Zweitwohnsitze. Ops SQL aktivacije primijenjen i svih pet konfiguracija ponovno pročitano iz produkcije. Raiffeisen putanja ograničena na /de/immobilien/kauf/7000/eisenstadt/.
- Stvarni postojeći main postupak uvoza spremio je 57 kandidata: 23 + 21 + 9 + 1 + 3. Svih 57 ima property_id i različit URL; nema duplikata u ovom skupu. Svih 57 ostaje nepotvrđeno (verified=false), nisu potvrđene prodaje ni pravna urednost.
- Izvori nemaju grešku u checkpointu. NESTOR ima 83 i ADAMANT 6 spremljenih URL-ova za nastavak; drugi izvori imaju i odbijene/nepodržane detalje. Nije potvrđena cjelovitost portala. Nedostajuća polja ostaju dopuna.
- Naknadno otkriven server mergeCandidate prepisivao je zemlju pojedinačne nekretnine zemljom registra. Uski popravak PR8 koristi validirani EU kod row.country za nekretnine pet pregledanih agencija; ostali izvori i kupci ostaju prema starom ponašanju. PR8 spojen: ca6f45a00db863d7d5a6be876173f1b533de51d1. Konačni CI 40108099246: success, uključujući PostgreSQL/TLS, Node i UI regresije. Testovi pokrivaju različite zemlje, nevaljan kod i očuvanje ručnih polja/dokaza.
- Registry-discovery Edge funkcija ACTIVE v7. Ponovni get_edge_function potvrdio je sva četiri modula točno prema paketu. Promijenjen samo merge.mjs; index.js/OIDC autorizacija, domain.mjs i verification.mjs identični prethodnoj produkciji. Provjera strukturiranih AT adresa u novim zapisima nije našla nesklad zemlje. Tri trenutačna Zweitwohnsitze oglasa imaju austrijske lokacije i Austriju.
- PR6 migracija nije ponavljana. Postojeći discovery.yml, raspored i ovlasti nisu promijenjeni. Dodatnu raspoređenu smoke provjeru odbio je automatski pregled; nije primijenjena niti zaobiđena. Objava i uvoz dovršeni su postojećim autoriziranim putem.
- Prioritet kupaca s konkretnim kriterijima, odvajanje sjedišta od zemalja potražnje, izvor/datumi te nastavak obiju baza zapisani su u AGENTS.md. Ovim paketom nisu prikupljeni novi investitori; sljedeće proširenje izvora prvenstveno usmjeriti na dokumentiranu potražnju.

## Granice provjere i nastavak

- Lokalni izravni HTTP poziv v7 završio je mrežnim timeoutom. Ne tvrditi da je napravljen uspješan stvarni poziv nove v7 kroz lokalni HTTP; potvrđeni su objavljena aktivna verzija, sadržaj modula i izolirane regresije. Prikaz unutar vlasnikova prijavljenog računa nije ponovno provjeravan i nije bio uvjet za backend objavu.
- GitHub fetch_commit_workflow_runs wrapper prikazuje PR pokretanja, ne main push/schedule: prazan odgovor nije dokaz da main uvoz nije pokrenut. Produkcijski uvoz potvrđuje baza.
- Ne ponavljati PR7 registraciju, PR8 popravak ili PR6 migraciju kao da nisu objavljeni. Nastaviti postojeće redove i sljedeća proširenja izvora uz prioritet kriterija kupaca. Za ostale Raiffeisen lokacije prvo prilagoditi dokaz lokacije; ne proširivati opseg na slijepo.
- Vlasnik je odobrio samostalan nastavak i objavu, bez novih prijava, uz periodično spremanje. Druge aplikacije nisu dirane; ponude i poruke vanjskim osobama nisu slane.
