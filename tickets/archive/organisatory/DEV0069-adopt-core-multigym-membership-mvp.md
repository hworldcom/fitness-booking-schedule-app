# Ticket DEV0069: Adopt core multi-gym membership MVP

- Status: Completed
- Created: 2026-09-25
- Last updated: 2026-09-25
- Milestone: M0 core product contract
- Coordination: [COR0007 — Core multi-gym membership MVP](./COR0007-core-multigym-membership-mvp.md)
- Related records: supersedes the current behavior defined by completed [DEV0058](DEV0058-fitness-access-mvp-contract.md), [DEV0066](DEV0066-freeze-membership-product-rules.md), and [DEV0068](DEV0068-revise-subscription-and-pass-resale-contract.md); affects [COR0006](./COR0006-persistent-access-catalogue.md), cancelled [DEV0018](../backend/DEV0018-class-pass-reservations-and-confirmed-visits.md), and [DEV0023](../backend/DEV0023-minimal-shared-activity-feed.md)

## Objective and context

Replace the broad access-product MVP with one focused multi-gym membership experiment. Members choose four participating core gyms for a billing period, consume either eight included monthly check-ins or a daily-limited uncapped plan, generate transparent usage-based provisional gym allocations, and may pay a simple member price at participating venues outside their selected four. Keep a small chronological social layer around explicitly shared verified participation.

The user explicitly removed membership transfer, standalone passes, pass resale, ordinary events and sponsored events from the MVP because the four-gym membership, check-in and settlement lifecycle is already sufficient hackathon scope. Completed records remain historical; this ticket updates the single current specification, navigation documentation and unfinished plans without rewriting their history.

## Scope and non-goals

- In scope: adopt configurable Basic/Classic multi-gym plans; four unique eligible core gyms per period; included check-in rules; member-priced non-core visits; usage accounting and provisional pro-rata settlement; minimum member/gym views; minimal verified-participation social; explicit removal of transfer, passes, events and sponsorship from current scope; create COR0007; reconcile README, AGENTS.md, COR0006, DEV0018 and DEV0023.
- Out of scope: runtime code, schema/migrations, Solana program/accounts, real settlement/payout, exact production prices, final unused-value economics, production renewal/cancellation, gym commercial agreements, interface implementation, deployment and legal/payment readiness.

## Expected behavior and edge cases

The proposed demo plans are configurable rather than immutable business facts: Basic illustrates €50 per monthly period and eight included check-ins; Classic illustrates €80 and no numerical monthly cap, with both limited to one included check-in per venue-local calendar day. A member selects exactly four distinct active plan-eligible gyms. The selection is frozen during the period under the working default and may change for the next period.

Valid included check-ins occur only at selected gyms, are uniquely identified and venue-confirmed, and update plan usage plus provisional allocation. A member-priced visit at another participating venue illustrates an €8 direct Devnet-EURC payment to that venue, does not consume Basic allowance and does not enter the core pool. Booking eligibility never guarantees capacity.

Membership transfer and every former transfer fee/time gate are absent. Standalone passes, pass resale, event tickets, sponsored funding and event redemption are absent. Failed, duplicate, stale, wrong-venue, exhausted Basic and second same-day included check-ins must not mutate usage or settlement. Zero/partial-usage value, pool aggregation, actual payout, renewal and production price remain explicit product hypotheses rather than silently frozen economics.

## Assumptions, decisions, and dependencies

- The supplied `movx_core_membership_mvp.md` is a proposal source, not repository instructions or an authority after this ticket completes.
- €50, €80, €8, four gyms and the final settlement formula remain configurable MVP hypotheses; public copy must label them as demo/illustrative until validated.
- The hackathon demonstrates real Devnet membership/member-visit payments and authoritative usage evidence, but gym allocations remain provisional until unused-value/pool/finalization policy is resolved.
- Minimal social means one-way follows plus chronological explicitly shared verified membership participation. There are still no reactions, comments, messages, notifications, ranking or general posts.
- Existing identity, personal/club wallet and hosted-staging work remains applicable.
- DEV0067's private Annual Unlimited/Flex 12 drafts must never be published as the new plans; an additive forward migration replaces their active catalogue role.

