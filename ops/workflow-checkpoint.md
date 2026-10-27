# Nastavak — 27.10.2026. (Claude, plan #46)

Plan: GitHub issue #46; detalji u `ops/buyer-workflow-plan.md`. Nalog: PR #5, komentar 6446132670.
Grana `feature/buyer-offer-workflow`. Aktualni `main` (`18a43f0`) spojen je običnim mergeom, bez rebasea. `data/*` i uvozni checkpointovi nisu mijenjani.

**Stanje:** kod i testovi dovršeni u repozitoriju. NIJE objavljeno: nema deploya Edge funkcije, Sites izvora ni upisa u produkcijsku bazu. Objava ide tek nakon neovisnog pregleda.

## Što je napravljeno
1. **Zasebni zahtjevi kupca** (`save_request`, `buyer_requests`). Svaki zahtjev je zaseban operativni profil povezan s `buyer_identity_id`, s vlastitim nazivom, kriterijima, izvorom i datumom.
   - Izvorni (uvozni) profil se kroz zahtjeve nikad ne mijenja.
   - Novi zahtjev ne nasljeđuje kontakt, provjere ni datum. Kad se promijeni izvor, brišu se raniji datum i kontakt.
   - Brojevi: `counts.buyers` (različiti kupci) prikazuje se odvojeno od broja zahtjeva.
   - UI: `sites-review/app/buyer-requests.tsx`.
2. **Ponovni izračun.** Postojeći zajednički `refreshSuggestions` pokreće se nakon spremanja zahtjeva, kao i dosad nakon uređivanja, uvoza, odgovora i provjere izvora. Discovery ga pokreće preko `discovery-sync`. Nema drugog masovnog uvoznika.
   - Oznake **Novo** i **Poboljšano** dolaze iz trajne `site_private.pair_history` (`changeOf`).
   - Poboljšanje znači viši status ili manje odstupanja/otvorenih stavki bez pogoršanja. Ponovni izračun bez promjene ne bilježi povijest, pa ga se ne označava.
3. **Završni pregled** (`workflow`) računa par svježe, prema aktualnim podacima i pravilima (`suggestion`). Spremljeni `match_results` prikazuje se uz njega.
   - Odobrenje traži da i svježi i spremljeni rezultat potvrde stvarnu priliku.
   - Ocjena (fit) i pouzdanost prikazuju se odvojeno: odgovara / odstupa / nedostaje, zadaci, dokazi i oba kontaktna kanala (izravni ili agencija).
4. **Anonimne prezentacije.**
   - Nepromjenjive verzije u `activity` (stage `Tijek ponude v1`), vezane uz SHA-256 snimku nekretnine i zahtjeva. Svaka promjena podataka poništava valjanost.
   - Sadržaj gradi poslužitelj iz allowliste (`buyerTeaser`, `requestSummary`): bez adrese, grada, naslova, URL-a, kontakata i katastarskih oznaka. Fotografije se ne prilažu.
   - Odobrenje je izričito i idempotentno.
   - Ispis/PDF (`/api/offer-print`) prikazuje samo aktualnu spremljenu verziju. Dok je poslovna faza isključena, ispis nosi oznaku „INTERNI NACRT”.
5. **Pisani odgovori** (`offer_response`). Mogući su samo uz odobrenu verziju i uz pisanu potvrdu, dokaz, kanal, osobu i datum.
   - Datum odgovora ne smije prethoditi odobrenju.
   - Odgovor na zastarjelu verziju čuva se, ali ne otvara predaju.
   - Vrijedi najnoviji odgovor, i preko drugih verzija: povlačenje ili odbijanje poništava stariji interes.
6. **Paket za ovlaštenu agenciju** (`agency_package`). Moguć je samo uz aktualnu odobrenu verziju i posljednji pisani interes za nju.
   - Obavezni su zasebni dokazi: ovlast/partnerstvo, dopuštenje dijeljenja i prihvaćena naknada. Naknadu plaća agencija nakon uspješne prodaje.
   - Paket je čitljiv po odjeljcima (`packageSections`) i nikad ne ulazi u prezentaciju.
   - Status: „Interni paket — nije poslan”.
7. **Poslovna faza** (`BUSINESS_PHASE`) ostaje isključena. Izrada i interno odobrenje verzija su dopušteni. Odgovori i predaja agenciji odbijaju se dok vlasnik ne uključi fazu. Ništa se nigdje ne šalje.

Pisanja jednog para serijaliziraju se: `pg_advisory_xact_lock(2261027, property)`, a za zahtjeve `2261028`. Ponovljeni zahtjevi pokriveni su postojećom tablicom `site_private.requests`. Nevaljani JSON u evidenciji se zanemaruje.

