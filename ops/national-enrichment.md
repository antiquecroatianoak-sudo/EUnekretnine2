# National record enrichment — 2026-10-25

The existing discovery workflow now has an independent `national-enrichment` job, using the unchanged six-hour schedule and existing repository-scoped OIDC authentication. It processes at most 100 existing property candidates per country per pass. Country cursors and outcomes live in `discovery_runs` under `enrichment:automatic:v1:<ISO>`. Large country collections take several passes; this is not a claim that every property refreshes every six hours.

New and existing candidates are included by country and cursor. A cycle restarts after exhaustion. Supplementary observations are stored under `facts.registry_enrichment.automatic`; original source facts, reviewed status, first_seen and property/investor links are not replaced. Conflicting field observations remain separate. Standalone property records without source candidates have gap evidence under `enrichment:property:v1:<id>`; an actual evidence storage adapter is still needed for those records.

All EU27 countries are in scope. A country without an enabled and verified adapter records its missing prerequisites; it does not obtain facts by trying another country's service. Missing parcel identifiers are actual gaps, not successful registry enrichments. No seller messages, account creation, payment or legal clearance occurs.

## Enabled adapters

- NL: Kadaster/PDOK cadastral parcel Features API; public, no authentication or fee, CC BY 4.0. Source documentation: https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1?f=html&lang=en . Daily source updates. Require municipality code (or exact cadastral municipality name), section and parcel number. Compare full returned identity, current status, unique result and pagination. Cadastral parcel area remains distinct from dwelling area. The indicative geometry is not a survey.
- FR: IGN API Carto cadastre PCI: https://apicarto.ign.fr/api/doc/cadastre . API retains source licences: https://apicarto.ign.fr/api/doc/ . DGFiP cadastral open data licence: https://www.data.gouv.fr/datasets/cadastre . Require INSEE municipality code, absorbed-commune prefix, section and parcel number. Preserve zeroes. No owner data is requested or inferred. Technical endpoint returned HTTP 200 in live test; no existing French candidate has yet been matched to a parcel.

HR: the official anonymous WFS described at https://geoportal.dgu.hr/cms/podaci-i-servisi/ returned HTTP 404 for both DescribeFeatureType and GetCapabilities on 2026-10-25. The public OSS UI successfully verified Rakitje 325139 parcel 491/1. This does not prove unattended WFS or land-register integration. HR adapter remains blocked pending a working officially documented service.

Poland ULDK documentation (https://uldk.gugik.gov.pl/opis.html), Spanish nonprotected cadastral web services (https://www.catastro.hacienda.gob.es/ayuda/servicios_web.htm), and Slovenian cadastral open data (https://podatki.gov.si/dataset/kataster-nepremicnin) are the next identified official routes. They have not been implemented or labelled active. Other EU services still require country-specific discovery and access/licence checks.

## Identity input contract

`facts.registry_identity` must have `country_iso`, `issuer`, `identifier_type: cadastral_parcel`, `source_url` for the actual original identifier evidence, and complete local identity. NL uses `issuer: Kadaster`, `municipality_code`, `section`, `parcel`. FR uses `issuer: DGFiP`, `municipality_code`, `prefix`, `section`, `parcel`. The property's country must agree with the candidate's actual country. Agency/portal country and listing IDs are not sufficient evidence. Unit identifiers require a separately verified unit-to-parcel relation.

Do not fabricate this structure from the portal country or an approximate map point. Research must read original listing documents, resolve identifiers, and preserve the source and read time before enabling an exact lookup.

## Preservation and verification

The legacy `discovery-sync` upsert previously replaced `body_json` wholesale. `snapshot-merge.mjs` now reads and locks existing rows before refreshing and preserves the independent national evidence, review status and first_seen. New enrichment batches lock current rows and compare the source snapshot before writing. Changed rows are deferred. Writes are read back within the same transaction; failure rolls back the batch. Existing OIDC authorization remains unchanged; unauthenticated requests were verified to return 401.

Tests: `node --test test_national_enrichment.mjs`. Covers cross-country and municipality collisions, missing/full IDs, leading zeroes, units, ambiguous/empty/historical responses, provenance, outages, conflicts without choosing a winner, and preservation across the subsequent listing import. Python driver uses fresh short-lived OIDC tokens and logs country outcome totals without tokens or private feeds.