## Implementation plan

1. Rewrite the confirmed/proposed decision register and product scope around Basic/Classic, four core gyms, member-priced visits and provisional usage settlement.
2. Replace the old single-gym membership, transfer, pass, event and sponsorship sections with multi-gym membership period, selection, check-in, pool and direct-visit contracts.
3. Reconcile architecture, delivery milestones, definition of done, acceptance matrix and demo while preserving verified identity/wallet/attendance boundaries.
4. Update README and AGENTS.md navigation/status references and clearly label the current frontend as a now-outdated prior concept requiring its own implementation ticket.
5. Create COR0007 with flat peer ownership; narrow COR0006 to venue/plan catalogue work; cancel/archive unimplemented DEV0018 and align DEV0023 to verified membership participation.
6. Run terminology, link, formatting and whitespace checks; application/database/browser tests are not applicable to this documentation-only contract change.

## Acceptance criteria

- [x] AC1: The current specification centers only Basic/Classic multi-gym membership, four core gyms, included check-ins, provisional usage allocation, member-priced non-core visits and minimal social.
- [x] AC2: Transfer, standalone passes/resale, ordinary/sponsored events, challenges and reactions are consistently outside the MVP, with historical decisions preserved rather than rewritten.
- [x] AC3: Prices, core-gym count and settlement economics are distinguished as configurable hypotheses; zero/partial usage, pool aggregation, actual payout and renewal remain explicit unresolved decisions.
- [x] AC4: COR0007 maps every required implementation part to a direct DEV ticket or an identified not-yet-created peer; COR0006, cancelled DEV0018 and DEV0023 have non-overlapping ownership.
- [x] AC5: README and implementation-status language distinguish the delivered prior preview/schema from the new target and make no runtime, payout, partner, legal or deployment claim.
- [x] AC6: Documentation terminology, repository-local links, formatting and whitespace checks pass.

## Validation plan

Review the confirmed/proposed decision register, scope, screens, fixture model, evidence, architecture, membership/settlement contract, social permissions, definition of done, milestones, acceptance matrix and demo as one system. Search current documentation for active transfer/pass/event/sponsorship promises and old Annual Unlimited/Flex 12 implementation direction. Validate reciprocal DEV/COR ownership and repository-local links; run `git diff --check` and the existing format check. Runtime tests are not applicable because this ticket changes documentation and current planning records only.

## Implementation record

Completed the documentation and planning pivot. No runtime application, database, program or deployment change is included.

### Changes and rationale

- Replaced the access-product specification with one configurable multi-gym membership: Basic has eight included period check-ins, Classic has no numerical period cap, both have one included check-in per venue-local day, and each activated period freezes four distinct eligible core gyms.
- Kept an illustrative direct member price for eligible participating gyms outside the selected four and separated that payment/attendance from included usage and the membership pool.
- Defined included check-in authority, idempotency, provisional pro-rata allocation, private/member/gym views, minimal explicitly shared social activity, demo fixtures, milestones and A01–A24 without pretending unresolved economics are final.
- Removed transfer, standalone passes/resale, ordinary/sponsored events, challenges and reactions from current scope. The existing frontend and DEV0067 drafts are labelled legacy rather than rewritten as delivered behavior.
- Created COR0007 for the membership lifecycle, narrowed COR0006 to gym/plan catalogue work, cancelled and archived the unimplemented pass ticket DEV0018, and made DEV0023 a direct COR0007 member consuming only verified membership check-ins.
- Updated current architecture, identity/wallet and staging records where the specification rewrite invalidated navigation or downstream relationships. Historical ticket links to moved DEV0018 were retargeted without changing their original implementation claims.

### Affected files

