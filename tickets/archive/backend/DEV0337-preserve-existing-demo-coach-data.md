# Ticket DEV0337: Preserve existing demo coach data

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: Nonproduction data integrity
- Coordination: None — independent development ticket
- Related records: Historical initialization [DEV0335](../../archive/backend/DEV0335-provision-nonproduction-demo-coaches.md), additional coach [DEV0336](../../archive/backend/DEV0336-add-fitness-and-sixth-demo-coach.md), earlier Daniel password setup DEV0332 (independent operational record awaiting its own commit).

## Objective and context

The user requires existing demo-coach data to remain unchanged by automatic setup from now on. They also asked whether the recent replacement happened during migration. The [identity/data contract](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) must distinguish fresh initialization from retained tester data.

DEV0335's operational setup initialized passwords, profile defaults and optional website samples, and was wired into both development launchers. It could upgrade an existing account when initialization markers were absent or older, or fill website samples after a later schema rollout. This was an operational script, not an Auth/password data migration. Daniel's private credential journal records local initialization at 2026-10-17T22:36:22.529Z (18 October 00:36 Berlin) and dev at 22:38:47.306Z (00:38 Berlin). Commit `30a164e` recorded the later source checkpoint; its commit time is not the data-change time. No secret values belong in this record.

## Scope and non-goals

- In scope: remove demo provisioning from normal local/hosted startup; manual creation of genuinely missing accounts only; preserve every existing account/profile/content/password regardless of initialization markers; reject bulk password rotation; prevent a complete SQL seed replay from changing an existing foundation dataset; record the future contributor requirement and regression/preservation evidence.
- Out of scope: resetting or restoring current data, changing current passwords, new portraits/coaches, production operations, owner-requested UI edits, migration-history rewrites, general account-retention policy and unrelated Auth/username implementation.

## Expected behavior and edge cases

Normal development startup does not call demo setup or obtain privileged hosted credentials for it. Explicit `demo:setup:local` / `demo:setup:dev` may create missing reserved Auth accounts for untouched fresh fixtures; every pre-existing Auth account remains unchanged, even with absent, old, malformed or future initialization markers. Existing blank/cleared media/content remains blank. Repeating a completed setup neither opens/writes the private password journal nor calls account updates. Conflicting/incomplete bindings fail without automatic repair. `--reset-passwords` is rejected before services or credentials are accessed; individual deliberate password recovery remains available through the existing owner flow.

The complete seed initializes a new foundation dataset only. If that dataset already exists, replay is a no-op, preserving renamed/hidden/retired/unclaimed profiles, edited venues/dates and removed content. An inconsistent partial foundation fails before writes. Fresh databases still get all six initial fixtures; deliberate new-fixture setup on retained data is an explicit separate operation. A newly created account interrupted during setup may require scoped manual repair; preservation takes priority over silently repairing an existing identity.

## Assumptions, decisions, and dependencies

Confirmed by the user on 18 October: stop further automatic replacements of existing demo-coach data. This includes passwords, names, biography, portraits, website, prices, usernames, locations and scheduling/history. Owner-requested edits and necessary Auth session bookkeeping remain normal product behavior. Future migrations/setup/rehearsals must preserve retained demo values or obtain a separately scoped explicit data-change request; tests use disposable/temporary records.

Adopt manual create-only setup as the fresh-install path. Reuse installed Supabase JS 2.116.0 and existing account/target guards; no new SDK API or package. Preserve completed tickets as historical evidence and all concurrent edits. No database migration or retained-data update is needed for this change.

## Implementation plan

1. Reserve this ticket and update the index; capture non-secret local fixture fingerprints and historical initialization timestamps.
2. Remove automatic demo setup from the two launchers. Restrict manual provisioner writes/ownership binding SQL to accounts created by that invocation; preserve pre-existing fixture content even while creating its missing Auth account, reject rotation and leave existing markers/journals unchanged.
3. Guard the full seed before any write so an existing foundation is untouched. Adapt the explicit Fitness upgrade rehearsal to use its existing additive initializer.
4. Test actual launcher child calls, existing/missing/legacy account decisions, refused rotation, scoped defaults and fresh/repeated seed preservation in disposable databases. Verify a real local completed setup is a no-op with retained fixture/credential fingerprints.
5. Update specification/AGENTS/setup guidance; run relevant tests, lint/types and documentation checks, self-review and archive only after criteria pass.

