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
