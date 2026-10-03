# Ticket DEV0040: Protected access and database context

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-21
- Milestone: M0 identity and protected access
- Coordination: [COR0002 — Phantom authentication and demo access](../organisatory/COR0002-phantom-auth-and-demo-access.md)
- Related records: depends on completed [DEV0039 — Prepared identity and wallet bindings](DEV0039-prepared-identity-and-wallet-bindings.md) and [DEV0025 — Next.js backend boundary](DEV0025-nextjs-backend-boundary.md); enables [COR0006 — Persistent access catalogue](../organisatory/COR0006-persistent-access-catalogue.md), converted from retired DEV0017, later-cancelled [DEV0018 — Class-pass reservations and confirmed visits](DEV0018-class-pass-reservations-and-confirmed-visits.md), and [DEV0023 — Minimal shared activity feed](./DEV0023-minimal-shared-activity-feed.md)

## Objective and context

Turn DEV0039's verified application identity into a reusable, server-enforced subject/dataset/profile/role context for private data and protected routes. A dataset participation record is the internal link between a profile and one isolated `demo_runs` dataset; it is not a gym membership, class pass or login session. Establish the first transaction-local PostgreSQL row-level security path, guard the currently private interface entry points and preserve anonymous catalogue discovery.

This ticket owns the shared access boundary required by the specification's [public browsing and sign-in rules](../../../docs/mvp-spec.md#public-browsing-and-sign-in-boundaries) and [authentication recommendation](../../../docs/mvp-spec.md#authentication-and-data-access-recommendation). Later feature tickets use it rather than reimplementing session, membership or database context checks.

## Scope and non-goals

- In scope: resolve the current verified Supabase subject to an active profile and dataset participation record; define a narrow server authorization context and response contract; set and clear subject/dataset/profile/role only inside a database transaction; add the first private grants and row-level security policies for identity/dataset access; prove pooled connections cannot leak context; add thin framework guards for `/profile`, `/challenges/new`, `/events/new` and protected mutations; validate safe internal return destinations; clear wallet-bound/private browser state when authentication or binding becomes invalid; preserve guest access to Explore, Challenges, classes/events/studios and public details.
- Out of scope: Supabase provider sign-in owned by DEV0038; personal enrollment and shared wallet-binding schema owned by DEV0039; catalogue/draft/follow/bookmark repositories owned by DEV0017; membership booking owned by DEV0018; feed/Cheers owned by DEV0023; company challenge and wallet proof owned by DEV0041; payments, balances, chain verification or broad admin tooling.

## Expected behavior and edge cases

Protected server operations derive the Auth subject from the server-verified Supabase session, resolve an active prepared profile and dataset participation record, and open a database transaction with only that context. Missing, expired or forged sessions; inactive datasets; revoked participation; wrong-dataset resources; absent roles and client-supplied identity metadata fail before protected data is returned or mutated.

Alternating users through the same connection pool never inherit each other's subject/dataset/profile/role. Commit, rollback, timeout and thrown-error paths clear the transaction-local context. Shared caches never contain authenticated responses, refresh cookies or personalized data.

Guests can directly open and reload public discovery and detail routes without Phantom or Supabase. Protected pages show a clear sign-in requirement with a validated same-origin internal return target. Completing sign-in does not automatically create, follow, book, join, pay or submit a saved mutation. Cancellation/sign-out returns to public browsing. A changed/disconnected wallet or invalidated binding clears affected private client state before another protected action; it never reassigns the session to the new wallet.

## Assumptions, decisions, and dependencies

Implementation starts after DEV0039 provides the verified identity/dataset lookup. Use the server-only boundaries and Drizzle/PostgreSQL connection established by DEV0015/DEV0025. Do not trust a decoded cookie, client component, request body, URL dataset ID or editable Auth metadata as authority.

This ticket establishes infrastructure and a current-actor vertical slice, not generic repositories for later features. DEV0017 consumes the helper for catalogue/private drafts; it remains responsible for public projections and its own feature policies. The exact first policy and route matrix below is locked before implementation; do not broaden anonymous database access implicitly.

