# Ticket DEV0153: Separate client and coach navigation

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only M3 interface follow-up
- Coordination: None — independent development ticket
- Related records: [DEV0147 — Separate client onboarding and verified coach access](../backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md), [DEV0149 — Replace the user Coach tab with My sessions](DEV0149-replace-user-coach-tab-with-my-sessions.md), [DEV0150 — Hide My sessions from signed-out navigation](DEV0150-hide-my-sessions-from-signed-out-navigation.md)

## Objective and context

The shared navigation currently shows `My sessions` to every authorized account, including approved and fictional demo coaches such as Daniel Park. That destination represents sessions the account booked as a client, while a coach's own schedule, availability and clients live under `Coach workspace`; presenting the client destination as the only global account-specific item makes the coach interface misleading.

Adopt the user's corrected 2026-10-08 navigation decision: every authorized account retains `My sessions`, while accounts with current coach-workspace access additionally receive `Coach workspace`. Update the confirmed navigation behavior and actor descriptions in the [MVP specification](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions) without changing the underlying one-account identity model or database authority.

## Scope and non-goals

- In scope: add bounded coach-access state to the existing authorized actor snapshot; derive desktop and mobile navigation from that state; retain `My sessions` at `/sessions` for every authorized account; additionally show `Coach workspace` at `/coach` for demo, approved and suspended coaches; update focused contract/navigation tests and the product specification.
- Out of scope: splitting Supabase Auth populations, removing a coach's underlying client capability, blocking direct `/sessions` access, changing booking permissions or data, redesigning the coach workspace, or adding staff review UI.

## Expected behavior and edge cases

- Signed-out, preview, forbidden and unavailable shells show neither private destination.
- Authorized accounts with `not-applied`, `pending` or `rejected` coach access see `My sessions` and no `Coach workspace` navigation item.
- Authorized accounts with `approved`, `demo` or `suspended` coach access see both `My sessions` and `Coach workspace`. Suspended coaches retain the existing bounded workspace needed for permitted existing-session actions.
- Initial server rendering and client-side actor refresh use the same validated coach-access status, so navigation does not temporarily expose the wrong private destination after sign-in.
- Mobile navigation accommodates the additional coach item without horizontal overflow and retains keyboard/touch access to both private destinations.

## Assumptions, decisions, and dependencies

- Adopted user correction, 2026-10-08: coaches should retain `My sessions` because they may also book other coaches. `Coach workspace` is additive for coach-capable accounts rather than a replacement.
- `approved` and `demo` are active coach states. `suspended` also receives the workspace destination because the existing product contract preserves bounded access for resolving current sessions. Pending and rejected applicants remain on client navigation until approval.
- The existing actor projection already derives server-authoritative coach access in the same protected database transaction, so exposing only its bounded status in `ActorSnapshot` avoids a second layout query and keeps browser input non-authoritative.
- The installed Next.js Server/Client Component guidance supports deriving the server value in the root Server Component and passing its serializable snapshot through the existing client provider.

## Implementation plan

1. Extend the exact actor snapshot contract and server projection with a validated coach-access status.
2. Replace the shell's status-only navigation filter with a pure actor-aware mapping that always selects the client destination for authorized accounts and adds the coach destination for coach-capable states.
3. Update focused actor-contract and shell-navigation tests, then adjust browser assertions if necessary.
4. Reconcile the specification's confirmed decision, actor description, flows and acceptance matrix with the adopted navigation split.
5. Run focused tests, lint, type checks, production build and responsive browser coverage appropriate to the shared desktop/mobile shell.

## Acceptance criteria

- [x] AC1: An ordinary authorized account sees `My sessions` and no `Coach workspace` item in both desktop and mobile navigation.
- [x] AC2: A demo or approved coach sees both `My sessions` and `Coach workspace` linking to their bounded routes in desktop and mobile navigation; suspended coach navigation uses the same pair.
- [x] AC3: Unauthorized shell states expose neither private destination, and exact actor-payload validation rejects missing, unknown or extra coach-access fields.
- [x] AC4: The current specification records the role-aware navigation decision without claiming separate authentication populations or removing underlying client capability.

## Validation plan

Run focused actor-contract and navigation unit tests for every actor and coach-access state. Run the full unit suite, lint, type checking and production build because the serialized actor contract crosses server/client boundaries. Run desktop/mobile browser navigation checks with the local Auth-enabled database, including an ordinary account and fictional demo coach when the harness supports authenticated fixtures. If real browser state cannot be exercised without altering unrelated local data, record the limitation and retain the ticket in progress unless equivalent existing rehearsal evidence covers both widths and role states.

## Implementation record

The shared shell now derives its private navigation from the server-authoritative coach-access status already loaded for an authorized actor. Every authorized account receives `My sessions`; actors with `approved`, `demo` or `suspended` coach access additionally receive `Coach workspace`. Unauthorized shell states receive neither destination.

### Changes and rationale

- The actor snapshot previously omitted coach-access state, which meant the shared shell could not distinguish ordinary clients from coach-capable accounts. The exact actor contract and server projection now expose only the bounded coach-access status already derived by the authorization service.
- One pure navigation mapping feeds both desktop and mobile shells. It always adds `My sessions` for an authorized actor and adds `Coach workspace` only for the three states that retain workspace access.
- Route activation now matches `/coach` and its descendants without treating public `/coaches/...` discovery pages as coach-workspace routes.
- Auth and coach-availability rehearsals now assert the appropriate private destinations, links and keyboard focus behavior. Contract and navigation unit tests cover every supported shell state.
- The product specification now records the additive coach navigation behavior and explicitly preserves the one-account identity model and a coach's client capability.

