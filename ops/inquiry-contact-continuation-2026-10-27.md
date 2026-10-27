# Record-bound inquiry continuation

The owner withdrew the active Claude assignment in issue #1 comment 6435872570;
ChatGPT owns this coding continuation. Do not restart the withdrawn assignment.

The main defect is lost evidence, not an email/phone formatting failure:
Emporia's detail forms carry hidden listing URL/title fields, but the importer
did not produce source_contact. The new parser requires those fields and the
form action to match the exact canonical listing. Generic and related forms,
cross-origin actions and missing submit controls do not count.

Scoped inquiry evidence now survives contactInput normalization in all domain
copies. Existing permissions and manual contacts are preserved. A reviewed
acquisition-profile invitation can establish only property_enquiry_only;
ordinary public addresses remain unapproved. Partnership, reuse rights, fees,
specific buyer interest and legal/activity verification remain separate.

Land records now carry their primary plot-size table into advertised_area;
buildings retain building area. Conflicting source measurements remain unknown.

Operator tools prepare evidence without changing the database. The compare-and-
set backfill helper fills only absent contacts with exact references. The fixed
Emporia transport supports a proxy environment while retaining robots checks,
one shared rate limit and a fixed public origin/path allowlist. Collection is
checkpointed and does not activate a source or create a schedule.

Validation: Python regression suite passed with database-dependent cases
explicitly skipped where TEST_POSTGRES_URL was unavailable. Node/domain,
contact hydration/backfill, batch persistence, lifecycle, catalog, source sync
and DOM checks passed. A separate PostgreSQL-engine rehearsal used the current
exported table definitions and live sync_source_listing/contact_usable functions;
property import, contact validation, plot area and transaction rollback passed.

GitHub Actions currently fails before assigning a runner. The user's GitHub
notification confirms included Actions minutes exhausted and reset on November 1.
Do not claim the scheduled importer has recovered, replay old production jobs,
change billing/repository visibility, or treat this as a parser failure.

No schema migration, physical deletion, auth/RLS change or other application
change is part of this repair. Confirmed closures remain excluded by the existing
activity policy; unknown availability remains explicitly unconfirmed.
