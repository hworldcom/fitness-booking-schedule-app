# Ticket DEV0346: Rehearse session types and flexible bookings

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: M11 — Session types and flexible bookings
- Coordination: [COR0029 — Session types and flexible bookings](../organisatory/COR0029-session-types-and-flexible-bookings.md)
- Related records: contract [DEV0257](../organisatory/DEV0257-define-reusable-session-types.md); dependencies and peer boundaries in COR0029.

## Objective and context

Deliver this owned slice of the user's Everfit-style model under [specification section 18.6](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings): coach-defined classes, athlete type-first selection and coach-confirmed bookings. Defaults include removable Private session and Group session types.

## Scope and non-goals

- In scope: Combined disposable-dataset proof, fresh/retained-schema upgrade compatibility, scoped deployment readiness and final documentation evidence.
- Out of scope: No production rollout or retained demo/account changes. Credits, payments, external calendars and retained demo-data changes are excluded.

## Expected behavior and edge cases

Real coach/client type-first booking/accept/manual override/cancel, group join/archive and calendar, concurrency/retry/privacy and exact tagged cleanup; original data fingerprints unchanged; relevant tests/lint/type/build and desktop/mobile evidence. Archived types remain historical references and never erase scheduled sessions or participant content. An empty catalogue is valid. Existing one-hour records remain readable with honest legacy labels; no invented type backfill.

## Assumptions, decisions, and dependencies

Confirmed: private/group types, 60/75/90-minute lengths, athlete chooses class then time, coach can book for an existing client/override one booking, either default may be removed. Adopted defaults are in the specification, including zero buffers, 15-minute starts, private-first requests and accepted-connection manual booking. Start condition: DEV0340–DEV0345 completed.

## Implementation plan

1. Review owned interfaces and existing authority; inspect installed framework/SQL documentation as applicable.
2. Implement only this slice with bounded contracts, actor checks, retries and retention; update scope before a material deviation.
3. Validate the criteria below using disposable/tagged accounts, review the diff and record exact results.

## Acceptance criteria

- [x] AC1: The owned deliverable above works end to end within its boundary.
- [x] AC2: Real coach/client type-first booking/accept/manual override/cancel, group join/archive and calendar, concurrency/retry/privacy and exact tagged cleanup; original data fingerprints unchanged; relevant tests/lint/type/build and desktop/mobile evidence.
- [x] AC3: Existing bookings, retained history and demo/profile/password data are unchanged; no implicit startup provisioning.
- [x] AC4: Appropriate regression/static/build/database or responsive/keyboard checks pass, and implementation evidence and affected links are complete.

## Validation plan

Use meaningful unit and integration tests for the listed behavior and failure cases, with exact actor/dataset checks and concurrency where state mutates. Database work uses disposable local databases; do not reseed retained data. Interface work requires desktop/mobile/keyboard/error-state proof. Run relevant existing tests, lint, type checking and build. Record nonapplicable checks explicitly.

## Implementation record

The integrated rehearsal owns three reusable entry points:

- [scripts/rehearse-session-types-database.mjs](../../../scripts/rehearse-session-types-database.mjs): isolated catalog-only fresh/upgrade proof.
- [scripts/rehearse-typed-sessions-database.mjs](../../../scripts/rehearse-typed-sessions-database.mjs): full pre-extension legacy compatibility, fresh/upgrade schema and preservation checks, optionally followed by the browser rehearsal.
- [scripts/rehearse-session-types-ui.ts](../../../scripts/rehearse-session-types-ui.ts): temporary application copy at localhost:3113 against a disposable database, real local Auth and exact tagged-account cleanup. It mirrors only its two newly created Auth identities/sessions, never enrolls them into the retained application dataset, writes no password/token/cookie/storage-state file, and fingerprints retained demo profiles before/after.

