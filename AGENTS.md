# Kontinuitet projekta EUnekretnine2

## Nastavak rada i kontinuitet — uputa vlasnika 28.10.2026.

- Na početku nastavka pročitaj `PROJECT_STATE.md`, ovaj `AGENTS.md` i dokumente na koje zapis upućuje. Kod korisnikova pozivanja na ranije odluke pretraži dostupne prethodne razgovore; nedostupnu povijest ne rekonstruiraj nagađanjem.
- Potvrdi identitet repozitorija, ciljnu granu i aplikaciju. Provjeri trenutačni remote, otvorene PR-ove, CI na točnom commitu i objavljenu verziju kroz odgovarajući servis. Lokalni checkout, stara poruka i spojeni PR sami ne dokazuju objavu.
- Prije izmjene napiši kratak radni plan s ciljem, ovisnostima, sljedećim korakom i kriterijem dovršenosti. Provjeri posljedice kroz cijeli tijek rada opisan u zapisu. To je operativni plan i provjera, ne zahtjev za zapisivanjem privatnog razmišljanja.
- Razlikuj dogovoreno, planirano, implementirano, testirano, spojeno i objavljeno. Test veži uz commit i rezultat; objavu uz verziju i potvrdu servisa. Nepokrenute, preskočene i nepotpune provjere ostaju vidljive.
- Nakon smislene cjeline i prije završetka razgovora ažuriraj `PROJECT_STATE.md`: nove odluke, dokaze, otvoreno, zapreke, sljedeći konkretni korak i njegov uvjet dovršenosti. U svaki zapis stavi vrijeme provjere Europe/Zagreb. Povijesne zapise ne briši i ne proglašavaj aktualnima.
- Kad se sjećanje, dokument i stvarno stanje razlikuju, sačuvaj trag razlike i potvrdi aktualno stanje iz primarnog sustava. Novija izričita odluka vlasnika nadomješta staru; tehničko stanje potvrđuju repo, testovi i objava.
- Nastavljaj već odobrene, sigurne i reverzibilne korake bez ponavljanja pitanja. Prijašnje odobrenje bilježi samo s potvrđenim opsegom; novu odluku traži samo kad je potrebna. Ne kontaktiraj osobe, ne uključuj troškove ili javni pristup na temelju ove upute.
- Predviđaj sljedeću ovisnost i provjeravaj rubne slučajeve. Pretpostavku označi kao pretpostavku; ne predstavljaj je kao korisnikovu odluku ili potvrđen rezultat.
- Odvajaj projektne podatke, ključeve, baze, repozitorije, objave i zadatke. Zajedničku tehniku prenesi tek nakon zasebne provjere i u opsegu naloga; nikad ne kopiraj poslovne podatke druge aplikacije.
- Ove datoteke su trajne projektne upute i provjerljivi zapisi. Nisu jamstvo automatskog učitavanja u svaki novi ChatGPT razgovor, savršenog pamćenja ili pozadinskog rada. Ako nastavak nema pristup repozitoriju, jasno navedi što ne možeš provjeriti.

# Project coding rules

## Obvezne provjere pri svakom budućem kodiranju

- Prije izmjene potvrditi poslovna pravila i povezane vrijednosti; promjena minimuma zahtijeva provjeru maksimuma i obratno.
- Za povezane granice odvojeno testirati valjan raspon, jednaku granicu, obrnut raspon i nedostajuće/nevaljane podatke gdje su primjenjivi.
- Testni primjeri moraju biti međusobno dosljedni osim kad izričito provjeravaju nevaljane ulaze.
- Popravak ne smije oslabiti zaštitu samo da test prođe. Provjeriti očuvanje ručnih dopuna i postojeće funkcionalnosti.
- Prije spajanja ili objave pokrenuti relevantne regresijske provjere; neuspjele i nepokrenute provjere jasno navesti. Ne tvrditi da grešaka nikada neće biti.
- Napredak spremati u GitHub nakon svake smislene cjeline, s provjerenim stanjem i preostalim zadacima.

## Prioritet prikupljanja podataka — uputa vlasnika 24.10.2026.

