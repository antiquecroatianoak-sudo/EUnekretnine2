# Nastavak nakon PR-a #3 — vidljivost mogućih parova, površina, izvori, poslovna faza

Polazište: `main` na `034d81e`. Upute su iz PR-a #3: 6361512242, 6364207005, 6364306499, 6366535035, 6366561469 i 6369410657. Odobrenje vlasnika dano je u Claude Code sesiji 23.10.2026.

Pravila rada:
- Nema mergea ni objave prije neovisnog pregleda.
- Nema nove migracije ako nije nužna.
- Ne mijenjaju se Košarica, građevinska aplikacija ni privatnost.
- Nikoga se ne kontaktira.

## Matrica zahtjev → kod → test → status
Ovaj dokument se ažurira sa svakim commitom ove grane. Status „u tijeku” znači da još nema koda ni testa.

| # | Zahtjev | Datoteke | Test | Status |
|---|---|---|---|---|
| V1 | Mogući parovi vidljivi čak i kad pun `read` ne uspije ili je prevelik; greška nije prazan rezultat | `sites-platform/index.js`, `route.ts`, `platform.tsx`, `platform-view.mjs` | — | u tijeku |
| V2 | Dijagnostika: koliko parova nastaje, zašto se isključuju (opravdano ili gubitak) i koliko ih je skriveno filtrom | `domain.mjs`, `index.js` | — | u tijeku |
| V3 | Stvarna nula ima objašnjenje; nepotpun kandidat ostaje vidljiv sa zadacima | `platform.tsx`, `platform-view.mjs` | — | u tijeku |
| A | Površina −15 % / +25 % (nadomješta ±25 % iz 6364306499), uz izričitu tvrdu granicu kupca | Python, sve kopije `domain.mjs`, UI | — | u tijeku |
| B | Otkrivanje novih izvora za oba toka, ili precizno dokumentirana prepreka | `registry_discovery.py`, `discovery.yml` | — | u tijeku |
| C | Odgođena poslovna faza, zadano isključena i reverzibilna | `platform.tsx`, `index.js` | — | u tijeku |
| D | `ops/potential-pairs.md` usklađen s PR-om #2 i #3 te Sitesom v7; povijesno stanje označeno | dokumentacija | — | u tijeku |