## Acceptance criteria

- [x] AC1: All normal local/hosted development launchers start without demo provisioning; hosted startup needs no administrative account-setup channel.
- [x] AC2: Manual setup creates only missing fresh accounts; existing passwords/metadata/profile/media/website data and credential entries survive absent/old/future initialization markers and repeat runs. Rotation/incomplete identity repair is not implicit.
- [x] AC3: Fresh full seed remains valid; replay on an existing edited/unclaimed/retired foundation leaves its complete stored data unchanged. The explicit missing-fixture path remains bounded.
- [x] AC4: Current preservation policy, exact historical explanation, setup/compatibility changes and passing automated/local preservation checks are recorded without changing retained coach data or applying migrations.

## Validation plan

Use the existing launcher fixture to reject any provisioning call and validate local/hosted target behavior. Exercise the real provisioner with controlled existing/missing account dependencies and seeded disposable PostgreSQL, including marker/journal edge cases. Fingerprint edited and unclaimed fixture data before/after seed replay; prove fresh seed and explicit Fitness addition still work. Run a read-only-in-effect local manual setup with non-secret original coach/password/journal hashes, using no sign-ins or password changes. Run meaningful unit/database regressions, lint, type checking, scoped formatting, links and whitespace. Build/browser validation is not required unless product/interface/framework code changes; none is planned. No hosted mutation or reset.

## Implementation record

Scope reviewed before source edits: one bounded data-preservation slice. Existing stored coach data and credentials were preserved; no restoration, password reset, migration application or hosted mutation was performed.

### Changes and rationale

Removed demo provisioning from ordinary local and hosted-dev launchers. Starting Next.js no longer initializes coach defaults or needs an administrative hosted provisioning operation. The independent ordinary local athlete test-account setup remains unchanged.

Manual provisioning validates the complete reserved profile/Auth inventory first, then creates and binds only genuinely missing accounts. Existing Auth users never enter the write path, irrespective of initialization markers; a completed repeat returns before opening the private credential journal. No existing password, metadata, biography, portrait, website or other business data is upgraded. Removed profile/media/website default writes from the account-binding SQL entirely, including when binding a freshly created account to its seed profile. The fresh SQL seed remains responsible for initial fixture biographies/portraits. A cleared field is therefore preserved even if it resembles an older default. Missing/inconsistent existing bindings fail for explicit repair. The former bulk-reset flag is rejected while parsing arguments, before service access.

Wrapped the complete seed in an atomic bootstrap block. An existing foundation dataset, active or retired, returns before any seed write; reserved coach profiles without their dataset raise an error instead of being overwritten. Fresh seed behavior still supplies all six coaches. The separately marked additive Fitness initializer is used explicitly in the disposable upgrade rehearsal, never automatically by account setup. Moved its existing extractor to a plain JavaScript module so the JavaScript rehearsal can import it without a TypeScript loader; the original TypeScript export remains available.

Recorded the user's preservation requirement as C49 and the current section-8 data contract, added the contributor rule for future retained-data changes, and corrected startup/manual setup guidance. Historical DEV0335/DEV0336 records remain unchanged and explain the previously authorized initialization.

### Affected files