- Kontinuirano ažurirati i širiti obje baze: nekretnine te investitore i kupce. Veći prioritet istraživanja novih izvora i uvoza dati kupcima i njihovoj konkretnoj potražnji, jer su ti podaci u deficitu.
- Sam naziv investitora ili profil tvrtke nije dovoljan: tražiti javno objavljene kriterije kupnje i sačuvati izvor, datum provjere i izvorni navod/natuknice.
- Prikupljati vrstu i oblik nekretnine, stanje (uključujući obnovu/rušenje), veličinu ili raspon površine, tražene države/regije/lokacije, dodatne uvjete te budžet ako je objavljen. Nepoznate podatke ostaviti nepoznatima za ručnu dopunu; ne izmišljati kriterije ni interes.
- Zemlja sjedišta kupca nije zemlja potražnje. Uparivati zemlju nekretnine s državama potražnje navedenima u izvoru; kupac iz bilo koje zemlje može tražiti u drugoj zemlji. Ako država potražnje nije poznata, označiti je za dopunu bez pretpostavljanja interesa.
- Budžet ostaje neobvezan i informativan prema postojećem pravilu; ne uvoditi isključenje parova zbog nepoznatog ili premašenog budžeta.
- Nastaviti otkrivati i provjeravati nove izvore za obje skupine; broj izvora ili naziva tvrtki ne prikazivati kao broj potvrđenih potražnji. Zasebno pratiti potencijalne kontakte, dokumentiranu potražnju i popunjenost kriterija.

## Automatsko širenje izvora — 24.10.2026.

- Vlasnik traži da se pronalaženje novih izvora i širenje baza odrađuje automatski u pozadini, bez ručnih ponovljenih naloga. To nije samo osvježavanje već poznatih izvora.
- Postojeći GitHub discovery radi svakih 6 sati. Dodatni uključeni pozadinski istraživački zadatak „Širenje izvora i kupaca” zakazan je svakih 6 sati, s prioritetom dokumentirane potražnje i kriterija kupaca te održavanjem obiju baza. Ne duplicirati postojeći masovni uvoz niti mijenjati njegove tekuće checkpointove.
- Istraživački napredak nastavlja se iz discovery_runs pod research-source-expansion:v1. Registrirati provjerljive nove izvore, spremati konkretne zahtjeve i kriterije bez duplikata i čuvati ručne dopune. Nepodržani parseri ostaju točno evidentirani za prilagodbu, ne predstavljati ih kao aktivan uvoz.
- Rutinski rezultati ostaju u aplikaciji; korisniku javiti prepreku koja zahtijeva njegovu radnju. Stvaranje i uključenje zadatka nisu dokaz uspješnog prvog prolaza: potvrditi upise u checkpointu i bazama prije tvrdnje o rezultatu. Nema automatskog kontaktiranja ljudi, novih računa, kupnje pristupa ni proširenja ovlasti.

## Dopuna iz nacionalnih evidencija — uputa vlasnika 25.10.2026.

- Podatke o nekretnini dopunjavati redoslijedom: izvorni oglas i njegova dokumentacija, zatim odgovarajuće službene nacionalne/lokalne evidencije; kontaktiranje prodavatelja e-mailom krajnja je mogućnost samo za preostale nedostatke. Prije slanja pripremiti konkretna nedostajuća polja i evidenciju prethodnih provjera. Ova uputa ne znači automatsko masovno slanje poruka.
- Obvezan je izbor evidencije prema potvrđenoj DRŽAVI NEKRETNINE, nikad prema sjedištu kupca, agencije, jeziku oglasa ili državi portala. Hrvatsku nekretninu dopunjavati samo iz nadležnih hrvatskih evidencija; isti princip vrijedi za svaku državu EU.
- Broj čestice/ID nije globalno jedinstven. Identitet mora uključivati ISO državu, vrstu i izdavatelja identifikatora te potrebne lokalne oznake (npr. katastarska općina, sekcija, podbroj ili jedinica). Broj oglasa nije katastarski identifikator. Čuvati izvorni zapis, vodeće nule i podbrojeve.
- Automatska dopuna samo nakon jednoznačnog podudaranja nekretnine. Nepoznata/proturječna država ili lokalna oznaka, više mogućih čestica ili nejasna veza zgrade/stana s česticom znači zaustaviti spajanje i označiti potrebu dopune; ne pokušavati isti broj u drugim državama. Više čestica ili posebnih dijelova ne svoditi na jedan proizvoljni zapis.
- Po svakom dopunjenom polju sačuvati službeni izvor, identifikator, vrijeme dohvata i datum važenja dokumenta/podatka kad postoji. Razlikovati navod oglasa, katastarski podatak, zemljišnoknjižni upis, prostorni plan i ručnu provjeru. Ne prepisivati izvorni navod ili ručnu dopunu; proturječja ostaju vidljiva.
- Automatski osvježavati samo putem stvarno dostupnih i dopuštenih servisa, uz ograničenja izvora i postojeći raspored kada je primjenjivo. Ne zaobilaziti prijavu, CAPTCHA ili blokade, ne kupovati izvatke niti prihvaćati ugovore bez odgovarajućeg odobrenja.
- Katastarska površina nije automatski korisna površina stana; katastarska uporaba nije potvrda građevinske namjene, dozvola ili vlasništva. Pravni status ne proglašavati urednim zato što je dohvat uspio. Prodajna cijena i aktivnost oglasa ne proizlaze iz povijesnog registra.
- Za kupce službene poslovne evidencije mogu dopuniti identitet tvrtke, ali ne dokazuju potražnju, budžet ni interes za konkretnu kupnju.
- Za budući kod obvezne regresije: isti broj čestice u različitim državama i općinama ne smije se spojiti; nepoznata država, pogrešan identifikator, više rezultata i proturječni dokazi moraju zaustaviti automatsku dopunu; čuvati ručna polja i trag izvora.

