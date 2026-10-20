# Ticket DEV0388: Preserve accepted requests when rescheduling

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: UAT booking recovery
- Coordination: None — independent development ticket
- Related records: [DEV0387](../frontend/DEV0387-rehearse-and-clean-up-disposable-uat-users.md) (discovering UAT rehearsal; this is a follow-up, not a coordination deliverable)

## Objective and context

DEV0387 found a reproducible failure on UAT source `137a5b9`: an athlete requests a typed private class, the coach accepts it, then an otherwise valid coach duration override returns HTTP 400. The accepted request's composite foreign key references the booking's original slot. `app.coach_session_booking` changes that booking slot and violates `coach_booking_requests_booking_fkey` (SQLSTATE 23503). The transaction rolls back and the confirmed original booking remains unchanged. This violates the existing [flexible session behavior](../../../docs/mvp-spec.md#186-session-types-and-flexible-bookings) and [booking/recovery contract](../../../docs/mvp-spec.md#7-requests-booking-and-recovery).

## Scope and non-goals

Fix request-origin booking rescheduling while retaining the original accepted request and auditable booking changes. Add a meaningful regression through request → accept → override. Do not delete request history, rewrite unrelated bookings, reset accounts or weaken actor authorization. DEV0387 owns the discovering rehearsal; DEV0388 owns this fix, its migration rollout and a separate disposable validation cohort.

## Expected behavior and edge cases

The owning coach can override a future confirmed request-origin booking to an available 60/75/90-minute time/location. Original request terms remain historical evidence; the booking detail and change history show the revised terms to its athlete. Stale revisions and invalid overlaps fail atomically, exact retries are idempotent, and other actors cannot alter/read the booking. Cancellation/recovery remains consistent with the revised occurrence.

## Assumptions, decisions, and dependencies

The database diagnosis used only a tagged temporary DEV0387 coach/athlete with rollback. The HTTP reproduction used ordinary UAT actor cookies; no direct SQL result was counted as a successful product interaction. The 2026-10-20 source review below confirms the cause and narrows the proposed correction. The user authorized implementation on 2026-10-20. Adopt stable dataset/booking/coach/athlete linkage, initial acceptance-slot validation and immutable accepted-request content, using an incremental migration without changing existing rows. Validate this design in fresh and upgrade disposable databases before hosted use.

## Implementation plan

1. Preserve the accepted request's original slot and reviewed terms while linking it to the booking's stable identity. The proposed migration replaces the changing-slot component of the request-to-booking foreign key with stable dataset/booking/coach/athlete linkage, backed by a matching unique constraint. Validate the original slot match when the acceptance link is first established, and preserve that historical binding afterward. Review the complete constraint/trigger behavior before choosing the final SQL; simply removing integrity checks is insufficient.
2. Add an incremental migration and its preserved-data proof. Existing acceptance constructs the booking from the request's exact slot; keep that authority, participant/dataset binding, unique accepted booking and deletion protection. Update repository contracts only if required. Never alter an archived migration as the deployment mechanism.
3. Add a deterministic request → accept → 60-to-75-minute override regression in addition to the existing direct-coach-booking test. Cover repeated moves, venue/time changes, retry/stale/unauthorized/overlap failure and cancellation. Assert the same booking ID, unchanged original request row, current participant/message projections and retained change history. Exercise migration constraints and appropriate existing integration checks.
4. Use a new fresh/upgrade disposable rehearsal through migration `20261020000100_request_booking_identity_link.sql`, including an accepted request created before upgrade; compare all retained row hashes. Keep the historical type rehearsal cutoff unchanged. Run existing type/legacy suites against the updated scratch schema.
5. Run desktop/phone edit flow and a bounded disposable UAT rehearsal with exact cleanup after local validation. Record actual release separately.

## Acceptance criteria

- [x] AC1: A future confirmed booking created by accepting an athlete request can be rescheduled through the ordinary coach API/UI without a foreign-key error.
- [x] AC2: Original accepted request terms, revised booking terms and change audit all remain accurate; cancellation/recovery uses the correct occurrence.
- [x] AC3: Stale, unauthorized, overlapping and altered-retry commands remain atomic failures; exact retries reuse their result.
- [x] AC4: Required migration/integration checks and mobile/desktop interaction evidence pass; any hosted fixtures are removed and existing data preserved.

## Validation plan

Reproduce with two fresh actors, current default private type and contiguous effective hours: request a 60-minute class; coach accepts; POST `/api/session-bookings?coach=true` with `action:"override"`, current revision, same time/type/venue and `durationMinutes:75`. Current outcome is 400; expected outcome is saved with revision +1 and one change-history entry. Test meaningful database/API authorization and invariants, migration constraints, lint/types/build as appropriate. Use no retained accounts as fixtures.

## Implementation record

2026-10-20 implementation started after scope review. One focused backend slice owns the forward migration, request-origin regression, preserved-data rehearsal and existing desktop/phone edit-flow verification. No product behavior/specification change is required: restore the existing section 18.6 contract. Runtime rollout and test evidence will be recorded separately.

### Changes and rationale

Implemented a four-column dataset/booking/coach/athlete foreign key, with an initial slot-match guard and immutable accepted history. The trigger executes as its invoker under the existing owner-command row policies; it grants no runtime entry point. Existing acceptance, booking override and API/UI contracts remain unchanged. No rows are backfilled, seeded or rewritten.

### Affected files

Files: [forward migration](../../../supabase/migrations/20261020000100_request_booking_identity_link.sql) replaces the moving-slot relationship and guards accepted history; [regression](../../../tests/database/request-booking-rescheduling.test.ts) exercises the accepted-request lifecycle through restricted repositories; [disposable driver](../../../scripts/rehearse-request-booking-rescheduling-database.mjs) proves fresh/retained upgrades, reproduces the old failure, runs the existing type/legacy suites and drops its exact scratch databases. README documents that test command. Historical source: [typed booking migration](../../../supabase/migrations/20261018000800_typed_private_sessions.sql), [typed session API](../../../src/app/api/session-bookings/route.ts).

### Decisions and deviations

2026-10-20: Keep this fix separate from DEV0387's UAT run. A failed expectation is not a successful booking edit.

### Source review: 2026-10-20

- The [original foreign key](../../../supabase/migrations/20261016000100_baseline.sql#L15302) binds an accepted request to `(run_id, booking_id, slot_id, coach_id, athlete_id)`. The [override command](../../../supabase/migrations/20261018000800_typed_private_sessions.sql#L296) deliberately replaces the booking's current slot while retaining its ID. These two rules conflict even when only duration changes, because the changed interval creates a different slot.
- The [acceptance command](../../../supabase/migrations/20261016000100_baseline.sql#L75) already creates the booking from the exact request slot and participants. Original request terms are historical; rewriting them to the new booking terms would lose that distinction. Stable identity linkage must retain the dataset/participant checks and validate origin at acceptance.
- The [current regression](../../../tests/database/typed-sessions.test.ts#L194) accepts an athlete request, but then creates a separate booking with `action: "create"` and overrides that new booking. It never overrides the accepted request's booking. This explains why direct scheduling passed while DEV0387 found this failure.
- Existing booking details and message-context projections read the current booking/current slot by stable booking ID; cancellation also reads the booking's current slot. They are compatible with separating original request terms from current schedule terms, but need regression coverage after the constraint change. No frontend payload change is indicated by this review.
- This review used repository source and the recorded DEV0387 evidence only. It created no accounts, changed no database rows and ran no new hosted operations. At the end of that read-only review, the ticket remained Draft with implementation and fix validation outstanding; the subsequent implementation and validation are recorded here.

### Contracts, configuration, and operations

Schema-only migration adds a stable-identity unique key, replaces the accepted-request foreign key, removes its obsolete changing-slot unique key and adds an invoker trigger guarding initial origin and accepted-history immutability. No API/environment/dependency changes. Apply transactionally after 20261019000200. Older application code remains compatible. Reintroducing the old constraint after successful moves would reject valid history; prefer a forward correction rather than rewriting request/booking rows for rollback.

## Validation results

Discovery evidence: ordinary authenticated HTTP returned 400 for the valid override; rollback diagnosis reported SQLSTATE 23503 at the booking `slot_id` update and named `coach_booking_requests_booking_fkey`. Subsequent detail stayed confirmed revision 0, 60 minutes, zero changes. Private evidence: ignored `work/dev0387/phase3-results.json`, `diagnose-override.mjs`, `last-query-error.log`. This is failed product validation, not proof of a fix. Those are the pre-fix results; successful fix evidence follows.

2026-10-20 implementation validation:

- `node scripts/rehearse-request-booking-rescheduling-database.mjs`: passed 23 reported checks across fresh/upgrade runs (including the expected pre-migration foreign-key failure). Both scratch databases were removed. Upgrade kept an actual accepted request created before the migration and compared exact application/Auth-user/Storage row hashes. Existing session-type, typed booking, group/calendar and legacy suites passed on both updated schemas.
- The focused regression proves 60 → 75 minutes, a second time/venue move to 90 minutes, unchanged full original request, audit snapshots, stable booking identity, messages/title/current context, exact retry, altered/stale/outsider/overlap rejection, origin/participant constraint enforcement and cancellation recovery. An individual 90-minute override may retire its row on athlete cancellation while exposing the unchanged offered 60-minute template as a fresh candidate; the test verifies actual public capacity and a new request rather than requiring reuse of a retired row.
- `npm test`: all 428 unit/server tests passed. Root `npm run lint`/`npm run typecheck` encountered pre-existing ignored `work/` and `tmp/` source copies (110 lint errors plus existing type errors); no unrelated files were changed. Focused ESLint passed. A clean `git archive HEAD` snapshot overlaid with only DEV0388 source files passed full `npm run lint` and `npm run typecheck`. Private logs: ignored `work/dev0388/`.
- Explicit-project UAT rollback-only migration/ledger rehearsal passed: 57 exact data fingerprints unchanged, four stable foreign-key columns, enabled origin guard, invoker/app_owner metadata and no runtime execution grant. Migration SHA256 `f054b928538fe6d9523b306f81a41decfbb64c78bb014c13f8dd4afc46b9dde8`. The identical migration and its ledger entry were then committed to the explicit UAT project `mdzidiqosxbghmfyxphb`; the same 57 fingerprints were unchanged. Final independent readback matched the full ledger source to the repository file, confirmed its SHA256, validated the four-column foreign key, and confirmed the enabled invoker guard with no runtime execution entry.
- No Next.js product code changed, so no replacement application build/deployment is needed for this schema-only correction. The existing deployed API/forms are the hosted verification target.
- Final review: `git diff --check` passed; all four new source/ticket files were checked for trailing whitespace, 25 affected record links/anchors resolved, and DEV0388 has exactly one archived path. Baseline comparisons confirmed the unrelated README paragraph, ticket-index edits, specification and browser-test edits were preserved; only the DEV0388 index row and its discovering-record links changed for closure.

### Hosted coach/athlete verification and cleanup: 2026-10-20

Three uniquely tagged `.test` Auth accounts (coach, athlete, unrelated athlete) used ordinary product sign-in and identity enrollment. Setup approved only the disposable coach, used the existing Chimosa venue, and created contiguous future hours. No retained account was a write fixture; no email or image upload was sent. Native Chrome used an owned Incognito window, preserving the user's normal signed-in windows.

- AC1: Native coach acceptance created the original 60-minute booking. The existing desktop form saved 75 minutes (revision 1), then the 375×568 phone layout saved 90 minutes (revision 2), both showing “Session saved.” Ordinary actor API readbacks returned HTTP 200 with the expected duration and history count after each save. Keyboard Tab/Return was used through the desktop review/save flow. Evidence: ignored `work/dev0388/coach-desktop-75.png`, `coach-mobile-90.png`, `uat-edit-75.json`, `uat-edit-90.json`; `node work/dev0388/check-edit.mjs 75` and `90` exited 0.
- AC2: The full accepted-request row remained equivalent as a complete JSON row, with its original 60-minute terms; current booking and message context reflected 75 then 90 minutes. The existing message, custom title, booking ID and offered 60-minute type remained intact. Native athlete desktop/phone detail showed 90 minutes and two schedule changes. Native phone cancellation moved that occurrence to History as “Cancelled by athlete” and showed “Booking cancelled.” `node work/dev0388/check-cancellation.mjs` exited 0: current detail was cancelled/90 minutes, both audits and original request survived, the public 60-minute candidate at that time returned and a fresh ordinary request succeeded. The scratch regression separately verifies a move to a second venue/time and recovery there.
- AC3: Hosted stale revision edits returned HTTP 409 and the unrelated athlete's detail read returned HTTP 403. Exact retry, altered retry, overlap, athlete/other-coach mutation and integrity rejection are covered by the scratch lifecycle regression; they are not all claimed as native UI interactions.
- AC4: Prepared cleanup first passed a full transaction rollback against the populated cohort. `node work/dev0388/uat-fixtures.mjs` then exited 0 after removing the exact three Auth users and all fixture business rows; all 57 application/Auth-user/Storage table fingerprints and website revisions matched the post-migration baseline. `node work/dev0388/final-verification.mjs` independently exited 0 with zero test Auth users, profiles, managed/application sessions and Storage objects; all 57 fingerprints matched again. Temporary passwords/cookies were removed from the private manifest, and the owned Incognito window was closed. No retained demo content, real coach approval/audit, image, venue or application content changed.

Private evidence is ignored under `work/dev0388/`: `uat-dry-run.log`, `uat-apply.log`, `uat-fixtures.log`, `check-edit-75.log`, `check-edit-90.log`, `check-cancellation.log`, `final-verification.json`, baseline/after snapshots and desktop/phone screenshots. The ticket records the outcomes without publishing private fixture credentials or row content. The ad hoc cancellation checker initially expected a database-style status label; it was corrected to the existing API's `cancelled` value before the successful check. No product change was made for that assertion.

## Risks, limitations, and follow-ups

Accepted-request rescheduling is repaired on UAT. This is a focused lifecycle regression, not exhaustive product QA or a physical-device/other-browser claim. Root static checks still encounter unrelated ignored source copies; the isolated source snapshot passed full lint/type checks. Vercel alias/environment metadata could not be independently rechecked at handoff because the existing CLI token returned HTTP 403; this task performed no Vercel deployment or environment mutation. Production and the retained local application database were not migrated. No remaining DEV0388 acceptance criterion or fixture cleanup is outstanding.

## Completion and review references

- Completed: 2026-10-20 — AC1–AC4 passed; archived after exact UAT fixture cleanup and independent preservation/schema verification.
- Commit: Included with its implementation/validation record in this user-authorized 2026-10-20 checkpoint: `[DEV0388] Preserve accepted requests when rescheduling`. No new hosted operation is implied.
- Review: Changed schema, regression, rehearsal, README and affected record links self-reviewed against AC1–AC4; no independent reviewer claimed.
- Deployment or release: UAT schema migration `20261020000100` applied transactionally to `mdzidiqosxbghmfyxphb` on 2026-10-20. No replacement Vercel build; existing deployed API/forms were used for native verification. No production release.
