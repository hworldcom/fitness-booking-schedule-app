# Ticket DEV0271: Apply the hosted dev calendar migration

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Hosted M9 calendar rollout
- Coordination: None — independent development ticket
- Related records: source/runtime owner [DEV0254](../frontend/DEV0254-add-private-and-group-coach-calendar.md), external calendar coordination [COR0023](../../current/organisatory/COR0023-coach-calendar-and-availability.md); completed dev setup [DEV0267](../../archive/backend/DEV0267-connect-new-hosted-dev-environment.md), startup [DEV0269](../../archive/backend/DEV0269-default-local-startup-to-hosted-dev.md) and local cleanup [DEV0270](../../archive/backend/DEV0270-remove-retired-local-supabase-containers.md).

## Objective and context

The user authorizes doing the pending calendar migration first, lifting the earlier migration deferral for this specific hosted-dev rollout. Review, transactionally validate and apply `20261016000300_owner_coach_calendar.sql` to confirmed dev `mdzidiqosxbghmfyxphb`, then prove its ledger/function/permissions and bounded real SQL behavior. Follow [infrastructure boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries) and [calendar authority](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability). DEV0254 remains the interface owner; this task does not claim full browser/feature completion.

## Scope and non-goals

- In scope: exact dev/schema/history/dependency preflight; immutable candidate hash; supplied pgTAP and meaningful positive/negative SQL checks inside rolled-back transactions; one-file reviewed CLI dry-run/application; accurate ledger/definition/data-preservation/runtime checks; operation documentation and cross-ticket handoff.
- Out of scope: production/old staging/local Docker writes or recreation, resetting/seeding shared dev, persisted test users/fixtures, external email, completing calendar/editor/events UI, deploying UAT, broad destructive suites or committing without a new request.

## Expected behavior and edge cases

Only the confirmed dev project receives the additive calendar function, owner/comment and narrow EXECUTE grant. Its accepted ledger initially has baseline `20261016000100` and effective availability `20261016000200`; refuse unexpected history or a pre-existing differing function before adapting the plan. The candidate is committed by DEV0254 checkpoint `e16c06f`, SHA-256 `94a6b056880d3a6a78df364bf8383e2ef17779f31fa77edab9b3e490e716ce75`. Validate runtime execution, actual query planning, bounded paging and owner/dataset isolation before final application; eight privilege-only tests cannot prove the successful SQL branch. All temporary validation rows/DDL are rolled back, with timeouts and no mail. Shared application/Auth/Storage rows remain unchanged by migration and test cleanup. Repeat dry-run must show no pending migration rather than replaying SQL.

## Assumptions, decisions, and dependencies

Confirmed dev account/CLI access and restricted runtime settings exist from DEV0267. Docker was deliberately retired under DEV0270 and will not be recreated for this operation. Use the supported explicit dev CLI management connection; no owner credential enters app configuration or output. Adopt a private CLI workdir containing exactly accepted baseline/effective-availability/calendar files and required config/template assets, leaving the repository's default link untouched. Inspect actual current target and available extensions/owner privileges before settling concrete fixture SQL. If successful SQL checks find a migration defect, record the finding and update this plan before the narrow correction; do not apply a known failing candidate.

## Implementation plan

1. Confirm exact dev project name/health, ledger, candidate absence, PostgreSQL/dependencies, privileged executor and relevant data/catalog fingerprints read-only. Record concrete SQL validation and application details before writes.
2. Prepare a rollback-only validation batch: create the candidate in a transaction, run supplied eight pgTAP assertions with enforced result checks, and exercise successful calendar queries with isolated owner/other-owner/dataset fixtures and bounded input/paging/privacy assertions. Roll back every fixture/schema/test-extension change; verify source/data preservation.
3. Copy only the three accepted migration files into the owned CLI workdir; verify hashes. Review explicit `db push --linked --project-ref mdzidiqosxbghmfyxphb --skip-vault --dry-run` showing only `20261016000300`, no seed/role/vault work; apply only after checks pass. Stop on unexpected target/history/SQL failure.
4. Verify exact ledger, function definition/owner/search path/ACL, restricted runtime grants, denied unauthenticated calls, data fingerprints and no pending migration. Repeat rolled-back successful/permission checks against the actual installed function.
5. Update current operational docs and DEV0254/COR0023 with precise hosted evidence and remaining UI/integration criteria, keeping historical completed records intact. Finish this operation record/index and clean only owned temporary resources.