| File or component                                                                                                | Change and purpose                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/mvp-spec.md`                                                                                               | Authoritative Basic/Classic four-gym membership contract, honest implementation status, provisional economics, delivery plan and compatibility anchors for historical ticket links. |
| `README.md`, `AGENTS.md`                                                                                         | Current product/status/navigation language and corrected specification links; contributor workflow rules remain unchanged.                                                          |
| `tickets/README.md`                                                                                              | Registers DEV0069/COR0007, narrows COR0006, moves DEV0018 to Cancelled history and advances the next COR identifier.                                                                |
| `tickets/current/organisatory/COR0007-core-multigym-membership-mvp.md`                                           | Flat work map for public positioning, member setup, activation, check-ins, direct non-core visits, gym views and minimal social.                                                    |
| `tickets/current/organisatory/COR0006-persistent-access-catalogue.md`                                            | Narrows catalogue ownership to participating gyms and versioned Basic/Classic plan data/services/screens.                                                                           |
| `tickets/archive/backend/DEV0018-class-pass-reservations-and-confirmed-visits.md`                                | Cancelled/archive the unimplemented standalone-pass plan and point replacement membership check-ins to COR0007.                                                                     |
| `tickets/current/backend/DEV0023-minimal-shared-activity-feed.md`                                                | Direct COR0007 member using only explicitly shared verified included/member-priced check-ins.                                                                                       |
| `tickets/current/organisatory/COR0001-project-structure.md`, `COR0002-phantom-auth-and-demo-access.md`           | Updates downstream ownership and current identity/specification references.                                                                                                         |
| `tickets/current/backend/DEV0041-club-wallet-authorization.md`, `DEV0055-hosted-supabase-staging-environment.md` | Corrects links to current identity, wallet-integrity and architecture sections without changing their implementation scope.                                                         |
| Affected archived ticket links                                                                                   | Retargets references to DEV0018 after its required archive move; historical outcomes remain intact.                                                                                 |

### Decisions and deviations

- 2026-09-25: The user removed contract transfer because assigning a membership with four selected gyms is too complex for the MVP.
- 2026-09-25: The user retained the minimal social network and removed ordinary/sponsored events.
- 2026-09-25: The user then removed standalone passes and pass resale, leaving multi-gym membership as the only current paid product family.

### Contracts, configuration, and operations

The documented target contract changed materially, but no runtime interface, schema, dependency, environment variable, migration or deployment changed. Existing migrations remain forward-only history. DEV0067's obsolete private drafts require an additive future migration; they were not edited or published here. The illustrative €50/€80/€8 values and four-gym count must be stored as configurable/versioned data when implemented.

## Validation results

| Criterion                       | Evidence                                                                                                                                                              | Result                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| AC1–AC3                         | Manual review of the confirmed/proposed register, scope, membership/check-in/payment/allocation contracts, definition of done, milestones, acceptance matrix and demo | Passed                                                               |
| AC4                             | Manual reciprocal work-map review of COR0006, COR0007, DEV0023 and cancelled DEV0018                                                                                  | Passed                                                               |
| AC5                             | Manual comparison of README/specification status against the unchanged application/schema state                                                                       | Passed                                                               |
| AC6 — whitespace                | `git diff --check`                                                                                                                                                    | Passed with no output                                                |
| AC6 — repository formatting     | `npm run format:check`                                                                                                                                                | Passed; all configured application/source files match Prettier style |
| AC6 — local Markdown paths      | Node audit over 91 Markdown files                                                                                                                                     | Passed; every repository-local Markdown target exists                |
| AC6 — Markdown fragments        | Node heading/explicit-anchor audit across repository Markdown                                                                                                         | Passed; all local fragments resolve                                  |
| Runtime/database/browser checks | Not run — this ticket changes product/documentation/work records only and makes no executable or database change                                                      | Not applicable                                                       |

## Risks, limitations, and follow-ups

The settlement design is intentionally not production-final. A future product decision must define billing-period duration/renewal, partial/zero-use allocation, per-member versus plan-wide pooling, final payout/claim timing, refunds and MovX revenue before real partner economics are represented. Classic usage at high frequency can produce an unsustainably low effective payout per check-in and requires modelling/venue interviews.

## Completion and review references

- Completed: 2026-09-25 — current contract and planning records now describe the focused multi-gym membership MVP.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC6; no independent review.
- Deployment or release: Documentation only; none.
