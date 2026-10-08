# Ticket DEV0160: Expose the mobile scheduling API

- Status: Draft
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Native iOS backend boundary
- Coordination: [COR0013 — Native iOS application](../organisatory/COR0013-native-ios-application.md)
- Related records: depends on [DEV0159 — Adopt the native iOS contract](../organisatory/DEV0159-adopt-native-ios-contract.md); supplies [DEV0162 — Deliver native client scheduling](../frontend/DEV0162-deliver-native-client-scheduling.md), [DEV0163 — Deliver the native coach schedule](../frontend/DEV0163-deliver-native-coach-schedule.md) and [DEV0164 — Deliver the native coach profile](../frontend/DEV0164-deliver-native-coach-profile.md); hosted validation depends on [DEV0055 — Hosted Supabase staging environment](DEV0055-hosted-supabase-staging-environment.md)

## Objective and context

Expose a versioned JSON boundary that a native client can use without invoking Next.js Server Actions or relying on browser cookies and same-origin form submissions. Verify Supabase bearer sessions server-side, derive the same application actor context used by the website and call the existing coach/booking services so business rules remain authoritative in one place.

The mobile API is an adapter over existing services, not a second implementation of scheduling. It must preserve atomic capacity-one booking, self-booking denial, owner-scoped reads, application/coach authority and bounded error messages.

## Scope and non-goals

- In scope: shared request/response schemas and API versioning; bearer-token session verification; public coach/profile/open-time reads; current actor/application reads; client booking, retry, session-history and cancellation endpoints; the authenticated transport/service primitives needed by the coach tickets; cache, error and rate/size bounds; tests and API documentation.
- Out of scope: native screens, direct device access to server database credentials, duplicating domain rules in route handlers, coach schedule/profile endpoints owned by DEV0163/DEV0164, account deletion owned by DEV0165, push notifications, offline mutation queues, GraphQL, or replacing the website's Server Actions.

## Expected behavior and edge cases

- Public discovery endpoints reveal only the same approved/demo coach, location and open-time projection available on the website.
- Authenticated endpoints accept a valid Supabase access token, verify it against the configured project and derive application identity transaction-locally; caller-supplied profile or actor IDs never establish authority.
- Missing, expired, malformed or wrong-project tokens return bounded `401`/`403` results without database/Auth internals.
- Repeating the same booking for the same client/occurrence returns the existing booking; a competing client receives a stable conflict and no partial state.
- Session reads return only the signed-in client's records. Cancellation retains the current actor, future-time and lifecycle checks.
- Mobile requests do not need to fake the website origin. Browser-cookie endpoints retain their same-origin protection independently.
- Every mutation is idempotent where the domain contract already promises idempotency; transport retries never create duplicate bookings.

## Assumptions, decisions, and dependencies

- DEV0159 must define the supported mobile/auth contract before this ticket becomes Ready.
- Proposed endpoint namespace: `/api/mobile/v1`. The exact route grouping may change before implementation if Next.js 16.3.8 bundled documentation indicates a safer convention.
- Use the existing Supabase publishable project configuration on the device; database credentials and service-role keys remain server-only.
- Bearer tokens avoid cookie cross-site request forgery assumptions, but token verification, response caching, request-size bounds and log redaction remain mandatory.
- Reuse framework-independent domain validation and server services. Extract shared serializable contracts only when they remain free of `server-only`, Next.js and React Native runtime imports.

## Implementation plan

1. Inspect installed Next.js 16.3.8 route-handler documentation and the installed Supabase SDK's server token-verification APIs.
2. Define versioned, exact-key JSON contracts and a transport-neutral verified-session/actor adapter.
3. Add public discovery/detail/open-time reads and authenticated actor/application/session reads.
4. Add book and cancel mutations over the existing booking service with stable status/error mapping and no-store/private caching.
5. Add contract, authorization, retry, conflict, cross-account, malformed-input and unavailable-service tests.
6. Document the base URL/public configuration required by the native app without recording credentials.

The scope is one backend boundary for public/client scheduling. Coach-specific mutations stay with their vertical interface tickets to keep this record reviewable.

## Acceptance criteria

- [ ] AC1: A valid mobile bearer session maps to the same application actor and permissions as the website without accepting caller-supplied authority.
- [ ] AC2: Public discovery and authenticated session responses expose only bounded fields and never private client or infrastructure data.
- [ ] AC3: Booking, retry, conflict and cancellation through the JSON API preserve existing atomic database outcomes.
- [ ] AC4: Missing/invalid/expired tokens, malformed bodies, cross-account IDs and unavailable dependencies fail with stable status codes and no partial mutation.
- [ ] AC5: Existing browser routes/actions and relevant unit, database, authorization, lint, type and production-build checks continue to pass.

## Validation plan

Add focused contract and server tests plus authenticated integration tests against local Supabase Auth/PostgreSQL. Exercise anonymous discovery, valid/expired/wrong-user tokens, same-client retry, two-client race, self-booking, cross-run identifiers and cancellation. Run relevant `npm test`, `npm run test:db`, `npm run db:test`, `npm run test:auth`, lint, typecheck and build commands. Record any hosted check separately; local success is not hosted deployment.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                  | Change and purpose                                                 |
| ---------------------------------- | ------------------------------------------------------------------ |
| Mobile API routes/contracts        | Planned versioned JSON boundary.                                   |
| Server auth/authorization adapters | Planned bearer verification and actor derivation.                  |
| Existing coach/booking services    | Reused; changes limited to transport-neutral seams where required. |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Expected new contract: a versioned HTTPS API using the existing public Supabase project configuration and bearer access tokens. No new database credential may enter the native bundle. Exact environment names and compatibility notes must be recorded during implementation.

## Validation results

Pending validation.

| Criterion | Evidence                                  | Result  |
| --------- | ----------------------------------------- | ------- |
| AC1       | Auth/actor integration tests              | Not run |
| AC2       | Projection and exact-key tests            | Not run |
| AC3       | Booking/cancellation database integration | Not run |
| AC4       | Negative authorization/transport tests    | Not run |
| AC5       | Existing suites and production build      | Not run |

## Risks, limitations, and follow-ups

Mobile API stability becomes a compatibility contract once a TestFlight build exists. Breaking response changes then require versioning or a coordinated minimum-app-version policy. Hosted rate limiting and observability may need a separate ticket if the first implementation cannot validate them without external infrastructure.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed.
