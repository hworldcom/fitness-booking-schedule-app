# Ticket DEV0380: Distinguish private and group sessions

- Status: In progress
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: Group-training interface maintenance
- Coordination: None — independent development ticket
- Related records: [DEV0240 — Group discovery and joining](../../archive/frontend/DEV0240-add-group-event-discovery-and-joining.md) (historical baseline)

## Objective and context

The owner reported that My sessions does not clearly distinguish private and group classes. `/sessions` opens private requests/bookings and hides group history behind a text link; `/sessions/groups` uses a different heading and low-emphasis navigation. Make both choices prominent and consistent. Contract: [authenticated presentation](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions), [group surfaces](../../../docs/mvp-spec.md#156-surfaces-and-ownership), and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix).

## Scope and non-goals

- In scope: Shared responsive Private sessions / Group sessions navigation, active state and explanations; consistent My sessions heading; retain navigation during preview, unavailable and invalid-page recovery; specification and existing rehearsal assertion updates; focused component checks and UAT release/visual validation.
- Out of scope: Booking, registration, privacy, permissions, pagination or lifecycle changes; combined timelines/counts; database or retained demo data changes; unrelated working-tree edits.

## Expected behavior and edge cases

Both routes show ordinary links for Private sessions (one-to-one coaching) and Group sessions (train with a group), with exactly one current-page indicator. Private requests and confirmed-training anchor links remain secondary. Empty lists still expose the other session type. Recovery states retain the selector without implying a successful reservation or exposing private data. Separate routes preserve browser history and keyboard navigation. The group reservation/confirmation explanation remains visible.

## Assumptions, decisions, and dependencies

Adopt two persistent navigation cards rather than mixing records with different lifecycles. Use existing routes and icons with text labels; no invented counts. Installed Next.js 16.3.8 Link and error-file documentation was inspected; its error boundary receives `retry` (not the older `reset` API). No new package or data dependency. One bounded presentation slice needs no coordination record.

## Implementation plan

1. Add shared navigation with semantic links, active-page state, visible descriptions, responsive layout and focus styling.
2. Integrate on both session routes and recovery output, retaining data/action wiring and private section anchors; scope existing anchor CSS to avoid styling the new selector as the old pill links.
3. Update the presentation contract and existing group rehearsal assertion; add focused server-rendered navigation tests.
4. Run focused/full unit and server suites, clean-source lint/type checks, formatting and hosted build. Commit only this ticket's changes, deploy an exact-source Preview build to UAT in Frankfurt, then validate desktop/mobile navigation, keyboard and empty views.
5. Record evidence and limitations, archive the completed ticket and commit its release record.

## Acceptance criteria

- [ ] AC1: Both views prominently expose the same two choices with accurate route links, descriptions and exactly one accessible current-page state.
- [ ] AC2: Private requests/confirmed sections and group seat/history actions remain separate; preview and recovery preserve navigation and truthful status copy.
- [ ] AC3: Desktop and mobile UAT show readable choices and working two-way navigation, with keyboard access and browser-history behavior.
- [ ] AC4: Relevant tests, lint, types and hosted build pass; an exact-source UAT release is verified and unrelated edits/data are preserved.

## Validation plan

Render both selected states and verify semantic navigation, links and current-page ownership. Run `npx tsx --test tests/my-sessions-navigation.test.ts`, `npm test`, scoped Prettier, and `npm run lint` / `npm run typecheck` in a clean source export excluding existing ignored scratch files. Verify Vercel build metadata, region and alias, then read-only native Chrome desktop and 375×568 mobile checks. Do not run database fixture rehearsals: no persistence changes and the existing rehearsal writes isolated fixtures. Review route diffs to prove unchanged data/actions. Validate relative documentation links and preserve baseline dirty files.

## Implementation record

Implemented locally; UAT release and native responsive checks remain outstanding.

### Changes and rationale

Replaced the hidden group-history text link and inconsistent route headings with a shared My sessions heading and two persistent navigation cards. Private sessions explains one-to-one coaching; Group sessions explains group training. The active card uses a dark background, check icon and `aria-current="page"`. Ordinary links preserve keyboard access and history. Preview, unavailable, invalid cursor and group error output retain the selector. Private requests/confirmed anchors remain secondary; data reads, action props, pagination and registration confirmation copy are preserved.

### Affected files

- [Shared heading/navigation](../../../src/features/profile/my-sessions-navigation.tsx): canonical route labels, descriptions and selected state.
- [Navigation CSS](../../../src/app/my-sessions-navigation.css) and [root layout](../../../src/app/layout.tsx): responsive two-column cards, focus indicator and stylesheet loading; [private workspace CSS](../../../src/app/client-sessions-workspace.css) scopes old section anchors independently.
- [Private page](../../../src/app/sessions/page.tsx), [group page](../../../src/app/sessions/groups/page.tsx) and [group error boundary](../../../src/app/sessions/groups/error.tsx): integrate the selector in normal and recovery output without changing services/actions.
- [Component tests](../../../tests/my-sessions-navigation.test.ts): both route mappings, only one active link, semantic navigation and lifecycle descriptions.
- [Existing group rehearsal](../../../scripts/rehearse-local-group-discovery.ts): replace its obsolete text-link assertion.
- [Specification](../../../docs/mvp-spec.md#156-surfaces-and-ownership) and [index](../../README.md): current presentation contract and delivery tracking.

### Decisions and deviations

None.

### Contracts, configuration, and operations

Presentation only; no schema, dependency, environment or permission changes. Release targets the dedicated UAT Preview project; rollback re-aliases its preceding ready deployment.

## Validation results

2026-10-19, local Node 24 / Next.js 16.3.8:

- `npx tsx --test tests/my-sessions-navigation.test.ts`: 4 passed.
- `npm test`: 350 unit tests and 64 server tests passed (414 total).
- `npm run lint` and `npm run typecheck`: passed in a clean tracked-source export with only DEV0380 source/test overlays. This excludes pre-existing ignored scratch files and unrelated working-tree edits.
- Scoped `npx prettier --write` completed; final check pending.
- Reviewed route diff: authorization checks, redirects, actor scope, service calls, booking/registration action props and cursor pagination unchanged. Group error forwards installed Next.js `retry` unchanged.
- Hosted build and native desktop/mobile validation pending. Database/fixture browser rehearsals not run: no persistence or lifecycle implementation changed, and live read-only checks will preserve existing account data.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

No known blocker. Populated booking/registration lifecycle behavior will be protected by unchanged service/action wiring and the existing unit/server suites; live checks use the signed-in account's existing data without provisioning or editing it.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Self-review pending; no independent review requested.
- Deployment or release: Pending.