### Affected files

| File or component                                                                                         | Change and purpose                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`src/auth/actor-contracts.ts`](../../../src/auth/actor-contracts.ts)                                     | Adds the required, exactly validated `coachAccessStatus` field to authorized actor snapshots.                        |
| [`src/server/authorization/service.ts`](../../../src/server/authorization/service.ts)                     | Projects the already-authoritative coach-access status into the actor snapshot.                                      |
| [`src/components/shell.tsx`](../../../src/components/shell.tsx)                                           | Derives shared desktop/mobile private navigation from the full actor and fixes exact coach-workspace route matching. |
| [`tests/authorization.test.ts`](../../../tests/authorization.test.ts)                                     | Covers accepted coach states and rejection of missing, invented or extra actor fields.                               |
| [`tests/shell-navigation.test.ts`](../../../tests/shell-navigation.test.ts)                               | Covers ordinary, coach-capable and unauthorized navigation plus route matching.                                      |
| [`scripts/rehearse-local-email-auth.mjs`](../../../scripts/rehearse-local-email-auth.mjs)                 | Verifies ordinary and signed-out navigation in the local Auth browser flow.                                          |
| [`scripts/rehearse-local-coach-availability.mjs`](../../../scripts/rehearse-local-coach-availability.mjs) | Verifies both coach destinations and keyboard focus at desktop and mobile widths.                                    |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md)                                                           | Records the confirmed additive navigation behavior in the product contract and acceptance matrix.                    |
| [`tickets/README.md`](../../README.md)                                                                    | Tracks this completed development record.                                                                            |

### Decisions and deviations

- The initial implementation followed the earlier request to replace `My sessions` for coaches. Before completion, the user clarified that coaches should keep the client destination because they may book sessions themselves. The ticket, specification, tests and implementation were updated before final validation so `Coach workspace` is additive.
- No database or authorization rule changed. The shell consumes existing capability state rather than inferring coach access from route data or adding another request.

### Contracts, configuration, and operations

- `ActorSnapshot` now requires `coachAccessStatus` for authorized actors and accepts only `not-applied`, `pending`, `approved`, `rejected`, `suspended` or `demo`. The server producer and browser validator changed together.
- No database schema, migration, dependency, environment variable, setup step or booking permission changed.
- A rollback must revert the actor field, shell mapping, specification and their tests together because older authorized payloads intentionally fail the new exact contract.

## Validation results

- Date and environment: 2026-10-08 on macOS with Node.js 24.21.0, npm 11.19.0, local Supabase/PostgreSQL/Auth/Mailpit and the Next.js application.
- `npx tsx --test tests/authorization.test.ts tests/shell-navigation.test.ts`: passed 8 tests.
- `npm run typecheck`: passed.
- `npm test`: passed 72 tests with 0 failures; the configured server suite completed successfully with 0 discovered tests.
- `npm run lint`: passed.
- `npm run build`: passed without runtime environment configuration, proving the production bundle remains configuration-safe.
- A configured production build followed by `npm run test:e2e`: passed all 28 desktop/mobile browser tests against bounded `localhost` configuration and an isolated visible-coach fixture.
- `npm run test:auth`: passed the local email-auth rehearsal, including ordinary-account and signed-out navigation assertions.
- A direct Daniel Park browser rehearsal at 1440 × 1040 and 393 × 852 observed an authorized `demo` coach with `My sessions` linking to `/sessions` and `Coach workspace` linking to `/coach`; both items were keyboard-focusable, the page had no horizontal overflow and no page errors occurred.
- `git diff --check`: passed before ticket finalization; repeated after final documentation formatting.
- Three disposable accounts created only for browser validation (Riley, Morgan and DEV0104 Coach) and their dependent fixtures were deleted with exact identifier guards. Local totals returned to 12 Auth users, 12 profiles, 4 coach applications and 5 visible coaches.
- Diagnostic failures resolved during implementation: the first type check exposed an overly broad test-only unauthorized union; an environment-free browser run correctly lacked database/Auth capability; a configured run using `127.0.0.1` violated the app's intentional literal-`localhost` boundary; and a temporary visible coach fixture changed a fixed discovery count. The final bounded configuration and isolated fixture passed.

| Criterion | Evidence                                                                                                                                            | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Focused state mapping, email-auth rehearsal and the 28-test desktop/mobile browser suite cover ordinary accounts.                                   | Passed |
| AC2       | Unit coverage includes `approved`, `demo` and `suspended`; the coach rehearsal and direct Daniel Park check prove both destinations at both widths. | Passed |
| AC3       | Actor-contract tests reject missing, unknown and extra fields; shell tests cover signed-out, preview, forbidden and unavailable states.             | Passed |
| AC4       | The confirmed decisions, actor model, definition of done and acceptance matrix in the MVP specification describe additive coach navigation.         | Passed |

## Risks, limitations, and follow-ups

Coach navigation has one more item than ordinary account navigation. Responsive validation must prove that the labels remain usable without overflow; a larger future information-architecture redesign is outside this focused change. No follow-up is currently required for the requested navigation outcome.

## Completion and review references

- Completed: 2026-10-08.
- Commit: Not created.
- Review: Self-reviewed against the ticket acceptance criteria; no independent review created.
- Deployment or release: Not deployed or released.
