# Ticket DEV0210: Adopt the hackathon group-event contract

- Status: Completed
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Hackathon H0 product and architecture contract
- Coordination: [COR0019 — Hackathon Solana group events](../../current/organisatory/COR0019-hackathon-solana-group-events.md)
- Related records: supersedes the branch-level exclusions adopted by [DEV0140](../../archive/organisatory/DEV0140-adopt-scheduling-only-contract.md) without rewriting that archived history; reviews [DEV0126](../../archive/organisatory/DEV0126-adopt-coach-pass-and-group-funding-contract.md) as a historical baseline

## Objective and context

Revise the authoritative [MVP specification](../../../docs/mvp-spec.md) and repository navigation for a deliberate hackathon branch of the latest scheduling application. The current contract explicitly excludes wallets, payments and group events, so runtime work cannot begin until this ticket adopts a narrow Solana group-event extension and distinguishes confirmed user requirements from implementation defaults.

## Scope and non-goals

- In scope: define actors and authority; event metadata and funding lifecycle; Events navigation; payment asset and units; threshold, capacity, deadline and schedule rules; wallet ownership; fee-sponsor boundary; payout/refund behavior; PostgreSQL versus chain authority; Devnet/Vercel configuration; failure and recovery semantics; delivery milestones; acceptance scenarios; README navigation.
- Out of scope: runtime code, schema migrations, program implementation, live deployment, key creation, any transaction submission, private-session token payments, passes/credits, attendance, disputes, reviews, messaging, waitlists, ticket transfers or mainnet.

## Expected behavior and edge cases

The contract must state that a coach creates a real scheduled group event at one confirmed coach location with an exact seat price, minimum participants, maximum capacity and funding deadline. A participant funds one spot with a linked personal wallet. Reaching the minimum produces a successful event whose recorded coach recipient can receive the exact funded liability; missing it produces a failed event whose contributors can recover their exact contributions. Full capacity, duplicate contribution, late funding, stale browser state, wallet changes, chain/RPC unavailability, settlement retries and transaction ambiguity must have explicit outcomes.

Email-backed MovX identity remains the application authority. Wallet signatures prove control of an on-chain address and authorize value movement; connecting a wallet does not sign a user into MovX or grant coach capability. PostgreSQL owns descriptive catalogue data and actor-scoped operation records. Finalized program accounts own financial terms and outcomes, and the application must never fabricate success from optimistic client state.

## Assumptions, decisions, and dependencies

Confirmed user decisions:

- Work starts from the latest `fitness-booking-schedule-app` on the isolated `hackathon/solana-group-events` branch.
- Phantom wallet support is required.
- Approved coaches can create group events and specify a price per spot plus the minimum interest needed for the event to happen.
- Participants who fund an event that does not reach its threshold are entitled to their money back.
- A distinct platform wallet sponsors transaction fees.

Adopted implementation decisions from the archived, previously clarified and locally proven group-event work:

- Devnet only; no mainnet or real-value claim.
- Wallet Standard discovery with Phantom as the required rehearsed wallet; `@solana/kit` plugin clients and `@solana/react` rather than legacy wallet-adapter code.
- One full-price spot per wallet per event for the hackathon.
- Coach chooses event start/end, one owned active training location, funding deadline, seat price, threshold and capacity. The location is snapshotted so profile edits cannot move the event.
- Funding remains open until the immutable deadline or maximum capacity. Reaching the minimum or maximum early does not settle the event or pay the coach.
- At or after the deadline, any caller may submit deterministic settlement. The program—not the caller—chooses success when recorded participants meet the minimum and failure otherwise.
- A failed pool uses independent participant-signed pull refunds. Each recorded participant recovers exactly their own contribution once; no participant depends on an unbounded all-participant transaction. The platform sponsors the claim's SOL fee and approved associated-token-account rent, but the chain does not wake automatically.
- The fee sponsor pays SOL fees and approved account rent only. It never supplies the participant's seat token, changes event terms or satisfies coach/participant authority.
- Server-side sponsor key material stays outside the repository and browser. Production-style hosted signing should use dedicated key management; a bounded environment-backed Devnet signer may be accepted only as a documented hackathon limitation.
- The only payment asset is Circle's official six-decimal Solana Devnet EURC mint `HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr`, owned by the legacy SPL Token program `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`. Test EURC has no financial value.
- An unbound application draft may be withdrawn. Once its EventPool is created/bound, event schedule, location and financial terms are immutable and coach cancellation is outside the hackathon contract. Attendance, no-show, disputes, chargebacks and post-settlement service remedies remain non-goals.
- Price is `1..=9_000_000_000_000_000` EURC base units. Minimum participants are `2..=50`; maximum participants are between the minimum and `50`; checked `price × maximum` must fit in `u64`. The deadline is after pool creation and strictly before event start. Event start is within 365 days of creation and duration is 30 minutes–12 hours.
- Title is 3–120 characters, description is 20–2,000 characters and an optional HTTPS or root-relative media reference is at most 1,024 characters.

