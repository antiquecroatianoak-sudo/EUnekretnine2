# Source refresh continuation — 26 October 2026

Prepared on top of PR28 (deployed v15). Main is behind the deployed availability policy. Do not deploy PR26 or merge the stricter old PR27 instead.

Confirmed cause: scheduled run 40343774501 started and performed writes; it failed for registry-51 (PropertyMarket Malta) after a persistence timeout. Its database checkpoint is 2026-10-26T15:08:15.226227+00:00, 9 pages, 814 pending URLs, 221 historical failed URLs, no unavailable URLs. The timeout does not establish a lost database commit.

Changes: only current failed detail checks are processed, in one source-bound query; source failures cannot reopen removed/expired lifecycle states. Explicit Biddit/Notaires/Dutch/Lithuanian closure observations are carried to existing records. Shared connector failures include their own timestamp. Biddit revisits known listings. Checkpoints are written after lifecycle reconciliation; a lost reply can be confirmed only by exact stored state through a read-only checkpoint-status action. No schema migration, physical deletion, authentication change or new schedule.

Validation: 246 Python tests passed, 5 database-dependent tests skipped without TEST_POSTGRES_URL. Targeted Node activity/unknown-availability/recheck tests and real PostgreSQL-engine (PGlite 0.3.14) lifecycle tests passed. Baseline PR28 also has outdated integration fixtures and divergent domain copies; copies and non-database contact fixtures are aligned here. Full PostgreSQL API/DOM CI, authenticated UI, fresh real import and all-source activation remain unverified. Do not report all sources fixed or all stored listings confirmed active.

Deployment and merge must be recorded after actual confirmation. Runtime availability briefly failed, then recovered with local files intact.
