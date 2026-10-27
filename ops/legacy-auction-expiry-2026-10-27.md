# Legacy auction visibility — 27 October 2026

Direct read-only checks found two legacy/manual auction rows with elapsed auction_at, NULL available_until/bid_deadline_at and no source_candidates link (IDs12 and25). The current SQL catalogue predicate could retain them, although JavaScript matching already refuses elapsed auctions. A third standalone expired auction also has available_until and is already excluded.

Add the existing auction_at timestamp to PROPERTY_ACTIVE in all three identical policy copies. Expired or equal-now auctions are excluded from catalogue, operational counts, pair reads and normal refresh regardless of an old active label. Future and unknown dates stay governed by the existing other checks; a future auction never overrides an elapsed bidding deadline. No source status, availability proof, schema, auth, schedule or physical record changes.

The real catalogue SQL regression includes a source-less legacy record with past, equal-now, future and NULL auction dates and conflicting bid deadline. The existing traversal beyond10000 properties/buyers still passes. Node unknown-availability and policy checks also pass. Run full hosted CI before deployment and record retrieved-bundle verification and read-only production counts after deployment. Do not physically delete historical property records.