## Testovi
- `test_offer_workflow.mjs` pokreće se preko `test_pair_records.py` na izoliranoj bazi sa stvarnom shemom i `ops/pair-records.sql`. Provjereni tijekovi:
  - zahtjevi;
  - rasponi (valjani, jednaki, obrnuti);
  - nepoznat budžet i sjedište;
  - kontakti i izvori koji se ne nasljeđuju;
  - svjež pregled;
  - verzije, anonimizacija i XSS;
  - istodobna pisanja;
  - poslovna faza;
  - odgovori (pogrešna i stara verzija, prije odobrenja, povlačenje, druga verzija);
  - naknada i dokazi;
  - promjena podataka, zastarjela provjera izvora, zatvoren oglas, nevaljani JSON i očuvanje povijesti;
  - `changeOf`.
- Mutacijske provjere čuvara: izvorni profil, kontakt i najnoviji odgovor.
- `sites-review/scripts/check-offer-workflow-dom.jsx` (jsdom): klikovi na stvarnom API odgovoru iz prethodnog testa (`WORKFLOW_RESPONSE`).
- `test-platform-route.mjs` provjerava nove radnje i ispisnu rutu: prijava, samo aktualna verzija, nikad paket, CSP i `no-store`.
- Lokalno prolazi cijeli CI skup: 292 Python testa, svi node testovi i DOM provjere sa stvarnim odgovorima.

## Otvoreno
- Neovisni pregled, zatim vlasnikovo odobrenje objave. Objava uključuje:
  - deploy izmijenjenih datoteka `sites-platform` (`index.js`, `workflow.mjs`, `offer.mjs`) uz očuvan auth i `verify_jwt`;
  - prijenos `sites-review` promjena u kanonski Sites izvor.

  Ova sesija nema Sites ni Supabase alat.
- Stvaran mobilni vizualni pregled. jsdom provjerava samo ponašanje i postojanje mobilnih pravila.
- Provjera u prijavljenom vlasnikovu računu.
- Fotografije u prezentaciji: potreban je zaseban postupak provjere prava i anonimizacije.
- Uključivanje poslovne faze je vlasnikova odluka.

## Neovisni pregled 6446780533 (head `c9e2ff5`) — ispravci
1. **P1 — kronologija odgovora.** Prije je vrijedio zadnji *upisani* odgovor, pa je naknadno upisan stariji interes nadjačavao novije povlačenje.
   - Sada vrijedi `effectiveResponse` (`offer.mjs`): odlučuje dokumentirani `responded_on`, a ne redoslijed upisa, za sve verzije para. Isti izračun koriste backend i UI.
   - Za odgovore istog dana koji se razlikuju, interes vrijedi samo ako izričito zamjenjuje (`supersedes`) svaki odgovor tog dana koji nije interes. Inače je stanje nejasno i predaja nije moguća.
   - Zamijeniti se mogu samo raniji odgovori bez interesa, i to samo novim interesom.
2. **P1 — valjanost paketa.**
   - Paket ostaje nepromjenjiv povijesni zapis. Njegova valjanost (`validity`: valjan, razlozi) računa se pri svakom čitanju prema verziji, snimci podataka i dokaza te važećem odgovoru.
   - UI opozvani paket označava „OPOZVAN / ZASTARIO — NE ZA PREDAJU” i navodi razloge. Moguć je samo arhivski izvoz, s oznakom `ARHIVA — NE ZA PREDAJU`.
3. **P1 — opseg odobrenja.**
   - `fingerprint` sada obuhvaća zapise i snimku dokaza para: provjerene odgovore, zadatke, svjež rezultat i `EVAL_VERSION`. Vremenske oznake dodira i `info` bilješke nisu uključene.
   - Novi dokaz koji i dalje daje podudaranje poništava odobrenje i paket.
4. **Utrka s uređivanjem.** Pisanja tijeka ponude zaključavaju nekretninu i zahtjev s `FOR SHARE`. Istodobna izmjena se ili vidi, ili čeka. Dokaz upisan u međuvremenu mijenja fingerprint i paket postaje nevaljan pri sljedećem čitanju.

**Regresije kroz stvarni `dispatch`** (`test_offer_workflow.mjs`):
- odobrenje prije oba datuma;
- stariji interes upisan nakon novijeg povlačenja, na istoj i na drugoj verziji;
- odbijanje;
- stvarno kasniji interes;
- nejasan isti dan i izričita zamjena;
- povlačenje nakon paketa;
- dokaz B nakon dokaza A;
- istodobna izmjena tijekom pripreme paketa.

**Mutacijske provjere:** test pada za sve četiri vraćene greške (redoslijed upisa, fingerprint bez dokaza, bez `FOR SHARE`, paket uvijek valjan).

**DOM provjera** na stvarnom odgovoru pokriva:
- valjan i opozvan paket;
- arhivski izvoz;
- zamjenu odgovora istog dana.

**Stalno pravilo suradnje (PR #5, 6446389085)** još nije u `AGENTS.md`. Sigurnosna provjera ove sesije odbila je upis iz komentara, a vlasnikova izravna potvrda u Claude sesiji još nije stigla.
