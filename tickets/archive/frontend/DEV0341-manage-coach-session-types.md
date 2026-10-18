# Ticket DEV0341: Manage coach session types

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: M11 — Session types and flexible bookings
- Coordination: [COR0029 — Session types and flexible bookings](../organisatory/COR0029-session-types-and-flexible-bookings.md)
- Related records: contract [DEV0257](../organisatory/DEV0257-define-reusable-session-types.md); dependencies and peer boundaries in COR0029.

## Objective and context

Deliver this owned slice of the user's Everfit-style model under [specification section 18.6](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings): coach-defined classes, athlete type-first selection and coach-confirmed bookings. Defaults include removable Private session and Group session types.

## Scope and non-goals

- In scope: Owner create/edit/remove/restore interface, explicit defaults for existing coaches and entry link from Schedule.
- Out of scope: No duration-aware inventory or client booking flow. Credits, payments, external calendars and retained demo-data changes are excluded.

## Expected behavior and edge cases

Desktop/mobile keyboard creation/edit/archive/restore, error/conflict draft retention, deleting either/both defaults and empty catalogue; owner actor changes never save into another coach. Archived types remain historical references and never erase scheduled sessions or participant content. An empty catalogue is valid. Existing one-hour records remain readable with honest legacy labels; no invented type backfill.

## Assumptions, decisions, and dependencies

Confirmed: private/group types, 60/75/90-minute lengths, athlete chooses class then time, coach can book for an existing client/override one booking, either default may be removed. Adopted defaults are in the specification, including zero buffers, 15-minute starts, private-first requests and accepted-connection manual booking. Start condition: DEV0340 persistence/API.

## Implementation plan

1. Review owned interfaces and existing authority; inspect installed framework/SQL documentation as applicable.
2. Implement only this slice with bounded contracts, actor checks, retries and retention; update scope before a material deviation.
3. Validate the criteria below using disposable/tagged accounts, review the diff and record exact results.

## Acceptance criteria

- [x] AC1: The owned deliverable above works end to end within its boundary.
- [x] AC2: Desktop/mobile keyboard creation/edit/archive/restore, error/conflict draft retention, deleting either/both defaults and empty catalogue; owner actor changes never save into another coach.
- [x] AC3: Existing bookings, retained history and demo/profile/password data are unchanged; no implicit startup provisioning.
- [x] AC4: Appropriate regression/static/build/database or responsive/keyboard checks pass, and implementation evidence and affected links are complete.

## Validation plan

Use meaningful unit and integration tests for the listed behavior and failure cases, with exact actor/dataset checks and concurrency where state mutates. Database work uses disposable local databases; do not reseed retained data. Interface work requires desktop/mobile/keyboard/error-state proof. Run relevant existing tests, lint, type checking and build. Record nonapplicable checks explicitly.

## Implementation record

Owner session-type manager. Coaches open Schedule → Session types to manage offerings. Removal requires an explicit review and explains that scheduled sessions stay retained. Restore is deliberate; reloading or signing in never recreates removed defaults. Drafts survive a failed/stale save, and an uncertain outcome retries the original command. The actor boundary hides sensitive content during verification and remounts it for another account. Owner labels are explicit for assistive technology; cards and navigation wrap on phones. Browser validation found ambiguous select labels and a navigation race from unnecessary router.refresh calls; the final implementation uses explicit labels and deliberate navigation.

Important implementation files:

- [src/features/session-types/manager.tsx](../../../src/features/session-types/manager.tsx): create/edit/remove review, restore, explicit defaults and retry/conflict recovery.
- [src/features/session-types/actor-boundary.tsx](../../../src/features/session-types/actor-boundary.tsx): hide verified drafts during transient account checks and discard them on a real account change.
- [src/features/session-types/session-types.css](../../../src/features/session-types/session-types.css): responsive fields/cards and visible keyboard focus.
- [src/app/coach/session-types/page.tsx](../../../src/app/coach/session-types/page.tsx): independent owner route.
- [src/features/coaches/coach-schedule-navigation.tsx](../../../src/features/coaches/coach-schedule-navigation.tsx): Session types and Schedule a client entry links.

Contracts/setup: this peer adds no package dependency or runtime environment variable. Apply migrations 20261018000700 → 20261018000800 → 20261018000900 before enabling the integrated interface. Existing retained data is not seeded or reset. Owner commands and private detail responses use private/no-store caching; public catalogs expose offered types only. Once typed 75/90-minute records exist, do not roll back to a one-hour-only application or drop the new metadata/audit tables; use a forward repair. Hosted rollout remains separate.

## Validation results

- AC1–AC2: Real owner browser checks passed editing a default to 75 minutes, stale-save draft retention/reload, keyboard removal of both defaults, persistence after reload, explicit restoration and denied athlete access. Loaded manager screens were visually reviewed at desktop, 375px and 430px; no document overflow. Catalog/database checks cover custom creation and revisioned lifecycle commands.
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

### Authorized commit checkpoint — 18 October 2026

The completed contract/runtime peers and DEV0348 profile compatibility repair share new domain types, public page/service imports and booking projections. They are committed together to keep the checkpoint buildable; each ticket retains its own scope/evidence. Active Auth and directory-card edits are excluded using an isolated Git index and exported candidate tree.

Exact candidate validation under Node 24.21.0: `node --import tsx --test tests/*.test.ts` passed **301 unit tests**; `node --import tsx --conditions=react-server --test tests/server/*.test.ts` passed **51 server tests** (352 total, zero failures/skips). Scoped ESLint and Prettier passed. `NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack` passed compilation, TypeScript, page generation and optimized production output. This suite count describes the isolated checkpoint; earlier larger shared-workspace counts include separate pending tests and are retained as historical evidence. Database/browser and preserved-data results above remain the evidence for those acceptance criteria; no code changed after candidate validation. Candidate Markdown review resolved 559 file links, with only the two intentionally untracked private tester journals handled outside Git. Final namespace, archive/index, dependency and whitespace checks passed.

Commit reference: `[DEV0257][DEV0340][DEV0341][DEV0342][DEV0343][DEV0344][DEV0345][DEV0346][DEV0348] Add session types and preserve public profiles` (this checkpoint). No hosted schema rollout, application deployment or independent review is implied.
