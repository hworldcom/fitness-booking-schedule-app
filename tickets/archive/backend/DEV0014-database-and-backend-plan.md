# Ticket DEV0014: Database and backend implementation plan

- Status: Completed
- Created: 2026-09-19
- Last updated: 2026-09-19
- Milestone: Planning for M0/M3; not backend delivery
- Coordination: None — independent development ticket
- Related tickets: [DEV0008 — Frontend](../frontend/DEV0008-repx-club-frontend.md)

## Objective and context

The user asks what the database needs, whether Supabase is appropriate, and for the next implementation tickets. Review the real frontend and the [current architecture](../../../docs/mvp-spec.md#5-architecture-and-storage), verify the provider's current capabilities, and define a bounded sequence without starting implementation or provisioning services.

## Scope and non-goals

- In scope: Supabase/PostgreSQL recommendation and alternatives/tradeoffs, identity/authorization and financial authority boundaries, staged data model, migration/testing strategy, and four scoped implementation tickets.
- Out of scope: creating cloud projects, subscriptions, credentials, dependencies, migrations, runtime changes, wallet setup or chain deployment. Choosing a provider for the plan does not assert a user-approved account or purchase.

## Expected behavior and edge cases

The specification remains the single product/architecture source. Future tickets reference it and record concrete delivery/validation criteria. Planning completion must not mark backend work complete. Browser fixtures cannot be promoted to authenticated bookings, balances, attendance, funded pools or payments. Older 0010–0013 IDs remain reserved after consolidation.

## Assumptions, decisions, and dependencies

Recommend Supabase managed PostgreSQL within the existing Next.js/PostgreSQL-and-Drizzle architecture plan, and investigate Supabase Auth's Solana wallet sign-in for the prepared Phantom demo. Drizzle is planned, not installed. Preserve current proof, run isolation and separate company-wallet requirements. Plan four near-term slices: database foundation, identity, persistent nonfinancial app flows, and the membership booking/confirmed-visit flow. Existing milestones continue to own later challenge-program, real-payment and rehearsal work; those need their own bounded tickets before execution.

## Implementation plan

1. Read the current app/spec/tickets and inspect storage/fixtures and installed dependencies.
2. Verify official Supabase database, Drizzle, Web3 Auth, SSR, connection, access-control, migration and pricing documentation.
3. Add the provider recommendation, data phases, security/migration choices and dependency sequence to the existing specification.
4. Write tickets 0015–0018 with scope, dependencies, acceptance and validation plans; update index and README navigation only.
5. Check document links/anchors, numbering, dependency ordering and unchanged application/configuration files; record findings and complete only this planning ticket.

## Acceptance criteria

- [x] AC1: Recommendation answers Supabase suitability, current costs/limits and remaining provider/setup decisions using official sources.
- [x] AC2: Staged database model covers actors/organizations, catalogue, drafts/social, access/attendance and later financial projections without treating SQL as the chain ledger.
- [x] AC3: Four bounded future tickets explain dependencies, failure/authorization cases and meaningful verification; no backend capability is reported as implemented.
- [x] AC4: Specification/index/setup navigation stay consistent and linked; application/configuration files are unchanged.

## Validation plan

Read-only source inspection and official documentation; local Markdown target/anchor, numbering and dependency checks; before/after hashes of application/tests/configuration. No application or database tests apply because this task writes plans only.

## Implementation record

The frontend currently uses seeded identities/catalogue and browser-local drafts, follows, bookmarks and membership bookings. There are no database, Auth, Drizzle or transaction integrations to extend yet. Supabase fits the specified PostgreSQL architecture and offers a Solana wallet login provider; actual Phantom interoperability and our single-use run proof still need evidence. Free is recommended for development, with its inactivity pause and lack of automatic backups documented for demo preparation.

- [Specification, section 5](../../../docs/mvp-spec.md#5-architecture-and-storage): added the provider/cost assessment, Auth and server/SQL access boundaries, staged record groups, one SQL migration history, seed/environment rules and implementation order. Existing financial authority and product decisions are preserved; the recommendation is not recorded as a new confirmed user decision.
- [DEV0015](DEV0015-supabase-database-foundation.md): scoped local database tooling, base schema, restricted roles, migrations and reproducible seeds.
- [COR0002](../organisatory/COR0002-phantom-auth-and-demo-access.md), converted from retired DEV0016: coordinates fresh tickets for real Phantom login validation, verified profiles/run access, wallet separation and protected queries.
- [COR0006](../organisatory/COR0006-persistent-access-catalogue.md), converted from retired DEV0017: coordinates the first shared catalogue/private-draft checkpoint, with cross-user denial and honest preview/error states.
- [DEV0018](DEV0018-class-pass-reservations-and-confirmed-visits.md): planned verified class-pass reservations and staff confirmation; it was later cancelled when passes left the MVP.
- [Ticket index](../../README.md#ticket-index) and [project README](../../../README.md#planned-backend-work): added navigation/status without copying the architecture into a second plan or inventing setup commands.

All four implementation tickets remain Draft with unchecked implementation acceptance criteria. The sequence is 0015 → 0016 → 0017 → 0018; M1 program work can progress independently once its rules are settled. No scope deviation, runtime contract, dependency, environment variable, migration, credential, cloud account or deployment was introduced. The future plan deliberately keeps Supabase SQL migrations as the sole applied migration history, Drizzle as typed query mappings, and Solana as financial authority. There is no application rollback requirement for this documentation-only change.

## Validation results

- **AC1 — passed:** inspected official Supabase PostgreSQL/Drizzle, Web3 Auth, SSR, RLS/API hardening, migration, connection and pricing documentation on 2026-09-19. The specification links sources beside each provider claim. Verified Free's 500 MB storage, one-week inactivity pause and no automatic backups; Pro starts at USD 25/month. Provider replay guarantees are explicitly unproven for this app.
- **AC2/AC3 — passed:** manual review of section 5 and all four new tickets against the existing actor, wallet, attendance, payment and social contracts. Every slice identifies prerequisites, exclusions, failure/authorization cases and future real-database/browser validation. Attendance depends on resolving P07; financial slices retain P01–P05 and event-policy dependencies.
- **AC4 — passed:** ran `python3 -` with an inline read-only Markdown/record/hash check from the project root. Checked all 19 current navigation/spec/ticket Markdown files, local link targets and heading/explicit anchors, 14 unique ticket records and matching index statuses, reserved 0010–0013 IDs, all required future-ticket sections and Draft/unchecked status. No failures. Confirmed C01–C16, P01–P08 and A01–A53 remain present.
- **AC4 — passed:** the same command compared SHA-256 hashes against the pre-edit snapshot for 42 source/test/asset/configuration files and checked for new files under `src`, `tests` and `public`. All unchanged; no new implementation files.
- **Not applicable:** application tests, lint, build, database migration tests, wallet rehearsal and hosted checks were not run because this task changes planning/navigation documents only. Future tickets specify their required implementation evidence; documentation checks do not satisfy those criteria.

## Risks, limitations, and follow-ups

Supabase project/region/plan and credentials are not selected. Auth integration requires a real Phantom proof/replay check. P01–P05/P07 and event policies remain unresolved before their dependent financial/attendance implementations.

## Completion and review references

- Completed: 2026-09-19 — planning only.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC4; no independent review.
- Deployment: None.
