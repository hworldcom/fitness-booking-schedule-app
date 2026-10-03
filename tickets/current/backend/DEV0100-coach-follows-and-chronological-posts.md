# Ticket DEV0100: Add coach follows and chronological posts

- Status: Draft
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first M6 network loop
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on persistent coaches from [DEV0096](../../archive/backend/DEV0096-persist-coach-profiles-and-discovery.md); replaces the unimplemented member-check-in feed in DEV0023 after DEV0094 reconciles that record

## Objective and context

Add the deliberately small network layer around coach discovery: clients follow coaches, coaches publish short posts and Following shows those posts in deterministic reverse chronological order. This is retention and discovery support, not a general social network and not the initial cold-start discovery source.

## Scope and non-goals

- In scope: one-way follow/unfollow of visible coaches; coach-only text posts; optional image only if the existing reviewed storage boundary makes it trivial; active/hidden post status; recent posts on coach profiles; authenticated Following feed; stable pagination/order; empty/loading/error states; owner post controls; responsive accessible UI and authorization/privacy tests.
- Out of scope: client posts, reactions, comments, direct messages, notifications, stories, groups, rankings/recommendations, attendance sharing, automatic purchase posts, real-time delivery or complex moderation.

## Expected behavior and edge cases

Follow/unfollow is idempotent and self-follow is rejected. Only an authenticated owner of a visible coach profile can publish or hide that coach's post. Following contains visible posts from currently followed visible coaches, newest first with deterministic tie-breaking; unfollow/hide/profile deactivation removes content from later queries without deleting financial/package evidence.

A new guest discovers coaches and open weekly slots through DEV0096/DEV0104 rather than an empty personalized feed. Buying a pass or booking a class does not silently follow a coach; an optional explicit post-booking follow prompt may be offered. Feed failure never falls back to fabricated posts.

## Assumptions, decisions, and dependencies

Text is the required hackathon format. Image upload is not an acceptance requirement. Posts and follows are authoritative offchain and have no Solana transaction. Existing browser-only preview follows cannot be treated as shared persistent state.

## Implementation plan

1. Add follow/post schema, indexes, row-level security and bounded content validation.
2. Add protected mutation and chronological query services with stable pagination.
3. Integrate follow controls, coach recent posts, create/hide controls and Following feed.
4. Validate two-user authorization, idempotency, ordering ties, hide/unfollow/profile changes and honest failure states.

## Acceptance criteria

- [ ] AC1: A client can follow/unfollow a visible coach idempotently; anonymous, self, cross-user and hidden-profile mutations fail safely.
- [ ] AC2: A coach can create/hide only their own bounded text post; clients cannot publish.
- [ ] AC3: Following and coach-profile posts are deterministic, paginated and update correctly after unfollow/hide/deactivation.
- [ ] AC4: No reactions, comments, messages, ranking or fabricated failure fallback is introduced.
- [ ] AC5: Database, service, two-user browser, accessibility, static and build checks pass.

## Validation plan

Run additive migration/constraint/RLS tests, two-user/anonymous service integration, pagination/idempotency tests and mobile/desktop keyboard browser flows. Run relevant unit, lint, typecheck and production build commands. No Devnet transaction is applicable because the social graph/content is offchain.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: additive social migration, Drizzle mappings, post/follow repositories/services/routes, coach profile and feed UI, and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Database contracts are planned. Image-storage configuration is explicitly not required; if added, revise the ticket before implementation.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Moderation and abuse controls are minimal for the hackathon and require production review. The feed is not a substitute for searchable coach discovery.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
