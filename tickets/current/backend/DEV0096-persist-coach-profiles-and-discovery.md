# Ticket DEV0096: Persist coach profiles and discovery

- Status: In progress
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first M1 identity and discovery
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on the simplified gym/location boundary from [DEV0109 — Retire membership schema and preserve gyms](../../archive/backend/DEV0109-retire-membership-schema-and-preserve-gyms.md), follows [DEV0094](../../archive/organisatory/DEV0094-adopt-coach-first-training-package-mvp.md) and reuses completed email identity plus in-progress [DEV0047 — Personal wallet linking](DEV0047-personal-wallet-linking-and-replacement.md); supplies coach identity/location to DEV0097, DEV0100, [DEV0104 — Publish weekly coach availability](DEV0104-publish-weekly-coach-availability.md) and [DEV0108 — Add the Mapbox coach Explore map](../frontend/DEV0108-add-mapbox-coach-explore-map.md)

## Objective and context

Add the persistent application boundary that lets an email-backed user become a coach, maintain a public profile and appear in cold-start coach discovery. The current catalogue is gym-centric and the existing feed cannot help a new visitor discover an unfollowed coach.

## Scope and non-goals

- In scope: coach role/profile schema and authorization; public display name, disciplines, bio, optional affiliation with one fictional gym supplied by DEV0109 or an independent location, one explicitly selected public discovery location with provider-neutral label/longitude/latitude/source/confirmation fields, private-training service mode, reviewed timezone and visibility; original fictional martial-arts coach seed data; restricted public coach search/filter/detail projections including optional gym name; profile editing by the owning authenticated coach; stable integration points for active offer metadata, weekly availability and the Mapbox UI owned by later peers; responsive list-based coach directory/profile screens with honest empty/error states.
- Out of scope: Mapbox dependency/provider UI owned by DEV0108, gym accounts/administration/classes/memberships/check-ins/wallet authority, credentials/verification claims, ratings, slot persistence or calendar mutation, messaging, client/device geolocation, live tracking, distance-from-me sorting, multiple simultaneous public gym/venue locations, coach payments, onchain offer creation, pass purchase, booking, session redemption, posts/follows or real-coach/gym data without permission.

## Expected behavior and edge cases

Guests can browse only visible fictional coaches and filter by discipline, optional gym/public location label and private-training service mode. A public location is one point explicitly confirmed by the coach for discovery: it may be sourced from an active fictional gym affiliation or entered as an independent training location. It is not live/current device location and does not imply availability. A signed-in user explicitly opts into the coach role and can mutate only their own profile and gym selection. Hidden, inactive-gym, incomplete, malformed, cross-dataset or deleted profiles and unconfirmed coordinates do not leak through search, detail or DEV0108 map projections.

Public offer summaries appear only when a later indexed active offer has matching approved metadata; metadata alone cannot invent price, sessions, recipient or active state. Weekly availability appears only through DEV0104's authoritative slot projection. Backend/database failure shows an honest unavailable state rather than fixture coach or slot fallback.

## Assumptions, decisions, and dependencies

Application identity remains email-first. Wallet linking is separate and required only before chain-backed offer actions. Coach status is self-declared for the hackathon and must not be labelled verified. Fictional coach identities, images and selected locations must be original/demo-safe and must not imply a real person or partnership.

PostgreSQL stores a provider-neutral location snapshot and never depends on a Mapbox feature identifier to render the list. DEV0108 owns selection/geocoding UI and must supply only a storage-permitted confirmed result. This ticket validates coordinate bounds, bounded labels, owner authority, optional same-dataset gym affiliation and confirmation metadata before persistence. Selecting a gym copies or references only its reviewed public location data; the gym gains no authority over the coach. P0 supports zero or one selected public gym affiliation and exactly one public location per coach; multiple simultaneous venues and service areas are deferred.

The existence of a coach profile is the hackathon's explicit, self-declared coach role; the retained demo-run `member`/`operator` role is an application-dataset authorization role and must not be reinterpreted as coach status. Public routes are `/explore` for list discovery and `/coaches/[slug]` for detail. Authenticated owner setup/editing is isolated at `/profile/coach`. Fixture coaches use a bounded martial-arts discipline vocabulary and initials/color artwork already supported by the application; no real-person photo, credential or verification claim is introduced.

