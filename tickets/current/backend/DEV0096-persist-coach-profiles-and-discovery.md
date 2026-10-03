# Ticket DEV0096: Persist coach profiles and discovery

- Status: Draft
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first M1 identity and discovery
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on [DEV0094](../../archive/organisatory/DEV0094-adopt-coach-first-training-package-mvp.md) and reuses completed email identity plus in-progress [DEV0047 — Personal wallet linking](DEV0047-personal-wallet-linking-and-replacement.md); supplies coach identity to DEV0097, DEV0100 and [DEV0104 — Publish weekly coach availability](DEV0104-publish-weekly-coach-availability.md)

## Objective and context

Add the persistent application boundary that lets an email-backed user become a coach, maintain a public profile and appear in cold-start coach discovery. The current catalogue is gym-centric and the existing feed cannot help a new visitor discover an unfollowed coach.

## Scope and non-goals

- In scope: coach role/profile schema and authorization; public display name, disciplines, bio, location text, private-training service mode, reviewed timezone and visibility; original fictional martial-arts coach seed data; restricted public coach search/filter/detail projections; profile editing by the owning authenticated coach; stable integration points for active offer metadata and weekly availability owned by later peers; responsive coach directory and profile screens with honest empty/error states.
- Out of scope: credentials/verification claims, ratings, slot persistence or calendar mutation, messaging, exact distance/geolocation, coach payments, onchain offer creation, pass purchase, booking, session redemption, posts/follows or real-coach data without permission.

## Expected behavior and edge cases

Guests can browse only visible fictional coaches and filter by discipline, location text and private-training service mode. A signed-in user explicitly opts into the coach role and can mutate only their own profile. Hidden, incomplete, cross-dataset or deleted profiles do not leak through search or detail routes.

Public offer summaries appear only when a later indexed active offer has matching approved metadata; metadata alone cannot invent price, sessions, recipient or active state. Weekly availability appears only through DEV0104's authoritative slot projection. Backend/database failure shows an honest unavailable state rather than fixture coach or slot fallback.

## Assumptions, decisions, and dependencies

Application identity remains email-first. Wallet linking is separate and required only before chain-backed offer actions. Coach status is self-declared for the hackathon and must not be labelled verified. Fictional coach identities and images must be original and must not imply a real person or partnership.

## Implementation plan

1. Add additive profile/role/discipline schema, indexes, row-level security and deterministic fictional seed data.
2. Add restricted repositories/services for owner mutation and public discovery projections.
3. Implement coach directory filters, detail page, owner edit flow and bounded offer/availability integration points without implementing either downstream capability.
4. Validate authorization isolation, hidden/error states, seed idempotency and responsive accessible browsing.

## Acceptance criteria

- [ ] AC1: A guest can discover visible fictional coaches and open a profile without authentication or fabricated live availability; the profile can host DEV0104's authoritative weekly projection later.
- [ ] AC2: An authenticated user can create/update only their own coach profile; anonymous, cross-user and cross-dataset mutations fail closed.
- [ ] AC3: Filters are deterministic and empty/database-error states do not fall back to fixtures.
- [ ] AC4: Offer metadata cannot override authoritative onchain commercial terms or surface a deactivated/unindexed offer.
- [ ] AC5: Migration, seed, authorization, service, browser, static and build checks pass.

## Validation plan

Run clean/repeat migration and seed checks, database constraint/RLS tests, server integration tests with owner/other/anonymous actors, focused discovery domain tests and desktop/mobile keyboard browser scenarios. Also run relevant `npm test`, lint, typecheck and build commands.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: additive Supabase migration/seed, Drizzle mappings, coach repositories/services/routes, discovery/profile features and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Additive database contracts are planned. No new secret is expected. Migration rollback/compatibility details must preserve dormant historical gym data.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Self-declared coach profiles prove neither credentials nor quality. Verification, ratings, moderation and real partner onboarding require later tickets.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
