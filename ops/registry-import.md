# Registry import operations
The import reads the current Supabase source registry on every run. Candidate records are not verified buyers or active sales.

## Bounded discovery and reading
- Existing detail URLs are read before more index pages.
- Discovery follows at most five index pages per source per pass; saved queues are retained.
- Immoweb, atHome, PropertyMarket and Imot.bg can process up to 150 pages per pass, bounded by six minutes per source and fifteen minutes for the complete registry pass.
- Other sources retain a 25-page budget until validated.
- Every request respects robots exclusions, crawl delay and request-rate hints, with a minimum two-second interval.
- Authentication/rate/robots blocks get a 24-hour cooldown. These are not successful imports.
- 404/410 observations mark the source unavailable without claiming that a property was sold.
- Malformed individual listings are logged separately so they do not stop all other detail URLs.
- Queue exhaustion is distinct from complete portal coverage. The importer never claims complete portal coverage.

## Source-specific scope
Static rules restrict willhaben to real estate, and exclude agent directories and unrelated pages on other adapted portals.
A verified new agency/portal can be configured without changing Python:
store a discovery_runs row with source_id registry-config-<sources.id> and JSON body containing entry_urls, index_path_prefixes, detail_path_prefixes, sale_scope and require_structured_listing.
Use only observed entry/detail URLs and path prefixes, restricted to the registered HTTPS host. New hosts should require structured RealEstateListing/House/Apartment/Residence evidence.
Do not use a prefix covering generic editorial/category pages as a detail rule.

## Evidence and metrics
Read verification.mjs. A fetched page is not proof of ownership, legal status, current availability or a mandate.
Track source pages, detail pages, inserts and updates separately.
Existing manual review fields and first_seen are preserved. Prices not in EUR keep their native currency and advertised_price, while asking_price stays null.
Missing fields from a new fetch are recorded in not_observed_in_latest_fetch rather than silently erasing historical evidence.

## Access review, 18 October 2026
Otodom's official partner page describes CRM/API/XML publishing into Otodom. It does not establish free permission to bulk download all listings:
https://partner.otodom.pl/
Immoweb has official API documentation, but its landing page alone establishes neither free access nor a license for this project:
https://developer.immoweb.be/
No portal accounts, subscriptions, access permissions or partner agreements were created as part of these code changes.
