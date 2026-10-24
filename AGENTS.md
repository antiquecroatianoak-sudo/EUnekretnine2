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
