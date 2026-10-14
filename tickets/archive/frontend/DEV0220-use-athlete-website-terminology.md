# Ticket DEV0220: Use athlete terminology on the website

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Athlete terminology and coach–athlete connections
- Coordination: [COR0020 — Athlete terminology and coach–athlete connections](../../current/organisatory/COR0020-athlete-terminology-and-connections.md)
- Related records: contract dependency [DEV0219 — Adopt athlete terminology and connection contract](../../archive/organisatory/DEV0219-adopt-athlete-connections-contract.md); validation dependency [DEV0229](DEV0229-correct-browser-rehearsal-assumptions.md); persistence peer [DEV0221](../../current/backend/DEV0221-persist-coach-athlete-connections.md); interface peers [DEV0222](../../current/frontend/DEV0222-add-coach-my-athletes.md) and [DEV0223](../../current/frontend/DEV0223-add-athlete-my-coaches.md)

## Objective and context

Replace participant-facing client/user labels with athlete vocabulary throughout the existing website. Athlete is the existing training-participant capability; the same account may coach and train. Implement against the [current vocabulary contract](../../../docs/mvp-spec.md#48-participate-as-an-athlete); implementation began on 2026-10-14 after the user requested starting this ticket.

## Scope and non-goals

- In scope: public explanatory copy, onboarding, account labels, booking/request messages, coach-facing identity labels, accessible names, empty/error states, relevant browser assertions and README navigation wording.
- Out of scope: database/TypeScript identifier renames, framework `use client` directives, Auth IDs, URL/API/query compatibility changes, new athlete profile fields, connections and native runtime.

## Expected behavior and edge cases

- Athlete account and Athlete and coach account labels preserve actual capability state, including applicant and suspended-coach variants.
- A coach's My sessions explains participation as an athlete; Bookings describes athletes the coach teaches.
- Ordinary account-management language may still say account; technical references to browser clients retain their meaning.
- Existing request-until-start, approval-only, cancellation/completion and avatar privacy behavior stays authoritative.

## Assumptions, decisions, and dependencies

- DEV0219 is Completed and establishes the approved vocabulary contract.
- Existing internal `client` identifiers and sign-in `intent=client` remain compatible; they map to athlete in presentation.
- Inspect installed Next.js version and relevant bundled guides before changing route/component integration.
- Historical ticket headings/filenames remain unchanged.

## Implementation plan

1. Inventory visible and assistive copy across public and private routes, including server-action error messages; distinguish participant nouns from browser clients, API fields, URLs, test identities and generic account wording.
2. Replace participant terms without changing technical identifiers or actor logic; correct any touched outdated confirmed-booking copy to match the existing approval contract.
3. Update relevant existing assertions and README prose, then review public routes and representative signed-in athlete/coach/applicant/suspended states at desktop/mobile widths, with keyboard use and existing Auth/request rehearsals.
4. Record exact files, validation and limitations.

## Acceptance criteria

- [x] AC1: Participant-facing website copy consistently uses athlete, including public story, onboarding, Profiles, request/booking states and accessible labels.
- [x] AC2: Coach-as-athlete behavior and all existing capabilities, URLs, identifiers, image permissions and scheduling actions remain compatible.
- [x] AC3: Desktop/mobile and keyboard review plus relevant existing tests, lint, type-check, formatting and build pass.

## Validation plan

Search remaining visible client/user strings and inspect each in context. Use relevant existing unit/browser assertions; do not add tests that merely repeat static copy. Review public routes and signed-in representative role states at mobile and desktop widths with keyboard use. Run `npm test`, relevant existing browser checks, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check`. Database migrations are not applicable.

## Implementation record

Implementation started on 2026-10-14 after confirming a clean main checkout, installed Next.js 16.3.8, supported Node.js 24.21.0/npm 11.19.0 and the relevant bundled Next.js component/page guides. Read-only inventory identified participant labels, coach request/booking descriptions and outdated direct-reservation copy; technical client identifiers remain out of scope.

### Changes and rationale

- Replaced training-participant client wording with athlete across public explanations, sign-in onboarding, account/shell role labels, coach profile visibility, Schedule, request decisions/history, Bookings and the coach-as-athlete My sessions context. Ordinary account-management language still says account.
- Account Profile now shows Athlete account, Athlete and coach account and accurate pending/rejected/suspended variants. The shell shows Coach and athlete for approved/demo accounts without changing any capability branch.
- Corrected touched direct-reservation wording: requests remain pending, and a booking appears after coach acceptance. The preview dialog requests a private hour, and Bookings' empty state explains accepting an athlete's request.
- Updated existing role/queue/navigation assertions and the profile-image rehearsal's expected account labels. Corrected the existing sign-in browser test's superseded home-heading expectation; application home copy did not change.
- Updated README participant prose while keeping command names, reserved test emails, TypeScript/database identifiers, API/URL/query values and CSS hooks compatible. No new static-copy tests were added.

### Affected files

| File or component                                                                                                                                                                                                                                                                             | Change and purpose                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [src/components/shell.tsx](../../../src/components/shell.tsx)                                                                                                                                                                                                                                 | Athlete role summaries and truthful request wording in the preview dialog.                  |
| [src/features/profile/profile.tsx](../../../src/features/profile/profile.tsx)                                                                                                                                                                                                                 | Account capability labels and coach-entry explanation.                                      |
| [src/features/auth/sign-in.tsx](../../../src/features/auth/sign-in.tsx) and [coach-application-gate.tsx](../../../src/features/coaches/coach-application-gate.tsx)                                                                                                                            | Athlete onboarding copy; application and coach-authority behavior unchanged.                |
| [src/app/sessions/page.tsx](../../../src/app/sessions/page.tsx)                                                                                                                                                                                                                               | Explicit coach-as-athlete participation context.                                            |
| [coach-booking-request-queue.tsx](../../../src/features/coaches/coach-booking-request-queue.tsx), [queue model](../../../src/features/coaches/coach-booking-request-queue-model.ts) and [coach-client-cards.tsx](../../../src/features/coaches/coach-client-cards.tsx)                        | Athlete request/withdrawal/booking descriptions and coach-acceptance empty state.           |
| [coach-availability-panel.tsx](../../../src/features/coaches/coach-availability-panel.tsx) and [coach-profile-editor.tsx](../../../src/features/coaches/coach-profile-editor.tsx)                                                                                                             | Athlete-facing availability/profile visibility explanations.                                |
| [coach-story.tsx](../../../src/features/public/coach-story.tsx) and [coming-soon.tsx](../../../src/features/waitlist/coming-soon.tsx)                                                                                                                                                         | Public athlete vocabulary and confirmed-session lifecycle explanation.                      |
| [profile navigation tests](../../../tests/profile-navigation.test.ts), [shell navigation tests](../../../tests/shell-navigation.test.ts), [queue tests](../../../tests/coach-booking-request-queue.test.ts) and [profile-image rehearsal](../../../scripts/rehearse-local-profile-images.mjs) | Update existing capability/lifecycle assertions to the new labels.                          |
| [auth browser test](../../../tests/browser/auth.spec.ts)                                                                                                                                                                                                                                      | Preserve the sign-in-to-browsing check using the current home heading.                      |
| [README](../../../README.md), [specification](../../../docs/mvp-spec.md), [COR0020](../../current/organisatory/COR0020-athlete-terminology-and-connections.md) and [ticket index](../../README.md)                                                                                            | Accurate participant language, delivered terminology status and lifecycle/navigation links. |

### Decisions and deviations

- 2026-10-14: The independent browser-maintenance record was corrected to DEV0229 after an accidental duplicate DEV0226 allocation conflicted with concurrent Home planning. Those Home records and other workspace edits were preserved; no ticket number was reused for a commit.

- 2026-10-14: The configured full browser run identified three unrelated expectation errors (five failing tests across projects); DEV0229 separately owns their correction so the terminology implementation retains its scope.

- 2026-10-14: Preserve generic account wording and every technical `client` identifier, route, directive, CSS hook and test identity. Source AST comparison confirmed only presentation text changed in the twelve affected source files.
- 2026-10-14 validation adjustment before rerun: the default production browser run lacked the `dev:local` environment injection, leaving fixture-dependent discovery unavailable, and its sign-in return assertion expected a superseded home heading. Correct that existing relevant assertion and rerun using the existing loopback configuration/parser helpers through a temporary driver, without changing application configuration or persisting environment values.

### Contracts, configuration, and operations

Presentation terminology changes only. No schema migration, dependency, environment variable or URL/API change is planned.

## Validation results

- Environment: Node.js 24.21.0, npm 11.19.0, Next.js 16.3.8 and the existing loopback Supabase/Auth/Mailpit stack. Inspected the bundled `05-server-and-client-components.md` and `03-layouts-and-pages.md` guides before source edits. The user's dev server remained running on port 3100.
- `npm test`: passed 124 domain/component/boundary tests plus 9 server tests (133 total), including all account-capability variants and request/booking authorization/labels.
- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check`: passed. The production build passed both ordinary preview and internally injected local-runtime configurations.
- `node /tmp/movx-dev0220-string-scan.cjs`: no old participant copy remains in source strings/JSX; remaining matches are existing CSS class hooks and the technical database-login user diagnostic.
- `node /tmp/movx-dev0220-compatibility.cjs`: twelve source files preserve TypeScript AST structure, identifiers, imports/directives, literal types and technical values; only presentation text changed.
- `npm run test:auth`: passed real local ordinary-athlete and pending-coach onboarding, returning login, invalid/replayed-code recovery, account separation, keyboard/mobile overflow and sign-out checks.
- `npm run test:coach-requests`: passed the real 24-candidate pagination, accept/decline/closure, retained history, confirmed-booking continuity and desktop/mobile keyboard rehearsal; its exact test identities/records were cleaned by the existing script.
- `node /tmp/movx-dev0220-review.cjs`: readonly sign-in/profile/session/Bookings review passed for the existing Hoang athlete and Daniel demo-coach accounts at 1440 and 393 pixel widths. Open My sessions worked through keyboard focus/Enter; coach-as-athlete text and role labels were present, with no horizontal overflow. Inspected desktop/mobile screenshots; no profile/media edit or scheduling mutation control was submitted during this readonly review.
- Initial `npm run test:e2e` attempt: 26 passed, 18 failed, 8 skipped because fixture-dependent tests ran without the local environment and the auth landing assertion was stale. The configured rerun passed 41, failed 5, skipped 6; DEV0229 separately owns the revealed data/view/guest expectation fixes. A subsequent run passed 43, failed 1, skipped 8 after exposing a second fixed filter-count assumption. These failed checks are retained as investigation evidence, not reported as passes.
- `node_modules/.bin/tsx /tmp/movx-dev0220-local-browser-suite.ts --skip-build`: final configured desktop/mobile suite: 44 passed, 8 project-specific skips, 0 failed. Temporary driver `/tmp/movx-dev0220-local-browser-suite.ts` captures local CLI status internally, uses the existing parser/environment factory, omits owner/service-role settings from child processes and runs the existing npm build/browser commands without writing an env file or printing private values.
- Screenshots from readonly review are retained in ignored `test-results/dev0220-review/` (athlete/coach Account Profile and coach Bookings at both widths); reviewed images show the updated labels and usable layouts.
- `python3 /tmp/movx-dev0220-check-docs.py` passed nine affected Markdown files, 286 local links/anchors, 170 unique/indexed records, current/archive statuses and reciprocal ownership after moving DEV0220/DEV0229. Markdown formatting and `git diff --check` passed; concurrent Home planning and other workspace edits were preserved.
- Database migration tests and hosted rehearsal are not applicable: no schema, authority, dependency, environment contract or hosted behavior changed. Profile-image mutation rehearsal was not rerun because media behavior is unchanged; its label assertions are maintained for later runs.

| Criterion | Evidence                                                                                                                                   | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Source/JSX inventory and real athlete/coach screenshots show consistent participant vocabulary.                                            | Passed |
| AC2       | Twelve-file AST/technical-value comparison, all capability variants and real Auth/request rehearsals preserve authority and compatibility. | Passed |
| AC3       | 133 application tests, 44 browser passes/8 project skips, local keyboard/mobile/Auth/request reviews and lint/type/format/build checks.    | Passed |

## Risks, limitations, and follow-ups

Internal client identifiers, sign-in intent values, API avatar routes, CSS hooks, command names and reserved test emails deliberately remain compatible. Connections and session notes remain separate runtime work. DEV0229 owns the independent browser expectation fixes required for final validation. Required validation is complete. This delivery is local; connection persistence/interfaces and session collaboration remain separate planned work.

## Completion and review references

- Completed: 2026-10-14 — acceptance criteria and required local validation passed.
- Commit: `[DEV0220][DEV0229] Use athlete terminology and align browser checks` — includes both completed records and their validation evidence; independent Home planning and other workspace edits are excluded.
- Review: No independent review created.
- Deployment or release: Not deployed or released.