## Obvezan upotrebljiv kontakt — uputa vlasnika 25.10.2026.

- Za svaki budući izvor tražiti podatke o nekretninama i potencijalnim kupcima/investitorima s upotrebljivim, dopuštenim načinom kontaktiranja relevantne strane.
- Nekretnina mora imati kontakt vlasnika, prodavatelja ili ovlaštenog zastupnika koji postupa za tu konkretnu nekretninu. Kupac/investitor mora imati vlastiti kontakt ili ovlašten kanal koji omogućuje obraćanje toj konkretnoj osobi/tvrtki. E-mail, telefon ili stvarno dostupan obrazac/platformski kanal prihvatljivi su samo ako su povezani s relevantnom stranom; opća poveznica portala nije kontakt.
- Bez takvog kontakta zapis nije korisna ponuda odnosno kontaktabilan potencijalni kupac i ne smije biti uključen u operativne ponude, valjane parove ni brojeve korisnih zapisa. Anonimni kriteriji, naziv tvrtke ili oglas bez načina obraćanja nisu dovoljni. Ne prikupljati takve zapise kao krajnji rezultat; eventualni privremeni trag služi samo pronalaženju nedostajućeg kontakta.
- Za valjan operativni par potreban je upotrebljiv kontakt OBIJU strana, uz postojeće kriterije i provjere. Postojanje kontakta nije potvrda interesa, aktualnosti oglasa ili pravne urednosti. Ne izmišljati kontakt niti pretpostavljati dopuštenje samo zato što je javno objavljen.
- Za postojeće zapise najprije provjeriti i dopuniti kontakt gdje je dopušteno; bez kontakta ih isključiti iz korisnih rezultata. Ova uputa sama ne nalaže nepovratno brisanje baze ili povijesti.
- Ovo pravilo navoditi u budućim zahtjevima za API/feed i pri pregledu izvora. Poslovni tijek ostaje: generička ponuda bez adrese i kontakta prodavatelja, pisani interes kupca, zatim predaja licenciranoj agenciji koja vodi posredovanje; strane ne povezujemo izravno.
- Status provedbe: ovom izmjenom spremljena je obvezna projektna uputa; programska primjena filtra i provjera postojećih zapisa moraju se zasebno implementirati i potvrditi prije tvrdnje da je pravilo aktivno u aplikaciji.

## Dopuna kontakta preko agencije — uputa vlasnika 25.10.2026.

- Pravilo kontakta primjenjuje se jednako na SVE izvore i obje strane: nekretnine/prodavatelje te kupce/investitore.
- Ako izravni kontakt nije dostupan, prihvatljiv je upotrebljiv kontakt agencije iz čijeg je izvora konkretan zapis preuzet, uz dokaz da agencija objavljuje ili zastupa tu konkretnu nekretninu odnosno tu konkretnu potražnju kupca/investitora. Sam opći kontakt portala, agencije ili tvrtke bez veze s konkretnim zapisom nije dovoljan.
- Takav zapis ostaje prihvatljiv za moguće parove s oznakom 'Kontakt preko agencije'. Kada postoji odgovarajući mogući par, rješenje se može ponuditi agenciji za njezina kupca ili prodavatelja; nedostatak izravnog kontakta nije razlog isključenja ako postoji ovaj dokazani kanal.
- Za svaku stranu zasebno zabilježiti izravni ili agencijski kanal, identitet zastupane strane/oglasa, izvor veze s agencijom i način kontaktiranja. Ne pretpostavljati da agencija zastupa kupca zato što samo oglašava nekretnine.
- Ova dopuna ne uključuje automatsko slanje poruka, ne potvrđuje mandat, interes ili pravnu urednost i ne mijenja predaju posredovanja licenciranoj agenciji.
- Programsku provjeru izravnog/agencijskog kanala i označavanje prikaza treba implementirati i testirati; spremljena uputa nije potvrda produkcijske primjene.