| Files                                                                                                                                                                                                                                                                                                                         | Role                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Local launcher](../../../scripts/start-local-development.ts), [hosted launcher](../../../scripts/start-hosted-development.mjs)                                                                                                                                                                                               | Start application services without demo provisioning.                                                                                                        |
| [Provisioner](../../../scripts/lib/provision-demo-coaches.ts), [binding SQL](../../../scripts/lib/demo-coach-fixtures.ts)                                                                                                                                                                                                     | Isolate writes to newly created accounts and bind their existing seed profiles without changing content.                                                     |
| [Argument guard](../../../scripts/lib/demo-coach-target.ts), [private journal](../../../scripts/lib/demo-coach-credentials.ts)                                                                                                                                                                                                | Refuse bulk password reset and describe individual recovery; completed setup does not access the journal.                                                    |
| [Full seed](../../../supabase/seed.sql), [seed command](../../../scripts/seed-local-database.mjs)                                                                                                                                                                                                                             | Bootstrap only a fresh foundation, preserve existing datasets and report that behavior.                                                                      |
| [Fitness block extractor](../../../scripts/lib/demo-coach-seed.mjs), [disposable rehearsal](../../../scripts/rehearse-fitness-database.mjs)                                                                                                                                                                                   | Exercise fresh/upgrade seed paths and partial-foundation refusal without touching retained datasets.                                                         |
| [Provisioning regressions](../../../tests/demo-preservation.test.ts), [existing guard/journal checks](../../../tests/demo-coaches.test.ts), [launcher checks](../../../tests/development-startup.test.ts)                                                                                                                     | Prove existing accounts never enter mutation/journal paths, mixed setup writes only the missing account, rotation is refused and launchers do not provision. |
| [Binding database check](../../../tests/database/demo-coaches.test.ts), [complete seed preservation check](../../../tests/database/demo-preservation.test.ts)                                                                                                                                                                 | Preserve old-looking text, cleared portraits, edited/unclaimed/retired data and booking history; only disposable database names are accepted.                |
| [Specification](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [contributor policy](../../../AGENTS.md#retained-demo-coach-data), [setup guide](../../../README.md#local-registration-and-sign-in), [database guide](../../../supabase/README.md#nonproduction-demo-coach-defaults), [index](../../README.md) | Durable requirement, operational compatibility and ticket lifecycle.                                                                                         |

### Decisions and deviations

18 October: preservation takes priority over the former automatic repair/backfill behavior. Even absent/malformed/future initialization markers cannot authorize an update to an existing identity. Interrupted creation can therefore leave a new account requiring explicitly scoped repair; rerunning setup will not repair it by resetting credentials or reinitializing content.

During review, removed content initialization from binding SQL even for new Auth accounts: a missing login is not evidence that its retained profile content may be replaced. Also moved the prior binding database regression off the shared local database and into the disposable rehearsal. These refinements stay within the planned preservation scope.

### Contracts, configuration, and operations

`npm run demo:setup:local`, its compatible `auth:provision:coaches` command, and `npm run demo:setup:dev` are explicit create-only operations. Fresh installations run setup after their initial seed; startup no longer creates their coach logins. Existing journals remain the private source of initial tester passwords; losing a journal never triggers password replacement. Ordinary individual recovery and owner UI edits remain available.

`npm run db:seed` preserves an existing foundation dataset rather than synchronizing it to source defaults. `npm run db:reset` remains an explicitly destructive disposable-database command; it was not used here. Adding a new fixture to retained data requires a separately scoped operation. No new schema, migration, package, environment variable, public API or runtime data shape. No retained-data rollout is needed. Reverting the source would restore the unsafe startup/upgrade/reseed behavior, so retain these guards during application rollback; do not reset stored data to roll back this change.

## Validation results

2026-10-18; Node 24.21.0, installed Supabase JS 2.116.0, existing local Docker project. Historical timestamps were inspected without printing credentials.

- `node --import tsx --test tests/demo-preservation.test.ts tests/demo-coaches.test.ts tests/development-startup.test.ts`: 10 passed. The initial automatic permission-review timeout was retried once as permitted; the successful run reached the actual tests. No failed check mutated data.
- `npm test`: 282 unit/development tests and 46 server tests passed (328 total, zero failures), including absent/old/future/malformed markers, missing journal, mixed existing/missing setup, target/ownership guards and launcher behavior.
- `node scripts/rehearse-fitness-database.mjs`: final run passed 3 database tests in each of fresh and upgrade modes (6 total, zero skipped/failed). It additionally proved a partial foundation refuses bootstrap without creating a dataset or changing the synthetic profile, and the Fitness migration preserves prior fixture fingerprints/security attributes. Both uniquely named disposable databases were removed on exit; retained `postgres` was not migrated or reset.
- `node --import tsx /tmp/dev0337/live-proof.mjs`: passed against the exact retained local project. Manual setup reported six coaches and **zero created accounts**. Before/after hashes matched for coach-linked application data, credentials/Auth metadata, foundation venues/dataset and both private local/dev journal files. Full local seed replay also matched the same fingerprints. No sign-in, password change or migration was needed. The private login files remained byte-identical. The one-use helper and hash-only results are operational evidence outside repository source, not a new project prerequisite.
- `npm run lint`: passed. After the final disposable-test refinement, `npx eslint scripts/rehearse-fitness-database.mjs tests/database/demo-coaches.test.ts tests/database/demo-preservation.test.ts` also passed.
- `npm run typecheck`: Next route type generation passed, but the root TypeScript scan failed on incomplete ignored source snapshots under `work/dev0336/commit-files/` (missing relative modules and resulting implicit-any errors). Those unrelated files were preserved. `npx tsc --noEmit -p /tmp/dev0337/tsconfig-validation.json` passed with the real project's compiler options and all root, application, script, test and generated route TypeScript, excluding only ignored work/tmp copies and dependencies. No project compiler setting was changed to hide the snapshot failure.
- Scoped `npx prettier --check` passed for all 14 changed/new implementation/test JavaScript/TypeScript files. Documentation checks passed all 445 repository link targets across the six affected documents; DEV0337 is unique and archived/indexed as Completed, the then-current next IDs were DEV0338/COR0029, and `git diff --check` passed.
- Commit review: isolated the exact HEAD-plus-DEV0337 snapshot, excluding unrelated Auth/navigation/username work and private credential files. `npm test` passed 270 unit/development and 44 server tests (314 total); full `npm run typecheck` passed without ignored working-copy snapshots. Both ran on the required Node 24.21.0. The first temporary-directory test run selected the shell's Node 20 default and failed four version-dependent tests; selecting Node 24 resolved all failures without source changes. All 426 non-private repository link targets in the isolated snapshot passed. DEV0338 was allocated concurrently to separate coach-page preview work; the commit reserves that ID and advances the next DEV ID to DEV0339 without including the preview implementation.
- Build/browser checks not run: this slice changes operational scripts, SQL bootstrap behavior and documentation, with no application interface or framework integration change. Actual disposable database execution and local preservation hashes establish the relevant behavior. No hosted write/test or production connection was performed.

| Criterion | Evidence                                                                                                                                                         | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Local expected child-command list; hosted provisioning stub throws if called; successful hosted startup without provisioning.                                    | Passed |
| AC2       | Existing-account dependency trap, mixed-account write scope, cleared-content binding regression, real zero-create setup and identical credential/journal hashes. | Passed |
| AC3       | Fresh and preserved upgrade databases, partial-foundation refusal, all-app-table active/retired fingerprints and real local full-seed no-op.                     | Passed |
| AC4       | C49/specification, contributor/setup guidance, historical evidence, complete validation record and link/lifecycle checks.                                        | Passed |

## Risks, limitations, and follow-ups

Fresh installations require explicit demo-account setup after their initial seed. An interrupted new-account bootstrap may require an explicitly scoped repair instead of an automatic password/profile rewrite. New website defaults are not backfilled; owners may edit their content normally. A code change cannot undo earlier initialization; current stored values are preserved. Root type checking remains affected by unrelated ignored source snapshots; scoped real-source checking passed. No hosted deployment or credential change is claimed.

## Completion and review references

- Completed: 2026-10-18 — startup, manual setup and full seed replay preserve retained demo-coach data; six local coaches and both private journals verified unchanged.
- Commit: Included with `[DEV0337] Preserve existing demo coach data`; unrelated working-tree changes and private credential files are excluded.
- Review: Scope, implementation boundaries, preservation behavior, validation and documentation/lifecycle self-reviewed. No independent review.
- Deployment or release: None.
