# Ticket DEV0140: Adopt the scheduling-only contract

- Status: Completed
- Created: 2026-10-07
- Last updated: 2026-10-07
- Milestone: Scheduling-only product split
- Coordination: [COR0011 — Scheduling-only product branch](COR0011-scheduling-only-product.md)
- Related records: supersedes the branch contract historically coordinated by [COR0010](COR0010-group-funded-coach-marketplace-mvp.md); retains the identity, coach-profile, discovery and availability foundations indexed by [COR0001](../../current/organisatory/COR0001-project-structure.md)

## Objective and context

Replace the branch's coach-pass/group-funding product contract with one authoritative scheduling-only contract before implementation begins. The current [MVP specification](../../../docs/mvp-spec.md) requires Solana wallets, EURC payments, credits, group-event funding and social behavior, which conflicts with the user's requested branch.

## Scope and non-goals

- In scope:
  - Define the retained guest, client and coach scheduling behavior and permissions.
  - Remove blockchain, payment, event-funding and social/feed requirements from the current specification.
  - Reconcile current coordination/development records that are incompatible with this branch while preserving archived history.
  - Update README navigation/status and the ticket index.
- Out of scope:
  - Runtime, schema, route, component or dependency changes owned by DEV0141–DEV0143.
  - Deleting historical tickets, migration history or external Solana/provider state.

## Expected behavior and edge cases

- The current contract describes coach discovery, availability, direct capacity-one booking, client cancellation and coach completion without wallets, credits or payments.
- Current tickets do not claim that removed marketplace work remains a delivery dependency.
- Completed/archived blockchain and social records remain factual history rather than being rewritten.

## Assumptions, decisions, and dependencies

- Email-backed identity remains the authority for client/coach scheduling actions.
- Mapbox remains optional; list discovery is authoritative and usable without it.
- A signed-in client may book another visible coach's future open slot; a coach retains client behavior but cannot book their own slot.
- Client or coach cancellation before session start is immediate because no financial credit needs return; coaches may mark elapsed bookings completed.
- Historical database structures are not current behavior merely because their migrations remain replayable.

## Implementation plan

1. Rewrite the MVP specification around the retained scheduling state and acceptance matrix.
2. Update README product/foundation language.
3. Cancel/archive incompatible unfinished blockchain, pass/event, wallet and public-story records; make retained Mapbox work independent.
4. Update COR0010/COR0003/COR0001 and the ticket index without altering archived implementation evidence.
5. Run Markdown formatting, link and consistency checks.

## Acceptance criteria

- [x] AC1: The specification has one scheduling-only contract with no current blockchain, wallet, payment, group-event or social requirement.
- [x] AC2: Every incompatible current work record is cancelled/archived or explicitly made historical; retained work has accurate ownership.
- [x] AC3: README and ticket index describe the scheduling-only branch without claiming runtime implementation is already complete.
- [x] AC4: All changed local Markdown links and work-map memberships are valid.

## Validation plan

Run Prettier over changed Markdown, a local relative-link checker, searches for current requirement language and `git diff --check`. Application tests are not required for this documentation/work-map ticket.

## Implementation record

### Changes and rationale

- Replaced the two-loop marketplace specification with one scheduling-only contract covering email authority, coach discovery, recurring availability, direct capacity-one bookings, client/coach cancellation and coach completion.
- Rewrote README product/setup/deployment guidance to describe the retained Next.js, Supabase, Mapbox and Vercel system without presenting removed behavior as current.
- Created COR0011 and four flat direct implementation tickets for the contract, booking core, runtime retirement and interface.
- Cancelled and archived DEV0047, DEV0122–DEV0125, DEV0129–DEV0130, DEV0136, COR0003 and COR0010. Their partial/completed evidence remains intact and explicitly does not claim unmet criteria.
- Made DEV0108 independent reusable discovery work and updated COR0001/DEV0055 relationships for the new branch.

### Affected files

| File or component                                                 | Change and purpose                                                                                    |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`, `README.md`, `AGENTS.md`                      | Establish the scheduling-only product, navigation/setup summary and current requirement anchors.      |
| `tickets/archive/organisatory/COR0011-scheduling-only-product.md` | Own the completed flat work map, sequence and integration evidence.                                   |
| `tickets/archive/{organisatory,backend,frontend}/DEV0140–DEV0143` | Preserve independently reviewable product, persistence, removal and interface implementation records. |
| Cancelled records under `tickets/archive/`                        | Preserve prior wallet/pass/group-event work and record why it no longer proceeds on this branch.      |
| `tickets/README.md`, COR0001, DEV0055 and DEV0108                 | Reconcile statuses, paths and retained ownership.                                                     |

### Decisions and deviations

- 2026-10-07: Pre-implementation review split the requested product branch into four peer tickets because contract reconciliation, booking persistence, runtime removal and interface work have independent acceptance evidence.
- 2026-10-07: “Only scheduling” excludes off-chain follows/posts and group events as well as blockchain behavior. Discovery/location remains because a client needs coach and place context before selecting a time.
- 2026-10-07: Existing provider database/on-chain state and historical SQL are preserved. Current runtime removal is owned by DEV0142; destructive external/data cleanup is not implied by a product branch.

### Contracts, configuration, and operations

The product contract changes materially: email identity and PostgreSQL become the only authorities for scheduling. Wallet/Solana/payment/social environment and interface contracts are superseded on this branch. No runtime, database, provider or external state changed under this documentation ticket.

## Validation results

- Date/environment: 2026-10-07 local macOS workspace.
- `npx prettier --write AGENTS.md README.md docs/mvp-spec.md tickets/**/*.md supabase/README.md` completed successfully.
- A repository-wide checker validated 1,039 relative Markdown links across 108 files with zero missing targets.
- Status-location checks found no unfinished record in the archive and no Completed/Cancelled record under `tickets/current/`.
- `git diff --check` passed.
- Application tests were not run because DEV0140 changes only the product/work-record contract; runtime validation belongs to DEV0141–DEV0143.

| Criterion | Evidence                                                                                                        | Result |
| --------- | --------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Specification decision register, flows, state model and acceptance matrix contain only scheduling requirements. | Passed |
| AC2       | Ten incompatible records were cancelled/archived; DEV0108 is independent and COR0011 owns current delivery.     | Passed |
| AC3       | README and index name the branch/current work and distinguish target from delivered foundation.                 | Passed |
| AC4       | Repository-wide link, status-location, Prettier and diff checks passed.                                         | Passed |

## Risks, limitations, and follow-ups

- No local implementation gap remains for DEV0141–DEV0143. Hosted deployment and rehearsal remain separate operational work recorded by COR0011.

## Completion and review references

- Completed: 2026-10-07 — scheduling-only contract and work map adopted.
- Commit: Included in `[DEV0140][DEV0141][DEV0142][DEV0143][DEV0144][DEV0145] Adopt scheduling-only product`.
- Review: Self-reviewed against AC1–AC4; no independent review or pull request created.
- Deployment or release: None.
