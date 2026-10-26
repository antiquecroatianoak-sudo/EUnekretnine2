# Active listing admission — staged implementation, not deployed

Scope: EUnekretnine2 only. User requires explicit activity verification before persistence, automatic rechecks in the existing six-hour workflow, immediate possible matching for accepted records and exclusion of invalid listings everywhere.

## Implemented in this branch

- Fail-closed activity predicate in Python, JavaScript and proposed private PostgreSQL functions. An HTTP 200, fresh download or asking price does not count as activity evidence.
- Record-bound positive source status, primary evidence URL and original check timestamp. Twenty-four-hour maximum evidence age; future timestamps, conflicting/expired deadlines and another record/source fail.
- Registry and legacy snapshot filters, manual checked import evidence, local matching filter and shared database candidate/property guards.
- Sites catalogue, source lists, pairs and initial offer payload filters; shared suggestion calculation excludes missing/stale activity evidence.
- Existing refresh schedule retained; no new account, paid API, automated email or other application change.

## Validation and deployment boundary

Python and Node regression results are recorded in the PR. SQL includes positive/negative assertions but has NOT run against staging or production: automatic approval review rejected the production migration twice.

First rejection: broad irreversible removal would delete listing, notification, activity and historical pairing data. All physical deletion was removed from this branch. Existing historical records remain; this branch does not meet the requested physical removal until a separate safe cleanup is reviewed.

Second rejection: even reversible admission triggers/functions and existing-record changes were rejected without a staged rollout and verified rollback. No migration or Edge Function deployment succeeded. `ops/active-listings-rollback.sql` is the non-destructive rollback plan; it still needs a staging rehearsal. Do not claim production enforcement or activation.

Pre-change production versions: sites-platform v13, discovery-sync v13, registry-discovery v13. Preserve deployed auth and dependencies when publishing; do not replace a live bundle blindly with older repository copies.

## Exact remaining stages

1. Rehearse SQL admission, positive/negative writes, matching and rollback on an isolated PostgreSQL copy of the current schema; verify original contact rules and manual fields.
2. Apply additive schema/functions, then admission guards; deploy the matching read filters and importer filters together. Verify the authenticated live import and read path.
3. Recheck existing listings against primary sources, separately count accepted records, and obtain explicit approval for physical cleanup that preserves business history.
4. Continue source adapters, prioritising sources with explicit primary availability/status fields. GARBE/TSC PDF work is not published by this branch.

The Globihome reply remains unsent after automatic review rejected disclosure of internal counts; this task does not retry email sending.
