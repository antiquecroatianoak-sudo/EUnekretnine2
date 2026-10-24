# Aktivni kanal nastavka EU projekta (nakon PR-a #4)

Dogovoreno u PR-u #4 (6369660650 i 6369922971), da se dostava nastavka ne izgubi nakon spajanja.

- **Kanal.** Nakon spajanja PR-a #4 upute i pregledi za EU projekt šalju se u ovaj nastavni draft PR (grana `claude/eu-next`). Isti Claude Code sesija ga prati. Kad se i ovaj PR spoji, prije spajanja se otvara i ovdje navodi sljedeći.
- **Prvi korak nakon spajanja PR-a #4:** spojiti `main` u ovu granu.
- **Pravila:**
  - bez mergea i objave prije neovisnog pregleda;
  - nikoga se ne kontaktira;
  - Košarica, građevinska aplikacija i privatnost ostaju netaknute.

## Otvorene stavke prenesene iz PR-a #4
1. **Produkcijska dijagnostika.** Nakon objave PR-a #4 pokrenuti „Zašto nema više parova?” (`pair_diagnostics`, samo brojevi). Na temelju lijevka ispraviti stvarne uzroke malog broja parova, npr. nekretnine bez prepoznate vrste. Ispravak ide dopunom iz izvora, ne pogađanjem.
2. **SQL `sync_source_listing`.** Za javne pozive kopira samo 7 ključeva kriterija. Proširenje na sve ključeve iz `buyerDraft` traži migraciju; ide samo uz odobrenje i pregled.
3. **Tragovi novih izvora.** Nakon prvog obilaska na `main` pregledati `data/source_leads.json`. Kandidate s provjerenim uvjetima korištenja uključuje vlasnik.
