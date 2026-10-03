# Ticket DEV0078: Revise the multi-gym catalogue schema

- Status: Completed
- Created: 2026-09-26
- Last updated: 2026-09-26
- Milestone: M1 participating gym and membership-plan catalogue
- Coordination: [COR0006 — Persistent membership catalogue](../organisatory/COR0006-persistent-access-catalogue.md)
- Related records: follows the historical schema foundation in completed [DEV0067](DEV0067-membership-catalogue-schema.md), implements the current product contract from completed [DEV0069](../organisatory/DEV0069-adopt-core-multigym-membership-mvp.md) and [DEV0070](../organisatory/DEV0070-revise-multigym-plan-pricing.md), and supplies the persistent contract later consumed by completed preview tickets [DEV0074](../frontend/DEV0074-preview-multigym-discovery.md) and [DEV0075](../frontend/DEV0075-preview-membership-selection.md)

## Objective and context

Replace DEV0067's obsolete private Annual Unlimited/Flex 12 catalogue shapes with an additive database contract for the current MovX Club product: versioned Basic and Classic multi-gym plans plus seven fictional participating gyms and explicit plan eligibility. Preserve shared migration history and keep catalogue configuration distinct from membership ownership, activation, payment and usage.

The current frontend already demonstrates the intended public read shape with typed preview fixtures. This ticket creates its durable server-side representation but does not switch the frontend away from those fixtures; the later COR0006 service peer owns safe public projections and adapter replacement.

## Scope and non-goals

- In scope: forward-only PostgreSQL migration; current monthly plan fields and constraints; platform-scoped Basic/Classic products; participating-gym metadata over the existing organization/venue foundation; plan-to-gym eligibility; retirement of obsolete private draft publication paths; seven deterministic fictional gym fixtures; Drizzle mappings; SQL and TypeScript database coverage; schema/setup documentation and coordination updates.
- Out of scope: public repositories or APIs; direct browser table access; catalogue editor UI; membership drafts or entitlements; selected four-gym ownership; activation/payment/wallet behavior; check-ins, allocation, reservations or non-core payment execution; gym accounts, administrators or wallets for the new fixtures; frontend fixture removal; deployment.

## Expected behavior and edge cases

The active dataset contains two published platform plans with stable slugs and immutable versioned terms. Basic costs 80 EURC per monthly period and includes ten check-ins. Classic costs 150 EURC per monthly period and has no numerical allowance. Both require exactly four core gyms, permit at most one included check-in per venue-local day and carry the illustrative 15-EURC eligible non-core visit price.

Seven fictional Berlin gyms are represented through existing organization and venue identities plus catalogue participation metadata. Each active participating gym has a safe illustrative map anchor, visual key and at least one plan eligibility row. Five are eligible for Basic and Classic; Quiet Current Recovery and Nightshift Athletic Club are Classic-only, matching DEV0074. Nightshift does not support the non-core member-priced visit; the other six do. Seven is seed volume, not a schema limit.

The schema rejects unknown plan/access/period shapes, negative or non-EURC prices, fabricated Classic allowances, Basic allowances other than ten, daily limits other than one, core-gym counts other than four, cross-run venue/plan references and duplicate eligibility. Browser-facing roles and the restricted runtime retain default-deny behavior until the service ticket opens narrow projections. Obsolete Annual Unlimited/Flex 12 drafts cannot be published as current offers.

## Assumptions, decisions, and dependencies

- EURC has six decimal places, so 80, 150 and 15 EURC are stored as `80000000`, `150000000` and `15000000` base units.
- Existing `organizations` and `venues` remain the canonical business/location identities. A new participation table adds only membership-catalogue metadata instead of creating a second gym identity.
- Existing `membership_products`/`membership_product_versions` remain the stable plan/version foundation. A forward migration widens them for platform-scoped monthly plans while preserving legacy rows and publication immutability.
- Eligibility attaches the stable plan product to a participating venue. Activation must still freeze the exact plan version and validate current venue eligibility in its own later ticket.
- Public map addresses are illustrative landmark anchors already reviewed in DEV0074, not claimed gym premises. No actual gym name, logo, price, address or partnership is seeded.
- DEV0074's `MembershipPlanSummary` and `GymSummary` are the downstream read contract. This ticket may add normalized persistence fields without importing frontend fixtures into server code.

