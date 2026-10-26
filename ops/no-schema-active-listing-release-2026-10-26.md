# No-schema active-listing filter

Scope: three existing Edge Functions, preserving their current v13 bundles, custom authentication, contacts and agency grouping. No database migration, trigger change, physical listing deletion or history deletion.

Before-write filters cover registry-discovery, discovery-sync and Sites save/prepare. Read filters cover catalogue, source listings, possible pairs, offers and notifications. Explicit record-bound active evidence expires after 24 hours; positive primary feed status is required, not a fetch timestamp alone. Legacy Notaires/Biddit source-status evidence retains its ORIGINAL last_seen timestamp. User manual source checks are explicitly recorded in the existing activity table, not fabricated by ordinary saves.

Validation before attempted deployment: JS policy tests and all three entrypoint syntax checks pass. Seven read-only PostgreSQL fixtures pass (active, unknown, removed, wrong record, wrong source, future proof, expired deadline). Actual read-only count: 17 active properties and 17 active property candidates among 20,717 stored properties. SQL was exercised without mutation. No claim of production deployment until confirmed by the deploy result; authenticated user UI verification remains separate.

Physical cleanup remains deferred after automatic review rejected destructive/history-wide cleanup and broad schema rollout. Do not execute the draft PR26 migration by another channel. Claude follow-up: issue1 comment6417376263. A separate hourly check starts26 October21:00 Europe/Zagreb for24 checks. No guarantee Claude is available then.

Rollback: redeploy the exact original v13 bundles captured before this change; no schema or data restoration is needed because this release does not delete them.

## Confirmed production publication

All three functions successfully deployed as ACTIVE v14: sites-platform, registry-discovery and discovery-sync. Downloaded deployed bundles match every planned file exactly. Unauthenticated POSTs to all three returned HTTP401 after deployment. The custom authentication identity and claims checks were preserved.

Independent post-deploy SELECT:17 activity-eligible properties;20,717 property rows,81 investors and117 activity records preserved. No schema migration, physical deletion or history cleanup was executed. These counts are not evidence of legal clearance, contact permission or buyer interest.

Authenticated user UI and a fresh normal-ingestion positive/negative server batch were not exercised in this session; do not describe them as end-to-end verified. Code is preserved in draft PR27 (head before this checkpoint8c002167afa063b6c69f655bb809ae1ed41208e4); it is not merged into main. Legacy integration fixtures still need alignment with the new fail-closed behavior before merging. Draft PR26 remains unapplied and must not be deployed as a substitute for this narrower release.