## Implementation plan

1. Add additive coach-profile/discipline/optional-gym/public-location schema, coordinate/label/affiliation constraints, indexes, row-level security and deterministic fictional seed data on DEV0109's simplified gyms. Treat coach-profile existence as the self-declared role while leaving demo-run authorization roles unchanged.
2. Add restricted repositories/services for owner mutation and public discovery projections.
3. Implement list-based coach directory filters, detail page, provider-neutral owner location mutation and bounded offer/availability/Mapbox integration points without implementing downstream Mapbox or slot capability.
4. Validate authorization isolation, hidden/error states, seed idempotency and responsive accessible browsing.

## Acceptance criteria

- [x] AC1: A guest can discover visible fictional coaches—including an optional fictional gym label or an independent training location—and open a profile without authentication, Mapbox or fabricated live availability; confirmed public-location projections can feed DEV0108 and the profile can host DEV0104's authoritative weekly projection later.
- [x] AC2: An authenticated user can create/update only their own coach profile and optional gym selection; anonymous, cross-user, inactive-gym and cross-dataset mutations fail closed.
- [x] AC3: Public-location fields are bounded, coordinate-valid, provider-neutral and owner-confirmed; a gym-derived location references one eligible fictional gym without granting gym authority; filters are deterministic and empty/database-error states do not fall back to fixtures or provider results.
- [x] AC4: Offer metadata cannot override authoritative onchain commercial terms or surface a deactivated/unindexed offer.
- [ ] AC5: Migration, seed, authorization, service, browser, static and build checks pass.

## Validation plan

Run clean/repeat migration and seed checks, database constraint/RLS tests, server integration tests with owner/other/anonymous actors, focused discovery domain tests and desktop/mobile keyboard browser scenarios. Also run relevant `npm test`, lint, typecheck and build commands.

## Implementation record

Implementation started after DEV0109 completed the simplified gym boundary. Route, authority and role semantics were reviewed before the first runtime edit. The feature implementation and its focused validation are complete; final repository-wide static validation is pending correction of unrelated concurrent DEV0097 files described below.

### Changes and rationale

Added `coach_profiles` and ordered `coach_profile_disciplines` persistence with forced row-level security, bounded fields, same-dataset participant/gym foreign keys and a single security-definer owner mutation. Profile existence is the self-declared coach role; it does not change the retained demo-run authorization role. Gym selection copies only an active fictional gym's reviewed public location, while an independent coach supplies one confirmed provider-neutral point.

Seeded five original fictional martial-arts coaches across gym and independent locations. Added database-backed public list/detail projections, deterministic text/discipline/location/service filters and honest unavailable/empty states with no in-memory fixture fallback. Added an owner-only profile editor and public `/explore` plus `/coaches/[slug]` routes. Public profile placeholders explicitly withhold prices, availability and posts until their authoritative downstream records exist.

Updated global navigation, Home/How-it-works calls to action, profile navigation and current project-status copy to expose the coach directory without reviving retired membership routes.

### Affected files

- `supabase/migrations/20261003000200_create_coach_profiles.sql` defines coach profiles, disciplines, constraints, indexes, row-level security and the owner-scoped upsert contract.
- `supabase/seed.sql` adds five deterministic fictional coaches and their disciplines on the simplified fictional-gym dataset.
- `src/domain/coaches.ts` owns bounded public/editor types, filter normalization and form validation; `src/server/db/schema/coaches.ts` exposes the Drizzle mappings.
- `src/server/db/coaches/repository.ts` owns policy-filtered public/owner queries and the bounded mutation call; `src/server/coaches/service.ts` maps database failures to explicit unavailable states.
- `src/app/explore/page.tsx`, `src/app/coaches/[slug]/page.tsx`, `src/app/profile/coach/page.tsx` and `src/app/profile/coach/actions.ts` expose public discovery/detail and authenticated owner editing.
- `src/features/coaches/coach-discovery.tsx`, `src/features/coaches/coach-profile-editor.tsx` and `src/app/coach-discovery.css` provide the responsive, accessible interface and truthful downstream placeholders.
- `tests/coaches.test.ts`, `tests/database/coaches.test.ts`, `supabase/tests/database/coach-profiles.test.sql` and `tests/browser/coach-discovery.spec.ts` cover validation, ownership/RLS, seed/schema invariants and desktop/mobile browsing. Boundary and legacy-route tests now cover the new server-only repositories and restored `/explore` route.