The readiness review found one bounded schema/fixture task with a single primary backend area. Public service/adapter replacement remains a separate peer, so DEV0078 does not require conversion to another coordination record.

## Implementation plan

1. Add a forward migration that supports platform-scoped monthly Basic/Classic versions, freezes all new published terms, adds participating-gym metadata and plan eligibility, and safely retires any existing obsolete private drafts.
2. Replace the obsolete seed rows with two published current plan versions and seven fictional organization/venue/participation/eligibility fixtures, preserving deterministic IDs and idempotency.
3. Extend server-only Drizzle mappings for the revised plan fields, participating gyms and eligibility relations.
4. Replace legacy catalogue assertions with pgTAP and TypeScript integration coverage for exact current terms, fixture count/content, eligibility, constraints, immutability, cross-run denial and default-deny access.
5. Update schema documentation and run clean replay, repeat seed/reset, SQL/driver tests, schema lint and the standard application checks. Record exact evidence and archive only after all acceptance criteria pass.

## Acceptance criteria

- [x] AC1: A clean database replay contains published, immutable Basic and Classic versions with exact €80/€150 prices, ten-versus-uncapped access, one-per-day limit, four-core-gym requirement and €15 non-core configuration.
- [x] AC2: Seven fictional participating gyms exist as organization/venue-backed catalogue records with safe illustrative map anchors and no real-gym identity or partnership claim; the schema supports arbitrary counts rather than encoding seven as a limit.
- [x] AC3: Plan eligibility matches the reviewed preview contract, rejects duplicates/cross-run references and distinguishes non-core support without creating an entitlement or payment record.
- [x] AC4: Obsolete Annual Unlimited/Flex 12 drafts are absent from the active seed and cannot be mistaken for published current offers; shared migration history remains additive and replayable.
- [x] AC5: Catalogue tables remain `app_owner` owned with forced row-level security and no direct browser or unrestricted runtime visibility.
- [x] AC6: Drizzle mappings, database constraints, lifecycle behavior, deterministic/idempotent fixtures, schema lint and standard unit/lint/type/format checks pass with exact evidence.

## Validation plan

