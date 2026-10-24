# Tablični prikaz mogućih prilika — 24.10.2026.

Nova izričita uputa vlasnika: prikaz mogućih prilika mora biti tablični i znatno pregledniji. Zamjenjuje raniji prikaz kartica.

Implementirano u Sites repozitoriju projekta appgprj_6ad3d11946fc8191bd34af0ad4f2cdd8, commit 033d40d4844ba4e38a2b0023f52fa2100028731e. Datoteke app/platform.tsx i app/globals.css. Prije buduće objave preuzeti aktualni Sites izvor, ne prepisati ga starim sites-review prikazom.

Jedan par po retku; stupci: nekretnina, lokacija/površina, cijena/trošak/ROI, kupac, spremljena ocjena, uvjeti/provjere, status/detalj. Podudarnost nije vjerojatnost prodaje. Kritična odstupanja i nedostaci ostaju vidljivi. Detalj para zadržava usporedbu, pitanja, odgovore i dokaze; dodatni podaci/faza/vrijeme i nacrt prezentacije ostaju dostupni. Postojeće filtri i paginacija očuvani. Mobilni prikaz ostaje semantička tablica s vodoravnim pomicanjem, fiksnim prvim stupcem i zaglavljem. Nema izmjena evaluatora, baze, izvora ili uvoza.

Prošlo: scripts/test-platform-view.mjs, 11 suggestion regresija, git diff --check, produkcijski vinext build. Vizualna browser provjera nije provedena: Sites preview prijavio terminal.local:4173, ali cloud browser vratio ERR_CONNECTION_REFUSED; status CLI i dalje running. Ne tvrditi da je provjeren izgled na fizičkom telefonu. Status objave provjeriti u Sitesu; ova bilješka ne dokazuje dovršetak deploymenta.
