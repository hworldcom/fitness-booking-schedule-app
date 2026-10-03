# Ticket DEV0096: Persist coach profiles and discovery

- Status: Draft
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first M1 identity and discovery
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on [DEV0094](../../archive/organisatory/DEV0094-adopt-coach-first-training-package-mvp.md) and reuses completed email identity plus in-progress [DEV0047 — Personal wallet linking](DEV0047-personal-wallet-linking-and-replacement.md); supplies coach identity/location to DEV0097, DEV0100, [DEV0104 — Publish weekly coach availability](DEV0104-publish-weekly-coach-availability.md) and [DEV0108 — Add the Mapbox coach Explore map](../frontend/DEV0108-add-mapbox-coach-explore-map.md)

## Objective and context

Add the persistent application boundary that lets an email-backed user become a coach, maintain a public profile and appear in cold-start coach discovery. The current catalogue is gym-centric and the existing feed cannot help a new visitor discover an unfollowed coach.

## Scope and non-goals

- In scope: coach role/profile schema and authorization; public display name, disciplines, bio, one coach-selected public discovery location with provider-neutral label/longitude/latitude/source/confirmation fields, private-training service mode, reviewed timezone and visibility; original fictional martial-arts coach seed data; restricted public coach search/filter/detail projections; profile editing by the owning authenticated coach; stable integration points for active offer metadata, weekly availability and the Mapbox UI owned by later peers; responsive list-based coach directory/profile screens with honest empty/error states.
- Out of scope: Mapbox dependency/provider UI owned by DEV0108, credentials/verification claims, ratings, slot persistence or calendar mutation, messaging, client/device geolocation, live tracking, distance-from-me sorting, multiple coach venues, coach payments, onchain offer creation, pass purchase, booking, session redemption, posts/follows or real-coach data without permission.

## Expected behavior and edge cases

Guests can browse only visible fictional coaches and filter by discipline, public location label and private-training service mode. A public location is one point explicitly confirmed by the coach for discovery; it is not live/current device location and does not imply availability. A signed-in user explicitly opts into the coach role and can mutate only their own profile. Hidden, incomplete, malformed, cross-dataset or deleted profiles and unconfirmed coordinates do not leak through search, detail or DEV0108 map projections.

Public offer summaries appear only when a later indexed active offer has matching approved metadata; metadata alone cannot invent price, sessions, recipient or active state. Weekly availability appears only through DEV0104's authoritative slot projection. Backend/database failure shows an honest unavailable state rather than fixture coach or slot fallback.

## Assumptions, decisions, and dependencies

Application identity remains email-first. Wallet linking is separate and required only before chain-backed offer actions. Coach status is self-declared for the hackathon and must not be labelled verified. Fictional coach identities, images and selected locations must be original/demo-safe and must not imply a real person or partnership.

PostgreSQL stores a provider-neutral location snapshot and never depends on a Mapbox feature identifier to render the list. DEV0108 owns selection/geocoding UI and must supply only a storage-permitted confirmed result. This ticket validates coordinate bounds, bounded labels, owner authority and confirmation metadata before persistence. P0 supports exactly one public location per coach; multiple venues and service areas are deferred.

## Implementation plan

1. Add additive profile/role/discipline/public-location schema, coordinate/label constraints, indexes, row-level security and deterministic fictional seed data.
2. Add restricted repositories/services for owner mutation and public discovery projections.
3. Implement list-based coach directory filters, detail page, provider-neutral owner location mutation and bounded offer/availability/Mapbox integration points without implementing downstream Mapbox or slot capability.
4. Validate authorization isolation, hidden/error states, seed idempotency and responsive accessible browsing.

## Acceptance criteria

- [ ] AC1: A guest can discover visible fictional coaches and open a profile without authentication, Mapbox or fabricated live availability; confirmed public-location projections can feed DEV0108 and the profile can host DEV0104's authoritative weekly projection later.
- [ ] AC2: An authenticated user can create/update only their own coach profile; anonymous, cross-user and cross-dataset mutations fail closed.
- [ ] AC3: Public-location fields are bounded, coordinate-valid, provider-neutral and owner-confirmed; filters are deterministic and empty/database-error states do not fall back to fixtures or provider results.
- [ ] AC4: Offer metadata cannot override authoritative onchain commercial terms or surface a deactivated/unindexed offer.
- [ ] AC5: Migration, seed, authorization, service, browser, static and build checks pass.

## Validation plan

Run clean/repeat migration and seed checks, database constraint/RLS tests, server integration tests with owner/other/anonymous actors, focused discovery domain tests and desktop/mobile keyboard browser scenarios. Also run relevant `npm test`, lint, typecheck and build commands.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: additive Supabase migration/seed, Drizzle mappings, coach/public-location repositories/services/routes, list-based discovery/profile features and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Additive database contracts are planned for one provider-neutral public location per coach. No Mapbox credential is stored in PostgreSQL and no new secret is expected here. Migration rollback/compatibility details must preserve dormant historical gym data.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Self-declared coach profiles prove neither credentials nor quality. Verification, ratings, moderation and real partner onboarding require later tickets.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
