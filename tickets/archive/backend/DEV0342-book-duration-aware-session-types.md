# Ticket DEV0342: Book duration-aware session types

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: M11 — Session types and flexible bookings
- Coordination: [COR0029 — Session types and flexible bookings](../organisatory/COR0029-session-types-and-flexible-bookings.md)
- Related records: contract [DEV0257](../organisatory/DEV0257-define-reusable-session-types.md); dependencies and peer boundaries in COR0029.

## Objective and context

Deliver this owned slice of the user's Everfit-style model under [specification section 18.6](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings): coach-defined classes, athlete type-first selection and coach-confirmed bookings. Defaults include removable Private session and Group session types.

## Scope and non-goals

- In scope: Type/venue-bound availability candidates, 15-minute starts, 60/75/90-minute requests/acceptance, direct coach booking and per-booking override, snapshots and cross-format coach-time protection.
- Out of scope: No owner/public/calendar interface implementation or automatic demo setup. Credits, payments, external calendars and retained demo-data changes are excluded.

## Expected behavior and edge cases

Fresh/upgrade migration preservation; candidate fit; active venues; 30-date boundary/DST; request privacy; concurrent overlapping accepts/bookings; archive/availability/retry races; manual booking only for accepted same-dataset connections; overrides preserve IDs/history, detect conflicts and do not mutate types. Archived types remain historical references and never erase scheduled sessions or participant content. An empty catalogue is valid. Existing one-hour records remain readable with honest legacy labels; no invented type backfill.

## Assumptions, decisions, and dependencies

Confirmed: private/group types, 60/75/90-minute lengths, athlete chooses class then time, coach can book for an existing client/override one booking, either default may be removed. Adopted defaults are in the specification, including zero buffers, 15-minute starts, private-first requests and accepted-connection manual booking. Start condition: DEV0340; existing one-hour/request/group locks and durable message/booking history.

## Implementation plan

1. Review owned interfaces and existing authority; inspect installed framework/SQL documentation as applicable.
2. Implement only this slice with bounded contracts, actor checks, retries and retention; update scope before a material deviation.
3. Validate the criteria below using disposable/tagged accounts, review the diff and record exact results.

## Acceptance criteria

- [x] AC1: The owned deliverable above works end to end within its boundary.
- [x] AC2: Fresh/upgrade migration preservation; candidate fit; active venues; 30-date boundary/DST; request privacy; concurrent overlapping accepts/bookings; archive/availability/retry races; manual booking only for accepted same-dataset connections; overrides preserve IDs/history, detect conflicts and do not mutate types.
- [x] AC3: Existing bookings, retained history and demo/profile/password data are unchanged; no implicit startup provisioning.
- [x] AC4: Appropriate regression/static/build/database or responsive/keyboard checks pass, and implementation evidence and affected links are complete.

## Validation plan

Use meaningful unit and integration tests for the listed behavior and failure cases, with exact actor/dataset checks and concurrency where state mutates. Database work uses disposable local databases; do not reseed retained data. Interface work requires desktop/mobile/keyboard/error-state proof. Run relevant existing tests, lint, type checking and build. Record nonapplicable checks explicitly.

## Implementation record

Duration-aware private booking authority. Candidates are virtual 15-minute starts over contiguous effective hours at the actual active venue. The full 60/75/90-minute interval must fit, remain within the rolling 30 Berlin dates and avoid ambiguous daylight-saving boundaries and coach-wide reservations. Requests materialize an open occurrence without holding capacity. Acceptance, direct coach booking and individual overrides share the schedule lock and recheck availability; concurrent overlapping acceptances have one winner. Overrides retain the original booking ID, participant access, messages/notes and a revisioned previous/new-terms audit. Audit reads page 20 changes without discarding history. Type edits/archive and removed effective hours close only unreserved attempts. Confirmed snapshots and cancellation history remain intact. Existing one-hour records are not assigned invented types, and optional metadata is omitted when the extension is absent. Tests exposed and fixed insert visibility, explicit booking IDs and request-trigger flag restoration.

Important implementation files:

