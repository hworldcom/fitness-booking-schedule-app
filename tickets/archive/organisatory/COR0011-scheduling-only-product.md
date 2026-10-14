# Coordination COR0011: Scheduling-only product branch

- Status: Completed
- Created: 2026-10-07
- Last updated: 2026-10-14
- Milestone: Scheduling-only product split
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: DEV0140, DEV0141, DEV0143
- Related records: Independent retained outcome; superseded dependencies pruned under DEV0225.

> Documentary pruning — 2026-10-14, [DEV0225](DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and boundaries

Coordinate a scheduling-only MovX branch from commit `52b2730`. The retained product lets guests discover coaches and open calendar times, lets email-authenticated clients book one capacity-one private session directly, and lets coaches publish availability and manage their schedule.

This record owns shared scope, sequence and integration evidence only. It does not authorize implementation or replace the detailed records in its direct development tickets. Historical SQL migrations remain untouched; retained records describe independent scheduling delivery only.

## Direct development work

| Implementation part                 | Development ticket                                                                                            | Owned deliverable                                                                                              | Start condition or dependency                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Product contract and work-map pivot | [DEV0140 — Adopt the scheduling-only contract](DEV0140-adopt-scheduling-only-contract.md)                     | Rewrite the current specification and reconcile incompatible current records before runtime changes            | Completed; supplies the authoritative target                                                      |
| Direct scheduling persistence       | [DEV0141 — Persist direct private bookings](../backend/DEV0141-persist-direct-private-bookings.md)            | Actor-authorized capacity-one bookings, cancellation and coach completion                                      | After DEV0140 establishes scheduling behavior                                                     |
| Scheduling-only interface           | [DEV0143 — Present the scheduling-only experience](../frontend/DEV0143-present-scheduling-only-experience.md) | Reframe public, client and coach routes around discovery, availability, direct booking and schedule management | After DEV0141 exposes the direct booking contract; retains the delivered direct-booking authority |

The retained direct members are DEV0140, DEV0141 and DEV0143. The former retirement record was removed by DEV0225; its deleted deliverable is not reassigned to a retained member. Original integration totals below describe the historical combined run, not a new three-record validation.

## Other relationships

- DEV0108 retains optional Mapbox discovery validation as independent work. The scheduling list must remain usable without Mapbox, so it does not block this product split.
- DEV0138/DEV0139 remain the historical Vercel-readiness and Cloudflare-retirement baseline consumed by this branch.
- Completed identity, coach profile, recurring availability and calendar records remain historical implementation evidence. This coordination does not reopen them.

## Delivery sequence and completion conditions

1. DEV0140 establishes the scheduling-only product contract and reconciles the ticket graph.
2. DEV0141 implements and validates direct database-backed booking transitions.
3. DEV0143 completes the public/client/coach experience against DEV0141 and removes obsolete navigation/copy.
4. Final integration runs unit/server tests, database tests when local Supabase is available, lint, type checking, formatting, native/Vercel builds and responsive browser checks for discovery, booking, cancellation and coach schedule management.

## Progress and integration record

- 2026-10-07: The user requested a new branch containing only the scheduling system without blockchain. Branch `scheduling-only` was created from Vercel-ready commit `52b2730`.
- 2026-10-07: Integration review found no live removed route or package import. The production route manifest contains only public/Auth/profile/coach scheduling routes; removed URLs return 404.

## Validation results

- Original work-map review passed at completion. The retained direct members DEV0140, DEV0141 and DEV0143 each completed their assigned scheduling deliverables and durable records; the documentary-pruned member is excluded from the present map.
- Database: local migration replay and seed passed; 143 pgTAP checks, 28 database integration tests and database lint passed.
- Application: 56 unit/server tests, lint, type checking, formatting and the guarded native Vercel production build passed.
- Responsive browser: 28 Playwright scenarios passed across desktop and mobile, including scheduling story/navigation, discovery/profile, guest sign-in guidance, protected coach pages, keyboard focus and removed-route 404s.
- Dependency/security: production dependency audit reports zero vulnerabilities. Five high development-only `braces` findings remain through Next's ESLint dependency tree; the only offered automated fix is a breaking forced downgrade and was not applied.

## Risks, limitations, and follow-ups

- Existing hosted databases still require the additive scheduling-only migration before this branch can accept direct bookings.
- No hosted Vercel/Supabase rehearsal or deployment was performed. Local integration validates the contract; release rehearsal remains a separate operational step and the specification's M4 milestone.
- Historical migrations may still contain unused tables by design. Destructive provider cleanup requires a separate reviewed operation.

## Completion and review references

- Completed: 2026-10-07.
- Direct development tickets: DEV0140, DEV0141 and DEV0143 completed and archived.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: Work-map, runtime boundary and integration evidence self-reviewed; no independent review or pull request created.
- Deployment or release: Not deployed.
