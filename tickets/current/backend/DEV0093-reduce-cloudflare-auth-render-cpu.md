# Ticket DEV0093: Reduce Cloudflare authentication and render CPU

- Status: Draft
- Created: 2026-09-30
- Last updated: 2026-10-03
- Milestone: Staging runtime reliability
- Coordination: None — independent development ticket
- Related records: staging runtime baseline in [DEV0054 — Cloudflare Workers runtime foundation](../../archive/backend/DEV0054-cloudflare-workers-runtime-foundation.md), hosted release work in [DEV0056 — Staging release and domain rehearsal](DEV0056-staging-release-and-domain-rehearsal.md), and current marketplace delivery in [COR0010 — Group-funded coach marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)

## Objective and context

Reduce avoidable Cloudflare Worker CPU use in authenticated server rendering and browser hydration without weakening session verification, actor isolation or fail-closed behavior.

During a legacy staging rehearsal, Cloudflare returned Error 1102 (`Worker exceeded resource limits`) after an authenticated mutation. A live trace of deployed version `818861bf-f738-4fae-9f68-445a30ad35b8` later measured 214 ms CPU for `GET /membership/setup` and 159 ms CPU for `GET /my-access`; the same retries returned HTTP 200 because Cloudflare permits occasional bursts above a configured CPU limit. Hydration then issued separate session, actor, organization-wallet, personal-wallet and product requests, with individual authenticated API invocations consuming 19–87 ms CPU. Those routes are no longer current, so the ticket must rebaseline coach-first authenticated routes before selecting an optimization.

Read-only code review found repeated work rather than one isolated expensive computation. A server render can verify the same Supabase session and resolve the same application identity in the root layout, protected-page guard and multiple feature services. The My Membership page also loads membership state directly and again through its class-schedule service. After hydration, the session and actor providers immediately refetch state already supplied by server rendering. This makes the staging application sensitive to strict Worker CPU limits and increases database/Auth traffic even when requests happen to succeed.

This ticket is an operational optimization, not a change to the product contract. The measurements above remain useful incident evidence, but DEV0101 removed the measured membership routes and club/membership hydration graph. Before implementation, this ticket must rebaseline the current coach-first authenticated shell and replace the membership-specific plan and acceptance criteria. It therefore returned to Draft on 2026-10-03.

## Scope and non-goals

- In scope: request-scoped reuse of verified session and application-identity reads; removal of duplicate membership loading from the My Membership server render; suppression of initial browser session/actor refetches when the server-supplied state still matches the current browser session; focused tests for cache isolation, auth-state changes and feature results; local production-build validation; staging CPU traces and repeated hard-reload evidence.
- Out of scope: changing Cloudflare account plans or billing; increasing a Worker CPU limit; cross-request or cross-user caching; trusting browser identity; weakening or removing the existing `getClaims`/`getUser` session checks; changing row-level security or actor-scoped database transactions; combining every authenticated API into one endpoint; database migrations; membership/payment/check-in behavior changes; Solana RPC or transaction changes.

## Expected behavior and edge cases

Each incoming HTTP request must still establish its own authenticated server boundary. Within one server-render request, repeated callers may reuse the same immutable verified-session result and the same identity projection, but no result may survive into a different request, user, cookie state or mutation.

The My Membership page should authorize once at its page/service boundary and reuse the resulting session/actor context while loading the active membership, class schedule and check-in snapshot. Class-schedule construction should consume the already loaded active membership rather than independently loading membership state again. Existing preview, signed-out, forbidden, unavailable and no-active-membership results must remain distinguishable and fail closed.

The browser may use the session and actor supplied by server rendering on initial hydration when they correspond to the current session. It must still refresh after a real sign-in, sign-out, token refresh, user update or account/session-key change. Development Strict Mode, repeated provider effects and a duplicate initial `SIGNED_IN` notification must not create parallel refresh storms. A failed refresh continues to produce the existing unavailable state rather than preserving stale authority.

API requests remain separate Worker invocations and therefore authenticate independently. This ticket may remove calls that are provably redundant on initial hydration, but it must not share authentication state between unrelated requests or assume that a successful page render authorizes a later mutation.

The staging trace is a baseline and diagnostic, not a promise that code optimization can make a server-rendered Next.js application fit every Cloudflare Free-plan CPU budget. If the optimized flow still exceeds the account's configured limit, record that evidence and the remaining operational choice explicitly rather than weakening security to meet a timing target.

## Assumptions, decisions, and dependencies

- The captured Error 1102 is treated as a Worker resource-limit incident. The observed 159–214 ms page CPU and repeated 19–87 ms authenticated API CPU make CPU exhaustion the leading cause; no evidence currently points to Solana settlement failure, PostgreSQL corruption or loss of the active membership.
- Reuse must be request scoped. A module-global promise, process cache, time-based cache or user-keyed shared cache is prohibited because a Worker isolate serves multiple users and requests.
- Preserve the current authoritative session checks and database actor context. Performance work should first remove duplicate invocations and duplicated reads rather than reduce verification strength.
- The implementation must inspect the installed React 19.3, Next.js 16.3 and vinext 1.0 beta behavior before selecting a request-memoization primitive. If framework request memoization cannot be shown to remain request scoped in the deployed runtime, pass the verified context explicitly through a bounded aggregate service instead.
- Staging measurements require the user's existing authenticated browser session and Cloudflare tail access. They must not log cookies, private RPC endpoints, provider credentials, database credentials or wallet key material.
- A Workers Paid plan would provide substantially more CPU headroom, but changing the plan is an external operational decision and does not replace this ticket's removal of demonstrably redundant work.

## Implementation plan

