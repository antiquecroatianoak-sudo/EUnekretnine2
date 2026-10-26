# Contact continuation — 26 October 2026

## Confirmed release
- PR33 merged as e14841201c894112efdcd856558f8dde408d45a8 after full PostgreSQL/API/DOM CI40381302220 passed.
- sites-platform and discovery-sync v17 deployed. Retrieved files matched every reviewed file; existing auth and verify_jwt settings were preserved.
- hydrate-contacts.mjs fills missing contact_json from the newest exact record-bound source contact, or a buyer's own legacy official_url/business contact. It preserves permission flags, manual contacts and record references. A missing source_url is added only from that buyer's own recorded official_url. It runs before both normal refresh entrypoints.
- Actual normalized counts after the one-time execution:142 properties and30 investors have contact_json; usable inquiry channels:2 properties and1 investor. These are not partner counts.
- Public contact details alone retain permitted=false. Reviewed exact invitations were separately recorded for Kubikon's own development page and Emporia listings L586/L275, with quotes, source URLs, timestamps and property_enquiry_only scope. No partnership, feed/republication permission, fee agreement or specific interest is asserted. No messages were sent.
- The reviewed data patch is ops/reviewed-contact-enquiries-2026-10-26.sql. Its isolated PostgreSQL fixture passed and rerunning it was idempotent.
- Corrected L275's200 EUR/m² to465800 EUR total for2329m², and filled the two missing plot areas from their exact pages. No legal or active status was set.

## Actual matching result
- Read all currently contact-usable records:2 properties and1 investor. Evaluated them with the deployed canonical suggestion() implementation.
- Stored both candidates under the existing transaction lock and database contact/lifecycle/verification guards. The write required unchanged matching facts and exact buyer data. A concurrent importer advanced only properties.updated, so the initial strict full-row comparison correctly wrote nothing; the next comparison excluded only this non-matching metadata timestamp.
- SELECT confirmed match_results pairs(16579,25) and(16581,25), each Kandidat - potrebna provjera.
- **2 possible pairs;0 fully verified criteria matches.** These are not confirmed interest or completed transactions. Availability, legal status, development suitability and remaining buyer conditions still require evidence. Kubikon's precise geographic scope remains unconfirmed; existing stored HR criteria are not proof of that scope.
- Do not report all contacts, sources or listings as approved or active. Other collected contacts remain unapproved.
- discovery.yml push path filters do not start a new scan merely for Edge refresh-module edits. Keep its existing six-hour schedule and current checkpoints; no historical job was replayed and no extra schedule was created.
- Authenticated UI was not verified in this continuation. The API/DOM CI passed; pair rows and deployed bundles were verified directly.
