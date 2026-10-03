# Ticket DEV0058: Adopt the fitness-access MVP contract

- Status: Completed
- Created: 2026-09-24
- Last updated: 2026-09-24
- Milestone: MVP product pivot and public presentation
- Coordination: [COR0005 — Fitness-access product pivot](COR0005-fitness-access-product-pivot.md)
- Related records: revises completed [DEV0005](DEV0005-consolidate-community-fitness-mvp.md), [DEV0007](../blockchain/DEV0007-eurc-only-wallet-contract.md), [DEV0022](../backend/DEV0022-social-contract-and-delivery-plan.md), and [DEV0048](../backend/DEV0048-remove-gym-membership-access.md); updates the plan later converted from retired DEV0017 to [COR0006](./COR0006-persistent-access-catalogue.md), later-cancelled [DEV0018](../backend/DEV0018-class-pass-reservations-and-confirmed-visits.md), [DEV0023](../backend/DEV0023-minimal-shared-activity-feed.md), and cancelled [DEV0024](../blockchain/DEV0024-verified-challenge-activity.md); precedes completed [DEV0059](../frontend/DEV0059-rewrite-public-positioning-and-guide.md) and [DEV0060](../frontend/DEV0060-replace-challenge-surfaces-with-access-navigation.md)

## Objective and context

Update the single current product contract after the 24 September 2026 decision to pivot from challenge creation and prize settlement to flexible fitness access. The current MVP will retain memberships, passes, ordinary events and sponsored events, while the social layer becomes a small participation/discovery aid with no reactions. Challenge modes, voting, prize pools, winners and challenge settlement leave the current scope.

The present [MVP specification](../../../docs/mvp-spec.md) and README still make challenge creation central, exclude consumer memberships and plan Cheer reactions. Current draft tickets inherit those assumptions. This ticket owns the documentation and planning reconciliation so later interface work does not implement against contradictory requirements.

## Scope and non-goals

- In scope: update the MVP specification's thesis, confirmed/proposed decision register, screens, evidence model, architecture, data phases, access/event contracts, social boundaries, definition of done, milestones, acceptance matrix and demo; update README navigation/status language; reconcile affected unimplemented tickets; cancel/archive challenge-only DEV0024; correct the stale seeded-member statement in the definition of done; record the pivot in the ticket index.
- Out of scope: changing application code or visual design; creating membership tables or a Solana program; processing payments; resolving every production membership/resale/refund/legal policy; rewriting archived historical records; claiming the current preview already implements the pivot.

## Expected behavior and edge cases

The current specification describes one coherent access-focused MVP. Membership, pass and event-ticket access stay distinct but share clear purchase, verification and redemption principles. A sponsored event is an ordinary event funding variant with equal stated attendee benefit, not a challenge or winner-based competition. Challenge routes and fixtures may remain temporarily as explicitly superseded implementation until DEV0060 removes them, but no current requirement or future ticket treats them as target behavior.

The social contract permits a minimal chronological stream of explicitly shared, verified participation and relevant club/event updates. It has no Cheers, likes, reaction table, comments, free-form posts, direct messages or algorithmic ranking. Booking, payment, entitlement, attendance and sharing remain separate evidence states.

The specification must distinguish confirmed direction from unresolved defaults. It must not promise paid membership resale, automated recurring billing, multi-gym credits, production integrations or a complete sponsored-event escrow contract. Historical ticket links continue to resolve and clearly remain historical.

## Assumptions, decisions, and dependencies

Confirmed user direction on 24 September 2026:

- retain memberships, passes, events and sponsored events;
- remove challenge mode from the current product direction;
- keep feeds minimal and remove reactions;
- improve both the writing and design of the public description, especially How it works.

For this first contract, “sponsored event” means a normal event where a business or organization covers some or all attendee access. There is no winner, vote or prize pool. Exact sponsorship settlement remains proposed/downstream. Transferable membership remains the flagship on-chain opportunity, but the exact entitlement and transfer policy must be frozen in later implementation tickets.

## Implementation plan

1. Replace challenge-first and reaction-oriented current requirements in the MVP specification with the confirmed fitness-access direction and explicit unresolved membership/sponsorship choices.
2. Reframe milestones and acceptance around discovery, membership purchase/transfer, passes, event tickets, sponsorship, staff redemption and minimal sharing while preserving identity/wallet/demo-integrity boundaries.
3. Update README current direction/status without claiming that the existing frontend, database or chain behavior has already changed.
4. Reconcile current planning records: remove challenge scope from DEV0017, preserve pass scope in DEV0018, narrow DEV0023 to a reaction-free feed, and cancel/archive DEV0024.
5. Update the ticket index and COR0005 progress map; run link, ID, status, stale-term and diff checks and record exact results.

## Acceptance criteria

- [x] AC1: The MVP specification and README consistently describe memberships, passes, events, sponsored events and minimal reaction-free community as current direction, while accurately describing the still challenge-oriented frontend preview.
- [x] AC2: Challenge creation, entry, voting, winners, prize pools and settlement are removed from current requirements, milestones, acceptance and demo; archived history remains intact and no unrelated wallet-authentication challenge terminology is incorrectly removed.
- [x] AC3: Membership transfer and sponsored-event funding are bounded honestly, with confirmed choices separated from unresolved transfer, refund, sponsorship and production-operation policy.
- [x] AC4: DEV0017, DEV0018, DEV0023 and DEV0024 have accurate scope/status/relationships; cancelled DEV0024 is archived and every index/link is updated.
- [x] AC5: Repository-local Markdown links, unique work-record IDs, current/archive statuses, formatting and diff whitespace checks pass; application tests are explicitly not applicable to this documentation/planning-only change.

