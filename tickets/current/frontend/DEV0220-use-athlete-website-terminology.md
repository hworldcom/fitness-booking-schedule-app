# Ticket DEV0220: Use athlete terminology on the website

- Status: Draft
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Athlete terminology and coach–athlete connections
- Coordination: [COR0020 — Athlete terminology and coach–athlete connections](../organisatory/COR0020-athlete-terminology-and-connections.md)
- Related records: contract dependency [DEV0219 — Adopt athlete terminology and connection contract](../../archive/organisatory/DEV0219-adopt-athlete-connections-contract.md); persistence peer [DEV0221](../backend/DEV0221-persist-coach-athlete-connections.md); interface peers [DEV0222](DEV0222-add-coach-my-athletes.md) and [DEV0223](DEV0223-add-athlete-my-coaches.md)

## Objective and context

Replace participant-facing client/user labels with athlete vocabulary throughout the existing website. Athlete is the existing training-participant capability; the same account may coach and train. Implement against the [current specification](../../../docs/mvp-spec.md#49-connect-after-a-confirmed-session); this ticket is a plan, not evidence of delivered behavior.

## Scope and non-goals

- In scope: public explanatory copy, onboarding, account labels, booking/request messages, coach-facing identity labels, accessible names, empty/error states, relevant browser assertions and README navigation wording.
- Out of scope: database/TypeScript identifier renames, framework `use client` directives, Auth IDs, URL/API/query compatibility changes, new athlete profile fields, connections and native runtime.

## Expected behavior and edge cases

- Athlete account and Athlete and coach account labels preserve actual capability state, including applicant and suspended-coach variants.
- A coach's My sessions explains participation as an athlete; Bookings describes athletes the coach teaches.
- Ordinary account-management language may still say account; technical references to browser clients retain their meaning.
- Existing request-until-start, approval-only, cancellation/completion and avatar privacy behavior stays authoritative.

## Assumptions, decisions, and dependencies

- DEV0219 must establish the vocabulary contract before implementation.
- Existing internal `client` identifiers and sign-in `intent=client` remain compatible; they map to athlete in presentation.
- Inspect installed Next.js version and relevant bundled guides before changing route/component integration.
- Historical ticket headings/filenames remain unchanged.

## Implementation plan

1. Inventory visible and assistive copy across public and private routes, including server-action error messages.
2. Replace participant terms without changing technical identifiers or actor logic; correct any touched outdated confirmed-booking copy to match the existing approval contract.
3. Update relevant existing assertions and navigation prose, then review guest, athlete, coach, applicant and suspended states.
4. Record exact files, validation and limitations.

## Acceptance criteria

- [ ] AC1: Participant-facing website copy consistently uses athlete, including public story, onboarding, Profiles, request/booking states and accessible labels.
- [ ] AC2: Coach-as-athlete behavior and all existing capabilities, URLs, identifiers, image permissions and scheduling actions remain compatible.
- [ ] AC3: Desktop/mobile and keyboard review plus relevant existing tests, lint, type-check, formatting and build pass.

## Validation plan

Search remaining visible client/user strings and inspect each in context. Use relevant existing unit/browser assertions; do not add tests that merely repeat static copy. Review public routes and signed-in representative role states at mobile and desktop widths with keyboard use. Run `npm test`, relevant existing browser checks, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check`. Database migrations are not applicable.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose                                                             |
| ----------------- | ------------------------------------------------------------------------------ |
| Pending           | Record actual repository-relative files and their roles during implementation. |

### Decisions and deviations

None yet; record adopted choices before material implementation changes.

### Contracts, configuration, and operations

Presentation terminology changes only. No schema migration, dependency, environment variable or URL/API change is planned.

## Validation results

Pending validation; all runtime checks are not run.

| Criterion | Evidence               | Result  |
| --------- | ---------------------- | ------- |
| AC1       | Pending implementation | Not run |
| AC2       | Pending implementation | Not run |
| AC3       | Pending implementation | Not run |

## Risks, limitations, and follow-ups

Avoid global identifier replacement: browser client modules are technical concepts. Connections and session notes remain separate runtime tickets. Next action: complete the copy inventory after DEV0219.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No independent review created.
- Deployment or release: Not deployed or released.
