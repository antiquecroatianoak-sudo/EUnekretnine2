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
