# Ticket DEV0067: Add membership catalogue schema

- Status: Completed
- Created: 2026-09-24
- Last updated: 2026-09-24
- Milestone: M1 persistent access catalogue
- Coordination: [COR0006 — Persistent access catalogue](../organisatory/COR0006-persistent-access-catalogue.md)
- Related records: implements the first database slice after [DEV0066 — Freeze membership product rules](../organisatory/DEV0066-freeze-membership-product-rules.md); uses the completed [DEV0015 database foundation](DEV0015-supabase-database-foundation.md) and [DEV0040 protected context](DEV0040-protected-access-and-database-context.md)

## Objective and context

Add the durable off-chain catalogue contract for gym-issued membership products without creating customer ownership. Separate a stable product identity from immutable published versions so later price or rule changes never rewrite terms already presented or purchased. Represent the two confirmed MVP configurations—Annual Unlimited and Six-Month Flex 12—as private draft fixtures while their exact purchase prices remain undecided.

This ticket is the storage and mapping foundation for a later public catalogue service. It does not make the preview database-backed and does not create a usable membership.

## Scope and non-goals

- In scope: additive PostgreSQL migration; product and product-version constraints; draft/published/retired lifecycle; immutable published terms; default-deny row-level security; deterministic draft fixtures; Drizzle mappings; SQL and TypeScript database tests; setup/schema documentation updates required by the new tables.
- Product rules: Annual Unlimited is 365 days with no synthetic entry balance; Six-Month Flex 12 is 183 days with twelve entries. Transferable versions use a 10-EURC fee, 30-day minimum hold and strictly-more-than-30-day remaining gate. Non-transferable versions carry no transfer fee or transfer thresholds.
- Out of scope: customer entitlements, purchases, payments, Solana accounts, transfer invitations/execution, redemptions, public API/repository, draft editor UI, Explore integration, passes, classes, events, follows and bookmarks.

## Expected behavior and edge cases

A product supplies stable issuer/slug identity. Each version freezes its display copy, currency, optional draft price, duration, access model, entry allowance and transfer rules. A draft may omit price. Publication requires an exact non-negative EURC base-unit price and timestamp. At most one version per product is currently published; a published version can only remain published or retire, and its frozen terms cannot change. A retired version cannot be edited or deleted.

Unlimited access stores `NULL` for its entry allowance rather than a large artificial count. Flex 12 stores exactly twelve. Transferable versions store exactly 10,000,000 EURC base units and 2,592,000 seconds for both transfer time gates; non-transferable versions store zero for all three. Cross-dataset product/organization/profile references fail. Browser-facing Supabase roles receive no direct access, and the runtime role sees no rows until a future feature-specific policy/service ticket explicitly opens a safe path.

## Assumptions, decisions, and dependencies

- EURC uses six decimal places, so the confirmed 10-EURC transfer fee is stored as `10000000` base units.
- Draft fixture purchase prices remain `NULL`; inventing a price would turn an unresolved product choice into implementation behavior.
- The catalogue schema is off-chain source data. A future purchase/program ticket must copy or reference a finalized version under its own verified contract rather than treating a catalogue row as ownership.
- Existing additive migration history remains intact; this ticket does not squash staging migrations.

## Implementation plan

1. Add `membership_products` and `membership_product_versions` with same-dataset foreign keys, exact MVP rule checks, lifecycle constraints, indexes, triggers, ownership and forced row-level security.
2. Seed the two confirmed configurations as price-pending private drafts for the prepared Fabrik Training organization.
3. Add matching Drizzle schemas and exports without exposing them to client modules.
4. Add pgTAP constraint/security/lifecycle coverage and Drizzle integration checks.
5. Run reset, database tests, lint/type checks and focused documentation/link consistency checks; record exact evidence.

## Acceptance criteria

- [x] AC1: A clean local reset creates product and version tables owned by `app_owner`, with forced RLS and no direct `anon`, `authenticated` or `service_role` privileges.
- [x] AC2: The schema accepts only the two frozen MVP access configurations and correctly distinguishes unlimited `NULL` allowance from Flex 12's twelve entries.
- [x] AC3: Transferable/non-transferable fee and time-gate combinations, EURC base-unit bounds, same-dataset ownership and publication timestamps/prices are database-enforced.
- [x] AC4: Published version terms are immutable, only one version per product can be published, retirement is one-way and non-draft versions cannot be deleted.
- [x] AC5: Deterministic Annual Unlimited and Six-Month Flex 12 draft fixtures exist with no fabricated purchase price or entitlement.
- [x] AC6: Drizzle mappings and database tests pass; no public repository, UI, payment, entitlement, transfer or redemption behavior is claimed.

## Validation plan

Run `npm run db:reset`, `npm run db:runtime`, `npm run db:test`, `npm run test:db`, `npm run db:lint`, `npm run lint`, `npm run typecheck` and relevant boundary tests. Validate migration/seed idempotency with a second reset. Probe invalid access models, duration/allowance combinations, transfer terms, publication without price, published mutation, second published version, cross-dataset references and runtime-role visibility.

## Implementation record

Implementation was authorized on 2026-09-24 after the user selected catalogue/schema as the next step.

### Changes and rationale

Added an additive migration with stable `membership_products` identities and independently versioned `membership_product_versions` offer terms. Composite foreign keys preserve dataset/issuer and creator boundaries. Checks admit exactly the two frozen MVP access shapes, EURC base-unit bounds, and either the confirmed transferable terms or a zero-fee/zero-gate non-transferable version.

