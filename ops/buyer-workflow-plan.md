# Odobreni plan 27.10.2026.

Cilj: dokumentirani zahtjev kupca → automatsko uparivanje → završna ljudska provjera → anonimna prezentacija → pisani odgovor na verziju → paket ovlaštenoj agenciji.

1. Više neovisnih zahtjeva istog kupca, uz očuvanje izvornog profila, kriterija i izvora.
2. Postojeći zajednički izračun odmah nakon promjena; isticanje novih/poboljšanih parova iz trajne povijesti.
3. Objedinjeni pregled podudaranja, nedostataka, dokaza i oba kontaktna kanala.
4. Nepromjenjive verzije anonimnih ponuda s pregledom, odobrenjem i ispisom/PDF izvozom.
5. Pisani odgovor na konkretnu verziju, razlog, dokaz, kanal i datum; otvaranje nije interes.
6. Paket za agenciju nakon potvrđenog interesa: dokumenti, provjere, potražnja, odgovor, otvorene stavke, izričiti dogovor o naknadi od agencije nakon uspješne prodaje.
7. Trajno spremanje, regresije i privatna objava. Bez automatskog slanja, bez aktivacije poslovanja samo zbog nadogradnje.

Samostalni zahtjevi su odvojeni operativni profili u postojećem matching sustavu, povezani metapodatkom buyer_identity_id. Zato kriteriji različitih zahtjeva nikad ne tvore jednu izmišljenu potražnju. Uvozni profil se ne prepisuje.

Verzije i događaji su append-only zapisi u postojećoj privatno dostupnoj evidenciji activity; pristup samo kroz postojeći autentificirani i potpisani gateway. Sadržaj ponude generira poslužitelj iz allowliste, ne prima HTML klijenta. Promjena nekretnine ili potražnje poništava valjanost prethodnog odobrenja za novu predaju. Ne uvodi se javno dijeljenje privatnog kataloga.

Nema promjene budžetskog pravila, geografije potražnje, tolerancije površine, kontakata, dostupnosti ili import checkpointova.

## Dopuna 27.10.2026.
Vlasnikova dopuna (PR #47, komentar 6446741323): šest nastavnih modula u `ops/buyer-workflow-enhancements-plan.md`. To je zaseban nastavak; ovaj osnovni plan je dovršen u PR-u #47.
