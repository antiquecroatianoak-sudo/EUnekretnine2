# Project coding rules

## Obvezne provjere pri svakom budućem kodiranju

- Prije izmjene potvrditi poslovna pravila i povezane vrijednosti; promjena minimuma zahtijeva provjeru maksimuma i obratno.
- Za povezane granice odvojeno testirati valjan raspon, jednaku granicu, obrnut raspon i nedostajuće/nevaljane podatke gdje su primjenjivi.
- Testni primjeri moraju biti međusobno dosljedni osim kad izričito provjeravaju nevaljane ulaze.
- Popravak ne smije oslabiti zaštitu samo da test prođe. Provjeriti očuvanje ručnih dopuna i postojeće funkcionalnosti.
- Prije spajanja ili objave pokrenuti relevantne regresijske provjere; neuspjele i nepokrenute provjere jasno navesti. Ne tvrditi da grešaka nikada neće biti.
- Napredak spremati u GitHub nakon svake smislene cjeline, s provjerenim stanjem i preostalim zadacima.