## Implementation plan

1. Reconcile the specification title, product summary, confirmed-decision register, actors, flows, state model, infrastructure/security boundaries, definition of done, milestones, acceptance matrix and demo for the hackathon branch.
2. Adopt the archived EURC, deadline settlement, pull-refund, bound-pool immutability and numeric-bound decisions without reopening them.
3. Define the chain/off-chain source-of-truth table and distinct email actor, personal wallet, coach authority, payout recipient, platform fee payer and program upgrade authority roles.
4. Document current Solana dependencies and required local/Devnet validation strategy without adding them yet.
5. Update README navigation and run consistency/link validation. Mark downstream tickets Ready only when their required decisions and interfaces are frozen.

## Acceptance criteria

- [x] AC1: The specification explicitly adopts the narrow hackathon wallet/group-event scope and no longer claims this branch has no blockchain or Events routes.
- [x] AC2: Event terms, lifecycle, authority, failure/recovery and source-of-truth behavior are complete enough for DEV0211–DEV0216 to implement without inventing product policy.
- [x] AC3: Payment asset, threshold timing, refund delivery, cancellation and numeric bounds are recorded as confirmed decisions rather than proposals.
- [x] AC4: The README, work map, milestones and acceptance scenarios agree, while archived scheduling and historical marketplace records remain preserved.

## Validation plan

Run Markdown formatting, `git diff --check`, repository-local link resolution, record-ID uniqueness and reciprocal COR membership checks. Review every current specification exclusion and acceptance scenario for contradictions. Application and blockchain tests are not applicable because this ticket changes only the product/document contract.

## Implementation record

Completed on 2026-10-12 as the documentation-only gate for COR0019. No application source, migration, dependency, key, deployment or transaction was added.

### Changes and rationale

The authoritative specification now extends the delivered scheduling product with one isolated Phantom/Solana Devnet group-event loop. It defines personal-wallet ownership separately from email identity, official test-EURC contributions, one full-price spot per wallet, immutable event/location/funding terms, deadline-only deterministic settlement, exact coach payout or participant-signed independent refunds, server-only fee sponsorship and honest finalized-chain recovery.

The contract deliberately reuses the earlier clarified and locally proven group-event decisions instead of asking the user to resolve them again. README navigation explains the branch boundary and current implementation status. COR0019 and every direct DEV ticket now distinguish recoverable historical code/migrations from evidence that must be restored, adapted and freshly validated against the current scheduling application.

### Affected files

