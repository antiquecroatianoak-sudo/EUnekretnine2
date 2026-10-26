# Source refresh continuation — 26 October 2026

Prepared on top of PR28 (deployed v15). Main is behind the deployed availability policy. Do not deploy PR26 or merge the stricter old PR27 instead.

Confirmed cause: scheduled run 40343774501 started and performed writes; it failed for registry-51 (PropertyMarket Malta) after a persistence timeout. Its database checkpoint is 2026-10-26T15:08:15.226227+00:00, 9 pages, 814 pending URLs, 221 historical failed URLs, no unavailable URLs. The timeout does not establish a lost database commit.

Changes: only current failed detail checks are processed, in one source-bound query; source failures cannot reopen removed/expired lifecycle states. Explicit Biddit/Notaires/Dutch/Lithuanian closure observations are carried to existing records. Shared connector failures include their own timestamp. Biddit revisits known listings. Checkpoints are written after lifecycle reconciliation; a lost reply can be confirmed only by exact stored state through a read-only checkpoint-status action. No schema migration, physical deletion, authentication change or new schedule.

Validation: 246 Python tests passed, 5 database-dependent tests skipped without TEST_POSTGRES_URL. Targeted Node activity/unknown-availability/recheck tests and real PostgreSQL-engine (PGlite 0.3.14) lifecycle tests passed. Baseline PR28 also has outdated integration fixtures and divergent domain copies; copies and non-database contact fixtures are aligned here. Full PostgreSQL API/DOM CI, authenticated UI, fresh real import and all-source activation remain unverified. Do not report all sources fixed or all stored listings confirmed active.

Deployment and merge must be recorded after actual confirmation. Runtime availability briefly failed, then recovered with local files intact.

## Verified continuation at 20:27 Europe/Zagreb

- PR29 merged as c6efecb9e3b58871e6d7285dbba3b62b95ecc1dc after full PostgreSQL/API/DOM CI run 40375463619 passed. Main CI 40375787527 also passed.
- Fixed the catalog's incomplete isolated schema and contact fixtures; the actual PostgreSQL catalog test traversed 10,125 properties and 10,042 investors.
- Deployed registry-discovery, discovery-sync and sites-platform v16. Retrieved bundles matched every reviewed file. sites-platform's bundle is unchanged from v15.
- Current discovery run 40375787160 started from the merge automatically. Do not replay historical run 40343774501: automatic approval rejected that replay because of repeated production side effects; the new current run makes replay unnecessary.
- That run exposed a national enrichment regression from copying the older deployed baseline. PR30 restored the exact pre-PR29 municipality-name lookup and apartment safeguard, and added the existing 13 national identity tests to PR CI. PR30 merged as 68a27bd6e15c458c094d9dffef1bd43d12b9f63f; full CI passed. registry-discovery v17 deployed and all retrieved files match. New national-enrichment job 121762457369 completed successfully on real data.
- Guetig Group and 777 Capital Partners had obsolete index-mode checkpoints after configuring reviewed acquisition profiles. PR31 sends those exact profile pages through the reviewed buyer parser. 68 registry/profile tests pass locally; full PostgreSQL/API/DOM CI passed before merge a568e6d834177fdc328e47bf87a3936f80f0e9cb. Contact permission remains false and profiles remain unverified.
- Actual database SELECT found 0 match_results and 81 investors. None of those investors has a populated contact_json; 29 have public business contacts in notes. This is a separate missing normalized/approved contact-evidence issue, not proof that their business contacts are absent. Never manufacture permitted=true or weaken the both-side contact filter to inflate matches.
- New normal import and PropertyMarket checkpoint advancement are still being observed. Sources with partial coverage are not complete catalogues.
- Authenticated browser UI was not verified: the app showed the normal ChatGPT sign-in gate. DOM CI did pass. No frontend source edit or new Sites version was needed for these backend/importer fixes.
