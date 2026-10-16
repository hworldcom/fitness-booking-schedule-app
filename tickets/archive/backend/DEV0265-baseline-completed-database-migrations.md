# Ticket DEV0265: Baseline completed database migrations

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Database maintenance before new hosted dev/UAT setup
- Coordination: [COR0025 — Migration baseline and seed cleanup](../organisatory/COR0025-migration-baseline-and-seed-cleanup.md)
- Related records: seed peer [DEV0249](DEV0249-repair-legacy-seed-location-compatibility.md); external retained-local continuity [DEV0232](../../current/organisatory/DEV0232-restore-local-migration-continuity.md); historical hosted setup [DEV0055](../../current/backend/DEV0055-hosted-supabase-staging-environment.md); independent completed calendar backend [DEV0252](DEV0252-persist-effective-coach-availability.md).

## Objective and context

Replace replay of 53 completed migration files with an equivalent final-state baseline for new databases, while preserving the original SQL and its review trail. The user authorized baseline/seed cleanup on 16 October 2026 before new Supabase setup. Follow the [database authority contract](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries), [identity/data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [security invariants](../../../docs/mvp-spec.md#10-security-and-failure-invariants).

## Scope and non-goals

- In scope: a baseline through `20261016000100`, an immutable byte-for-byte archive with checksums, required role/extension/storage bootstrap, repeatable generation/equivalence checks, affected test/path/link and database contributor/setup documentation, and a truthful existing-environment transition handoff.
- Out of scope: changing/deleting existing tables or user rows, legacy product pruning, DEV0249's seed repair, active calendar SQL, remote provisioning/migrations, Auth changes, copying accounts/files, resolving DEV0232 branch-only provenance, deployment and commits.

## Expected behavior and edge cases

A fresh Supabase-compatible database obtains the same app objects, owners, RLS, function/table/schema grants, default privileges, project Storage policies and bucket configuration as the completed history. The baseline is for an empty application schema and must fail visibly against an existing schema. The repaired full seed remains separate from required bootstrap data. Excluded legacy tables remain compatibility history without adding runtime access.

Use the completed cutoff version for the baseline, preserving forward calendar version ordering. Archive originals outside the active `migrations/` scan; every archived byte and checksum must match the committed source. Repair repository references to those files in the same change. Existing databases with old history entries keep their data/ledgers unchanged and require a deliberate transition before the CLI can consume the new stream; document recovery from the archive/previous revision and do not falsely claim DEV0232 is resolved.

## Assumptions, decisions, and dependencies

Adopted technical choice: generate from a clean replay of committed sources rather than the shared local database, which contains branch-specific history and is behind the group cutoff. Use schema-only PostgreSQL output for app objects, explicitly retain project Storage policies/bucket rows, extension/role bootstrap and default privileges. Compare independent legacy-replay and baseline databases. Current Supabase CLI 2.120.0 docs confirm squash omits DML; its local help attempt also requires writable telemetry outside the sandbox. Generation need not invoke a remote/linked squash command.

This is one delivery boundary: a baseline cannot ship separately from its archive, bootstrap and fresh/legacy instructions. DEV0249 owns seed semantics as a peer. This scoped authorization permits archive-and-baseline restructuring, preserving applied originals; it does not permit silently rewriting original migration contents or existing ledgers. Update the database guide's blanket preservation wording to explain this specific transition. No unresolved product behavior is added.

## Implementation plan

1. Preserve a committed-source snapshot and fix the cutoff/manifest before implementation. Review app and external-schema dependencies and all migration-path consumers.
2. Replay the 53 original migrations in transactions in a disposable database over Supabase infrastructure. Generate a deterministic baseline containing final app schema plus explicit required bootstrap/policies; retain original files in an immutable archive.
3. Compare app schema, external project policies, roles/grants/default privileges and bootstrap rows against an independent fresh baseline restore; run the repaired complete seed and database/permission regressions.
4. Repair affected test/link paths and contributor/setup guidance. State legacy-ledger/data/hosted settings boundaries and preserve the active calendar migration byte-for-byte.
5. Run relevant checks, finish evidence and archive only after all acceptance criteria pass. Never reset the existing local stack or modify a hosted environment.

## Acceptance criteria

- [x] AC1: The active completed migration stream is one baseline; all 53 originals are preserved with verified checksums, ordered cutoff metadata and repaired links; the active calendar SQL is unchanged.
- [x] AC2: Fresh baseline and original replay produce equivalent schema/owners/constraints/functions/RLS/grants/default privileges/project Storage policies and required bucket/extension setup.
- [x] AC3: Complete fresh and repeated seed plus meaningful database regressions pass; the baseline fails on an existing app schema and existing accounts/data/ledgers remain untouched.
- [x] AC4: Reproducible generation/verification and clear fresh-versus-existing setup/rollback guidance are documented; applicable formatting/static/document checks pass with accurate limitations.

## Validation plan

Use distinct disposable original-replay and baseline databases, catalog/schema and policy/ACL comparisons, full seed (no filtered statements), repeated-seed preservation proof from DEV0249, pgTAP and restricted-runtime driver tests at the completed code revision. Test refusal against an existing schema without changing retained rows. Verify archive hashes and forward version order. Run relevant unit/lint/type/format checks; no interface/browser or production build behavior changes are planned, so document why a build/viewport check is inapplicable if no runtime modules change. Verify shared-stack identity/schema/ledger state read-only before/after and remove only owned scratch artifacts.

## Implementation record

Implemented on 2026-10-16 after source/consumer review and the recorded plan. The reference is committed revision `3890d243225badb5f0de91a8a654429b72915a03`; the shared local database was not used as the application's schema authority.

### Changes and rationale

New databases apply one final-state baseline through `20261016000100` instead of replaying 53 historical migrations. The originals remain byte-for-byte in an archive outside the CLI's active migration scan, with source revision and individual SHA-256 hashes. The independent `20261016000200` calendar migration stays a separate forward file; this ticket did not edit its SQL.

The baseline comes from a clean original-history replay. It preserves the app schema, comments, constraints, functions, owners, row-level security (RLS), explicit/default grants and nine project Storage policies. Explicit application role/extension bootstrap and both avatar/portrait bucket configuration rows close the gaps in a schema-only export. It refuses any pre-existing `app` schema before bootstrap. Demo fixture rows remain exclusively in the separate seed.

Two local helpers make the proof reproducible. One verifies archive/baseline checksums, generates deterministically and compares independent schemas/security/setup. The other copies only managed schema infrastructure into disposable databases, replays originals versus the baseline as the same migration owner, runs the complete seed, verifies refusal/preservation and deliberately injects CHECK and function-grant drift to prove the comparison rejects both. No existing application/account/file rows are copied.

### Affected files

- [Baseline SQL](../../../supabase/migrations/20261016000100_baseline.sql) is the new active completed-history migration, including required external bootstrap.
- [Original archive and manifest](../../../supabase/migration-history/20261016000100/manifest.json) preserve all 53 committed SQL files and the generated checksum. [History navigation](../../../supabase/migration-history/README.md) explains immutability and cutoff.
- [Generation/comparison helper](../../../scripts/database-baseline.mjs) owns deterministic export, membership/hash verification and schema/security equivalence. [Isolated rehearsal](../../../scripts/rehearse-database-baseline.mjs) owns disposable setup, complete-seed proof, drift/refusal checks and cleanup.
- [Private-message tests](../../../tests/database/private-messages.test.ts) read four historical fallback migrations from their archive paths. Twenty-six historical ticket records have migration links repaired; their completed implementation evidence is retained.
- [Database operations](../../../supabase/README.md#migration-baseline-and-history), [root navigation](../../../README.md), [specification preservation note](../../../docs/mvp-spec.md#1-product-status-and-document-authority), the ticket index and COR0025 explain fresh/retained setup and delivery boundaries. Seed behavior/test changes belong to peer DEV0249.

### Decisions and deviations

2026-10-16: Fixed the completed cutoff separately from active DEV0252. Preserve existing schemas/history and original migration bytes. Generation uses clean committed replay and explicit bootstrap instead of the drifted shared database.

2026-10-16 equivalence refinement before changing the comparer: PostgreSQL 17 reparses nested associative Boolean `CHECK` expressions into flattened conjunctions on schema restore. Raw dump text therefore differs despite unchanged enforcement. Keep every other dumped schema/owner/ACL definition exact after object-order normalization; compare CHECK definitions separately after PostgreSQL parses them into temporary empty LIKE tables inside rolled-back transactions, including original validation/inheritance/deferral flags. Do not erase parentheses or ignore constraints. This avoids treating parser normalization as schema drift while retaining meaningful security/schema comparison.

2026-10-16 metadata refinement: the first restored baseline passed all 115 drivers but pgTAP found three missing table authority comments because the initial export used `--no-comments`. Preserve all app database comments in both generation and equivalence comparison; retain the existing pgTAP assertions. This closes a metadata omission rather than changing scheduling behavior.

Rehearsal roles are explicit: copied managed Supabase infrastructure restores as `supabase_admin`, while archived app migrations and the baseline execute as the documented `postgres` migration owner. A first all-admin rehearsal correctly exposed four historical functions whose implicit owner follows the executor; rerun with the same owner on both sides rather than ignoring ownership differences.

2026-10-16 integration refinement: the independent calendar owner completed/archived DEV0252 during this run. Keep the frozen 53-file cutoff and the separate `20261016000200` forward file unchanged. After frozen-baseline proof, additionally apply that completed forward migration and the complete seed in the owned fresh database and run current database checks. Record this as compatibility evidence, not calendar implementation under this ticket. A transient concurrent document move resolved with the latest specification and calendar ticket back at their proper paths; preserve their contents in link checks.

### Contracts, configuration, and operations

Migration **packaging** changes: new installations record the baseline version plus later forward migrations, while retained databases still have their old version lists. Applying this repository layout to an old CLI ledger may report missing local versions; do not run the baseline over existing schema or silently repair that ledger. DEV0232 remains open for retained local branch-specific continuity. The operations guide documents keeping the prior revision/archive during transition review and requiring schema/history comparison and restorable data/file backup before a separate ledger/import change.

No product API, retained schema behavior, package, environment variable or runtime login contract changes. The helpers require installed dependencies, Docker and the documented local database port/container; overrides and exact commands are in the operations guide. They accept named `dev0265_*` disposable databases, not remote database URLs. Schema infrastructure restores as `supabase_admin`; app migrations execute as `postgres`. The baseline's final SHA-256 is `e54fdfedbd429309cc08463f6ee37bb0bc01a671e304d91068a3fb8254392709`.

Repository rollback before any environment transition restores the prior file layout with no retained-data undo. A new database already using the baseline should receive forward corrections. No remote migration, user/password/file transfer, SMTP/provider/redirect change, shared reset/seed or ledger mutation occurred.

## Validation results

PostgreSQL 17.11 and installed Supabase CLI 2.120.0 were used. Frozen-cutoff suites ran in an isolated `git archive` checkout of the source revision plus this baseline/seed work, with installed dependencies linked; concurrent calendar/interface edits were excluded from that proof.

| Criterion | Command or proof                                                                                                                                                                                                  | Result                                                                                                                                                                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1       | `node scripts/database-baseline.mjs verify`; independently hash each archived file and compare with `git show <manifest.sourceRevision>:supabase/migrations/<file>`                                               | All 53 original bytes/hashes and baseline checksum match; one active baseline at the cutoff, later calendar file separate.                                                                                                                                                 |
| AC2–AC3   | `BASELINE_KEEP_DATABASES=1 node scripts/rehearse-database-baseline.mjs`                                                                                                                                           | Original replay and baseline restore plus full unfiltered seed passed. 855 definition blocks, parsed CHECKs/enforcement flags, comments/owners/ACLs/default privileges, nine Storage policies, two bucket configurations, application roles and required extensions match. |
| AC2–AC3   | Inject altered profile CHECK, restore; grant group publication to browser role, restore                                                                                                                           | Both drifts detected; restored candidates compare equal. Existing-schema baseline attempt rejected with unchanged profile-row hash.                                                                                                                                        |
| AC3       | `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/*.test.ts` at frozen cutoff                | 115/115 passed, including full repeated-seed ordinary/claimed-account preservation.                                                                                                                                                                                        |
| AC2–AC3   | `./node_modules/.bin/supabase test db --db-url postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh` then `supabase db lint --db-url <same-loopback-url> --schema app --fail-on warning` at frozen cutoff | 225/225 assertions across 13 files; no schema errors/warnings.                                                                                                                                                                                                             |
| AC4       | Regenerate independently from `dev0265_replay`, then `verify` and compare SHA-256 with the prior artifact                                                                                                         | Byte-identical final baseline; originals unmodified.                                                                                                                                                                                                                       |
| AC4       | `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check` in the isolated completed-source checkout                                                                                                 | 155 application + 16 server tests passed; lint, types and formatting passed.                                                                                                                                                                                               |

The initial metadata omission caused three pgTAP failures, resolved by retaining database comments. The first all-admin infrastructure/app rehearsal exposed owner differences, resolved by explicit matching migration owners. The CHECK parser refinement and DEV0249's failing preservation rehearsal are documented above/in the peer; final checks retain those assertions. No failure was waived or existing constraint weakened.

Forward compatibility after the independent DEV0252 completion: applied `20261016000200_effective_coach_availability.sql` and the complete seed to owned `dev0265_fresh` using `docker exec -i supabase_db_fitness-booking-social-app psql -X -U postgres -d dev0265_fresh -v ON_ERROR_STOP=1 --single-transaction < <file>`. The same driver command against current source passed **124/124**, current pgTAP passed **239/239 across 14 files**, and current SQL lint reported no errors/warnings. The operations guide includes these forward-migration steps before the current full-suite commands. This proves compatibility without absorbing calendar scope into the baseline.

Read-only before/after snapshots of the shared `postgres` database match: PostgreSQL 17.11, the same 54 ordered migration versions, 13 Auth users and 2 Storage objects. No shared application/identity/file rows or ledger entries were written; all fixture/schema testing used owned scratch databases. PostgreSQL roles are cluster-scoped: the app-role bootstrap is preserved from the original foundation and existing restricted attributes are checked; this rehearsal does not claim a separate fresh-cluster role provisioning or hosted rollout.

Final handoff checks passed: 605 local file/anchor links across 34 affected documents, unique ticket IDs/index/archive status, reciprocal COR membership, all 53 original Git-byte/hash comparisons, active migration ordering, focused Prettier across 38 affected files and `git diff --check`. The calendar forward SQL matches its independent committed revision. Disposable database cleanup is recorded in completion below. No viewport or production build was run: owned changes affect SQL packaging, seed/test support and documentation, with no app runtime/UI module or bundler integration edits. Installed CLI help was inspected; generic squash/push/reset was not executed against a linked or retained environment.

## Risks, limitations, and follow-ups

The baseline is verified against local Supabase PostgreSQL infrastructure; a new hosted setup still requires its own provisioning/rehearsal. Storage buckets and policies are included, but Auth identities/passwords, Storage file bytes and provider configuration are not a schema export. DEV0232 still owns branch-specific retained-ledger continuity. Historical excluded-product schema objects remain; this cleanup does not prune them. No retained-data backup, hosted deployment or independent review is implied by local completion.

## Completion and review references

- Completed: 2026-10-16 — acceptance criteria and required validation passed; archived with the delivery handoff.
- Cleanup: Removed only owned `dev0265_reference`, `dev0265_baseline`, `dev0265_replay` and `dev0265_fresh` databases after validation; retained/shared `postgres` was not reset or migrated.
- Commit: User authorized committing on 2026-10-16 after calendar compatibility review; scoped subject `[DEV0249][DEV0265] Baseline migrations and repair repeatable seeding`. Independent Events, calendar editor, session-note and invitation edits are excluded; shared specification/index changes are staged only for this delivery.
- Review: Source/planning self-review; no independent review.
- Deployment or release: None.