| File or component                                                              | Change and purpose                                                                                                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`                                                             | Adopt the branch product scope, decisions, actors, flows, state/authority boundaries, security invariants, definition of done, milestones and acceptance cases. |
| `README.md`                                                                    | Explain the branch extension, reused rules, unfinished runtime and navigation to the active coordination/tickets.                                               |
| `tickets/README.md` and `tickets/current/organisatory/COR0019-*.md`            | Keep work ownership, delivery order, current statuses and integration conditions consistent.                                                                    |
| `tickets/current/{backend,blockchain,frontend}/DEV0211-DEV0217-*.md`           | Replace open product questions with adopted decisions and identify exact surviving migrations plus recoverable implementation commits.                          |
| `tickets/archive/organisatory/DEV0210-adopt-hackathon-group-event-contract.md` | Preserve this completed contract ticket and its validation trail.                                                                                               |

### Decisions and deviations

2026-10-12: Reused the previously clarified and locally proven group-event contract from DEV0117, DEV0120–DEV0123, DEV0132 and DEV0134 rather than asking the user to decide it again. The current branch intentionally excludes the historical coach-pass loop and reuses only the group-event, wallet and platform-payer decisions.

The recoverable implementation baselines are commits `63490d9` (personal-wallet linking), `8defb6c` (event catalogue/projections), `3e5146d` (funding program), `12e8ccc` (group-event integration), `d385bdd` (event interface), `6671383` (platform-payer separation) and `7815539` (EURC adoption). They are inputs to DEV0211–DEV0216, not current-runtime completion evidence. The combined historical program may be restored for binary compatibility, but this branch does not restore coach-pass product surfaces.

### Contracts, configuration, and operations

The contract adds no runtime dependency, schema, variable, signer or deployment. It defines future public Devnet RPC/program identifiers and server-only credentialed RPC, fee-sponsor and deployment/upgrade categories. Exact variable names and signing backend belong to DEV0215. No secret or private key appears in the documentation.

## Validation results

- Date and environment: 2026-10-12, macOS workspace on branch `hackathon/solana-group-events`.
- Exact commands and outcomes:
  - `npx prettier --check <12 changed Markdown files>` passed.
  - The targeted Node consistency validator resolved all 261 local links in the 12 changed Markdown files, found 167 unique DEV/COR record IDs with no duplicates, and found no DEV0210–DEV0217 status, index or reciprocal COR0019 membership mismatch. It also found every required C30–C41/event-contract marker.
  - `git diff --check` passed.
  - `git cat-file -e <commit>^{commit}` verified all seven recorded recovery baselines: `63490d9`, `8defb6c`, `3e5146d`, `12e8ccc`, `d385bdd`, `6671383` and `7815539`.
  - `test -f <migration>` verified the six referenced personal-wallet and group-event migration baselines still exist; targeted `rg` confirmed the historical Devnet program and EURC identifiers in DEV0122/DEV0134.
  - `git branch --show-current` returned `hackathon/solana-group-events`; `git merge-base --is-ancestor e14966c HEAD` passed.
- Manual steps and observed outcomes: reviewed the specification, README, COR0019 and DEV0211–DEV0217 together; event rules, role boundaries, delivery order and restored-history caveats agree.
- Failed, blocked, or not-run checks and reasons: application, database, browser, Rust/program and Devnet transaction tests were not run because this ticket changes only Markdown contracts and creates no runtime behavior.

| Criterion | Evidence                                                                                    | Result |
| --------- | ------------------------------------------------------------------------------------------- | ------ |
| AC1       | Specification scope, decision register, routes and exclusions review                        | Passed |
| AC2       | Actor, state-machine, authority, recovery and direct-ticket contract review                 | Passed |
| AC3       | C31–C41 plus event flow/state-model review against archived clarified decisions             | Passed |
| AC4       | README, milestone, acceptance, local-link, record-ID and reciprocal-coordination validation | Passed |

## Risks, limitations, and follow-ups

DEV0211, DEV0213 and DEV0214 can start from the frozen contract; later tickets remain Draft until their recorded dependencies deliver stable interfaces. Recoverable history still requires current-toolchain review and fresh evidence. The branch remains a hackathon experiment; adoption here does not revise the main branch or authorize mainnet value.

## Completion and review references

- Completed: 2026-10-12.
- Commit: This change, `[DEV0210] Adopt hackathon group-event contract`.
- Review: No independent review or pull request.
- Deployment or release: Not applicable — contract work only.
