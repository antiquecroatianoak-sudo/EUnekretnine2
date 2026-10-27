# Public repository importer release — 27 October 2026

- Owner confirmed the switch to public. GitHub metadata confirms visibility=public and runner allocation recovered.
- PR34 merged as5874b658e474d25dc6a31b6acbb29b7d38f13f08 after full hosted PostgreSQL/API/DOM CI40467934488 passed.
- Resolved PR35 merged asc57d9a0a397127c15989a4e9fb451f559f2014e8 after full CI40468692553 passed. Land area/decimal/unit-price corrections retain the listing-bound inquiry repair.
- The first fresh discovery40468408911 ran but authenticated operations failed. The endpoints still required repository_visibility=private. PR36 changes only that expected value to public and retains immutable owner/repository IDs, exact subject/ref/workflow, issuer/audience/signature, supported events and token-age checks. Full CI40468889539 and merged-main CI40469070569 passed. Merged as4f85bc680f6859de88795b0d5ffa7578e1927850.
- Automatic approval rejected the initial production replacement for missing explicit approval. The owner then explicitly approved deployment in this conversation. No rejection was bypassed.
- Successfully deployed sites-platform18, discovery-sync18 and registry-discovery19. All retrieved files are byte-for-byte identical to each prepared deployment. Existing verify_jwt=false and in-function identity checks are preserved. All other live files were retained; domain metadata changes come from mergedPR34, and only the expected public-visibility literal changed in the two importer entrypoints. No migration, billing change or new schedule.
- Direct SELECT before the fresh import confirmed90 possible pairs, all Kandidat - potrebna provjera; not verified interests.115 registry sources,52 enabled and63 disabled. An enabled flag is not proof of a successful current import. Disabled access/robots/unsupported-adapter sources must not be bulk enabled.

## Fresh-run verification

The discovery push-path filter now includes both importer entrypoints and their identity regression, and the normal scan runs that regression before external operations. This is required to verify importer identity changes against current main; the existing six-hour schedule/concurrency/checkpoints are retained. Merge starts a fresh normal run; do not replay historical failed production runs. Record actual authorization, persistence, checkpoint and matching outcomes after that run. No successful end-to-end production refresh or all-source activation is claimed by this checkpoint.