### Locked implementation contracts — 2026-09-21

#### Verified actor and error contract

The server-only authorization value is:

```ts
type AuthorizedActor = Readonly<{
  authUserId: string;
  profileId: string;
  runId: string;
  runRole: "member" | "operator";
  walletBindingId: string;
  walletAddress: string;
  walletCluster: "solana:devnet";
}>;
```

`runId` identifies the isolated demo dataset. `runRole` is only the dataset-wide `member` or `operator` role already stored in `demo_run_memberships`; it does not imply gym membership, organization administration, venue staff authority or company-wallet authority. Later features must check those narrower records inside the same protected transaction.

The server derives every field from `verifiedAuthSession()` plus DEV0039's current-identity lookup. It accepts no subject, profile, dataset, role, binding or wallet value from request bodies, query parameters, Auth user metadata or client components. Resolution requires the exact active personal binding, claimed profile, active dataset and active dataset participation record to agree with the verified Supabase subject and wallet. The database/Auth-mode result is one of `authorized`, `signed-out`, `forbidden` or `unavailable`: protected HTTP handlers map those to `200`, `401`, `403` and `503` without revealing whether an arbitrary wallet or profile is prepared.

A server-only access-mode parser returns `preview` only when all five relevant variables are absent: `DATABASE_URL`, `PREPARED_PERSONAL_IDENTITIES_JSON`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL`. It returns `database` only when the existing database, roster and Supabase parsers validate all five. A partial or invalid combination returns `unavailable`, never `preview`. This preserves configuration-free builds while ensuring a configured outage or mistake cannot silently expose fixtures as application data.

#### Transaction and database-context contract

One server-only `withAuthorizedActor(work)` helper owns the complete lifecycle. It verifies the Supabase session, starts a Drizzle transaction, revalidates the actor inside that transaction, sets the following PostgreSQL settings with `set_config(..., true)`, invokes `work(transaction, actor)`, and never exposes the transaction object outside the callback:

| Transaction-local setting       | Value                                      |
| ------------------------------- | ------------------------------------------ |
| `app.current_auth_user_id`      | Verified Supabase subject UUID.            |
| `app.current_profile_id`        | Verified application profile UUID.         |
| `app.current_run_id`            | Server-selected active demo dataset UUID.  |
| `app.current_run_role`          | Exact `member` or `operator` dataset role. |
| `app.current_wallet_binding_id` | Exact active personal wallet-binding UUID. |

The third `set_config` argument is always `true`, so every setting is local to the current transaction. No protected repository receives the base pooled client or uses session-level `SET`. Commit, rollback, thrown errors and callback rejection end the context automatically. Missing or malformed settings deny access. Tests must alternate actors through a one-connection pool and inspect success, commit, rollback and thrown-error reuse paths.

A hardened `SECURITY DEFINER` predicate owned by `app_owner` validates the complete setting tuple against the live profile, active dataset, active participation record and active personal binding. It has a fixed empty search path, is executable only by `app_runtime`, returns false for missing/invalid context and does not return identity data. The row-level policies call this predicate in addition to matching the row's own profile/dataset fields, so revocation during a request fails closed rather than trusting stale JavaScript context.

#### First grant and row-level security matrix

DEV0040 adds only the minimum current-actor read surface. Existing forced row-level security remains enabled, and `public`, `anon`, `authenticated` and `service_role` receive no app-schema access.

| Table                         | `app_runtime` privilege | Policy in this ticket                                                                                                          |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `app.profiles`                | `SELECT`                | Read only the actor's exact claimed profile after the complete live actor tuple validates.                                     |
| `app.demo_runs`               | `SELECT`                | Read only the actor's exact active demo dataset after the complete live actor tuple validates.                                 |
| `app.demo_run_memberships`    | `SELECT`                | Read only the actor's exact active dataset participation row with the role equal to `app.current_run_role`.                    |
| `app.wallet_bindings`         | No direct table grant   | Continue using DEV0039's narrow functions; the validation predicate may inspect the binding as its `app_owner` implementation. |
| All product/organization data | No new privilege        | DEV0017, DEV0018, DEV0023 and DEV0041 own their feature-specific grants, policies and role checks.                             |

No `INSERT`, `UPDATE` or `DELETE` grant is introduced by this ticket. No same-dataset people directory, public-profile projection or generic feature repository is opened. The migration is forward-only; disposable local rollback uses `npm run db:reset`, while an applied hosted correction requires a new migration.

#### Server and browser contract

The existing `/api/auth/identity` endpoint keeps DEV0039's enrollment contract. DEV0040 adds `GET /api/auth/actor` as the first real consumer of `withAuthorizedActor`, with this exact browser response:

```ts
type ActorSnapshot =
  | Readonly<{ status: "preview" }>
  | Readonly<{
      status: "authorized";
      profile: Readonly<{ slug: string; displayName: string }>;
      demoRun: Readonly<{ slug: string; name: string }>;
      role: "member" | "operator";
    }>
  | Readonly<{ status: "signed-out" | "forbidden" | "unavailable" }>;
