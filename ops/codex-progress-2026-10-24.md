# PR 5 — Codex nastavak, 24.10.2026.

Vlasnik je odobrio izravnu implementaciju dok Claude čeka obnovu limita, uz spremanje dovršenih cjelina. Claude nastavlja komunikaciju kroz isti PR; ne ponavljati ovaj paket.

## Spremljeno / implementirano

- Usklađen main (327115e0dac95aeb0716820025985287ee7ef4d9) u postojeću granu, očuvani kanal i prethodne upute. Prvi kodni checkpoint: 087d75b9b8adb40bcc27abcbe03196bce7ab325d.
- Početni pregled vodi na moguće parove. Svaki par ima razumljive brojače, osnovne podatke, usporedbu zahtjeva kupca i nekretnine, otvorene provjere i vidljiva kritična odstupanja. Ocjena se preuzima iz spremljenog evaluatora, uz objašnjenje bodovanih kriterija i dodatnih provjera. Budžet ostaje informativan. Tolerancija −15%/+25% očuvana.
- Zaseban popis neprovjerenih nekretnina nije prikazan u evidenciji izvora; evidencija izvora zadržava kandidate za kupce. Interno otkrivanje, podaci i provjera nisu obrisani niti su neprovjereni zapisi proglašeni provjerenima.
- Potvrđen uzrok granice: stari read imao je LIMITS.properties=10000 i LIMITS.investors=10000. Zamijenjeno ograničenom početnom stranicom i katalogom s keyset nastavkom bez ukupnog maksimuma, pretragom/filtrima nad cijelim katalogom, stvarnim brojačima i granicom novih unosa do osvježavanja. Isti nastavak dostupan je karti i analizi. Izvoz izričito označuje da obuhvaća učitane rezultate.
- Brojači odvajaju sve zapise, dostupne zapise i zapise koji zadovoljavaju postojeće property_eligible/investor_eligible uvjete; ne izmišljaju novu definiciju provjere.
- Uparivanje već dohvaća cijele tablice bez LIMIT 10000; pravila nisu popuštana. Stari discovery-sync zadržava sigurnosni maksimum pojedinačnog zahtjeva, a Python pošiljatelj sada dijeli cijeli snapshot prema broju i UTF-8 veličini, bez ukupnog maksimuma i tihog odsijecanja. Svaki batch potvrđuje broj spremljenih zapisa; ponavljanje koristi iste idempotentne upserte.
- Detalj para dohvaća aktualne povezane zapise za usporedbu nakon dopune dokaza.

## Provedene lokalne provjere

- PostgreSQL/PGlite: 10.125 testnih nekretnina i 10.042 testna kupca; sve stranice, dohvat/pretraga iza 10.000, bez duplikata/preskakanja, brisanje prije kursora, granica novih unosa, lifecycle isključenje i stvarni evaluator para iza oba prijašnja limita.
- Test prikaza: potpuno i djelomično podudaranje, kritično odstupanje, nedostajući dokaz pri 100%, nepromijenjena ocjena i rubovi tolerancije.
- React/jsdom stvarni klikovi: postojeći postupci pitanja/odgovora/dokaza/prezentacija, nezavisni dohvat parova, statusi i pogreške; novi prikaz usporedbe, keyset nastavak, pretraga na serveru, reset kursora i eksplicitna pogreška kataloga.
- Test stvarne API rute: dopušten katalog uz postojeću prijavu, blokada neprijavljenih i cross-origin zahtjeva.
- Python batch test: 10.125 zapisa u ograničenim zahtjevima, očuvani svi podaci i statusi, determinističan retry i eksplicitna pogreška prevelikog pojedinačnog zapisa.

## Još nije potvrđeno / nastaviti

- Puni CI i testovi s produkcijskom izvezenom shemom na PostgreSQL 17, neovisni pregled diffa i stvarni mobilni vizualni pregled. Lokalni jsdom ne dokazuje raspored na uređaju.
- Stvarni produkcijski brojevi i prikaz unutar prijavljenog vlasnikova računa nisu provjereni. Podaci za test su izolirani; nisu dodavani u produkciju.
- Prethodni zadatak proširenja sync_source_listing na dodatne kriterije kupca s migracijom i dokazom očuvanja ručnih izmjena ostaje za poseban nastavak/pregled. Ovaj paket ne primjenjuje novu migraciju.
- Pregled stvarnih novih izvora i produkcijska dijagnostika ostaju prema komentaru 6371837456; ne tvrditi da je ovaj UI paket i njih dovršio.
- Pairs endpoint zasad vraća sve spremljene parove s njihovim zapisima; kod vrlo velikih baza dalje razmotriti paginaciju tog zasebnog odgovora i nastavak skupog izračuna, bez skrivanja kandidata.

Nema mergea, objave, kontakata ni slanja ponuda. Poslovna faza ostaje isključena. Košarica i građevinska aplikacija nisu dirane.
