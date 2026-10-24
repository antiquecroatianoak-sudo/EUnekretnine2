# Rezultati probe novih izvora — 24.10.2026.

Run 40102730364, head 8a4eb8ad9aab10fa0779a64f6f7a38dbf51ec214. Proveden dohvat uz postojeći Fetcher i robots provjere, bez upisa u bazu.

- https://www.immonestor.at/objekt/7582406?from=482954: HTML dohvaćen; LUXUS Penthouse im Zentrum - Die Weltstadt! / LUXUS Penthouse im Zentrum - Die Weltstadt!.
- https://www.adamant-immobilien.at/objekt/17329426?from=1555954: HTML dohvaćen; Sonnige Eigentumswohnung nahe Augarten – perfekte Raumaufteilung / Sonnige Eigentumswohnung nahe Augarten – perfekte Raumaufteilung.
- https://www.immolution.at/objekt/14502658?from=302544: HTML dohvaćen; Modernes Zweifamilienhaus mit hochwertiger Ausstattung – Einziehen und Wohlfühlen! / Modernes Zweifamilienhaus mit hochwertiger Ausstattung – Einziehen und Wohlfühlen!.
- https://www.raiffeisen-immobilien.at/de/wohnung-kaufen: HTML dohvaćen; Wohnung kaufen | Raiffeisen Immobilien / Wohnung in Österreich kaufen.
- https://zweitwohnsitze.com/: HTML dohvaćen; Zweitwohnsitze kaufen | Chalets & Ferienimmobilien in den Alpen / Zweitwohnsitze in den Alpen kaufen.

NESTOR, ADAMANT i Immolution imaju RealEstateListing + OfferForPurchase za glavni oglas, s izričitim EUR iznosom i državom u offers.itemOffered.address. NESTOR u istom HTML-u ima i preporučene RealEstateListing objekte s drugim cijenama. Postojeći listing_record obilazi sve objekte i može prepisati cijenu glavnog oglasa cijenom preporučenog: blokator aktivacije. Potrebno vezati podatke za kanonski URL/identifier glavnog oglasa; izričito isključiti najam i filtrirati zemlju samog oglasa, ne sjedište agencije.

Raiffeisen katalog ima /de/immobilien/kauf/ pojedinačne poveznice; Zweitwohnsitze ima /objekte/*.html. Potreban dohvat jednog dopuštenog detalja svakog prije parsera. Nije potvrđen unos ovih izvora; novi automatski uvoz NIJE aktivan. PR6 migracija ostaje primijenjena.