## Acceptance criteria

- [x] AC1: The reviewed calendar migration is applied once to exact hosted dev with truthful three-version history and no other environment/local-stack changes.
- [x] AC2: Supplied permission assertions plus successful real owner queries, bounded input/paging and owner/dataset/privacy checks pass; all validation fixtures are rolled back and existing app/Auth/Storage data is preserved.
- [x] AC3: Runtime/catalog/repeat-dry-run and documentation checks pass, with exact operations/recovery/remaining feature validation recorded and no secret output or false deployment/feature-completion claim.

## Validation plan

Actual provider preflight/catalog/fingerprint queries, rollback-only candidate and installed-function SQL assertions, reviewed one-file dry-run, migration push, post-catalog/data comparison, existing 20-check hosted verifier and direct denied runtime call. Run focused existing calendar/action tests if source behavior needs regression evidence. SQL parsing/creation alone is insufficient; invoke successful mixed/filtered/paged function paths. Documentation link/namespace/index/status checks, formatting and whitespace complete the record. No Docker reset, general shared-dev fixture suite, email, full UI rehearsal or unrelated build is included.

## Implementation record

### Adopted validation operations before execution

Preflight confirms exact healthy `movx-dev`, PostgreSQL 17.11 and executor/session user `postgres`; ledger is exactly baseline/effective availability, calendar absent, every required helper present, pgTAP available but not installed, and owner may SET ROLE to runtime. Dev contains one Auth user and no Storage objects. Add a reproducible operator SQL validator under `scripts/sql/`: one explicit BEGIN/ROLLBACK, bounded lock/statement timeouts, temporary assertion/actor helpers, tagged temporary Auth/profile/coach fixtures created through existing application functions, real runtime-role calendar calls, then guaranteed rollback on successful validation. Create no test emails/accounts through Auth HTTP. Temporarily install pgTAP and enforce all eight supplied assertion results in the same rollback transaction. Validate mixed availability/bookings/groups, 50-row paging, private/group/venue filters, exact previews, draft exclusion, hidden/suspended history, other-owner/dataset/unapproved denial and private-field exclusion. Snapshot all application table row counts/digests plus Auth/Storage counts before and after; no shared reset/seed. Candidate creation is injected into this transaction before the supplied tests; post-apply verification omits that injection and calls the installed function. Keep only source SQL and bounded evidence, not private rows or credentials.

Pre-application gate passed: the unchanged candidate passed all eight supplied pgTAP assertions and 21 successful/negative runtime SQL assertions. The transaction rolled back; all 39 application table counts/digests, Auth/Storage counts, absent calendar and absent pgTAP state match the initial fingerprint. Explicit dev `db push --linked --project-ref mdzidiqosxbghmfyxphb --workdir <owned-dir> --skip-vault --dry-run` succeeded and proposed exactly `20261016000300_owner_coach_calendar.sql`, with empty seed/role lists. Apply that exact command without `--dry-run` and with `--yes`, preserving the reviewed three-file workdir and candidate hash. No source SQL correction was required.

### Changes and rationale

Applied the unchanged committed calendar migration to confirmed hosted dev after successful rollback-only candidate proof. Dev now has the bounded `app.owned_coach_calendar(jsonb)` function, owned by `app_owner`, with an empty fixed search path and EXECUTE only through the existing restricted runtime authority. The ledger records the actual third version; repeated dry-run shows no pending migration. No reset, shared seed, Docker recreation, Auth message, production/staging write or real account enrollment was performed.

Added a reproducible rollback-only SQL validator to exercise the successful query branches missing from the initial privilege-only proof. Before and after installation, the eight supplied pgTAP assertions plus 21 runtime assertions passed with temporary coach/athlete data, including real availability, accepted booking and published/draft groups. Every fixture, generated inventory row, temporary helper and pgTAP installation rolled back.

