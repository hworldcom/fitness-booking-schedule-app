# Ticket DEV0102: Clarify Auth service unavailability

- Status: Completed
- Created: 2026-10-03
- Last updated: 2026-10-03
- Milestone: Project maintenance / local authentication reliability
- Coordination: None — independent development ticket
- Related records: [DEV0046 — Email OTP registration and application profiles](DEV0046-email-otp-registration-and-application-profiles.md) and [DEV0055 — Hosted Supabase staging environment](../../current/backend/DEV0055-hosted-supabase-staging-environment.md)

## Objective and context

When the configured local Supabase Auth stack is stopped, the server and browser currently expose the generic provider exceptions `AuthRetryableFetchError: fetch failed` and `AuthRetryableFetchError: Failed to fetch`. The sign-in screen only says that verification failed, so a developer must reconstruct that `NEXT_PUBLIC_SUPABASE_URL` points to an unavailable local service.

Make this expected infrastructure failure explicit and recoverable without weakening the fail-closed authentication boundary described in the [architecture and delivery boundaries](../../../docs/mvp-spec.md#6-architecture-and-delivery-boundaries) and [definition of done](../../../docs/mvp-spec.md#11-definition-of-done).

## Scope and non-goals

- In scope: classify whether the configured Supabase URL is local; add one bounded fetch diagnostic used by browser, server-render and request-proxy Supabase clients; show a specific local recovery message and command on the sign-in page; return an unavailable HTTP status from the session route; add focused automated coverage.
- Out of scope: starting Supabase automatically, changing authentication/session authority, exposing provider response bodies or credentials, changing hosted infrastructure, redesigning the sign-in page, or changing the coach-first product contract.

## Expected behavior and edge cases

- A failed network request to a loopback Supabase URL reports that local Supabase Auth could not be reached and tells the developer to run `npm run auth:start` before retrying.
- The sign-in screen distinguishes an unconfigured Auth client from a configured but unreachable local Auth service.
- A hosted Supabase network failure uses bounded operational copy and does not expose the configured URL, keys, provider response body or underlying exception.
- Missing sessions and ordinary OTP rejection retain their existing behavior; no failed verification is promoted to a signed-in state.
- The session endpoint reports `503 Service Unavailable` for an unavailable verification result while preserving the existing bounded response body.

## Assumptions, decisions, and dependencies

- `localhost`, `127.0.0.0/8` and IPv6 loopback URLs are development-local endpoints. The recovery command is shown only for those hosts.
- A fetch wrapper is preferable to scattered catch-copy because `@supabase/ssr` creates clients in the browser, server render and request proxy. The wrapper changes only the message attached to transport failures and leaves HTTP/Auth errors to the installed Supabase SDK.
- The implementation uses the installed `@supabase/ssr` and Next.js versions. No dependency or environment-variable change is required.

## Implementation plan

1. Add pure Auth service diagnostic helpers and focused unit tests for local URL classification, bounded copy and transport-error wrapping.
2. Use the shared fetch wrapper in the browser, server and request-proxy Supabase clients.
3. Render environment-appropriate unavailable copy on the sign-in page and return HTTP 503 for an unavailable session snapshot.
4. Run focused tests, type checking, linting, formatting and the production build; record exact evidence and review the diff against this ticket.

## Acceptance criteria

- [x] AC1: A stopped local Supabase Auth stack produces an explicit message naming the unreachable local Auth service and the `npm run auth:start` recovery command in both server/browser diagnostics and the sign-in UI.
- [x] AC2: Hosted service failures use bounded copy without disclosing configured URLs, keys, raw provider bodies or exception details.
- [x] AC3: Authentication remains fail closed and `/api/auth/session` responds with HTTP 503 plus the bounded unavailable snapshot when verification is unavailable.
- [x] AC4: Focused tests and applicable repository quality checks pass.

## Validation plan

- Unit-test loopback recognition, local/hosted copy and the custom fetch wrapper with deterministic rejected/successful fetch doubles.
- Extend the session-contract coverage for the unavailable response status.
- With local Supabase stopped, load `/sign-in`, inspect visible copy and confirm that the server/browser diagnostic names the recovery command without leaking credentials.
- Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build`. Browser layout regression coverage is not required because the change reuses the existing alert component and changes only copy; a focused manual browser check covers the operational state.

## Implementation record

Completed one bounded diagnostic path for every Supabase Auth client and the sign-in interface.

### Changes and rationale

Added a shared transport wrapper that turns otherwise generic Supabase fetch failures into environment-appropriate diagnostics. Loopback endpoints name the local Auth service, its safe origin and `npm run auth:start`; hosted endpoints receive bounded operational copy without their configured URL or low-level exception. Aborted requests retain their original `AbortError` so navigation cancellation is not mislabeled as an outage.

The browser client, request proxy and server-render client all use the wrapper. The browser client keeps the application's existing module-level singleton rather than reusing an opaque `@supabase/ssr` package singleton, ensuring the wrapper remains attached after development hot reloads. OTP actions and the unavailable sign-in state now show the actionable local recovery path. The session route returns HTTP 503 for the existing `{ "status": "unavailable" }` contract instead of returning that failure with HTTP 200.

### Affected files

| File or component                                                                                                                           | Change and purpose                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/auth/service-availability.ts`](../../../src/auth/service-availability.ts)                                                             | Classifies loopback Auth URLs, supplies bounded local/hosted UI copy and wraps fetch transport failures without leaking the underlying exception.        |
| [`src/auth/client/browser-client.ts`](../../../src/auth/client/browser-client.ts)                                                           | Attaches the diagnostic fetch to the browser Supabase client and makes the application-owned module cache the only singleton.                            |
| [`src/server/auth/client.ts`](../../../src/server/auth/client.ts) and [`src/server/auth/proxy.ts`](../../../src/server/auth/proxy.ts)       | Attach the same diagnostic to server-render and request-proxy Auth calls.                                                                                |
| [`src/auth/email-otp.ts`](../../../src/auth/email-otp.ts) and [`src/features/auth/sign-in.tsx`](../../../src/features/auth/sign-in.tsx)     | Present the local start command for OTP transport failures and configured-but-unreachable Auth state while keeping hosted copy bounded.                  |
| [`src/app/api/auth/session/route.ts`](../../../src/app/api/auth/session/route.ts)                                                           | Returns HTTP 503 for an unavailable verified-session snapshot.                                                                                           |
| [`tests/auth.test.ts`](../../../tests/auth.test.ts) and [`tests/supabase-auth-config.test.ts`](../../../tests/supabase-auth-config.test.ts) | Cover loopback classification, bounded hosted diagnostics, transport wrapping, abort preservation, local OTP copy and the session-route status contract. |
| [`tickets/README.md`](../../README.md) and this record                                                                                      | Track DEV0102, its lifecycle and durable validation evidence.                                                                                            |

