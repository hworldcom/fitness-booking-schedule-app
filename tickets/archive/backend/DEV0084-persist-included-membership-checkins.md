# Ticket DEV0084: Persist included membership check-ins

- Status: Completed
- Created: 2026-09-27
- Last updated: 2026-09-28
- Milestone: M3 check-ins, member-price access and allocation
- Coordination: [COR0008 — Membership reservations and check-ins](../organisatory/COR0008-membership-reservations-and-checkins.md)
- Related records: builds on active periods from [DEV0080 — Persist membership activation foundation](DEV0080-membership-activation-foundation.md), consumes the shared daily-access claim from completed [DEV0086 — Persist included class reservations](DEV0086-persist-included-class-reservations.md), supplies [DEV0085 — Add the member check-in interface](../frontend/DEV0085-member-checkin-interface.md), and is deliberately distinct from the financial club-wallet authority in [DEV0041](../../current/backend/DEV0041-club-wallet-authorization.md); the original broad DEV0084 plan is preserved in commit `f6bde9f`

## Objective and context

Turn an eligible arrival at one of the four gyms frozen into an active membership into immutable attendance only after authorized same-venue staff confirm physical presence. For a scheduled class, confirmation consumes DEV0086's held daily-access claim. For ordinary open-gym access, the same boundary first holds and then consumes a daily-access claim without inventing a class reservation.