```

`preview` and `authorized` return `200`; the other statuses use `401`, `403` and `503` respectively. The response omits internal UUIDs, wallet address, binding ID and prepared-roster details. The route is dynamic and sends `Cache-Control: private, no-store`, including for errors. Protected page components and every server action or route handler call the server helper directly; they do not authorize by calling the browser endpoint.

`src/proxy.ts` remains responsible only for refreshing Supabase cookies. It must not become the sole authorization layer or open a database connection. The actual page/action guard runs in the Node.js server boundary where the verified session and database actor can be checked. Every state-changing HTTP endpoint also requires the configured same-origin `Origin`, uses a non-`GET` method, and reauthorizes inside the operation; a hidden button or prior page guard is never sufficient.

The protected route/view matrix is:

| Route or action                                                                                         | Database/Auth mode behavior                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/profile`, `/users/:id`, `/challenges/new`, `/events/new`                                              | Require an authorized actor. `/users/:id` remains same-dataset personal content, not an anonymous people directory.                                                  |
| Local draft details matching `/challenges/draft-<uuid>` or `/events/event-draft-<uuid>`                 | Require an authorized actor before rendering the browser-local draft. The identifier never grants access.                                                            |
| My Challenges/drafts, save/book/follow/Cheer/join/vote/claim and any later protected server mutation    | A guest attempt opens sign-in with a safe return destination and performs no mutation. The owning feature ticket still supplies the real repository and permissions. |
| `/`, `/explore`, `/challenges`, public class/event/studio/challenge details, `/search`, `/how-it-works` | Remain directly reachable and reloadable by guests. `/` may show a guest sign-in/discovery state but no server-derived personal feed.                                |
| `/sign-in`                                                                                              | Remains public and consumes only a validated internal `returnTo`.                                                                                                    |

Authentication-disabled preview mode remains a distinct development/demo mode: the existing clearly labelled browser-local preview routes and interactions continue to work without server identity and never claim protected database access. Once Auth/database mode is configured, an Auth outage, missing identity or authorization failure must show its explicit signed-out/forbidden/unavailable state and must never fall back to Anna fixtures or browser-local data as authoritative state.

The page guard renders existing preview content only for the exact `preview` mode, renders protected content only for `authorized`, sends `signed-out` to `/sign-in` with a safe `returnTo`, sends `forbidden` to the sign-in identity explanation without retry loops, and renders a retryable service error for `unavailable`. Successful sign-in follows `returnTo` only after enrollment and actor revalidation reach `authorized`; a Supabase session by itself is insufficient.

#### Return destinations, caching and invalidation