## Zahtjevi agencijama za pristup i suradnju — pojašnjenje vlasnika 25.10.2026.

- Buduće zahtjeve prilagoditi primatelju: agenciji za nekretnine ili agenciji s bazom investitora. Tražimo ažurirane ponude/potražnje i kriterije, uz mogućnost da agenciji ponudimo odgovarajuće rješenje za konkretan zapis.
- Izravni osobni kontakti kupca/investitora ili vlasnika/prodavatelja NISU potrebni kada izvorna agencija omogućuje kontakt i obrađuje prijedlog za tu konkretnu zastupanu stranu. Ne uvjetovati suradnju otkrivanjem klijentskih kontakata i ne tražiti nepotrebne osobne podatke.
- Kontakt agencije vrijedi simetrično za obje skupine izvora i obje strane para, uz utvrđenu vezu agencije s konkretnom nekretninom ili potražnjom investitora. Moguće su kombinacije izravno/izravno, izravno/agencija, agencija/izravno i agencija/agencija. Bez izravnog ili relevantnog agencijskog kanala zapis nije operativno koristan.
- Predložena jezgra budućih zahtjeva (prilagoditi stvarnoj ponudi agencije): 'Zainteresirani smo za odobren pristup ponudama nekretnina i/ili kriterijima potencijalnih kupaca i investitora koje zastupate. Nije potrebno otkrivati njihove izravne kontakte ako vam možemo dostaviti prijedlog za konkretnu nekretninu ili potražnju, a vi ga proslijediti svom klijentu i voditi daljnji postupak. Molimo potvrdite takav kanal suradnje, dopuštenu uporabu podataka, način ažuriranja i uvjete pristupa.'
- Ovo je predložak za buduće pojedinačne zahtjeve, nije nalog za automatsko slanje niti tvrdnja da je agencija već pristala na suradnju.

## Evidencija po izvornim agencijama — uputa vlasnika 25.10.2026.

- Sve nekretnine i sve kupce/investitore preuzete sa stranica agencija voditi pod njihovom izvornom agencijom. Agencija je dovoljan operativni kontakt za svoj konkretan zapis; ne pokušavati pribavljati izravne kontakte njezinih klijenata.
- Ne poistovjećivati zastupnika s pravnim vlasnikom. Agencija je prodajni kontakt/zastupnik i vodi daljnji postupak sa svojim klijentom. Izvorni oglas ili potražnja ostaju vezani uz agenciju jasnom referencom.
- Grupiranje koristiti za obje baze i buduće uvoze. Izvorne veze određuju agenciju; javni portal, sjedište ili sličan naziv sami ne uspostavljaju zastupanje. Način obraćanja agenciji mora biti upotrebljiv; ne izmišljati e-mail/telefon niti potvrdu pristupa API-ju.
- U uvodu budućih mailova agencijama objasniti obostranu korist: nudimo agenciji nekretninu za njezina kupca/investitora ili potencijalnog kupca/investitora za nekretninu koju zastupa; agencija ostaje kontakt i vodi postupak. Zatraženi pristup podacima služi tom uparivanju, bez zahtjeva za otkrivanjem izravnih klijentskih kontakata.

## Partnerski model i naknada — mjerodavna uputa vlasnika 26.10.2026.