### Decisions and deviations

The self-declared coach role is represented by a coach-profile row rather than by changing the retained demo-run `member`/`operator` authorization role. This prevents dataset access roles from becoming product claims. Public list/detail and private owner editing use separate route and service boundaries. Offer and availability sections remain explicitly empty until their authoritative downstream records exist.

The owner mutation is intentionally a database function without a caller-supplied profile identifier: it derives both profile and demo run from the verified server-set actor context. The runtime role has policy-filtered reads but no direct insert/update/delete grants. Fixture profiles cannot be claimed by an application user. Public slugs reuse the already enrolled application-profile slug so they are stable without introducing a second naming authority.

### Contracts, configuration, and operations

The additive database contract permits zero or one selected fictional gym affiliation and requires exactly one confirmed provider-neutral public location per coach. Gym-derived records copy the reviewed gym timezone, label and coordinates; independent records accept manual data or a named permanent-geocoding source. No Mapbox credential, external feature identifier, secret or new environment variable is stored. DEV0109's destructive hosted cleanup remains unapplied, so this migration is validated locally but must not be applied to staging ahead of that reviewed cleanup.

## Validation results

- Passed twice: `npm run db:reset` rebuilt the complete migration chain through `20261003000200_create_coach_profiles.sql` and reapplied the deterministic seed without conflict.
- Passed: `npm run db:test` — 4 pgTAP files and 101 assertions, including 27 coach-profile schema/RLS/seed assertions.
- Passed: `npm run db:runtime && npm run test:db` — 14 integration tests; coach cases proved the verified owner-only mutation, public filtering, hidden-profile isolation and inactive-gym rollback.
- Passed: `npm test` — 47 unit/boundary tests in the isolated DEV0096 state; a later shared-tree run also passed 51 tests after concurrent DEV0097 tests appeared. Focused coach validation and server-only boundary checks passed in both runs.
- Passed: `npm run test:e2e` — 24 desktop/mobile scenarios. The coach directory, discipline filtering, profile detail, truthful empty downstream sections and protected editor boundary passed without horizontal overflow. Captured desktop/mobile directory and profile screenshots were visually reviewed.
- Passed: `npm run db:lint` — no schema errors. `npm run format:check`, focused ESLint for every DEV0096 TypeScript/TSX file and `git diff --check` also passed.
- Passed before concurrent DEV0097 files appeared: `npm run typecheck`, full `npm run lint -- --quiet` and `npm run build`; the build included dynamic `/explore`, `/coaches/[slug]` and `/profile/coach` routes.
- Pending final repository-wide rerun: later uncommitted DEV0097 files currently fail TypeScript on BigInt literals below the configured target and full ESLint on two generated empty-object types. These files are outside DEV0096 and were not modified here. DEV0096 therefore remains in progress with AC5 unchecked until that parallel ticket restores the shared static checks.

## Risks, limitations, and follow-ups

Self-declared coach profiles prove neither credentials nor quality. Verification, ratings, moderation and real partner onboarding require later tickets. The manual coordinate form is an interim provider-neutral editor; DEV0108 owns Mapbox-assisted selection and compliance. Weekly times, offers and posts remain truthful empty states until DEV0104, DEV0097/DEV0098 and DEV0100 supply authoritative data. Hosted migration is sequenced after DEV0109's unresolved staging-history disposition.

## Completion and review references

- Completed: Not completed — focused implementation and validation pass; final shared-tree typecheck/lint/build rerun is waiting on the concurrent DEV0097 worktree changes.
- Commit: Not created.
- Review: Implementation self-review completed against AC1–AC4; AC5 remains open for the final shared-tree static rerun.
- Deployment or release: None.
