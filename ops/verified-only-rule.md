# Permanent project rule

Only verified, current property offers and verified, documented buyer/investor mandates belong in main application lists and automatic matching. Candidates and public investor profiles without a documented mandate remain separate. A suggested pair does not establish interest in that particular property. Listing verification is not legal due diligence.

The database functions in ops/verification-policy.sql are shared by Sites reads, refreshes and the database write guard. Source candidate automatic draft promotion is disabled. Existing draft records and candidate links are retained; filtered main lists must not count them as verified. Prior ineligible match rows were archived in site_private.excluded_match_history.

Current freshness limits: property source check 30 days, buyer mandate check 90 days. Missing evidence fails closed. No missing budgets, activity, condition, legal clearance or availability may be invented.

2026-10-18 audit: 1,983 source candidates; 1,514 raw property rows; 69 raw investor rows. Zero rows currently satisfy the complete eligibility checks. All 69 investor rows lack usable numeric maximum budgets, and 1,503 property rows lack structured property types. Automated discovery is not a complete verification pipeline. Do not report the full system as operational until real source-backed records have been verified, promoted and matched end to end.