## Validation plan

Use `rg` audits that distinguish product challenges from wallet-authentication challenges, and reactions from unrelated wording. Run the repository's Markdown link/record validation approach or an equivalent read-only script, `npx prettier --check` on changed Markdown when available, and `git diff --check`. Review every changed current ticket against its acceptance criteria and COR0005 work map. No runtime, database, browser or Devnet validation applies because this ticket changes no application behavior.

## Implementation record

Completed. The initial audit found current challenge requirements across the specification, README and DEV0017/DEV0023/DEV0024; it also found a stale definition-of-done promise that a seeded member could book without paying after DEV0048 removed that access path. The new contract replaces those requirements while labelling the still-challenge-oriented frontend honestly. The How-it-works page remains runtime work owned by DEV0059/DEV0060.

### Changes and rationale

Replaced the challenge-first specification with an access-focused contract covering programmable memberships, passes, ordinary/sponsored events, staff redemption and reaction-free chronological activity. Preserved account/wallet, authority, payment verification and demo-integrity boundaries; retained legacy anchors for historical records. README now distinguishes target direction from the superseded current preview.

Revised the unimplemented DEV0017 catalogue/draft plan, DEV0018 pass boundary and DEV0023 social plan. DEV0023 keeps its ID/history but now owns a minimal feed without reactions. DEV0024 was cancelled and archived because its entire challenge-source deliverable left the product.

### Affected files

| File or component                                                  | Change and purpose                                                                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`, `README.md`, `AGENTS.md`                       | Establish the authoritative access contract, honest implementation status/navigation and updated product-requirements link.                          |
| `tickets/current/backend/DEV0017*`, `DEV0018*`, renamed `DEV0023*` | Reconcile public catalogue, pass and minimal social plans without silently implementing memberships or sponsorship.                                  |
| `tickets/archive/blockchain/DEV0024*`                              | Preserve and cancel the unimplemented challenge-activity plan.                                                                                       |
| `tickets/current/frontend/DEV0059*`, `DEV0060*`                    | Prepare the website narrative/design and interface-retirement slices requested by the user.                                                          |
| `tickets/README.md`, `tickets/archive/organisatory/COR0005*`       | Register the completed pivot work map, lifecycle/status changes and next identifiers.                                                                |
| Affected archived/current links                                    | Keep renamed/moved ticket references and historical architecture/plan records navigable without rewriting their original implementation conclusions. |

### Decisions and deviations

- Defined sponsored events as ordinary events with sponsor-funded/subsidized attendee access, explicitly excluding winners, voting and prize pools.
- Recorded whole-entitlement gift transfer with recipient acceptance as P09 rather than silently deciding paid resale, fees, freezes or cancellation.
- Kept the current interface untouched and labelled it superseded; DEV0059/DEV0060 own implementation and visual validation.

### Contracts, configuration, and operations

Product/documentation contract changes only. No schema, API, dependency, environment variable, migration or deployment operation is introduced.

## Validation results

Date/environment: 24 September 2026, Node.js v24.21.0, documentation/planning-only worktree.

- A focused `rg` product-term audit reviewed challenge/reaction occurrences in current requirements, README and current tickets. Remaining product occurrences explicitly describe retirement/current-preview mismatch; wallet-authentication challenge terminology remains intact.
- A read-only Node validator checked **80 Markdown files and 59 unique DEV/COR records**, repository-relative links/anchors, current/archive status placement, required DEV coordination fields and index presence; passed with no errors.
- `npx --no-install prettier --check` on all changed Markdown files passed after formatting.
- `npm run format:check` passed for the repository's configured source/configuration set.
- `git diff --check` passed.
- Application, database, browser and Devnet checks were not run because this ticket changes product documentation and planning records only. DEV0059/DEV0060 retain runtime/visual verification.

| Criterion | Evidence                                                                                     | Result |
| --------- | -------------------------------------------------------------------------------------------- | ------ |
| AC1       | Specification/README contract and implementation-status review                               | Passed |
| AC2       | Focused product-term audit with wallet-authentication challenge distinction                  | Passed |
| AC3       | C20–C24 and P09–P12 review                                                                   | Passed |
| AC4       | DEV0017/DEV0018/DEV0023 review, DEV0024 cancellation/archive and link/index validator        | Passed |
| AC5       | 80-file/59-record validator, Prettier checks, configured format check and `git diff --check` | Passed |

## Risks, limitations, and follow-ups

The current application remains challenge-oriented until DEV0059 and DEV0060 complete; documentation must label that mismatch rather than imply delivery. Later membership and sponsorship implementation records remain required before code or migrations begin.

## Completion and review references

- Completed: 2026-09-24 — adopted the access-focused MVP contract and reconciled affected planning without changing runtime behavior.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC5; no independent review.
- Deployment or release: None.