Drafts may omit price, but publication requires an exact price and timestamp. A lifecycle trigger requires draft creation, blocks direct draft-to-retired transitions, freezes every published term, permits only published-to-retired progression and prevents deletion of published/retired versions. A partial unique index allows only one currently published version per product. Both tables are `app_owner` owned with forced row-level security and no feature policy, so the runtime cannot yet see or mutate them.

The seed now contains Annual Unlimited and Six-Month Flex 12 for Fabrik Training as private draft versions with `NULL` purchase prices. They demonstrate durable catalogue shape without pretending that a business selected prices or that a customer owns access. Matching Drizzle mappings remain under the server-only schema barrel. Dedicated pgTAP and TypeScript integration tests cover structure, security, exact terms, invalid shapes, non-transferable terms, publication, immutability, retirement, uniqueness and cross-dataset/default-deny behavior.

### Affected files

| File or component                                                                               | Change and purpose                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260924000200_create_membership_catalogue.sql`                            | Creates the two catalogue tables, frozen-rule/lifecycle constraints, indexes, triggers, ownership and default-deny security. |
| `supabase/seed.sql`                                                                             | Adds the two price-pending private draft products idempotently.                                                              |
| `src/server/db/schema/membership.ts`, `schema/index.ts`                                         | Mirrors the SQL contract for typed server-side queries and exports it only through the server schema boundary.               |
| `supabase/tests/database/membership-catalogue.test.sql`                                         | Adds 20 structural, fixture and access-control assertions to the pgTAP suite.                                                |
| `tests/database/membership-catalogue.test.ts`                                                   | Exercises the Drizzle mapping plus constraint/lifecycle/security behavior against PostgreSQL.                                |
| `README.md`, `docs/mvp-spec.md`, `supabase/README.md`                                           | Records the delivered private schema while keeping public catalogue, purchase and entitlement claims explicitly outstanding. |
| `tickets/current/organisatory/COR0006-persistent-access-catalogue.md` and affected work records | Converts retired DEV0017 into a flat coordination map and repairs downstream ownership links.                                |

### Decisions and deviations

- 2026-09-24: Split the original DEV0017 plan before implementation because it combined independently reviewable schema, service, UI and social-overlay work. COR0006 now coordinates those peers.
- 2026-09-24: Kept fixture purchase prices `NULL` and versions private rather than inventing an unresolved business decision. Publication is impossible until a price is supplied.
- 2026-09-24: Enforced the two current MVP shapes in PostgreSQL instead of building a generic duration/allowance editor that the current contract does not require.
- 2026-09-24: Opened no runtime policy or public service. Schema readiness alone is not authorization to expose drafts or claim a persistent public catalogue.

### Contracts, configuration, and operations

Additive local database contract only. The new migration must be applied in order after `20260924000100_rename_demo_run_participants.sql`; existing rows and migrations are unchanged. No dependency, secret or environment variable changed. The migration has not been applied to hosted staging and must travel with compatible application code in a later authorized release. Before publication/purchase data exists, rollback may drop the two new tables and lifecycle function; after such data exists, use reconciliation and a forward migration rather than destructive rollback.

## Validation results

Validated on 2026-09-24 against the disposable local Supabase PostgreSQL instance.

- `npm run db:reset` — passed twice; every migration applied in order and both seed runs completed.
- `npm run db:seed` — passed after the first reset, proving the new deterministic inserts are idempotent.
- `npm run db:runtime` — passed after each reset and recreated the restricted loopback runtime login.
- `npm run db:test` — passed: 5 files and 109 pgTAP assertions, including the new 20-test membership catalogue file.
- `npm run test:db` — passed: 18/18 TypeScript/PostgreSQL integration tests.
- `npm run db:lint` — passed with no schema errors.
- `npm test` — passed: 51/51 configuration-free domain/boundary tests.
- `npm run lint`, `npm run typecheck`, `npm run format:check` — passed.
- `npm run build` — attempted twice but the environment denied Turbopack's existing font/PostCSS helper process an internal port (`Operation not permitted`). `./node_modules/.bin/next build --webpack` passed the optimized production build, TypeScript, all 13 static pages and route collection, distinguishing the sandbox/Turbopack limitation from an application regression.
- Repository-wide local Markdown file links passed for 88 files; `git diff --check` passed.

| Criterion     | Evidence                                                                                                | Result                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| AC1, AC3, AC4 | Two clean resets, 109 pgTAP assertions, 18 integration tests and schema lint                            | Passed                                                    |
| AC2, AC5      | Seed/mapping assertions for exact durations, allowances, transfer terms, `NULL` prices and draft states | Passed                                                    |
| AC6           | Boundary/unit tests, lint, typecheck, format and successful webpack production build                    | Passed; standard Turbopack command blocked by environment |

## Risks, limitations, and follow-ups

Exact membership purchase prices and the public catalogue service remain follow-ups under COR0006. The runtime deliberately sees no catalogue rows until that service ticket introduces narrowly tested policies or a restricted read path. No entitlement, payment, transfer or redemption table exists. Future entitlement/program design may add references but must not weaken published-version immutability or confuse product offers with customer ownership. Standard Turbopack build validation remains environment-blocked here; the webpack production build passed.

## Completion and review references

- Completed: 2026-09-24 — delivered and validated the default-deny versioned membership catalogue schema and two honest private drafts.
- Commit: Not created.
- Review: Implementation self-reviewed against AC1–AC6; no independent review.
- Deployment or release: None.
