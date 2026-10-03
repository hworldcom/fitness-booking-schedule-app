# Ticket DEV0100: Add coach follows and chronological posts

- Status: Completed
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first M6 network loop
- Coordination: [COR0009 — Coach-first private-class booking MVP](../../current/organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on persistent coaches from [DEV0096](DEV0096-persist-coach-profiles-and-discovery.md) and integrates with self-service activation from [DEV0110](DEV0110-activate-coaching-during-account-onboarding.md); replaces the unimplemented member-check-in feed in DEV0023 after DEV0094 reconciles that record

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

The reviewed first slice is text-only: images are deferred because the repository has no existing approved upload/moderation boundary. Post text is normalized and limited to 1–500 characters. Public coach posts and the authenticated Following feed use cursor pagination ordered by `(published_at desc, id desc)` with a bounded page size of 20. A hidden post retains its durable record but is absent from public and follower projections.

Public recent posts remain integrated with `/coaches/[slug]`; authenticated feed and owner controls use dedicated `/following` and `/coach/posts` routes. Follow and post mutations use Server Actions backed by server-only services and database functions that derive the actor from the verified request context. Migration `20261003000500` follows the committed DEV0104 `00300` availability migration and DEV0110 `00400` coaching-activation migration.

## Implementation plan

1. Add follow/post schema, indexes, row-level security, bounded content validation and deterministic fictional post seed data.
2. Add protected mutation and chronological query services with stable cursor pagination.
3. Integrate follow controls and recent posts on coach profiles plus dedicated owner-post and Following routes.
4. Validate two-user authorization, idempotency, ordering ties, hide/unfollow/profile changes and honest failure states.

## Acceptance criteria

- [x] AC1: A client can follow/unfollow a visible coach idempotently; anonymous, self, cross-user and hidden-profile mutations fail safely.
- [x] AC2: A coach can create/hide only their own bounded text post; clients cannot publish.
- [x] AC3: The Following feed is cursor-paginated and both Following and coach-profile post projections are deterministic and update correctly after unfollow/hide/deactivation.
- [x] AC4: No reactions, comments, messages, ranking or fabricated failure fallback is introduced.
- [x] AC5: Database, service, two-user browser, accessibility, static and build checks pass.

## Validation plan

Run additive migration/constraint/RLS tests, two-user/anonymous service integration, pagination/idempotency tests and mobile/desktop keyboard browser flows. Run relevant unit, lint, typecheck and production build commands. No Devnet transaction is applicable because the social graph/content is offchain.

## Implementation record

Implementation completed on 2026-10-03 in a separate `dev0100` Git worktree so the active DEV0104 availability migration and coach UI changes remained isolated.

### Changes and rationale

- Added durable one-way coach follows and bounded coach-authored posts. Forced row-level security (RLS) leaves the runtime role read-only on both tables; actor-derived security-definer functions own follow, publish and visibility mutations so the browser cannot select the acting profile or demo run.
- Added server-only projections for public recent posts, current follow state, owner post history and the Following feed. Feed order is `(published_at desc, id desc)`, with an opaque cursor and a bounded page size of 20; hidden posts, hidden coaches and unfollowed coaches disappear from subsequent reads without deleting their records.
- Added `/following` and `/coach/posts`, a follow control plus recent posts on `/coaches/[slug]`, and a shared Following navigation item. The UI exposes text-only publishing and visible/hidden owner controls, honest signed-out/unavailable/empty states, and no reactions, comments, messages or ranking.
- Added three deterministic fictional fixture posts and a local two-account rehearsal that signs in separate coach/client identities, publishes, follows, verifies the feed, unfollows, re-follows and hides the post.

### Affected files

- [`supabase/migrations/20261003000500_create_coach_social.sql`](../../../supabase/migrations/20261003000500_create_coach_social.sql) creates the follow/post tables, constraints, indexes, forced RLS policies and actor-derived mutation functions.
- [`supabase/seed.sql`](../../../supabase/seed.sql) adds deterministic text posts for three fictional coaches; [`src/server/db/schema/social.ts`](../../../src/server/db/schema/social.ts) and the schema barrel expose matching Drizzle mappings.
- [`src/domain/coach-social.ts`](../../../src/domain/coach-social.ts), [`src/server/db/coaches/social-repository.ts`](../../../src/server/db/coaches/social-repository.ts) and [`src/server/coaches/social-service.ts`](../../../src/server/coaches/social-service.ts) define the bounded input/cursor contracts, authoritative database operations and signed-in/public service states.
- [`src/app/coaches/[slug]/actions.ts`](../../../src/app/coaches/[slug]/actions.ts), [`src/app/coach/posts/actions.ts`](../../../src/app/coach/posts/actions.ts), [`src/app/following/page.tsx`](../../../src/app/following/page.tsx) and [`src/app/coach/posts/page.tsx`](../../../src/app/coach/posts/page.tsx) add the mutation and route boundary.
- [`src/features/coaches/coach-social.tsx`](../../../src/features/coaches/coach-social.tsx), [`src/features/coaches/coach-discovery.tsx`](../../../src/features/coaches/coach-discovery.tsx), [`src/app/coach-discovery.css`](../../../src/app/coach-discovery.css), [`src/app/globals.css`](../../../src/app/globals.css) and [`src/components/shell.tsx`](../../../src/components/shell.tsx) provide the responsive profile/feed/editor controls and navigation.
- [`tests/coach-social.test.ts`](../../../tests/coach-social.test.ts), [`tests/database/coach-social.test.ts`](../../../tests/database/coach-social.test.ts), [`tests/browser/coach-discovery.spec.ts`](../../../tests/browser/coach-discovery.spec.ts), [`tests/boundaries.test.ts`](../../../tests/boundaries.test.ts) and [`scripts/rehearse-local-coach-social.mjs`](../../../scripts/rehearse-local-coach-social.mjs) cover validation, authorization, deterministic ordering and real browser behavior.

### Decisions and deviations

- 2026-10-03: Use text-only posts for the hackathon rather than introducing unreviewed upload, moderation and storage behavior.
- 2026-10-03: Initially reserved migration `20261003000400` after DEV0104's active `00300` migration. Integration review found that DEV0110 had since reserved `00400` for coaching activation, so the independent social migration moved to `20261003000500` before commit.
- 2026-10-03: Use dedicated `/following` and `/coach/posts` routes to minimize collision with DEV0104; the coach profile has only the required follow/recent-post integration.
- 2026-10-03: Keep initial `useActionState` values in the client component. A top-level `"use server"` module exposes async Server Actions only, avoiding a hydration-time value export that this Next.js version does not support safely.
- 2026-10-03: Treat coach-profile posts as a bounded recent preview rather than a second paginated feed. The personalized Following route owns cursor pagination; both projections retain deterministic ordering.
- 2026-10-03: Call Next.js `connection()` before resolving the protected `/coach/posts` workspace. Build-time preview configuration can otherwise let Next.js prerender a signed-out shell instead of evaluating runtime authentication for each request.

### Contracts, configuration, and operations

Migration `20261003000500` adds `app.coach_follows`, `app.coach_posts`, `app.set_owned_coach_follow(uuid, boolean)`, `app.create_owned_coach_post(text)` and `app.set_owned_coach_post_visibility(uuid, text)`. Runtime table writes remain revoked. Existing environments must apply the migration and seed update before serving the new routes.

The browser gains `/following` and `/coach/posts`; coach profiles gain follow state and a three-post public preview. No public API, Solana transaction, environment variable, image-storage dependency or external service contract was added. Posts and follows remain authoritative offchain state.

## Validation results

- `npm run format:check` — passed; all checked files use Prettier formatting.
- `npm run typecheck` — passed after Next.js route generation.
- `npm run lint` — passed with zero errors or warnings.
- `npm test` — passed, 57 unit/boundary tests including post normalization, deterministic cursor parsing and the `/coach/posts` request-time rendering guard.
- `npm run build` — passed with Next.js 16.3.5; `/following`, `/coach/posts` and `/coaches/[slug]` compiled successfully, with the two authenticated social workspaces marked for request-time rendering. The installed Supabase client emitted its existing warning that future versions will require Node.js 22 or later; it did not affect this build.
- `npm run db:reset` — passed from a clean local database and applied the integrated DEV0104 `00300`, DEV0110 `00400` and DEV0100 `00500` migrations in order before seeding.
- `npm run db:runtime && npm run test:db` — passed, 24/24 database tests after restoring the disposable loopback runtime login removed by the clean reset. The three DEV0100 cases prove direct runtime writes are denied, follow/unfollow is idempotent, self-follow and client publishing fail, cross-user post hiding fails, equal-time ordering uses the UUID tie-breaker, and hidden posts/coaches disappear.
- `npm run db:test` — passed all 129 pgTAP assertions, including the updated 11-table foundation inventory.
- `npm run db:lint` — passed with no schema errors.
- `npm run db:seed` — passed after applying the additive migration; the fictional coach posts were created without real-coach references.
- `npm run test:e2e -- tests/browser/coach-discovery.spec.ts` — passed, 10/10 desktop and mobile checks. This covers public recent posts, sign-in-gated social workspaces, follow call-to-action, keyboard filter use and no horizontal overflow.
- `npm run test:coach-social` — passed against local Supabase and Chrome with two isolated email-auth accounts. It verified coach preparation, publish, follow, feed visibility, idempotent unfollow/re-follow, hide removal and mobile overflow, with no page errors.

The first post-reset `npm run test:db` attempt failed because the clean database no longer had the disposable loopback runtime login prepared. Running the documented `npm run db:runtime` prerequisite restored that local-only role, after which all 24 tests passed. This was an environment-preparation failure rather than an application or migration failure. No Devnet check applies because this ticket adds offchain social state only.

A configuration-free browser rerun correctly showed the honest unavailable catalogue state and therefore failed four fixture expectations. Rebuilding and rerunning with the repository's existing ignored local environment loaded passed all 10 focused desktop/mobile checks; no credential was copied into this worktree or recorded in the ticket.

## Risks, limitations, and follow-ups

Moderation and abuse controls are minimal for the hackathon and require production review. Images remain deferred. The feed is not a substitute for searchable coach discovery.

The local two-account rehearsal prepares its visible coach through the same authoritative activation/profile database functions used by DEV0110/DEV0096, then browser-tests every DEV0100 interaction. Public profile discovery remains the cold-start path; Following stays intentionally empty until a client explicitly follows a coach.

## Completion and review references

- Completed: 2026-10-03.
- Commit: `[DEV0100] Add coach follows and chronological posts` (this commit).
- Review: Implementation self-review against all acceptance criteria; no independent review.
- Deployment or release: None.
