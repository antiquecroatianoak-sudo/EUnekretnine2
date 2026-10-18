# Funkcioniranje aplikacije

Ovo je trajni dokument o funkcioniranju aplikacije. Zajedno ga nadopunjavamo kako razvijamo aplikaciju, prema izričitim dogovorenim uputama korisnika. Postojeća pravila ostaju važeća dok ih korisnik ne promijeni; nove dopune bilježimo u isti dokument. Dokument opisuje ponašanje aplikacije i rad s podacima, a ne vizualni izgled. Dogovorene zahtjeve uvijek razlikovati od stvarno implementiranih i provjerenih mogućnosti.

## 1. Popunjavanje i automatsko ažuriranje baza — 18.10.2026.

Dogovoreno i potvrđeno 18.10.2026.: baza nekretnina popunjava se konkretnim prodajnim oglasima iz svih država članica EU; baza kupaca konkretnim oglasima potražnje sa službenih oglasnih platformi svih država članica EU. Sve baze automatski se ažuriraju dodavanjem novih, osvježavanjem postojećih i uklanjanjem isteklih ili izbrisanih oglasa s izvora. Ovo je prva stavka trajnog dokumenta; daljnje funkcije dodavat ćemo tijekom razvoja.

Izričita uputa korisnika Luke, 18.10.2026. u 20:05 Europe/Zagreb. Ova uputa određuje način popunjavanja baza i ima prednost pred ranijim proturječnim operativnim napomenama.

1. Baza nekretnina popunjava se konkretnim oglasima prodaje nekretnina iz internetskih izvora u svim državama članicama Europske unije.
2. Baza kupaca popunjava se konkretnim oglasima potražnje za nekretninama sa službenih platformi za oglašavanje kupaca/potražnje u svim državama članicama EU. Sam javni profil tvrtke, imenik investitora ili kategorija portala nije oglas potražnje.
3. Sve baze ažuriraju se automatski. Ažuriranje uključuje unos novih pronađenih oglasa, osvježavanje postojećih podataka i uklanjanje iz aktivnih baza oglasa koji su istekli ili su obrisani s izvornog oglasnika.
4. Privremena nedostupnost izvora ili neuspjeli dohvat nisu dokaz da je oglas obrisan. Uklanjanje mora imati dokaz isteka ili uklanjanja izvornog oglasa; takav oglas ne ostaje u aktivnoj ponudi/potražnji niti u aktivnim podudaranjima. Eventualna interna evidencija uklanjanja nije aktivan oglas.
5. Svaki zapis treba biti vezan uz konkretni izvorni oglas, URL/identifikator i datum provjere; spriječiti duplikate. Nepoznate podatke ne izmišljati. Nedostatak nekog polja ne smije ponovno uzrokovati skrivanje svih stvarnih oglasa iz baza.
6. Trenutni prioritet je ispravno automatsko popunjavanje i ažuriranje baza. Stara arhivirana uparivanja ne vraćati: korisnik je izričito rekao da će se uparivanja ponovno računati. Zaštite uparivanja ne uklanjati na temelju ove napomene.

Status: ovo je trajno spremljena korisnikova specifikacija, a ne potvrda da su svi dijelovi automatizacije već implementirani ili aktivni. Svaku tvrdnju o automatskom radu provjeriti prema stvarnom rasporedu, izvršenjima i upisima. Pri nastavku najprije pročitati ovu datoteku i ops/display-rollback-2026-10-18.md. Ne ponavljati skrivanje svih zapisa primjenom dodatnih uvjeta izvan ove specifikacije.


## Provedba prve stavke — 18.10.2026.

Primijenjeno u bazi i objavljenim servisima: odvojeni unos konkretnih prodajnih oglasa i oglasa potražnje; deduplikacija i ažuriranje podataka izvora uz očuvanje ručnih izmjena; uklanjanje iz aktivnog pregleda po dokumentiranom isteku, HTTP 410 ili ponovljenom HTTP 404 s razmakom od najmanje 24 sata; privremene 401/403/429 pogreške ne uklanjaju oglase. Profil investitora bez konkretnog oglasa potražnje ne promiče se novim unosom kao kupac. Zaštite uparivanja ostaju uključene.

Prilagođen je periodični dohvat tako da ponovno posjećuje i ranije spremljene pojedinačne oglase, uz nastavak pronalaženja novih. Raspored u repozitoriju ostaje svakih šest sati. Dodane su provjere koje prolaze: 31 Python test i transakcijske SQL provjere unosa, duplikata, vrste izvora, 403, 404, 410 i zaštite uparivanja. Obrađeno je 1.805 postojećih kandidata/veza; to nije broj novih oglasa. Provjeren aktivni pregled nakon primjene: 1.513 nekretnina i 69 zapisa kupaca/investitora; te brojke ne znače da su zapisi svi potvrđeni za uparivanje.

Preostala provjera: stvarno završeno periodično izvršavanje s novim kodom. Posljednja provjera GitHub izvršavanja još nije vratila ciklus za novi commit; zato ne tvrditi da novi ciklus već radi ili da su sve države/oglasnici pokriveni funkcionalnim adapterima. Podržani dostupni izvori obrađuju se automatski, a blokirani/nepodržani ostaju posebno evidentirani. Vizualni prikaz u pregledniku nije provjeren u ovom koraku.