Run `npm run db:reset` twice, `npm run db:seed`, `npm run db:runtime`, `npm run db:test`, `npm run test:db`, `npm run db:lint`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check`. Probe invalid Basic/Classic shapes, wrong prices/currency, synthetic Classic allowance, wrong daily/core counts, duplicate/cross-run eligibility, published-term mutation, direct role access and obsolete fixture absence. No browser or payment rehearsal is required because this ticket exposes no public service or transaction path.

## Implementation record

Implementation started after the user approved the seven-gym database representation on 2026-09-26.

### Changes and rationale

Added a forward migration over the DEV0067 tables rather than rewriting shared history. Membership products now distinguish platform and organization scope, while product versions support the current monthly plan code, period, included-use, daily-use, required-core-gym and non-core-price fields. Current Basic/Classic shapes are constrained to the confirmed values, and the existing lifecycle trigger now freezes every new term after publication.

Added `participating_gyms` as catalogue metadata over canonical venue identities and `membership_product_gym_eligibility` as the explicit platform-plan/venue allowlist. Both tables use composite same-run foreign keys, `app_owner` ownership, forced row-level security and no policies. They therefore describe configuration without creating partnership, user selection, entitlement or transaction state.

Replaced the obsolete seeded drafts with published Basic and Classic versions, seven fictional Berlin organizations/venues, discovery metadata and 5/7 active eligibility rows. The existing stable first-club IDs now represent Northside Combat, so club-wallet scripts/tests were updated without changing their authorization behavior. The preview adapter remains unchanged and separate from persistence until the next COR0006 service ticket.

### Affected files

- `supabase/migrations/20260926000100_revise_multigym_catalogue.sql`: additive platform-plan fields, current-term constraints, lifecycle freeze coverage, participating-gym/eligibility tables and security grants.
- `supabase/seed.sql`: deterministic Basic/Classic, seven-gym and eligibility fixtures; removes obsolete draft inserts and renames the stable first gym fixture.
- `src/server/db/schema/membership.ts` and `src/server/db/schema/foundation.ts`: server-only typed mappings for the revised columns/tables and expanded fictional activity tags.
- `supabase/tests/database/membership-catalogue.test.sql` and `tests/database/membership-catalogue.test.ts`: exact terms, fixtures, constraints, lifecycle, same-run, uniqueness and default-deny coverage.
- `scripts/prepare-local-club-wallet.mjs`, `scripts/rehearse-local-club-wallet.mjs`, `tests/club-wallet.test.ts`, `tests/club-entry-state.test.ts` and current DEV0041: compatibility consumers now use the fictional Northside identity.
- `README.md`, `supabase/README.md` and `docs/mvp-spec.md`: current status and database operation guidance now distinguish delivered private persistence from the still-preview-only frontend adapter.
- `tickets/README.md` and current COR0006: lifecycle, work-map and handoff status.

### Decisions and deviations

- 2026-09-26: Reuse organization/venue identities and add catalogue participation metadata. This avoids a duplicate gym entity while keeping catalogue eligibility separate from general venue status.
- 2026-09-26: Keep public service integration in the next COR0006 peer. Schema completion alone must not make private rows browser-readable or cause silent fixture fallback.

### Contracts, configuration, and operations

The additive PostgreSQL contract adds `membership_products.scope`, revises membership-version columns/constraints, and adds `participating_gyms` plus `membership_product_gym_eligibility`. Current plan versions use EURC base units and immutable published terms. Historical single-gym shapes remain migration-compatible but have no current seed rows. No dependency, environment variable, secret, public API, browser-readable policy or deployment changed. Existing local club scripts now default to `northside-combat`; stable database IDs and authorization relations are preserved.

## Validation results

- `npm run db:reset` — passed twice from a clean local database; every historical migration, DEV0078 migration and revised seed applied.
- `npm run db:seed` — passed against the already seeded database, proving fixture idempotency.
- `npm run db:runtime` — passed after each final reset; recreated the loopback-only runtime login.
- `npm run db:test` — passed 5 files and 116 pgTAP assertions, including 27 catalogue assertions.
- `npm run test:db` — passed all 17 TypeScript database integration tests. Direct probes rejected wrong price/currency, fabricated Classic allowance, wrong daily/core limits, duplicate/cross-run/non-platform eligibility, published-term mutation and runtime writes.
- `npm run db:lint` — passed with no schema errors.
- `npm test` — passed all 55 unit/contract tests.
- `npm run lint` — passed with no findings.
- `npm run typecheck` — passed after Next.js route type generation.
- `npm run format:check` — passed after formatting the revised Drizzle mapping.
- `git diff --check` — passed. A current-tree search found no remaining `Kru Tiger`/`kru-tiger` references outside archived history.
- Browser, Auth, wallet and payment rehearsals were not run because this ticket adds no public route, Auth behavior, wallet flow or transaction path.

## Risks, limitations, and follow-ups

Plan terms and public gym metadata are configurable demo hypotheses, not production commitments or partnership claims. The following COR0006 service peer must expose only published active projections and must report backend failure rather than silently mixing database rows with preview fixtures.

## Completion and review references

- Completed: 2026-09-26.
- Commit: Not created.
- Review: Scope/readiness self-review completed; no independent implementation review.
- Deployment or release: None.
