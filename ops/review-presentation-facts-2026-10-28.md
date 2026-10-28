# Neovisni pregled anonimnog izvoza facts-v1

Provjera: 28.10.2026. 15:15 Europe/Zagreb. #48 head13a37f504d948107eb7bc5c81fdb80bafe412381; isti filter potvrđen u #55/53745aaa1f84199057c34c1e0ca30a315e125a5a.

## P2: budući observed_on još ulazi u anonimnu prezentaciju
`offer.mjs`/`factsSummary(p,now)` filtrira status i valid_until, ali ne observed_on. Spremljeni (legacy) podatak s budućim opažanjem je čitljiv radi očuvanja povijesti, pa novi strogi validator unosa ne štiti ovaj izvoz.

Izvršena čista funkcijska reprodukcija:
- `p.facts_json = JSON.stringify({rooms:{value:43,unit:'kom',origin:'izvor',status:'potvrđeno',evidence:'TEST ONLY',observed_on:'2099-01-01'}})`
- `factsSummary(p,Date.parse('2026-10-28T12:00:00Z'))`
- Dobiveno `["Smještajni kapacitet: 40 – 50 soba"]`.

`presentation()` poziva ovaj helper; `presentationHtml()` ispisuje činjenice pod naslovom „Dodatna obilježja (potvrđeni podaci)”. Evaluator sada ispravno otvara future podatak kad je tražen uvjet, ali neovisna sektorska činjenica i dalje može ući u prezentaciju, čak ako kupac taj uvjet nije zatražio.

Popravak: koristiti istu semantiku datuma/aktualnosti kao facts usporedba; future/unconfirmed/conflict/expired podatak ne smije u potvrđeni anonimni sadržaj. Očuvati izvorni zapis i povijest. Regresije: prošli/današnji/budući datum, valid_until, factsSummary i stvarni presentation→HTML put te kopija sites-review/lib/offer.mjs. Nije izvršena DB ili mobilna provjera ovog nalaza.
