# Ticket DEV0343: Select session types and available times

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: M11 — Session types and flexible bookings
- Coordination: [COR0029 — Session types and flexible bookings](../organisatory/COR0029-session-types-and-flexible-bookings.md)
- Related records: contract [DEV0257](../organisatory/DEV0257-define-reusable-session-types.md); dependencies and peer boundaries in COR0029.

## Objective and context

Deliver this owned slice of the user's Everfit-style model under [specification section 18.6](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings): coach-defined classes, athlete type-first selection and coach-confirmed bookings. Defaults include removable Private session and Group session types.

## Scope and non-goals

- In scope: Coach type/venue availability assignment and athlete type-first time selection/request, truthful duration and archive/unavailable recovery.
- Out of scope: No instant private booking, prices/checkout or manual coach-booking editor. Credits, payments, external calendars and retained demo-data changes are excluded.

## Expected behavior and edge cases

Real coach assignment and client request/acceptance across 60/75/90 minutes at desktop/mobile; empty catalogue/invalid type/day/time errors; keyboard and return-after-login; legacy appointments/history remain reachable. Archived types remain historical references and never erase scheduled sessions or participant content. An empty catalogue is valid. Existing one-hour records remain readable with honest legacy labels; no invented type backfill.

## Assumptions, decisions, and dependencies

Confirmed: private/group types, 60/75/90-minute lengths, athlete chooses class then time, coach can book for an existing client/override one booking, either default may be removed. Adopted defaults are in the specification, including zero buffers, 15-minute starts, private-first requests and accepted-connection manual booking. Start condition: DEV0341 and DEV0342; preserve current public URL ownership.

## Implementation plan

1. Review owned interfaces and existing authority; inspect installed framework/SQL documentation as applicable.
2. Implement only this slice with bounded contracts, actor checks, retries and retention; update scope before a material deviation.
3. Validate the criteria below using disposable/tagged accounts, review the diff and record exact results.

## Acceptance criteria

- [x] AC1: The owned deliverable above works end to end within its boundary.
- [x] AC2: Real coach assignment and client request/acceptance across 60/75/90 minutes at desktop/mobile; empty catalogue/invalid type/day/time errors; keyboard and return-after-login; legacy appointments/history remain reachable.
- [x] AC3: Existing bookings, retained history and demo/profile/password data are unchanged; no implicit startup provisioning.
- [x] AC4: Appropriate regression/static/build/database or responsive/keyboard checks pass, and implementation evidence and affected links are complete.

## Validation plan

Use meaningful unit and integration tests for the listed behavior and failure cases, with exact actor/dataset checks and concurrency where state mutates. Database work uses disposable local databases; do not reseed retained data. Interface work requires desktop/mobile/keyboard/error-state proof. Run relevant existing tests, lint, type checking and build. Record nonapplicable checks explicitly.

## Implementation record

Type-first public booking. Athletes choose a private class, its default or explicitly selected active venue, a Berlin date and an available interval before submitting a reviewed request. The request remains pending until coach confirmation. Group offerings link to filtered Events. Any stored type opts the coach into catalog behavior, including a group-only catalog; an enabled empty/removed private offering never reactivates legacy private offers. Untouched existing coaches retain their original one-hour flow until opting in. Separate type-specific weekly schedules were deliberately deferred: offered classes use the coach's existing effective venue hours and booking switch. A failed times read has explicit retry; an uncertain successful request reuses its original command. Independent DEV0348 owns absent-capability and booking-only public-profile outage recovery; its implementation is preserved.

Important implementation files:

- [src/features/session-types/public-booking.tsx](../../../src/features/session-types/public-booking.tsx): class/venue/date selection, full intervals, review and exact retry.
- [src/app/_coaches/public-coach-page.tsx](../../../src/app/_coaches/public-coach-page.tsx): public catalog booking controls while retaining independent profile content.
- [src/app/api/coaches/[slug]/session-types/route.ts](../../../src/app/api/coaches/[slug]/session-types/route.ts): public catalog and bounded available-times API.
- [supabase/migrations/20261018000800_typed_private_sessions.sql](../../../supabase/migrations/20261018000800_typed_private_sessions.sql): public catalog opt-in and candidate authority.

