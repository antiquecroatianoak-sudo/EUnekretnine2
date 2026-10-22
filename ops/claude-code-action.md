# Prijedlog: Claude na izričit zadatak vlasnika (claude-code-action)

Zahtjev vlasnika 6344603119. Ovo je **prijedlog za pregled, ne radni tijek**. Datoteka `ops/claude-code-action.yml` stoji izvan `.github/workflows`, pa je GitHub ne pokreće ni nakon spajanja.

## Što bi radio nakon aktivacije
- **Okidač:** samo komentar vlasnika (`antiquecroatianoak-sudo`, `OWNER`, korisnik, ne bot) koji izričito sadrži `@claude`, na issueu ili PR-u.
- **Bez petlji:**
  - nema `schedule`, `push` ni `workflow_run` okidača;
  - komentari i commitovi samog Claudea ne zadovoljavaju uvjet, jer nisu vlasnikovi.
- **Bez spajanja i objave:**
  - zabranjeni su `gh pr merge`, `gh api`, `curl`, prisilni push i push na `main`;
  - nema pristupa Supabase tajnama, bazi ni webu.
  - Rezultat je grana s commitom i odgovor u komentaru. Spajanje ostaje vlasniku ili neovisnom pregledu.
- **Bez autorizacije se ništa ne pokreće:** posao se završava napomenom „nije postavljen”.

## Autorizacija: što stvarno postoji
- Službena akcija prihvaća `claude_code_oauth_token` (pretplata Pro/Max) ili API ključ.
  - API ključ znači dodatno plaćanje, koje vlasnik ne odobrava. Zato prijedlog koristi samo `CLAUDE_CODE_OAUTH_TOKEN`.
- **Token se izdaje u Claude Code CLI-ju** naredbom `claude setup-token`, uz prijavu vlasnika.
  - Ta prijava ide u vlasnikovu terminalu ili pregledniku, izvan ove sesije.
  - Vlasnik zatim sam dodaje tajnu: GitHub → Settings → Secrets and variables → Actions → `CLAUDE_CODE_OAUTH_TOKEN`.
  - Uz to treba instalirati Claude GitHub App na ovaj repozitorij.
- **U ovoj sesiji ne postoji podržan jednokratni korak kojim bih to dovršio.** Ova sesija:
  - ne može izdati token, jer to zahtijeva vlasnikovu prijavu;
  - nema alat za postavljanje tajni repozitorija;
  - ne smije tražiti ni ispisivati tajne u komentarima.
  - Ranije neuspjele prijave preko terminala i mobitela ne ponavljam.
- **Dok vlasnik sam ne postavi token, prijedlog nije funkcionalan.** Ne treba ga predstavljati drukčije.

## Prije aktivacije (vlasnik)
1. Pregledati `ops/claude-code-action.yml`, zamijeniti `@v1` punim SHA-om provjerenog izdanja i premjestiti datoteku u `.github/workflows/claude.yml`.
2. Zaštititi `main`: obvezan PR i pregled, bez izravnog pusha. To je stvarna zaštita od spajanja, uz zabrane u alatu.
3. Postaviti tajnu i aplikaciju kako je opisano gore. Ništa od toga ne radi ova grana.