`returnTo` accepts at most 2,048 characters and only one root-relative application path beginning with exactly one `/`. Parse it against the configured site origin, preserve its path/query/fragment, and require the resulting origin to match. Reject protocol-relative values, absolute URLs, backslashes, control characters, credentials, `/api`, `/_next`, `/sign-in` and malformed encodings; fall back to `/`. Sign-in returns to the safe page but never replays a form submission, request body or intended mutation. The user must reselect or reconfirm the action after current eligibility is checked.

Protected pages, route handlers and fetches are request-time only and never use shared `use cache`, static output, public cache headers or cross-user tags. Authenticated responses use `private, no-store`. Public catalogue caching remains a separate later contract and may not include personalized overlays.

Sign-out, session expiry, subject change, inactive dataset participation, revoked binding or failed actor revalidation clears in-memory current-actor state and all server-derived personalized responses before a public view renders. Phantom disconnect or wallet mismatch clears only live wallet/company authority and wallet-dependent cached data: the verified Supabase session and durable Anna binding remain, and non-wallet private access may continue after server revalidation. The existing `repx-club-preview-v1` local preview store is neither authenticated data nor authority; authentication transitions do not delete or migrate it, and it is never substituted for protected server data.

## Implementation plan

1. Add the forward-only validation predicate, exact grants/policies and Drizzle-aligned types from the locked matrix without changing DEV0039's migration or browser contract.
2. Add verified actor resolution and `withAuthorizedActor`, setting the exact five values transaction-locally and revalidating the complete actor tuple inside the transaction.
3. Add SQL/driver tests for own identity/dataset reads, missing or forged context, revoked/wrong-dataset denial and one-connection pool isolation after success, commit, rollback and thrown errors.
4. Add `GET /api/auth/actor`, the server-component/action guard and the locked route/action matrix while preserving direct anonymous public discovery and the explicit configuration-free preview mode.
5. Add safe-return parsing, same-origin mutation enforcement, current-actor invalidation and browser coverage for expiry, sign-out, disconnect, mismatch, cancellation and no automatic post-login mutation. Run the full relevant regression suite.

## Acceptance criteria

- [ ] AC1: Every protected identity/current-dataset operation derives the exact locked actor from a server-verified subject and live binding/profile/dataset participation records; absent, forged, expired, revoked or wrong-dataset contexts fail without returning private data.
- [ ] AC2: The five locked database settings exist only inside `withAuthorizedActor`'s transaction. Alternating users, success, commit, rollback and thrown errors through a one-connection pool never leak prior context.
- [ ] AC3: The first private grants/policies enforce the locked three-table read-only matrix under `app_runtime`; ordinary requests use neither owner/service-role shortcuts nor direct `wallet_bindings` access.
- [ ] AC4: Guests can directly open/reload the locked public routes. The locked private pages, draft views and protected actions require an authorized actor and use only validated internal return destinations.
- [ ] AC5: Sign-in completion never automatically executes a pending mutation. Sign-out, expiry, subject change, invalid participation/binding and wallet-state changes clear only the specified state; disconnect does not delete the session/binding or the separate preview store.
- [ ] AC6: Authenticated responses are request-time `private, no-store`; configured failures never fall back to fixtures, while explicit authentication-disabled preview mode remains functional and clearly non-authoritative.
- [ ] AC7: Migration/database tests, authorization unit/integration tests, boundary checks, lint, typecheck, formatting, build and desktop/mobile browser regressions pass with exact evidence recorded.

## Validation plan

Use local PostgreSQL/Supabase with Anna plus a second integration-test actor, an expired session, an inactive dataset, a revoked dataset participation record, a revoked binding and foreign-dataset resources. The second actor does not require a second real Phantom rehearsal; DEV0038 already proves the provider boundary. Alternate both actors through a one-connection database pool and force success, commit, rollback and thrown-error paths while inspecting current settings and visible rows.

Exercise configuration-free preview mode and configured anonymous direct navigation, private route redirects/entry states, public versus local-draft dynamic details, safe and unsafe return URLs, cross-origin mutation attempts, cancelled/failed login, session expiry, sign-out, wallet disconnect and wallet mismatch on desktop and mobile. Confirm no pending create/save/book/follow/Cheer/join/vote/claim/payment action runs automatically and that the preview store is not treated as authenticated data. Run clean migration/reset, SQL and Drizzle tests, existing unit/boundary checks, lint, typecheck, formatting, webpack build and affected Playwright suites.

