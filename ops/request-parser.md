# Zahtjev običnim tekstom — modul 3 (28.10.2026.)

**Stanje:** implementirano i izolirano testirano. Nije pregledano ni objavljeno. Nema migracije.

## Što radi
`sites-review/lib/request-parser.mjs` (`local-parser-v1`) je ograničeni lokalni parser, bez LLM-a, vanjskih servisa i slanja podataka (uputa 6446803748). Iz teksta predlaže zasebne zahtjeve. Svaka predložena vrijednost nosi:
- doslovni navod iz izvornog teksta (test provjerava da je svaki navod podniz izvornika);
- pouzdanost;
- otvorene nejasnoće.

Neprepoznate rečenice ostaju navedene; opće razumijevanje teksta se ne tvrdi.

U obrascu zahtjeva kupca, „Primijeni u obrazac” samo popunjava polja. Operator ih provjerava, dodaje izvor i sprema postojećim tijekom. Ništa se ne označava kao provjereno, ne postavlja se kontakt, pravni status, mandat ni interes.

## Što parser razlikuje
- **Zasebni zahtjevi i alternative.** Zasebni zahtjevi (numeracija, „Zahtjev N”, prazni redovi) dijele se uz napomenu. Alternative unutar zahtjeva („hotel ili skladište”) postaju jedna želja s alternativama, a osnovnu vrstu potvrđuje operator. Natuknice ne dijele zahtjev.
- **Država potražnje i sjedište.** Sjedište se ne predlaže kao potražnja.
- **Jedinice i brojevi.** m² i ha se razlikuju. Decimalni zarez se čita ispravno; „15.000” se označava kao nejasno, uz nisku pouzdanost.
- **Granice:**
  - najmanje i najviše, uključujući negacije („ne manje od”, „ne više od”);
  - jednak raspon se prihvaća;
  - obrnut raspon se ne ispravlja automatski;
  - površina bez granice („oko”) traži odluku operatora;
  - nepoznata osnova površine je otvoreno pitanje.
- **Isključenja (nalaz 6464815024).** Država, vrsta, podvrsta, stanje ili uvjet iza riječi isključenja u istoj rečenici ili dijelu rečenice nikad nije potražnja. Primjeri riječi: „ne u”, „ne želimo”, „osim”, „bez”, „not in”, „no interest in”, „excluding”, „nicht in”, „ohne”, „außer”. Dio rečenice završava zarezom, točkom-zarezom ili riječju kontrasta („ali”, „samo”, „but”, „only”, „sondern”, „nur”).
  - Isključenje se prikazuje kao konkretno upozorenje s izvornim navodom i vraća se u `excluded`. „Primijeni” ga ne preuzima.
  - Iz isključenog dijela ništa se ne predlaže kao traženo. Na primjer, u „Ne želimo kuću za obnovu, samo useljivu.” predlaže se samo „Useljivo”, a vrstu potvrđuje operator.
  - Negacije granica („ne manje od”, „not more than”, „nicht mehr als”) i „bez zakupa” nisu isključenja.
- **Granice specijaliziranih uvjeta.** Za sobe, kategoriju, snagu i visinu granica se čita iz riječi neposredno ispred broja (najmanje/najviše, s negacijama na HR, EN i DE) ili iz raspona „od X do Y”.
  - Bez granice uvjet se **ne predlaže**, uz upozorenje („20 soba” može biti najmanje, najviše ili točno).
  - Obrnut raspon se ne predlaže.
- **Uvjeti.** „Bez zakupa” je uvjet; „nije uvjet” nije. Obavezno i želja razlikuju se prema riječima navoda; ako nije navedeno, predlaže se želja uz otvoreno pitanje.
- **Budžet.** Ukupni iznos ostaje informativan, a cijena po m² nikad nije ukupni budžet.
- **Jezici.** HR te uzorci EN, DE, IT, FR i ES.
- **Sigurnost.** Tekst nalik uputi („ignore…”, „mark verified”) je podatak: prijavljuje se i ne izvršava. HTML se prikazuje kao tekst. Kontrolni znakovi se uklanjaju.

## Pohrana
`save_request` sprema izvorni blok interno (`source_text`, `source_text_digest`, `parsed_by`):
- isti tekst istog kupca ne može postati drugi zahtjev;
- ta polja se ne mogu podmetnuti kroz opće kriterije;
- anonimna prezentacija ih ne sadrži (allowlist u `offer.mjs`; testirano).

## Testovi
- **`sites-review/scripts/test-request-parser.mjs`** pokriva:
  - HR, EN i DE;
  - negacije i raspone (valjan, jednak, obrnut);
  - decimalni zarez i jedinice;
  - nedostajuće dokaze;
  - više zahtjeva bez križanja;
  - zabranu izmišljanja (nema podataka → nema polja);
  - injection i XSS kao podatak;
  - curenje izvornog teksta u prezentaciju.
- **`test_offer_workflow.mjs`:** spremanje, ponovljeno spremanje bez duplikata, nepoznat način obrade i podmetanje kroz kriterije.
- **DOM:** prijedlog s navodima, primjena bez spremanja, a zatim spremanje s izvornim tekstom i bez potvrde.