1. Add focused instrumentation/tests around the session, identity and My Membership call graph so one render's duplicate work and cross-request isolation can be asserted without logging sensitive values.
2. Introduce a proven request-scoped verified-session/identity read boundary, or an explicit per-render authorized context if framework memoization cannot be verified. Keep mutation and API-request boundaries independent.
3. Refactor the My Membership read path to load membership state once and pass the active period into class-schedule construction while preserving actor-scoped database access and every existing result state.
4. Update the client session and actor providers so initial server state is not immediately refetched when the browser reports the same session, while real auth/session transitions still refresh or clear state.
5. Run focused unit/browser tests, the full static checks and the Cloudflare/vinext production build. Rehearse signed-in setup and My Membership locally at desktop/mobile widths.
6. Deploy only after the code and ticket record are committed, then compare Cloudflare CPU traces with the 214 ms setup and 159 ms My Membership baselines. Perform repeated hard reloads and record any `exceededCpu`, `exceededMemory` or Error 1102 outcome separately from normal HTTP failures.

## Acceptance criteria

- [ ] AC1: One authenticated server-render request verifies a given session and resolves its application identity at most once, while two different requests or session keys never reuse authority.
- [ ] AC2: My Membership loads membership state once and produces the same active/pending/empty, reservation and check-in presentation without a nested membership reload from the class-schedule service.
- [ ] AC3: Initial hydration with matching server-supplied session/actor state does not call `/api/auth/session` or `/api/auth/actor`; genuine sign-in, sign-out, token-refresh, user-update and session-key changes still refresh or clear authority correctly.
- [ ] AC4: Preview, signed-out, forbidden, unavailable, no-active-membership and database/Auth failure paths remain fail closed, and mutation/API requests continue to authenticate independently.
- [ ] AC5: Unit, browser, lint, type, formatting and Cloudflare production-build checks pass for the affected boundaries with no membership, reservation, check-in or wallet-payment behavior regression.
- [ ] AC6: A post-deployment authenticated staging trace records setup and My Membership CPU against the 214 ms/159 ms baselines, and repeated hard reloads record whether Error 1102 remains. The result must distinguish completed code optimization from any remaining account-plan limit.

## Validation plan

Add deterministic tests that count underlying session/identity reads within one request context and prove fresh results across distinct contexts. Cover provider hydration and real auth-state transitions without making live Supabase calls. Extend membership service/page tests so class schedule consumes an existing active period and all current access states remain unchanged.

Run the focused tests first, followed by `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check` and `npm run build:vinext`. Run the relevant membership/authorization Playwright cases at desktop and mobile widths. A local Worker can validate behavior but cannot prove hosted CPU enforcement, so final performance evidence requires `wrangler tail` around the signed-in staging setup/My Membership hard-reload flow.

No database migration or Solana transaction is expected. The staging rehearsal is read-only and must not prepare, sign, send or retry a membership payment.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose                                                        |
| ----------------- | ------------------------------------------------------------------------- |
| Pending           | Record concrete implementation locations after the approach is validated. |

### Decisions and deviations

- 2026-09-30: Keep the performance fix independent rather than adding it as a direct COR0004 or coach-product deliverable. It supports the hosted runtime but changes neither coordination record's product outcome.
- 2026-10-03: DEV0101 removed the profiled membership pages and their duplicate loaders. Preserve the Error 1102 trace as a baseline, but do not implement the stale My Membership refactor; first profile the remaining coach-first/auth routes and revise this ticket.

### Contracts, configuration, and operations

No contract, schema, dependency or environment-variable change is planned. Cloudflare plan or CPU-limit changes remain explicitly outside this ticket.

## Validation results

Pending validation.

- Date and environment: 2026-09-30, current Cloudflare staging deployment, diagnostic baseline only.
- Exact commands and outcomes: `wrangler tail` recorded successful authenticated retries at 214 ms CPU for `/membership/setup` and 159 ms CPU for `/my-access`; follow-up authenticated APIs used 19–87 ms CPU. This establishes the baseline and does not validate a fix.
- Manual steps and observed outcomes: the existing signed-in Chrome session hard-reloaded setup and navigated to My Membership. Both later returned HTTP 200, demonstrating Cloudflare's variable over-limit tolerance rather than resolving the earlier Error 1102.
- Failed, blocked, or not-run checks and reasons: implementation validation has not run because this ticket currently records only the reviewed plan.

| Criterion | Evidence                                | Result                                       |
| --------- | --------------------------------------- | -------------------------------------------- |
| AC1–AC5   | Implementation and automated validation | Not run                                      |
| AC6       | Captured pre-change Cloudflare trace    | Baseline recorded; post-change trace not run |

## Risks, limitations, and follow-ups

Request-scoped memoization is security-sensitive: accidental isolate-global reuse could cross user boundaries, while overly broad invalidation could leave stale authority after an auth transition. Tests must prove isolation before deployment.

Even a correct optimization may not make authenticated Next.js server rendering reliable under a strict 10 ms Worker CPU limit. If post-change traces remain above the configured account limit, the remaining choice is operational—for example, a Workers Paid plan or a separately scoped architectural move away from authenticated server rendering—and must not be hidden as an application-code success.

## Completion and review references

- Completed: Not completed — implementation and post-change validation have not started.
- Commit: This commit — `[DEV0093][DEV0094][DEV0095][DEV0101][DEV0103] Adopt coach-first pivot` (DEV0093 planning/rebaseline only; implementation remains Draft).
- Review: Scope reviewed against the captured staging trace, current auth/membership call graph and ticket-splitting rules; no split is required before implementation.
- Deployment or release: Not deployed; this record contains only planning and the pre-change diagnostic baseline.