## Implementation record

Implementation started on 2026-09-21 after the locked contract review. The code and automated validation are complete; the ticket remains in progress until the configured, authenticated Phantom browser rehearsal below is confirmed. This ticket was created when the unimplemented DEV0016 plan was converted to COR0002. It owns shared protected-access enforcement, not feature persistence.

### Changes and rationale

- Added a forward-only migration that removes direct runtime access to wallet bindings, grants only the three locked identity/dataset reads and makes every policy depend on a hardened live actor predicate. The predicate validates all five transaction settings against the claimed profile, active dataset participation and active personal binding without returning identity data.
- Added a server-only authorization service and Drizzle transaction wrapper. They distinguish configuration-free preview mode from complete database/Auth mode and fail closed on partial or invalid configuration. An authorized callback receives a transaction scoped to the exact verified actor; the base pooled client is not passed to protected repositories.
- Added the bounded `/api/auth/actor` projection, server page guard, exact protected route matrix and validated internal `returnTo` behavior. Public discovery routes remain available to configured guests, while private pages and local draft URLs redirect to sign-in or render an explicit unavailable state.
- Added browser actor state keyed to the verified Auth subject, wallet identity and token expiry. Sign-out, subject changes, expiry changes and failed actor refreshes hide private browser state immediately. Phantom disconnect or mismatch does not alter that durable session key. Browser-local preview data remains stored separately, is masked from unauthorized configured users and is still available in explicit configuration-free preview mode.
- Updated sign-in completion to refresh the actor after prepared enrollment and follow a safe return destination only after authorization succeeds. It never records or replays the action that originally led to sign-in.
- Added SQL, driver, unit, boundary and desktop/mobile browser coverage for privileges, policies, live revocation, pooled-connection isolation, response parsing, mode separation, redirect safety, private-state invalidation and configured guest behavior.

### Affected files

| File or component                                                                                                                                                                                                                                                                                                                                                                                                           | Change and purpose                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`supabase/migrations/20260921000200_protect_actor_context.sql`](../../../supabase/migrations/20260921000200_protect_actor_context.sql)                                                                                                                                                                                                                                                                                     | Adds the live actor predicate, validation-only owner policies, exact runtime read policies/grants and direct wallet-binding revocation.                                           |
| [`src/server/authorization/`](../../../src/server/authorization/) and [`src/server/db/authorization/repository.ts`](../../../src/server/db/authorization/repository.ts)                                                                                                                                                                                                                                                     | Define the internal actor, access-mode parsing, verified resolution, page guard and transaction-local database context.                                                           |
| [`src/auth/actor-contracts.ts`](../../../src/auth/actor-contracts.ts), [`src/auth/actor-state.ts`](../../../src/auth/actor-state.ts), [`src/auth/return-to.ts`](../../../src/auth/return-to.ts) and [`src/auth/client/`](../../../src/auth/client/)                                                                                                                                                                         | Define and validate the public projection, bind client state to one session generation, validate return targets and refresh the current actor without exposing UUIDs or wallets.  |
| [`src/app/api/auth/actor/route.ts`](../../../src/app/api/auth/actor/route.ts), [`src/app/layout.tsx`](../../../src/app/layout.tsx), protected pages under [`src/app/`](../../../src/app/) and [`src/features/auth/protected-access.tsx`](../../../src/features/auth/protected-access.tsx)                                                                                                                                   | Expose the no-store current-actor read, initialize session and actor consistently, enforce private page entry and render the retryable unavailable state.                         |
| [`src/features/auth/sign-in.tsx`](../../../src/features/auth/sign-in.tsx), `src/features/preview/store.ts` (historical path `src/features/preview/store.ts`), the later [challenge retirement record](../frontend/DEV0060-replace-challenge-surfaces-with-access-navigation.md) and `src/features/feed/feed.tsx` (historical path `src/features/feed/feed.tsx`)                                                             | Follow safe return targets after actor authorization, gate local demo mutations/private filters and mask local private state from unauthorized configured users.                  |
| [`supabase/tests/database/authorization.test.sql`](../../../supabase/tests/database/authorization.test.sql), [`tests/database/identity.test.ts`](../../../tests/database/identity.test.ts), [`tests/authorization.test.ts`](../../../tests/authorization.test.ts), [`tests/browser/authorization.spec.ts`](../../../tests/browser/authorization.spec.ts) and existing boundary/auth tests under [`tests/`](../../../tests/) | Prove the policy matrix, context cleanup, alternating actors, forged/revoked denial, exact browser contracts, safe redirects and desktop/mobile guest behavior in both app modes. |