This ticket owns the attendance portion of [included check-ins](../../../docs/mvp-spec.md#74-included-check-ins), M3 and acceptance scenarios A05–A11/A24. Advance reservation/capacity moved to DEV0086, monetary provisional allocation remains a later ticket, and member presentation remains DEV0085.

## Scope and non-goals

- In scope: one short-lived opaque arrival request bound to member, active period, selected venue and optional reservation/session; a 15-minute presentation token/code stored only as a hash; pending/confirmed/expired/cancelled lifecycle; authenticated email-account actor plus active same-venue `manager` or `check_in_staff` authorization; reservation/window validation; shared `membership_daily_access_claims` acquisition/consumption/release; immutable venue-local service date; Basic confirmed-use consumption; Classic attendance without a numerical allowance; duplicate/concurrency protection; immutable private attendance; member history/allowance reads; bounded staff-confirmation service/route; migrations and database/domain tests.
- Out of scope: class discovery/reservation/capacity owned by DEV0086/DEV0087; member UI owned by DEV0085; staff scanner/workspace UI; club-wallet proof; monetary allocation calculation or payout; direct non-core visits; social publication; penalties, refunds, notification delivery and production attendance hardware.

## Expected behavior and edge cases

Near arrival, a signed-in member creates or resumes one pending request for a selected gym. A reservation-backed request is also bound to the exact `reserved` class and opens 30 minutes before the class starts; it closes when the class ends. A venue-only open-gym request needs no class. The server generates a high-entropy opaque value, returns it only with the first successful create response and persists only its SHA-256 hash plus request metadata. The browser retains that raw value only for the pending request; no personal or financial data is embedded in it.

The code expires 15 minutes after creation and cannot be confirmed at another gym. A reservation-backed code expires earlier when the class ends. Staff authenticate with their own email account; the server derives their profile and requires an active `venue_staff` relation with `manager` or `check_in_staff` for the exact venue. Club-wallet proof is unnecessary because confirming presence is not a financial signature.

Creating a reservation-backed arrival reuses its existing `held` claim. Creating a venue-only open-gym arrival atomically obtains a `held` claim for the venue-local service date; cancellation or expiry releases it. This prevents a class reservation and open-gym arrival from both reserving the same membership day.

Confirmation rechecks the active period, selected venue, code hash/expiry, staff scope, immutable service date, daily claim and the reservation when present. For Basic, it atomically changes the claim from `held` to `consumed` and increments confirmed usage exactly once. For Classic, it consumes the same daily claim without creating a synthetic balance. A reservation-backed confirmation also changes the reservation to `checked_in`; immutable attendance is written once and repeated confirmation returns the same result. Wrong venue/staff, expired code/period, terminal reservation, exhausted Basic allowance, released/consumed claim, second same-day attendance or concurrent conflict changes no usage or history.

The attendance record is an auditable future allocation input, but DEV0084 calculates no monetary share. Private check-ins do not enter social queries until DEV0023 explicitly consumes confirmed evidence.

## Assumptions, decisions, and dependencies

- Completed DEV0086 supplies the shared daily-access claim and reserved terminal transition. This ticket must use that contract rather than introduce a parallel daily-use model.
- Fifteen minutes applies to the arrival code, not the advance reservation. A different configurable window requires a recorded product change.
- For the hackathon, a reservation-backed arrival opens 30 minutes before class and closes at class end. This is an implementation default rather than a validated production policy.
- The one-per-day rule is per membership/service date across all four gyms. The target venue's IANA timezone derives that date.
- PostgreSQL is the hackathon attendance authority. Activation and direct payments retain separate Solana verification boundaries.
- Raw presentation codes remain only in the first create response and bounded browser session state; they never enter persistent storage or logs. The server stores their SHA-256 hash. A reload in the same browser resumes the raw value and existing request, while a lost value requires the member to cancel/expire that request before creating a replacement.
- Expiry is reconciled lazily during member reads, create/cancel operations and staff confirmation; the hackathon flow requires no background scheduler.
- The existing `venue_staff` relation, not DEV0041 club-wallet proof, supplies operational attendance authority.

## Implementation plan

1. Implement the reviewed server-generated-code contract, 30-minute class arrival window, lazy expiry and DEV0086's atomic reservation/daily-claim boundary.
2. Add additive schema/Drizzle mappings and database functions for create/resume, expire/cancel and same-venue staff confirmation with immutable attendance and daily/use serialization.
3. Add member request/history/allowance and staff confirmation repositories/services/routes with server-derived actor and venue authority.
4. Make the confirmed attendance projection safe for later member UI and allocation/social consumers without publishing private data or monetary claims.
5. Add migration, database, domain, authorization, expiry and concurrency coverage; replay migrations/seed cleanly and run static/build validation.

## Acceptance criteria

- [x] AC1: An active member can create or resume one 15-minute arrival request only for a selected core gym and, when class-backed, one eligible `reserved` reservation; losing the raw browser-held value cannot silently create a second active request.
- [x] AC2: The returned opaque code contains no personal/financial data, is stored only as a hash, is bound to the exact venue/request and cannot be used after expiry.
- [x] AC3: Only a signed-in actor with active same-demo-dataset, same-venue `manager` or `check_in_staff` authority can confirm; club-wallet proof, member action, wrong-venue staff and stale authority cannot create attendance.
- [x] AC4: Basic confirmation atomically changes exactly one daily-access claim from `held` to `consumed`, increments confirmed usage once and rejects an eleventh; concurrent final-use attempts produce at most one success.
- [x] AC5: Classic consumes the same daily claim without a numerical monthly allowance, while both plans reject another held or consumed claim across the membership on the same venue-local service date.
- [x] AC6: Reservation-backed confirmation atomically sets `checked_in`; venue-only arrival obtains and consumes the shared claim without a fabricated reservation; terminal reservations and released/consumed claims cannot confirm.
- [x] AC7: Successful confirmation creates one immutable private attendance record; duplicate code/operation/confirmation retries return the existing result without double effects.
- [x] AC8: Member reads expose only that actor's pending/history/allowance state, staff confirmation exposes only the bounded outcome, and unshared attendance remains absent from social queries.
- [x] AC9: Forward/clean migration replay, authorization/concurrency/database tests, unit tests, lint, typecheck, formatting, database lint and production build pass.

## Validation plan

Use separate member, same-venue staff, wrong-venue staff and ordinary non-staff actors. Exercise valid/expired/replayed/tampered codes, reservation and open-gym arrivals, Basic uses one through eleven with active future holds, Classic around local midnight, same-day different-gym attempts, expired periods and concurrent confirmations. Assert every rejection leaves usage, reservation and attendance unchanged.

Run forward migration, clean migration/seed replay, pgTAP or equivalent constraints, focused database integration tests, the full unit suite, lint, typecheck, formatting, database lint, production build and `git diff --check`. Browser evidence belongs to DEV0085 and the later staff-interface ticket.

## Implementation record

Implemented the private arrival and attendance boundary over DEV0086's daily claims. The original committed plan combined reservation, attendance and monetary allocation; the delivered scope retains only persistence, rules and private server contracts while DEV0085 owns the member interface and later tickets own allocation.

### Changes and rationale

Added two forced-row-level-security tables. `membership_arrival_requests` stores one idempotent member operation, selected venue, optional reservation, immutable service date, claim reference and SHA-256 code hash through a pending/confirmed/expired/cancelled lifecycle. `membership_checkins` stores one immutable private attendance record per claim, arrival and optional reservation.

Security-definer database functions now create or resume arrivals, lazily expire them, cancel member-owned requests, return a member-safe allowance/pending/history snapshot and confirm attendance only for active same-venue staff. Reservation arrivals reuse their held claim; open-gym arrivals create one. Confirmation atomically consumes the claim, moves a reservation to `checked_in` when present, increments Basic exactly once, leaves Classic without a synthetic balance and writes immutable evidence. The same transaction rejects expired codes, wrong/stale staff, inactive periods, terminal reservations, exhausted allowance and unusable claims without partial changes.

The server generates 32 random bytes and returns the base64url presentation value only when a request is first created. It sends only the SHA-256 hash to persistence. Private member create/read/cancel routes and a bounded staff confirmation route derive identity from the verified email session and apply the established exact-origin mutation boundary. The browser-facing snapshot validator rejects extra fields such as a code hash.

### Affected files

| File or component                                                                                                                            | Change and purpose                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260928000300_create_membership_checkins.sql`                                                                          | Adds private arrival/attendance tables, constraints, indexes, transition guards, row-level-security policies and atomic member/staff functions.                               |
| `src/server/db/schema/membership.ts`                                                                                                         | Maps arrival and attendance records for typed server use.                                                                                                                     |
| `src/domain/membership-checkins.ts`                                                                                                          | Defines and strictly validates the member-safe snapshot, identifiers and 32-byte base64url presentation-code shape.                                                           |
| `src/server/db/checkins/repository.ts` and `src/server/checkins/service.ts`                                                                  | Map bounded database outcomes, generate/hash the opaque code and enforce verified actor access without exposing persistence details.                                          |
| `src/app/api/membership/check-ins/**`                                                                                                        | Adds private member snapshot, create and cancel operations with exact-origin checks on mutations.                                                                             |
| `src/app/api/staff/check-ins/confirm/route.ts`                                                                                               | Adds the bounded same-venue staff confirmation operation; no staff workspace UI is implied.                                                                                   |
| `tests/database/membership-checkins.test.ts`, `supabase/tests/database/membership-checkins.test.sql` and `tests/membership-checkins.test.ts` | Cover RLS/grants, no raw-code storage, Basic/Classic rules, authorization, cancellation/expiry, concurrency, immutability and response validation.                            |
| `package.json`                                                                                                                               | Runs stateful database integration files sequentially so their deliberate mutations of one deterministic local fixture cannot race across processes.                          |
| `AGENTS.md`                                                                                                                                  | Retains the contributor guidance automatically appended by the installed Next.js development server so future framework edits consult bundled version-specific documentation. |
| `README.md`, `docs/mvp-spec.md` and coordination records                                                                                     | Record the delivered backend boundary while keeping the member QR interface, staff workspace, allocation and social publication out of scope.                                 |

### Decisions and deviations

- 2026-09-27: Preserve DEV0084 because its planning record was already committed; narrow its implementation ownership to arrival and attendance under COR0008.
- 2026-09-27: Remove reservation/capacity and monetary allocation calculation. DEV0086 owns reservation; confirmed attendance merely supplies a future allocation input.
- 2026-09-27: Use email-authenticated `venue_staff` authority rather than the unrelated club-wallet proof.
- 2026-09-28: Consume DEV0086's shared daily-access claim for reservation-backed attendance. Venue-only arrival uses the same claim contract so reservation and open-gym flows cannot both use one membership day.
- 2026-09-28: DEV0086 completed the private `held`/`consumed`/`released` claim and four-state reservation schema. DEV0084 is technically unblocked.
- 2026-09-28: Readiness review adopted a 30-minute-before-start through class-end reservation arrival window, capped every code at 15 minutes, chose server-generated 32-byte opaque codes with persisted SHA-256 hashes, and chose lazy expiry reconciliation. These are bounded hackathon defaults. The ticket moved to In progress before implementation edits.
- 2026-09-28: Kept expiry lazy and transactional. Expired open-gym arrivals release their temporary claim; expired reservation arrivals preserve the independently valid reservation hold until cancellation, session cancellation or no-show reconciliation.
- 2026-09-28: The first focused integration run exposed an open-gym branch reading an unassigned class-only record variable. Replacing it with an explicitly nullable class-session identifier fixed the defect before completion.
- 2026-09-28: The initial full integration run exposed cross-file races because stateful tests deliberately changed the same seeded schedule and reused temporary chain evidence concurrently. The database test script now runs files sequentially; concurrency inside the reservation and check-in cases remains explicit and tested.
- 2026-09-28: The installed Next.js development server appended its managed contributor-rule block to `AGENTS.md`. It is retained with the implementation so framework work uses the bundled version-specific documentation and a subsequent `next dev` run does not recreate an unexplained dirty-tree change.

### Contracts, configuration, and operations

Migration `20260928000300_create_membership_checkins.sql` is additive and must run after the reservation migration. It adds `app.membership_arrival_requests`, `app.membership_checkins` and five security-definer operations. Rollback would destroy pending-arrival and attendance history, so no automatic down migration is supplied; a rollback requires an explicit retention/export decision.

The private HTTP contract adds `GET|POST /api/membership/check-ins`, `POST /api/membership/check-ins/cancel` and `POST /api/staff/check-ins/confirm`. A successful first create is the only response containing `presentationCode`; retries return metadata without reconstructing the raw code. No environment variable, dependency, wallet key, Solana program, public route or payment contract changed.

## Validation results

The clean local replay applied every migration through `20260928000300`, seeded successfully and recreated the restricted runtime login. Browser validation is not applicable because DEV0084 exposes no member or staff interface; DEV0085 owns that evidence.

| Criterion | Evidence                                                                                                                                                                                                                                         | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1–AC2   | Focused integration covers selected-venue class/open-gym creation, exact operation retry, one pending request, cancellation and lazy expiry; pgTAP proves only `code_hash` is stored; unit validation rejects malformed codes and leaked fields. | Passed |
| AC3       | Integration rejects an ordinary member, wrong-venue staff and a revoked staff relation, then accepts the restored active same-venue relation.                                                                                                    | Passed |
| AC4       | A Basic period at nine confirmed uses receives one class hold; concurrent confirmations converge on `confirmed`/`existing`, one attendance row and exactly ten uses. A different service-date attempt rejects the eleventh use.                  | Passed |
| AC5       | Classic open-gym confirmation consumes its claim while `includedCheckins` remains null and numerical usage remains zero; a second same-day gym rejects with `daily-conflict`.                                                                    | Passed |
| AC6–AC7   | Class confirmation atomically produces `checked_in`/`consumed`; open-gym cancellation and expiry release their claims; replay returns the same check-in; a direct evidence update is rejected as immutable.                                      | Passed |
| AC8       | Forced RLS denies direct runtime reads, member snapshots contain only that actor's pending/history/allowance fields, and staff receives only a bounded outcome/check-in identifier. No social query changed.                                     | Passed |
| AC9       | Clean `db:reset`/`db:runtime`; `npm run test:db` 35/35; `npm run db:test` 168 assertions; `npm test` 87/87; database lint, ESLint, typecheck, Prettier, production build and `git diff --check` passed.                                          | Passed |

## Risks, limitations, and follow-ups

A displayed arrival code can be shared during its short lifetime; same-venue staff still confirm physical presence, so the code is a lookup capability rather than proof by itself. Expiry is reconciled only when a relevant member/staff operation runs, not by a background job. The later gym workspace must prevent accidental confirmation and show member/session context without exposing private financial data. DEV0085 must keep the first-response raw code in bounded session state and provide cancel/expiry recovery when that value is lost.

## Completion and review references

- Completed: 2026-09-28.
- Commit: Implementation and DEV0089 planning committed in `867bc76` — `[DEV0084][DEV0089] Persist check-ins and plan wallet card`; initial broad planning is `f6bde9f` and split revision is `25d4842`.
- Review: Implementation self-review against AC1–AC9 completed; no independent review.
- Deployment or release: None. The migration and routes are validated locally but have not been applied or deployed to staging.