- Agencije koje izričito e-poštom pristanu na suradnju i dostavu podataka voditi kao partnere za potvrđeni opseg suradnje. Sačuvati referencu potvrde, datum, dopuštena polja/uporabu i uvjete. Automatska potvrda primitka e-maila nije pristanak.
- Usluga je ponuditi agenciji rješenje njezine konkretne potražnje: investitora za nekretninu koju zastupa ili odgovarajuću nekretninu za njezina investitora. Izravni kontakti njezinih klijenata nisu potrebni ako agencija omogućuje upotrebljiv kanal vezan uz konkretan zapis, na obje strane podudaranja.
- Agencija je zastupnik i operativni kontakt, ne pretpostavljeni pravni vlasnik. Ona vodi daljnju komunikaciju, posredovanje i prodaju. Naknadu tražimo OD AGENCIJE, prema unaprijed dogovorenim uvjetima i tek nakon uspješno dovršene prodaje; ranije pretpostavke o naplati kupcu nisu mjerodavne.
- Potvrda partnerstva, dopuštenje uporabe podataka, tehnička aktivacija uvoza, aktualnost konkretnog oglasa, dokumentirana potražnja, pisani interes i prihvaćen dogovor o proviziji zasebne su činjenice. Ne izvoditi jednu iz druge niti jamčiti točnost svih zapisa samo na temelju partnerskog statusa.
- Predložak zahtjeva je u `ops/agency-partner-request.md`. Prilagoditi ga stvarnoj ponudi agencije; postojanje predloška ne znači slanje ili pristanak primatelja.
- Vlasnik je 26.10.2026. zbog Claudeova limita izričito predao trenutačno kodiranje ChatGPT-u. Nastaviti iz aktualnog maina u zasebnoj grani uz relevantne testove. Ne slati iste naloge Claudeu niti pokretati dvostruki rad. Ova uputa nadomješta raniji način predaje kodiranja Claudeu za ovaj nastavak.


## OBVEZNO: samo odmah provjereni aktivni oglasi — uputa vlasnika 26.10.2026.

- Svaki oglas provjeriti prije trajnog upisa. Nepotvrđeni oglasi ne smiju se trajno spremati ni kao kandidati; dohvat i provjera smiju koristiti samo privremenu obradu.
- Prihvaćanje zahtijeva svjež dokaz aktivnosti konkretnog izvornog oglasa/odobrenog feeda, vezan uz njegov identitet, URL i vrijeme provjere. HTTP 200, datum dohvata, prisutnost cijene ili oglas na kategorijskoj stranici sami nisu potvrda aktivnosti. Nepoznat ili proturječan status znači odbiti upis.
- Prihvaćen aktivan oglas odmah uključiti u mogućnost uparivanja, uz ostala postojeća pravila o kontaktima i kriterijima. Aktivnost ne dokazuje pravnu urednost ili interes kupca.
- Potvrđeno prodane, povučene, neaktivne i istekle oglase odbiti prije upisa, a postojeće ukloniti iz baza oglasa/kandidata te iz parova, ponuda, brojila, obavijesti i izvoza. Ne održavati paralelnu bazu takvih oglasa; minimalan tehnički trag odbijanja može sadržavati identifikator/hash, razlog i vrijeme, bez kopije oglasa.
- Provjeru automatizirati u svim putovima uvoza i ponavljati u postojećem rasporedu. Istek dokumentiranog roka odmah isključuje oglas; ne čekati sljedeći dohvat. Zastarjela/neuspjela ponovna provjera ne produljuje potvrdu aktivnosti.
- Provjeriti i postojeće zapise. Dok nema svježeg pozitivnog dokaza, ne prikazivati ih kao aktivne niti uključivati u uparivanje. Ne mijenjati nepovezane ručne podatke ili druge aplikacije.
- Obvezne regresije: aktivan, nepoznat, prodan/povučen, istekao, proturječan, budući datum provjere, zastarjela potvrda, ponovno otvoren oglas i pokušaj zaobilaženja drugim uvoznikom. Dokumentirana uputa nije potvrda da je programska provedba već objavljena.


## Izmjena dostupnosti — najnovija uputa vlasnika 26.10.2026.

- Ova uputa zamjenjuje raniji strogi zahtjev pozitivne potvrde aktivnosti za svaki upis/prikaz. Nedostatak podatka ili neuspjela provjera dostupnosti sami nisu razlog za odbijanje, uklanjanje ili isključenje iz mogućih parova.
- Nepoznatu dostupnost zadržati uz oznaku 'Dostupnost nije potvrđena' i nastaviti automatske provjere. Ne prikazivati je kao potvrđeno aktivnu.
- Potvrđeno prodane, povučene, neaktivne i istekle oglase i dalje odbijati/isključivati. Dokumentirani istek roka ima prednost pred oznakom aktivan.
- Kontakti, kriteriji, pravni status, ovlasti i uvjeti za stvarnu priliku ostaju zasebne provjere. Ova promjena ne dopušta izmišljanje dostupnosti ni dokaza.
