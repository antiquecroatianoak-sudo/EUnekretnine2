# Reviewed buyer linkage continuation — 27 October 2026

## Verified starting state
- Fresh normal run40469716310 completed all five jobs successfully. The scan's actual snapshot response accepted490 of563 input records and recomputed90 possible pairs at2026-10-27T08:06:58.302Z. These are not490 new properties or fully verified matches.
- Direct SELECT:22080 properties,81 investors,90 possible pairs, all90 linked to buyer25. Only buyers25 and83 have usable contact routes. The active source82 still retains an older timeout record; not every source was refreshed in one bounded pass.
- Deployed functions remain sites-platform18, discovery-sync18, registry-discovery19, with retrieved files matching the approved deployment. The public-repository identity fix is working on real requests.

## Defect and repair
- The strict reviewed profile parser validated named identity, explicit acquisition wording, contact observation, types and demand countries, but emitted transaction_type=unconfirmed_acquisition_profile. The live sync_source_listing function refuses that kind before linking it to investors, even when a buyer with the same source URL already exists.
- Emit buy_request only from this strict configured parser. The listing_kind stays public_acquisition_profile, imported records stay unverified, and a merely public email remains unapproved. Unreviewed generic company/profile observations retain their existing exclusion. No matching, contact, legal, lifecycle, auth or schema guard is relaxed.
- Preserve reviewed additional requirements through the already-supported required_criteria field. A field can have several independently observed excerpts on the same page; every excerpt must still be present. This avoids inventing one contiguous quote for country-specific links. Tests cover missing evidence, malformed/empty/oversized lists and1/10 excerpt bounds.
- The isolated PostgreSQL fixture now consumes actual Python profile output and asserts successful unverified buyer linkage, source-demand countries, preserved profile kind, no inferred contact permission and continued refusal of a generic unreviewed profile.

## C&P source94
- Reviewed the actual HTML page https://www.cp-ag.at/en/contact/project-purchase/ including company identity, purchase categories, AT/DE purchase departments, the Croatia vacation profile link, its offer invitation and observed ankauf@cp-ag.at mailto link.
- Prepared a strictly bound profile mapping with country-specific requirements left open for review. Existing investor75 has the same source URL but blank demand countries and no contact. Normal sync must reuse that source-linked entity and retain its manual fields; no duplicate or automatic verification is intended.
- Inserted registry-config-94 only when that exact source is inactive and no config exists. The source remains inactive pending actual batch and fresh normal-process write confirmation. Do not claim activation from a successful local parse alone.
- Inspected the linked official Croatia PDF both as extracted text and a rendered page: https://www.cp-ag.at/en/wp-content/uploads/sites/6/2021/11/Acquisitionprofile_Vacation_Properties_Croatia.pdf . Its2000m² threshold is achievable net usable project area, not parcel area. Croatia covers vacation developments/complexes in established coastal locations, with specific zoning and documentation requirements. Do not encode2000 as min_area for the parcel, infer planning permission, or treat every general C&P asset category as automatically acceptable in Croatia. These document-specific requirements must be retained in manual/source review before any pair becomes verified.

## Remaining release checks
Run full hosted PR CI before merge. Then inspect the real profile-import job, exact candidate/investor linkage, contact evidence, inherited requirements and idempotence. Activate source94 only after both normal batch writes are confirmed. Check a real matching refresh and state the measured pair count separately from fully verified matches and buyer interest. No emails are sent and no physical deletion is authorized by this patch.