### Decisions and deviations

No locked product or security contract changed during implementation. Two implementation details were tightened during review:

- The root layout now obtains the initial session and actor from one verified session result rather than issuing two independent Auth checks, so one browser can never receive an actor projection paired with a different refreshed subject.
- Unauthorized configured users retain the separate `repx-club-preview-v1` storage value, but its private contents are masked and protected interactions redirect to sign-in without mutation. Authorized users and explicit preview mode retain the existing visibly local demo interactions until their owning persistence tickets replace them.

### Contracts, configuration, and operations

The final contracts remain the exact `AuthorizedActor`, five transaction-local settings, live validation predicate, three-table read-only policy matrix, `/api/auth/actor` response boundary, route/action matrix, safe-return parser, mode separation and invalidation rules above. No environment variable or dependency was added. All five existing variables must be absent for preview or valid for database/Auth mode; partial configuration is unavailable.

The applied migration is `20260921000200_protect_actor_context.sql`. It is forward-only. A disposable local rollback/recovery uses `npm run db:reset` followed by `npm run db:runtime`; the second command is required because reset recreates the non-login runtime role and its local password must be provisioned again. A hosted correction requires a new migration.

## Validation results

Automated implementation validation and the configured authenticated browser rehearsal passed on 2026-09-21. After the UI compatibility correction, the user ran the prescribed flow and confirmed it worked: the prepared wallet reached the bounded authorized actor state, protected navigation succeeded, sign-out removed protected access, and disconnecting Phantom alone preserved the application session and non-wallet actor access.

