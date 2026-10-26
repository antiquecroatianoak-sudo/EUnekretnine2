# Retain unknown availability

Owner changed the rule on 26 October: missing availability must not exclude a listing. Unknown and stale proof remain unconfirmed, while explicit closure and elapsed documented deadlines exclude the listing. Applies to API catalogues, counts, suggestions, manual saves, registry batch and snapshot sync. Confirmed-active labels still require the previous exact-source, fresh evidence. Both import paths record confirmed closures against an existing listing instead of relabelling them unknown. No schema migration, physical deletion, auth or RLS change.

Validation: strict evidence tests, new unknown/closure/deadline tests, entrypoint syntax checks passed. Read-only production predicate returned 20,589 retained properties (not 20,589 confirmed-active offers). Publication status is recorded separately after deployment. No full authenticated UI/positive ingestion or all-source live validation claimed. Rollback is prior v14 function bundles stored before publication; no database rollback needed.

## Confirmed publication

All three functions are ACTIVE v15; downloaded files exactly match commit b26a380c41892f7077034860fc7286deccd55e92. Unauthenticated POST returned 401 for sites-platform, registry-discovery and discovery-sync. Postdeployment read-only query: 20,589 properties pass the retained-availability predicate; stored matching rows remain 0. Deployment changes eligibility, does not itself create matching results. Draft PR #28 records the deployed code; not merged into main. Full signed-in UI/new ingestion remains unverified.
