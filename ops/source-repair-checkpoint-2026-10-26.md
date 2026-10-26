# EU source import and export checkpoint — 26 October 2026

Work is confined to antiquecroatianoak-sudo/EUnekretnine2. No changes to the grocery or construction applications.

## Confirmed changes

- PR15: response-local JSON-LD agency references and primary source details.
- PR16/18/20: bounded read-only source evidence, removal of navigation/service traps, Stoja's actual detail routes; Stoja details returned HTTP403 and remain inactive.
- PR17: recheck known shared-source records; retain explicit 404/410 removal evidence and distinguish denial/changed format.
- PR19/21/23: reviewed 777 Capital Partners and Guetig hotel mappings, direct/agency contact provenance, independent trials within the existing schedule, and actual fresh normal-parser writes.
- PR22: server-confirmed unknown-buyer-seat NOT NULL defect fixed. registry-discovery v13 keeps unknown seat empty and demand geography independent. Existing buyer IDs80 and83 and their candidate identities were retained.
- PR24: Bulgarian single-price English sale HTML adapter. Development price ranges and unsupported formats remain deferred; VAT basis and area conflicts retained.
- PR25: actual normal shared-collector write is required before a property trial can support activation. No cursor mutation or source activation by the trial.

## Source activation evidence

Guetig107 and 777110 are enabled after real trial and normal refresh job121461296028 (run40289606803). Both were updates, not new buyers. Contacts do not imply partnership, data-use permission, a mandate, or specific purchase interest.

Bulgarian68 first trial job121463860499 (run40290407267) inserted candidate registry:property:7a6fa1a87f6ca248c18d6d36402bc930 linked to property20075. Automatic review rejected activation at that point because normal refresh had not yet been proved. PR25 real server job121467433484 (run40291512156) subsequently confirmed normal_refresh_confirmed=true, refresh_pages=3, refresh_inserted=0 and refresh_updated=1. SQL independently confirmed the same candidate/property20075 refreshed at2026-10-26T08:20:46.140541+00:00. The source was activated only after this new evidence, and the previously rejected threshold was satisfied. Initial scope is supported single-price English Bulgaria sale details; no full catalogue coverage claim.

## Authorised export/feed access

No new supplier replies or access approvals were found on26 October. Globihome's existing thread has a technical capability statement and the owner's sent follow-ups, but no authorised outbound endpoint, credentials, documented export contract, sample or agreed price. Funda/Immoweb receipts are acknowledgements. Idealista, Kyero, Properstar, Green-Acres, Bulgarian Properties and Stoja requests are already sent; do not duplicate them without a new reason.

The application's current CSV button explicitly exports loaded property records. No specific CSV failure has been supplied or reproduced in this task; do not claim it was fixed. Provider outbound feeds and application CSV export are distinct.

## Remaining inventory

Final inventory snapshot:115 registered sources,52 enabled and63 inactive after activation of sources68,107,110. Enabled flags are not record verification. The remaining inactive inventory groups are31 authorisation/access denials,30 format/primary-evidence gaps, and2 PDF profiles. Recompute after any activation.

| ID | Source | Remaining requirement |
|---|---|---|
| 1 | SodneDrazbe.si | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 4 | Nexity – javno objavljeni kriteriji kupnje zemljišta | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 5 | Urbatys – vendre votre terrain | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 9 | Državne nekretnine – natječaj K-4/26 | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 10 | Ministerio de Hacienda – Subasta Noviembre 2026 (Granada) | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 13 | FINA Očevidnik nekretnina i pokretnina | format_or_primary_evidence_required: Registry homepage has no supported details; existing legacy FINA CSV remains separate, avoid duplicate import. |
| 27 | Biddit — belgijski javni bilježnici | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 30 | Ingatlan | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 31 | Etuovi | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 32 | KV.ee | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 33 | ImmobilienScout24 | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 34 | Idealista | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 35 | Bazaraki | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 36 | Boligsiden | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 38 | Hemnet | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 40 | Nepremicnine.net | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 41 | PAP | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 43 | Imot.bg | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 44 | Sreality | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 45 | Njuškalo | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 46 | Imobiliare.ro | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 47 | Idealista Portugal | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 48 | Spitogatos | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 49 | Immobiliare.it | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 50 | Funda | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 52 | Aruodas | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 55 | City24 Latvia | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 56 | Nepremicnine.net — javni oglasi kupnje zemljišta | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 57 | Immotop.lu | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 59 | XE.gr | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 66 | RE/MAX Austria | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 69 | FOX Realty | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 70 | M&M Reality | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 71 | VON POLL Immobilien | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 72 | EDC | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 73 | Uus Maa | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 74 | Tecnocasa España | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 75 | Kiinteistömaailma | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 76 | Orpi | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 77 | Grekodom | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 78 | Opereta | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 79 | Duna House | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 80 | Sherry FitzGerald | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 81 | Tecnocasa Italia | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 83 | INOWAI | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 85 | Frank Salt | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 86 | Brockhoff | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 87 | Metrohouse | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 88 | RE/MAX Portugal | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 89 | RE/MAX Romania | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 90 | Fastighetsbyrån | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 91 | Stoja | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 92 | RE/MAX Slovakia | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 93 | VGP – javni kriteriji kupnje zemljišta u Europi | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 94 | C&P Immobilien – kupnja zemljišta i objekata za razvoj | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 95 | PEVEX – javna kupnja građevinskog zemljišta | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 97 | Gobidreal – dražbe nekretnina | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 98 | Immo Notaires Enchères – javnobilježničke dražbe | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 99 | Licitor – sudske dražbe nekretnina | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |
| 108 | GARBE Industrial | pdf_adapter_required: Review dated acquisition criteria, country scope and record-bound contact from the PDF. |
| 109 | TSC Real Estate Germany GmbH | pdf_adapter_required: Review dated acquisition criteria, country scope and record-bound contact from the PDF. |
| 112 | Norauto Italia S.p.A. | authorised_access_required: Obtain an authorised outbound feed or explicit supported access; no bypass. |
| 114 | Invest in Italy Real Estate — ICE | format_or_primary_evidence_required: Validate individual primary records, country, price semantics and record-bound contact before batch/refresh/activation. |

Existing six-hour schedules remain. No additional schedule, paid access, credentials, bulk messaging or source-access bypass was introduced.

Published through PR15–25. Main code CI and relevant PR checks passed; PR25 local regression run:169 tests, plus the separate Node unknown-country regression. Existing long scans can be queued/cancelled by GitHub concurrency while independent import jobs complete; a cancelled aggregate run is not proof a source batch failed. Check per-job outcomes and database evidence.