- **Scope and ownership review — passed:** the ticket stops at shared authorization infrastructure and one current-actor read slice. DEV0017, DEV0018, DEV0023 and DEV0041 retain their feature repositories, mutations and narrower permission checks.
- **Existing-contract review — passed:** the locked actor derives from DEV0038's verified session and DEV0039's durable binding/current-identity result. It preserves wallet disconnect without sign-out and does not change either completed endpoint contract.
- **Framework review — passed:** reviewed the installed Next.js 16.3.5 documentation and current `src/proxy.ts`, server-component and route-handler boundaries. Proxy remains cookie refresh only; authorization and uncached personalized reads stay in the Node.js server boundary.
- **Specification and route review — passed:** public discovery, same-dataset profiles, private draft paths, no automatic post-login mutation and explicit preview/database separation agree with the MVP specification. The second review added exact handling for partial configuration and required actor authorization—not merely a Supabase session—before following `returnTo`.
- **Fresh migration — passed:** `npm run db:reset` applied all three migrations and seed data successfully. `npm run db:runtime` then reprovisioned the loopback-only runtime login as required after a reset.
- **SQL policies — passed:** `npm run db:test` passed 63 assertions across three files, including the exact read-only grants, missing/malformed context, own-row visibility, foreign-profile denial and immediate participation revocation. An initial test-harness attempt called pgTAP assertions while assuming `app_runtime`; results are now captured under that role and asserted only after resetting the role.
- **Schema lint — passed:** `npm run db:lint` reported no errors in `app`, `extensions` or `public`.
- **Driver integration — passed:** `npm run test:db` passed 9 tests. Two prepared actors alternated through the same one-connection Drizzle pool; the five settings were empty after successful commit, explicit rollback and a thrown callback; a forged binding and live membership revocation were denied. The first post-reset run correctly failed authentication until `npm run db:runtime` restored the disposable runtime password.
- **Unit and boundary suite — passed:** `npm test` passed 44 tests, including exact actor parsing, complete/partial/absent mode selection, encoded redirect rejection and subject/wallet/expiry-bound actor invalidation. The sandbox initially blocked the test runner's local IPC socket; the identical command passed outside that restriction.
- **Static checks — passed:** `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check` passed.
- **Configured production build — passed:** `npm run build -- --webpack` compiled with `.env.local`; every application route that consumes the authorization root was emitted as request-time dynamic output.
- **Configured guest browser checks — passed:** `npm run test:e2e -- tests/browser/authorization.spec.ts` passed 4 desktop/mobile tests. The exact public routes remained directly reachable; all locked private pages and UUID draft paths redirected to sign-in with the original safe path; save and My Drafts attempts changed no local state.
- **Configuration-free preview build/regression — passed:** building and running Playwright with all five access variables explicitly empty preserved preview mode. The full suite reported 40 passed and 4 configured-only checks skipped across desktop and mobile; draft, booking, follow, saved-item, keyboard, error and responsive behavior remained intact.
- **Authenticated browser rehearsal — passed:** the user confirmed the prescribed configured flow worked after the UI compatibility correction. `/api/auth/actor` reached the bounded authorized state after sign-in/enrollment, the protected page opened, sign-out removed protected access, and disconnecting Phantom alone preserved the session and non-wallet actor access. No second message or transaction signature was requested beyond normal sign-in.
- **Completion/archive integrity — passed:** DEV0040 moved to the backend archive, the root/index/specification/dependency links were updated, 42 unique work records have lifecycle-correct placement, and 685 repository-relative links resolve across 63 Markdown files.

| Criterion | Evidence                                                                                                                             | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | SQL live-validation/revocation assertions, driver forged-binding/revocation checks and current-actor projection                      | Passed |
| AC2       | One-connection alternating-actor driver test across commit, rollback and thrown-error reuse                                          | Passed |
| AC3       | SQL privilege/policy assertions, direct wallet denial and schema lint                                                                | Passed |
| AC4       | Configured desktop/mobile public-route, private-route, draft-path, return-target and no-mutation browser checks                      | Passed |
| AC5       | Unit invalidation coverage, existing DEV0038/DEV0039 wallet/session evidence and the combined configured authenticated rehearsal     | Passed |
| AC6       | Exact no-store API implementation, configured dynamic build, configured failure tests and full configuration-free preview regression | Passed |
| AC7       | All automated commands above and the configured authenticated browser rehearsal passed                                               | Passed |

## Risks, limitations, and follow-ups

PostgreSQL connection pooling makes session-level settings unsafe; use transaction-local settings and test cleanup under failures. Next.js caching defaults can expose personalized responses if misapplied, so explicitly opt protected reads out of shared caching and test browser isolation.

This ticket does not create repositories for every protected feature. DEV0017/DEV0018/DEV0023 must use the delivered context while owning their specific authorization and data tests.

No required DEV0040 work remains. DEV0017, DEV0018, DEV0023 and DEV0041 must reuse this boundary while adding their own feature-specific repositories and authorization checks. User-prioritized DEV0046 may revise the login and personal-wallet model, but it must preserve the delivered server-derived actor and transaction-local isolation guarantees.

## Completion and review references

- Completed: 2026-09-21 — implementation, automated validation and the configured authenticated browser rehearsal passed.
- Commits: `1a02f8c` (`[DEV0040] Lock protected access contracts`) and `643b5ff` (`[DEV0040] Enforce protected actor context`).
- Review: Implementation self-review and user acceptance rehearsal completed; no independent review.
- Deployment or release: None.
