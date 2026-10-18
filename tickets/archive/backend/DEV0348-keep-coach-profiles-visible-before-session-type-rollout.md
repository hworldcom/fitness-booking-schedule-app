# Ticket DEV0348: Keep coach profiles visible before session-type rollout

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: M10/M11 public profile compatibility
- Coordination: None — independent development ticket
- Related records: Incident discovered by [DEV0347](../../archive/backend/DEV0347-preserve-test-coach-public-urls.md); completed integration peers [DEV0342](DEV0342-book-duration-aware-session-types.md), [DEV0343](../frontend/DEV0343-select-session-types-and-available-times.md). Those tickets retain typed-booking implementation ownership.

## Objective and context

Opening a valid test-coach username URL displays “We couldn’t verify this coach profile.” The in-progress public page makes its optional session-type catalog mandatory; the retained local database lacks `app.public_session_type_catalog(text)`. Recover public profiles without resetting data or deploying unfinished migrations. Follow [identity integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [session-type compatibility](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings) and [public websites](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites).

## Scope and non-goals

- In scope: database-bound catalog capability check; retain legacy booking on confirmed absent capability; isolate genuine catalog failures to the booking section; focused regression tests and real current-source page verification.
- Out of scope: completing/deploying session types, changing public visibility/identity or booking authority, resetting/provisioning fixtures/passwords, broad service refactoring, hosted schema rollout.

## Expected behavior and edge cases

- A database without the catalog function serves the normal public profile and existing one-hour booking interface. Check per request so later schema installation is detected automatically.
- An installed enabled catalog uses the typed interface, including a deliberately empty catalog; do not reopen legacy offers for an empty or failed catalog.
- Installed catalog query errors, malformed results or a null ineligible-coach response keep the verified profile visible with a bounded booking-unavailable message and retry link. No legacy or typed request controls appear for that failure.
- Existing core profile unavailability, missing/hidden coach handling, public aliases and authorization checks remain authoritative.

## Assumptions, decisions, and dependencies

The user reports this error after testing the URLs and authorizes its repair. Missing optional rollout capability is distinct from an installed feature outage. Use PostgreSQL `to_regprocedure` rather than catching arbitrary undefined-function errors or caching absence. No retained data change is needed. Installed Next.js 16.3.8 error-handling documentation was inspected before the page edit. Database queries remain in `src/server/db`.

## Implementation plan

1. Add a bounded catalog repository read that detects exact function absence before invocation; delegate the existing service read to it without changing callers' catalog shape.
2. Replace the page-wide catalog failure return with a booking-section recovery state. Preserve enabled-empty and disabled-legacy semantics.
3. Test missing/installed/error/malformed catalog handling and actual public pages, legacy redirects and responsive/keyboard recovery on current source. Run relevant lint/type tests, document unrelated shared failures, and finish this record/index.

## Acceptance criteria

- [x] AC1: Six exact local demo public pages render their verified profile on the current unmigrated session-type database, and legacy URLs redirect correctly.
- [x] AC2: Only confirmed absent/explicitly disabled catalog capability permits the legacy flow; enabled empty catalogs, null responses and failures do not invent bookable sessions.
- [x] AC3: A genuine catalog outage affects only booking controls and exposes an accessible retry; core profile/hidden/missing semantics remain unchanged.
- [x] AC4: No retained profile, credential or schema reset/migration; regression/static checks and actual page evidence are recorded with known limitations.

## Validation plan

Focused repository tests cover no unsupported invocation, late feature availability, enabled-empty data, null, invalid results and genuine SQL errors. Verify the actual old-schema read using the restricted local runtime; use current-source HTTP/browser checks at desktop/mobile widths for profiles and retry/keyboard recovery, with isolated failure injection only in a temporary validation copy. Run relevant existing public URL/demo tests, scoped lint/format/type checks and appropriate broader checks without changing unrelated active work. No mutation or new migration needs database constraint tests. Inspect exact fixture/credential preservation where applicable.

## Implementation record

### Changes and rationale

Implemented exact catalog capability detection and bounded public mapping in a new database repository. The existing service delegates this read without changing its return shape. Previously, invoking an absent catalog routine threw and returned the whole-profile unavailable view. A confirmed absent routine now produces the explicit disabled legacy catalog before invocation. This is checked on every request, so a later schema installation is visible immediately.

The page now limits catalog errors or an installed null/ineligible response to the booking section. Independently verified profile/contact content remains visible, with no request controls for the failed section and a safe same-coach/date retry link. Existing schedule-panel, spacing and keyboard-focus styles are reused. An installed enabled catalog remains enabled when empty, so it cannot silently reopen legacy offers. All core profile/visibility checks still run first and retain their original missing/unavailable behavior.

### Affected files

| File                                                                                                                 | Role                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [public-session-catalog-repository.ts](../../../src/server/db/coaches/public-session-catalog-repository.ts)          | SQL capability probe and catalog read stay within the database boundary; validates result/locations and returns public-only catalog fields. |
| [typed-session-service.ts](../../../src/server/coaches/typed-session-service.ts)                                     | Existing slug-validated catalog entry point delegates to the repository; other ongoing typed-session work is preserved.                     |
| [public-coach-page.tsx](../../../src/app/_coaches/public-coach-page.tsx)                                             | Booking-only failure state, accessible retry, explicit legacy versus typed/empty behavior; retains the active session-type integration.     |
| [public-session-catalog.test.ts](../../../tests/server/public-session-catalog.test.ts)                               | Six regression cases covering absence, later availability, empty/disabled/null catalog, public mapping, malformed data and genuine errors.  |
| [Specification](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings) / [ticket index](../../README.md) | Current rollout compatibility rule and durable incident/lifecycle record.                                                                   |

### Decisions and deviations

2026-10-18: distinguish exact absent capability from every installed-feature failure. Do not catch arbitrary PostgreSQL `42883` errors as absence: a missing inner dependency must keep requests unavailable. Null installed-catalog results likewise never permit legacy controls. Reuse existing visual/anchor classes rather than adding new styles. No deviation from the planned repair; no unfinished migration was applied to fix rendering.

### Contracts, configuration, and operations

No new schema, migration, package, environment variable, user field, credential change or setup step. The catalog service still returns `SessionCatalog | null`; absence is represented by `{enabled:false,types:[],locations:[]}`. Genuine read/validation errors propagate to existing callers, with the public page handling them locally. No cached capability or restart is required after future migration deployment. Source rollback would restore the rendering regression on an unmigrated database; no data rollback is needed. Hosted deployment and completion of typed-session work remain separate.

## Validation results

2026-10-18; Node 24.21.0, Next.js 16.3.8, installed local Docker project, existing running app on localhost:3100.

- `node --import tsx --conditions=react-server --test tests/server/*.test.ts`: **52 passed**, zero failures/skips, including six new catalog regressions. Cases verify no absent-function invocation, no cached negative capability, enabled-empty/explicit-disabled behavior, null eligibility, malformed capability/catalog/location rejection, and propagation of permission/connection/undefined-inner-function errors with connection cleanup.
- `node --import tsx --test tests/coach-public-urls.test.ts tests/coach-schedule.test.ts tests/session-types.test.ts tests/typed-sessions.test.ts tests/demo-preservation.test.ts tests/demo-coaches.test.ts`: **24 passed**, zero failures/skips.
- Actual restricted local database read: `DATABASE_URL=<existing restricted loopback runtime> node --import tsx --conditions=react-server --input-type=module -e 'import {publicSessionCatalogRecord} from "./src/server/db/coaches/public-session-catalog-repository.ts";console.log(JSON.stringify(await publicSessionCatalogRecord("daniel-park")));'` returned `{enabled:false,types:[],locations:[]}` against the existing unmigrated catalog schema. Only SELECT operations; no reset/provisioning/migration.
- `node --import tsx /tmp/dev0348-validation/check-routes.mjs`: actual current-source app on **port 3100** returned all six complete named coach pages with HTTP 200 and all six legacy HTTP 307 redirects to their stable username URLs. Results: `/tmp/dev0348-validation/route-results.json`. Unlike DEV0347's isolated renderer proof, no committed-file substitution or source exclusion was needed.
- `node /tmp/dev0348-validation/browser.mjs`: Chrome checked **1440×1040 desktop and 393×852 mobile** against a temporary complete current-source app on port 3148. Both widths passed missing-schema legacy profile display; synthetic installed-catalog outage kept the named profile visible, removed both booking interfaces, exposed retry through Tab/Enter and retained the chosen date. Enabled-empty catalog stayed typed/empty with no legacy offers; installed-null response likewise kept requests unavailable. Restoring the reader recovered legacy scheduling. No horizontal overflow; private local/dev tester files remained byte-identical. Full results: `/tmp/dev0348-validation/browser-full-results.json`; screenshot pairs under `/tmp/dev0348-validation/screenshots/` were visually reviewed. Failure injection changed only the temporary repository module, always restored in `finally`; shared source and real schemas were untouched. Initial cold compilation took 30.7 seconds and exceeded the harness's original 30-second navigation limit; raising that test timeout to 60 seconds resolved it without application changes.
- `DEV0348_ERRORS_ONLY=1 node /tmp/dev0348-validation/browser.mjs`: final targeted recheck of the styled error panel passed at both widths, including keyboard/date retry, null response and recovery. Results: `/tmp/dev0348-validation/browser-results.json`. The final mobile panel screenshot was visually inspected with readable wrapped text, visible focus ring and no horizontal overflow. Only the owned temporary server was stopped; the user's port-3100 app remains running.
- The temporary development server logged early-closed destination-stream errors when the harness retried or closed pages during streamed rendering. Browser assertions and subsequent recovery passed; the twelve actual-app HTTP checks consumed successful complete responses. This is distinct from the original whole-profile catalog failure, which no longer occurs for the missing capability.
- `node node_modules/.bin/tsc --noEmit -p /tmp/dev0348-validation/tsconfig.json`: passed for all actual application, script, test and generated route TypeScript, using repository compiler options and installed Node types. Ignored incomplete source snapshots under work/tmp were excluded; no repository compiler configuration changed.
- `node node_modules/.bin/eslint .`: passed with zero errors and one existing unrelated hooks warning in `src/features/session-types/manager.tsx:90`. Scoped ESLint on the four affected implementation/test files passed without warnings. Scoped Prettier and `git diff --check` passed.
- Documentation review passed 374 local link targets, the unique archived/completed DEV0348 record and next-ID consistency (DEV0349/COR0030).
- No production build/deployment or hosted migration was attempted: this local compatibility slice was exercised through actual current-source Next.js compilation, browser/HTTP behavior, read-only database execution and type/static tests. Broader in-progress session-type delivery remains independently owned. No new database constraints or mutations require a migration rehearsal.

| Criterion | Evidence                                                                                                                         | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Six named current-source pages and six redirects on the actual port-3100 app; restricted unmigrated runtime read.                | Passed |
| AC2       | Catalog regression tests; enabled-empty/null browser scenarios; genuine errors do not fall back.                                 | Passed |
| AC3       | Both viewport outage scenarios keep verified content, remove request controls and pass keyboard/date retry and recovery.         | Passed |
| AC4       | No schema/credential/fixture mutation, byte-identical tester files, 76 regressions, type/static checks and actual page evidence. | Passed |

## Risks, limitations, and follow-ups

Typed-session runtime peers completed independently after this repair's original validation and are included in the authorized checkpoint below. Their hosted deployment remains separate. This compatibility fix does not make missing typed APIs available. A genuine failure of core profile verification still returns the original profile-unavailable response. Existing cold compilation/profile-query latency was observed in the temporary app; this ticket fixes the missing-capability error path, not general scheduling performance. No external review or hosted deployment is claimed.

## Completion and review references

- Completed: 2026-10-18 — all six current-source profiles load on the existing local schema; absent-capability compatibility and booking-only error recovery verified.
- Commit: See the authorized checkpoint below.
- Review: Capability/error distinction, public-field mapping, branch behavior, scope and evidence self-reviewed; no independent review.
- Deployment or release: No hosted migration/deployment.

### Authorized commit checkpoint — 18 October 2026

The completed contract/runtime peers and DEV0348 profile compatibility repair share new domain types, public page/service imports and booking projections. They are committed together to keep the checkpoint buildable; each ticket retains its own scope/evidence. Active Auth and directory-card edits are excluded using an isolated Git index and exported candidate tree.

Exact candidate validation under Node 24.21.0: `node --import tsx --test tests/*.test.ts` passed **301 unit tests**; `node --import tsx --conditions=react-server --test tests/server/*.test.ts` passed **51 server tests** (352 total, zero failures/skips). Scoped ESLint and Prettier passed. `NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack` passed compilation, TypeScript, page generation and optimized production output. This suite count describes the isolated checkpoint; earlier larger shared-workspace counts include separate pending tests and are retained as historical evidence. Database/browser and preserved-data results above remain the evidence for those acceptance criteria; no code changed after candidate validation. Candidate Markdown review resolved 559 file links, with only the two intentionally untracked private tester journals handled outside Git. Final namespace, archive/index, dependency and whitespace checks passed.

Commit reference: `[DEV0257][DEV0340][DEV0341][DEV0342][DEV0343][DEV0344][DEV0345][DEV0346][DEV0348] Add session types and preserve public profiles` (this checkpoint). No hosted schema rollout, application deployment or independent review is implied.
