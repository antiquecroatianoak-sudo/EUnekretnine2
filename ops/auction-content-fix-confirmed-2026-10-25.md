# Auction request representation fix — confirmed 25 October 2026

PR12 merged as1409624c9ba8ceb70451d0ee22bbe7cb23f92858. The common fetcher previously requested HTML from JSON APIs. It now requests JSON for the two existing public API path families, XML for sitemap files and text/plain for robots.txt. HTML pages retain the previous representation. No source identity, SSRF, redirect, robots, rate or access restriction was weakened.

86 local regression checks and PR CI passed. Notaires JSON returned HTTP200 with12 records using the existing bot identity. Production workflow40233339398, property-groups job121289576897 completed successfully. SQL confirmed all12 existing registry-28 candidates refreshed by the server at2026-10-25T21:00:06.532278+00:00, with their record-bound contact evidence retained. Source28 was then reactivated. This is one page/sample, not full portal coverage or legal verification. Normal scheduled registry imports resume with the previously fixed checkpoint contract.

AXIORA source113 remains active; its previous normal import was confirmed successful with0 inserted/1 updated and no error at2026-10-25T20:42:59.805324+00:00. Existing URL-bound candidate and investor86 were retained, with no duplicate buyer.

Biddit public robots, XML sitemap and JSON lot API were reachable in an additional read-only protocol check, but source27 has NOT been activated: an available response alone does not prove a current usable lot or complete record-bound contact. Continue its bounded supported parser trial separately if allowed. Do not treat this as resolution of all remaining agency layouts or access-denied sources. Keep recorded cooldowns and permissions.

Authoritative progress: research-auction-content-negotiation:v1 and research-source-activation:28-113 in discovery_runs; source28 and113 is_active=true. Existing scheduled scans continue; do not add duplicate schedules or overwrite live registry cursors.