Contracts/setup: this peer adds no package dependency or runtime environment variable. Apply migrations 20261018000700 → 20261018000800 → 20261018000900 before enabling the integrated interface. Existing retained data is not seeded or reset. Owner commands and private detail responses use private/no-store caching; public catalogs expose offered types only. Once typed 75/90-minute records exist, do not roll back to a one-hour-only application or drop the new metadata/audit tables; use a forward repair. Hosted rollout remains separate.

## Validation results

- AC1–AC2: Real athlete browser checks passed type/venue/date/full-interval selection, coach-confirmed 75-minute booking, a lost successful response followed by exact retry with one durable request, unavailable-times recovery, removed offerings and 375/430px controls without overflow. Database proof passed group-only catalog opt-in and retained legacy behavior for untouched coaches. Independent DEV0348 regression checks remain its own evidence.
- AC3: the combined fresh/upgrade rehearsal preserved original application rows without backfilling types. Applying only local migrations 007–009 preserved all 50 original application/Auth table fingerprints; retained coach type count remained zero. No reset, seed, credential rotation or hosted mutation occurred.
- AC4: `npm test` passed 304 unit + 55 server tests; four final targeted type/booking boundary checks, scoped ESLint, source TypeScript and the final isolated production build passed. Desktop/mobile/keyboard/error-state integration evidence is recorded in [DEV0346](../backend/DEV0346-rehearse-session-types-and-flexible-bookings.md).

[DEV0346](../backend/DEV0346-rehearse-session-types-and-flexible-bookings.md#validation-results) records exact commands, the fresh/upgrade database runs, all 14 browser checkpoints, initial failures/fixes, supporting artifact locations, preservation hashes and environment limitations. This peer's evidence is the owned behavior above; shared checks do not imply hosted deployment or independent review.

## Risks, limitations, and follow-ups

Hosted/UAT/production rollout is not performed. Existing coaches deliberately configure their catalog through Schedule → Session types; no retained fixtures are populated. Types use existing venue effective hours, zero buffers and the agreed 60/75/90-minute lengths. Separate per-type weekly schedules, prices/credits/payments and external calendar synchronization are outside this slice. Existing untyped records remain legacy records. Migration rollback must preserve typed terms/history; use forward repair after typed records exist.

## Completion and review references

- Completed: 2026-10-18 — all four criteria accounted for above.
- Commit: See the authorized checkpoint below.
- Review: Scope reviewed before implementation; no independent review.
- Deployment or release: Local schema only; no hosted rollout.

### Bounded availability assignment

Adopt the existing effective-hours editor as the time source: the type’s public-booking switch and optional default venue determine which existing venue hours it offers. A type with no default lets the athlete choose an active venue. Add guidance/linkage in type management; do not introduce a second competing weekly schedule editor. Separate per-type weekly schedules are deferred.

### Review correction before implementation

A coach with only a group type has deliberately configured their catalog. Treat any stored type as opt-in; do not require a private-format row or reactivate legacy private offers for a group-only catalog. Untouched existing coaches with no rows retain their legacy flow. Validate the group-only case with a disposable owner.

### Authorized commit checkpoint — 18 October 2026

The completed contract/runtime peers and DEV0348 profile compatibility repair share new domain types, public page/service imports and booking projections. They are committed together to keep the checkpoint buildable; each ticket retains its own scope/evidence. Active Auth and directory-card edits are excluded using an isolated Git index and exported candidate tree.

Exact candidate validation under Node 24.21.0: `node --import tsx --test tests/*.test.ts` passed **301 unit tests**; `node --import tsx --conditions=react-server --test tests/server/*.test.ts` passed **51 server tests** (352 total, zero failures/skips). Scoped ESLint and Prettier passed. `NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack` passed compilation, TypeScript, page generation and optimized production output. This suite count describes the isolated checkpoint; earlier larger shared-workspace counts include separate pending tests and are retained as historical evidence. Database/browser and preserved-data results above remain the evidence for those acceptance criteria; no code changed after candidate validation. Candidate Markdown review resolved 559 file links, with only the two intentionally untracked private tester journals handled outside Git. Final namespace, archive/index, dependency and whitespace checks passed.

Commit reference: `[DEV0257][DEV0340][DEV0341][DEV0342][DEV0343][DEV0344][DEV0345][DEV0346][DEV0348] Add session types and preserve public profiles` (this checkpoint). No hosted schema rollout, application deployment or independent review is implied.