- [supabase/migrations/20261018000800_typed_private_sessions.sql](../../../supabase/migrations/20261018000800_typed_private_sessions.sql): typed candidates, interval guards, requests/acceptance, manual booking, snapshots, audit history and optional metadata.
- [src/domain/typed-sessions.ts](../../../src/domain/typed-sessions.ts): bounded request, owner command and booking-detail contracts.
- [src/server/db/coaches/typed-session-repository.ts](../../../src/server/db/coaches/typed-session-repository.ts): database reads/commands with validated results.
- [src/server/coaches/typed-session-service.ts](../../../src/server/coaches/typed-session-service.ts): verified actor orchestration and accepted-athlete options.
- [src/app/api/session-bookings/route.ts](../../../src/app/api/session-bookings/route.ts): participant details/history and athlete/coach commands.
- [src/server/db/coaches/session-type-capability.ts](../../../src/server/db/coaches/session-type-capability.ts): uncached optional-capability checks for pre-extension legacy projections.

Contracts/setup: this peer adds no package dependency or runtime environment variable. Apply migrations 20261018000700 → 20261018000800 → 20261018000900 before enabling the integrated interface. Existing retained data is not seeded or reset. Owner commands and private detail responses use private/no-store caching; public catalogs expose offered types only. Once typed 75/90-minute records exist, do not roll back to a one-hour-only application or drop the new metadata/audit tables; use a forward repair. Hosted rollout remains separate.

## Validation results

- AC1–AC2: Private database tests passed 75-minute full-fit candidates at 15-minute starts, horizon and ambiguous/missing Berlin time checks, no pending capacity hold, exact/stale requests, concurrent overlapping acceptance with one winner, archived-type denial, retained snapshots/cancellation, connected-athlete manual 90-minute booking, 75-minute override with stable ID/template, 20+5 audit paging, unrelated-reader denial and day-off pending closure. Legacy one-hour readers/confirmation passed both before and after schema installation.
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

### Implementation approach before code — 18 October

Use virtual 15-minute candidates over the union of contiguous effective one-hour ranges at the selected venue. A bookable private type uses matching effective hours at its optional default venue (or the venue explicitly chosen by the athlete when none is set); separate per-type weekly schedules are deferred. Materialize a typed occurrence only on request, without reserving capacity. Typed open candidates may overlap; confirmed/held occurrences and existing private/group reservations remain exclusive. Reuse existing request/booking IDs, message triggers, participant projections and cancellation history. Store reviewed type terms on occurrences. Add revision-checked coach booking commands/audit with no retained-data rewrite. Update the typed branch of guards while keeping legacy paths, whole-day closures and existing authority.

History reads are bounded to 20 changes per page with an original-booking/revision cursor. The owning coach and participant can page older audit terms; a changed booking requires reloading before appending history. Audit rows remain retained. This bounds the new detail response without discarding change evidence.

Pending-attempt reconciliation: type revisions/archive close open candidates and their pending requests atomically; effective-hours synchronization closes typed candidates that no longer fit, without generating them as one-hour inventory. Confirmed bookings retain their reviewed terms. This keeps availability-editor closed-request counts and participant status history consistent.

Rollout compatibility refinement before implementation: existing booking/request projections and calendar/group contexts must remain usable on the pre-extension database. Probe exact optional table/function capabilities before selecting new metadata; confirmed absence keeps legacy shapes and hides unsupported detail links. Installed-feature errors remain errors, with no invented empty/successful data. DEV0348 separately owns the public catalog/profile recovery boundary; this ticket owns compatibility of its new private projections and consumers.

### Authorized commit checkpoint — 18 October 2026

The completed contract/runtime peers and DEV0348 profile compatibility repair share new domain types, public page/service imports and booking projections. They are committed together to keep the checkpoint buildable; each ticket retains its own scope/evidence. Active Auth and directory-card edits are excluded using an isolated Git index and exported candidate tree.

Exact candidate validation under Node 24.21.0: `node --import tsx --test tests/*.test.ts` passed **301 unit tests**; `node --import tsx --conditions=react-server --test tests/server/*.test.ts` passed **51 server tests** (352 total, zero failures/skips). Scoped ESLint and Prettier passed. `NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack` passed compilation, TypeScript, page generation and optimized production output. This suite count describes the isolated checkpoint; earlier larger shared-workspace counts include separate pending tests and are retained as historical evidence. Database/browser and preserved-data results above remain the evidence for those acceptance criteria; no code changed after candidate validation. Candidate Markdown review resolved 559 file links, with only the two intentionally untracked private tester journals handled outside Git. Final namespace, archive/index, dependency and whitespace checks passed.

Commit reference: `[DEV0257][DEV0340][DEV0341][DEV0342][DEV0343][DEV0344][DEV0345][DEV0346][DEV0348] Add session types and preserve public profiles` (this checkpoint). No hosted schema rollout, application deployment or independent review is implied.
