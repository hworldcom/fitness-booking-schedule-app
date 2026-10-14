# Ticket DEV0101: Retire the multi-gym membership runtime

- Status: Completed
- Created: 2026-10-02
- Last updated: 2026-10-14
- Milestone: Coach-first legacy runtime cleanup
- Coordination: None — independent development ticket
- Related records: Independent retained outcome; superseded handoffs removed under DEV0225.

> Documentary pruning — 2026-10-14, [DEV0225](../organisatory/DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Remove the superseded multi-gym membership runtime after the coach-first contract is adopted. Those capabilities no longer belong to the coach-first product and should not remain reachable or maintained as a second live product.

## Scope and non-goals

- Retained scope: retire the superseded membership API/service/interface surfaces, preserve independently consumed primitives and additive SQL history, and record exact local validation.
- Non-goals: new coach features, hosted data destruction or rewriting applied migrations.

## Expected behavior and edge cases

After completion, visitors and authenticated users cannot reach the old membership setup, My Membership, Basic/Classic activation, reservation, arrival/check-in or membership-card rehearsal flows. Old bookmarked URLs resolve predictably without exposing a half-working mutation path. No old `/api/membership/**` endpoint accepts or mutates state.

Existing schema may remain dormant until a separately reviewed data-retention/drop ticket decides its fate.

It must not copy the same logic into parallel old/new implementations.

## Assumptions, decisions, and dependencies

Its detailed superseded-record reconciliation may finish alongside this cleanup because the user explicitly prioritized removal first.
Until then, removed private/member routes may resolve to a truthful unavailable/not-found state rather than preserving obsolete behavior.

- Additive migration history is preserved. A later database-retention ticket may archive or drop dormant tables only after hosted data and rollback requirements are reviewed.
- The primary area is backend because API, service and persistence retirement is the central boundary; frontend and blockchain file removals are part of this one cross-cutting cleanup rather than duplicate tickets.

## Implementation plan

1. Build a route/import/config/test inventory for the multi-gym membership, reservation/check-in and membership-card families; classify each item as remove, temporarily retain, or extract as a generic coach-first dependency.
2.
3.
4. Run import/dead-route/config searches, relevant unit/static/build/browser validation and negative HTTP checks proving legacy mutations are unavailable.

## Acceptance criteria

- [x] AC1: No current navigation or reachable product screen exposes four-gym selection, Basic/Classic activation, multi-gym reservation/check-in or membership-card rehearsal behavior.
- [x] AC2: Superseded membership API endpoints cannot read or mutate private membership state and return an intentional safe response or no longer exist.
- [x] AC5: Historical migrations, archived tickets, transaction references and reconciled DEV0092 evidence remain intact; no destructive hosted-data change occurs.
- [x] AC6: Link/import/config searches, unit/static/build checks and focused legacy-route browser/HTTP checks pass.

## Validation plan

Before and after removal, use `rg` and import-graph/build failures to inventory every membership/reservation/check-in/card reference. Exercise old public and authenticated URLs plus every former membership API family and confirm intentional redirects/not-found responses with no mutations. Database migration tests are required only if an additive compatibility migration is introduced; dropping historical tables is not authorized here.

## Implementation record

Implementation started after the user explicitly selected cleanup as the first pivot step. The first attempt stopped after planning; on 2026-10-03 the user asked to run the cleanup again. Inventory and contract adoption precede deletion; existing membership-card work is recorded before removal rather than overwritten silently.

### Changes and rationale

The removal inventory is now fixed before deletion:

- Remove obsolete package scripts, browser expectations, boundary assertions, CSS imports and the QR-code dependency after their last consumer disappears.
- Preserve the additive Supabase migration history, SQL migration tests and archived tickets.

### Affected files

`src/components/shell.tsx`, `src/app/page.tsx`, `src/features/waitlist/coming-soon.tsx` and `src/features/profile/profile.tsx` provide the truthful transitional coach-first surface.

### Decisions and deviations

- 2026-10-02: Historical migrations and data are preserve-only in this ticket; runtime removal does not authorize destructive schema cleanup.
- 2026-10-02: The user chose legacy removal before replacement features.
- 2026-10-03: Review showed the old public catalogue and discovery screens were also a reachable second product, so the cleanup expanded within the ticket's retirement objective to remove them.
- 2026-10-03: Archived implementation records still referenced source files removed by this cleanup. Their claims and exact repository-relative paths were preserved as inline historical paths, while work-record links were retargeted to their archive/current locations, so documentation navigation contains no dead local links.

### Contracts, configuration, and operations

Package scripts for membership/card/club rehearsals and the unused QR dependency were removed.

## Validation results

- `npm test` — passed, 41/41 unit and boundary tests after removing obsolete suites and adding negative legacy-path assertions.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run format:check` — passed.
- Repository-local Markdown link check — passed across 125 Markdown files with zero missing local targets. Work-record lifecycle/index validation found 103 unique records, 103 matching index rows and zero path/status errors.

| Criterion | Evidence                                                                      | Result |
| --------- | ----------------------------------------------------------------------------- | ------ |
| AC1–AC2   | Production route manifest plus desktop/mobile negative-route tests            | Passed |
| AC3       | Source/package inventory and successful lint/typecheck/build after removal    | Passed |
| AC6       | Unit, static, production-build, formatting and focused browser commands above | Passed |

## Risks, limitations, and follow-ups

Dormant multi-gym tables and historical seed/migration definitions remain intentionally. Removing hosted data would be destructive and needs a separately reviewed retention/migration ticket after the coach schema is designed.

## Completion and review references

- Completed: 2026-10-03.

- Review: Self-reviewed against AC1–AC6; no independent review.
- Deployment or release: None.