### Decisions and deviations

- 2026-10-03: Kept this bounded local diagnostic separate from future Cloudflare CPU profiling and authentication-runtime optimization.
- 2026-10-03: Preserved `AbortError` unchanged because a superseded navigation is not proof that the Auth service is down.
- 2026-10-03: Disabled the SDK package-level browser singleton while retaining the module-level client cache, so hot reload cannot silently return a previously created client without the diagnostic fetch.

### Contracts, configuration, and operations

No new environment variables, dependencies, database changes, credentials or migrations were added. The existing local recovery command remains `npm run auth:start`. The only response-contract change is that `/api/auth/session` now pairs its existing unavailable snapshot with HTTP 503 instead of HTTP 200; signed-out, disabled and signed-in snapshots remain HTTP 200.

## Validation results

Validation passed.

- Date and environment: 2026-10-03, local macOS workspace with the Next.js development server on `localhost:3100` and no listener on the configured local Supabase port `55321`.
- `npm test`: passed 43/43 tests, including local/hosted diagnostic copy, rejected-fetch wrapping, low-level-detail redaction and `AbortError` preservation.
- `npm run typecheck`: passed after Next.js route type generation.
- `npm run lint`: passed with no ESLint errors.
- `npm run format:check`: passed after formatting the changed test.
- `npm run build`: passed with Next.js 16.3.5; all 11 listed application/API routes and the request proxy built successfully.
- Browser probe in installed Chrome through Playwright: requesting a code while Auth was stopped displayed `Local Supabase Auth is unreachable. Run npm run auth:start from the project directory, wait for it to report ready, then try again.`
- Browser probe with a deterministic invalid local test session: `/sign-in` visibly rendered `Local Supabase Auth is unreachable.`, the configured loopback origin, the recovery command, retry and local-session clearing controls. The only browser network diagnostic was the expected connection refusal/503; no key, provider body or underlying test exception was displayed.
- HTTP probe with the same non-sensitive invalid test session: `GET /api/auth/session` returned `503 Service Unavailable`, `cache-control: private, no-store` and `{ "status": "unavailable" }`.
- Initial validation detours: one expired-token probe exceeded 30 seconds in the Supabase SDK's refresh retry path, and the first browser locator also matched Next.js's route-announcer alert. The successful probes used a non-expired invalid token and a scoped `.auth-notice[role=alert]` locator; no product behavior was changed to make the test pass.

| Criterion | Evidence                                                                                                                 | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Shared fetch diagnostics plus both stopped-stack browser probes showed the local service, origin and recovery command.   | Passed |
| AC2       | Unit assertions reject hosted URL and underlying exception leakage; hosted UI copy contains neither.                     | Passed |
| AC3       | The invalid-session HTTP probe returned 503 with only the bounded unavailable snapshot; no signed-in state was inferred. | Passed |
| AC4       | 43 unit/static tests, typecheck, lint, format check and production build passed.                                         | Passed |

## Risks, limitations, and follow-ups

The diagnostic can identify a transport failure to a configured loopback service, but it cannot prove whether Docker, Supabase CLI, a firewall or another local networking issue is the underlying cause. The recovery copy therefore says the service could not be reached and offers the normal start command rather than asserting that one specific process failed.

The installed Supabase SDK may retry an expired stored session before returning the bounded unavailable result, so a stale expired cookie can delay the explicit message. This ticket improves diagnosis but does not alter SDK retry policy; that performance concern belongs to future authentication-runtime profiling if it remains observable.

## Completion and review references

- Completed: 2026-10-03. All acceptance criteria passed and the Auth transport failure now has actionable local diagnostics plus bounded hosted behavior.
- Commit: This commit — `[DEV0102] Clarify Auth service unavailability`.
- Review: Self-review completed against the scoped diff and acceptance criteria; no independent review or pull request.
- Deployment or release: Not deployed; validation is local only.