### Affected files

- [`scripts/sql/verify-coach-calendar-rollout.sql`](../../../scripts/sql/verify-coach-calendar-rollout.sql): explicit owner-operated BEGIN/ROLLBACK validator with bounded timeouts, temporary assertion/actor helpers, real runtime-role queries, tagged fixtures, 21 enforced assertions and a bounded final result. It is not part of normal app startup or a broad shared-data test suite.
- Source [`20261016000300_owner_coach_calendar.sql`](../../../supabase/migrations/20261016000300_owner_coach_calendar.sql) and [`coach-calendar.test.sql`](../../../supabase/tests/database/coach-calendar.test.sql): DEV0254's unchanged committed candidate and eight permission assertions; no SQL correction was needed. Their original deferred/prepared headers describe the earlier checkpoint, not an ongoing prohibition after the user's new authorization.
- [`supabase/README.md`](../../../supabase/README.md#separate-hosted-environments): current applied revision, forward-file prerequisite for the current complete SQL suite and an explicit installed-function verification command, with role/rollback/feature-validation boundaries. [Specification status](../../../docs/mvp-spec.md#1-product-status-and-document-authority) now distinguishes actual hosted SQL proof from still-pending interface integration without changing adopted product behavior.
- Current [DEV0254](../frontend/DEV0254-add-private-and-group-coach-calendar.md) and [COR0023](../../current/organisatory/COR0023-coach-calendar-and-availability.md): precise external hosted SQL evidence and removal of the stale missing-function blocker; their remaining Auth/browser/detail criteria and status remain open.
- This ticket and [`tickets/README.md`](../../README.md): reviewed operations, source identity, results and lifecycle/index handoff. Private temporary CLI/config/query files are cleaned separately; no credential was added to the repository.

### Decisions and deviations

No source migration defect was found. Kept the existing SQL bytes/hash rather than repackaging an applied baseline or changing the earlier migration comment. The initial digest helper failed because of SQL literal quoting; fixed that verification-only helper before capturing the baseline or invoking the candidate. Candidate/installed validators then passed without a migration or product-code correction. The CLI's bare version command hit its sandboxed telemetry write restriction; supported hosted commands ran with required local CLI/network access. These were tool/preflight issues, not provider authorization or automatic approval-review rejections.

Kept SQL proof distinct from browser/Auth product completion. Temporary roles/actor context exercise real PostgreSQL/runtime authority with real ephemeral records; they do not represent a completed user-interface rehearsal. Validation used no Docker recreation or production write and no owner credential was persisted to app settings.

### Contracts, configuration, and operations

Installed the already specified `app.owned_coach_calendar(jsonb)` through its existing versioned migration. The source SHA-256 remains `94a6b056880d3a6a78df364bf8383e2ef17779f31fa77edab9b3e490e716ce75`; installed `prosrc` MD5 is `3ed9177c8f4833b34ffc068e5df8003b` and matches the source body exactly. The function accepts at most 42 Berlin dates and returns up to 50 items, cursor, complete filtered date summaries and content version, with no participant identity/media/notes. It delegates authorized inventory reconciliation to existing effective-availability authority.

Exact accepted CLI ledger is `20261016000100`, `20261016000200`, `20261016000300`. In a private owned workdir with only those accepted files, reviewed `./node_modules/.bin/supabase db push --linked --project-ref mdzidiqosxbghmfyxphb --workdir <owned-dir> --skip-vault --dry-run` proposed only the third file, no seeds/roles. The same command with `--yes` instead of `--dry-run` applied that one file; repeating `--dry-run` returned `upToDate: true`, empty migrations/seeds/roles. The repository's old default link and runtime credentials were not changed.

No new environment variable, dependency or credential. Candidate verification could roll back before installation; after the recorded application, recovery is a reviewed forward correction or reverting the calling app usage, with history retained. No destructive rollback, database reset, fixture seeding or ledger relabelling is authorized. Production and UAT deployment remain separate.

## Validation results

- AC1 target/application: CLI listing confirmed `movx-dev`, exact dev reference, Frankfurt and healthy status. Read-only preflight confirmed PostgreSQL 17.11, executor/session user `postgres`, exact two-version predecessor ledger, absent calendar, existing dependencies and owner role-switch authority. Reviewed one-file dry-run, actual one-file apply and post-apply no-pending dry-run all passed; no seed/role work appeared. Source migration bytes/hash remain unchanged.
- AC2 candidate and installed proof: `supabase db query --linked --project-ref mdzidiqosxbghmfyxphb --workdir <owned-dir> --file <candidate-or-installed-validation.sql> --output json` passed twice. Each combines the source pgTAP file with enforced `ok`/`not ok` checks (all eight pass) and the committed validator (21 assertions pass), ending in ROLLBACK and `{result: passed, positive_assertions: 21, fixtures: rolled back}`. Candidate mode injects the unchanged DDL inside that transaction; installed mode calls the actual installed function. No fake success from a bare pgTAP text response was accepted.
- The 21 assertions cover: real 50-item limit/cursor/complete duplicate-free traversal and stable version; group/draft/private/own-versus-other-venue filtering; real groups beyond the private horizon; original accepted-booking identity; exact date totals/three previews; bounded item keys; invalid 43-date/cross-context cursor rejection and helper-flag restoration; valid other-owner isolation, unapproved-athlete/foreign-dataset denial, hidden-owner commitments and suspended-owner history.
- AC2 preservation: the same privileged metadata-only fingerprint query before candidate validation, after its rollback and after installed validation compared all **39** application-table row counts and sorted row digests. Every existing application fingerprint matched; Auth user count remains one and Storage object count zero. The calendar is absent after candidate rollback and present after actual application; pgTAP remains absent after both rollback runs. No fixture account/profile/group/booking/inventory row remains.
- AC3 catalog/runtime: exact three-version ledger, source body, `app_owner`, SECURITY DEFINER and `search_path=""` verified. Dedicated runtime has EXECUTE; PUBLIC/anon/authenticated/service_role do not; runtime still cannot SELECT group tables directly. `node --env-file=.env.development.local scripts/verify-hosted-runtime-database.mjs --environment dev` passed all **20** existing role/privilege checks. A direct actual-runtime probe confirmed calendar EXECUTE and rejected an actor-unbound call with P0001 `coach calendar query is invalid`.
- Source regression: `node --import tsx --test tests/coach-calendar.test.ts` passed **8** tests; `node --import tsx --conditions=react-server --test tests/server/coach-calendar-actions.test.ts` passed **1** test. No application TypeScript/framework/dependency change required a repeated whole-tree build, interface viewport check or unrelated full test suite. Real Auth/browser and owner-detail acceptance remain DEV0254 and peers.
- Final review: affected documents passed local links/anchors and 182 unique-record/next-ID/index/status checks and explicit independent membership; repeated after archival. Targeted installed Prettier and `git diff --check` passed. SQL formatting and fixture/role/rollback scope were reviewed directly; installed Prettier has no SQL parser and no formatter dependency was added. Removed only the owned private CLI/query workdir after all verification; app settings/default link remain untouched. No fixture data or owner credential is retained in source. No commit was created.

## Risks, limitations, and follow-ups

The calendar read delegates legitimate inventory synchronization to existing authority, so positive validation must roll back resulting writes. Shared dev may receive concurrent app work; distinguish concurrent row changes from migration effects instead of claiming preservation without evidence. DEV0254/DEV0253/DEV0255 still own their real UI and integrated account outcomes; this migration alone cannot complete them. Production and UAT deployment remain separate.

## Completion and review references

- Completed: 2026-10-16; all three migration-rollout criteria passed. Calendar interface/integration completion remains with its existing tickets.
- Commit: Included in the user-authorized `[DEV0271] Record verified hosted dev calendar rollout` commit on 2026-10-16.
- Review: Source/operation self-review; no independent review.
- Deployment or release: Calendar SQL applied and verified only on `movx-dev` (`mdzidiqosxbghmfyxphb`). No UAT/production application deployment, production database change or Docker recreation.