[Catalog tests](../../../tests/database/session-types.test.ts), [private authority tests](../../../tests/database/typed-sessions.test.ts), [legacy compatibility tests](../../../tests/database/legacy-session-type-compatibility.test.ts) and [group/calendar tests](../../../tests/database/group-calendar-session-types.test.ts) prove the respective peer boundaries. Supporting unit tests validate untrusted fields and cursor/filter binding. [README](../../../README.md#session-type-validation) links the runnable database entry point; the specification records the delivered local behavior and unchanged hosted rollout boundary.

Integration ran while the peers were In progress so failures could be fixed before their completion; all six runtime peers are completed with this final proof rather than using an intermediate implementation as release evidence. Failures exposed and corrected SQL insertion/trigger handling, ambiguous select labels and an unnecessary route-refresh race. The browser fixture initially rejected generated Auth columns and double-encoded JSON; only disposable fixture setup changed to correct it. Cold-development timeouts under concurrent checks were rerun in isolation; the final 14-check run passed. No new package or runtime environment variable is introduced. Rehearsal-only environment variables select a disposable database and the temporary copy.

## Validation results

- AC1–AC2: `node scripts/rehearse-typed-sessions-database.mjs` passed all six tests on a fresh database, the pre-extension legacy read/request/confirmation check, and all six tests after upgrade. Coverage includes custom creation; removable/restored defaults; empty catalogs; group-only opt-in; immutable format; invalid durations; owner/dataset/privacy checks; full-fit/15-minute starts/horizon/daylight-saving boundaries; exact/stale commands; overlapping acceptance with one winner; connected-athlete manual creation/override; 20+5 audit paging; type/day-off pending closure; group publication/registration/archive preservation; and calendar filtering. The upgrade compares original application-row fingerprints and performs no type backfill. Test databases are removed in finally blocks.
- AC1–AC2/AC4: isolated local Supabase Auth + real browser run `work/dev0346/502160c2/results.json` passed 14 checkpoints. It exercised class-first 75-minute request/confirmation, an interrupted successful response with exact retry/no duplicate, 90-minute coach creation → 75-minute same-booking change, reviewed group prefilling/publication/type filtering, calendar type labels, stale saves, denied role/origin, unavailable-times recovery, 375/430px layouts without document overflow, keyboard removal of both defaults, restore and retained confirmed details. Loaded manager/booking/calendar screenshots were visually reviewed. The runner removed its two exact tagged temporary Auth accounts and verified retained demo profiles before/after.
- AC3: local `supabase db push --local --yes --skip-vault` applied only migrations 007–009 after a dry run. All 50 original application/Auth table fingerprints matched, excluding only new additive metadata columns/tables; retained coach type row count remained zero. No reset, seed, credential rotation, demo provisioning or hosted change occurred.
- AC4: `npm test` passed 304 unit + 55 server tests (359 total). Final targeted session-type/typed-session tests passed four checks after strict DTO refinements. Scoped ESLint passed, as did `node node_modules/typescript/bin/tsc --noEmit -p work/dev0257/tsconfig.validation.json` and a final isolated `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack`. The build/type copy excludes ignored incomplete old work snapshots rather than changing repository TypeScript settings. Link/ownership/namespace/format/whitespace review completes this handoff.

Initial failures were not counted as passes: SQL tests caught insert visibility/booking-ID/request-flag issues; browser checks caught select labels and an unnecessary navigation refresh race. Test-fixture Auth generated-column/JSON encoding issues were fixed without changing retained accounts. A concurrent cold-development page load timed out; the final isolated run used a 120-second navigation limit and passed all 14 checkpoints. The sandboxed npm/CLI attempts could not create their IPC/telemetry files; the authorized local checks passed outside that restriction.

Final documentation review: nine owned records passed 97 relative links/anchors and 262 unique current/archive IDs; all 484 relative file links in the 11 affected navigation/contract/record documents resolve. Archived metadata, checked acceptance criteria, reciprocal COR membership, index placement and whitespace checks passed. Scoped installed Prettier passed. No commit was created.

## Risks, limitations, and follow-ups

No hosted rollout, notification-delivery promise, per-type weekly schedules, buffers, prices/credits/payments or external calendars are included. Existing coaches opt in explicitly; local migration created zero type rows for retained coaches. Apply migrations 007 → 008 → 009 before using the typed UI. After 75/90-minute records exist, a one-hour-only app/schema rollback is unsafe; retain snapshots/audit and use a forward repair. Independent public-profile, authentication, marketplace and fixture changes in the shared workspace are preserved and are not claimed as this work.

## Completion and review references

- Completed: 2026-10-18 — integrated local proof and retained-data upgrade passed.
- Commit: See the authorized checkpoint below.
- Review: Scope reviewed before implementation; no independent review.
- Deployment or release: Local schema only; no hosted rollout.

### Validation approach before implementation

The database runner builds isolated fresh and pre-extension retained-data upgrade databases from local infrastructure schema, applies migrations 007–009, compares all existing application rows with new nullable/default columns stripped, and proves no defaults are backfilled. Runtime UI proof will run an isolated application copy against a disposable database, with newly tagged Supabase Auth accounts only, exact cleanup and no retained demo provisioning. Historical ignored work snapshots are excluded from the isolated build/type check because the root TypeScript include pattern otherwise includes incomplete old commit snapshots.

### Local rollout plan before applying schema

After the fresh/upgrade and browser proof passes, apply only pending local migrations 20261018000700–20261018000900 with `supabase db push --local`, without reset, seed or demo provisioning. Compare application/Auth-row fingerprints immediately before/after, excluding only the new additive columns/tables. Record the result here. DEV0348 has completed its pre-extension compatibility proof, so that earlier reason to hold the local schema is resolved. Hosted rollout remains outside this work.

### Reproduce the browser proof

Use a free localhost:3113 port and running local Supabase. The application copy deliberately excludes dotenv files, retained work snapshots and Git metadata:

```sh
task_ui_root=$(mktemp -d /private/tmp/movx-dev0346-XXXXXXXX)
cp -R src public scripts tests tickets docs supabase "$task_ui_root/"
cp package.json package-lock.json tsconfig.json next-env.d.ts next.config.ts postcss.config.mjs eslint.config.mjs "$task_ui_root/"
ln -s "$PWD/node_modules" "$task_ui_root/node_modules"
SESSION_TYPES_UI_ROOT="$task_ui_root" node scripts/rehearse-typed-sessions-database.mjs
```

`SESSION_TYPES_UI_ONLY=1` skips the independently run database test suite and runs only the fresh disposable schema/browser phase. Evidence stays ignored under `work/dev0346/<tag>/`; these files are local supporting artifacts, while this ticket records the durable outcomes. The exact disposable DBs and temporary Auth accounts are removed in finally blocks. The application-copy directory can be removed afterward without following its node_modules symlink.

### Local rollout result — 18 October 2026

The dry run listed only 20261018000700, 20261018000800 and 20261018000900, with no seeds or roles. `supabase db push --local --yes --skip-vault` applied those three successfully. Before/after hashes of all 49 original application tables plus Auth users matched; new columns/tables were excluded from the comparison. Both catalog/coach-booking functions exist, and the retained type row count is zero. This task changed no existing account/profile/booking content or credentials and did not contact a hosted database. Exact hash-only evidence is ignored under `work/dev0257/local-before.json`, `local-after.json` and `local-upgrade.log`.

### Authorized commit checkpoint — 18 October 2026

The completed contract/runtime peers and DEV0348 profile compatibility repair share new domain types, public page/service imports and booking projections. They are committed together to keep the checkpoint buildable; each ticket retains its own scope/evidence. Active Auth and directory-card edits are excluded using an isolated Git index and exported candidate tree.

Exact candidate validation under Node 24.21.0: `node --import tsx --test tests/*.test.ts` passed **301 unit tests**; `node --import tsx --conditions=react-server --test tests/server/*.test.ts` passed **51 server tests** (352 total, zero failures/skips). Scoped ESLint and Prettier passed. `NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack` passed compilation, TypeScript, page generation and optimized production output. This suite count describes the isolated checkpoint; earlier larger shared-workspace counts include separate pending tests and are retained as historical evidence. Database/browser and preserved-data results above remain the evidence for those acceptance criteria; no code changed after candidate validation. Candidate Markdown review resolved 559 file links, with only the two intentionally untracked private tester journals handled outside Git. Final namespace, archive/index, dependency and whitespace checks passed.

Commit reference: `[DEV0257][DEV0340][DEV0341][DEV0342][DEV0343][DEV0344][DEV0345][DEV0346][DEV0348] Add session types and preserve public profiles` (this checkpoint). No hosted schema rollout, application deployment or independent review is implied.
