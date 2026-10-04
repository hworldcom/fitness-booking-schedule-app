# Ticket DEV0124: Present the coach-pass and group-funded story

- Status: Ready
- Created: 2026-10-04
- Last updated: 2026-10-05
- Milestone: Marketplace M0 truthful public story
- Coordination: [COR0010 — Coach-pass and group-funded marketplace MVP](../organisatory/COR0010-group-funded-coach-marketplace-mvp.md)
- Related records: replaces the copy delivered historically by [DEV0095](../../archive/frontend/DEV0095-present-coach-first-public-story.md); follows the revised contract in [DEV0126](../../archive/organisatory/DEV0126-adopt-coach-pass-and-group-funding-contract.md), the completed EURC compatibility contract in [DEV0134](../../archive/blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md), the two-loop consolidation in [DEV0135](../../archive/organisatory/DEV0135-narrow-marketplace-mvp-to-two-loops.md) and the [current MVP specification](../../../docs/mvp-spec.md)

## Objective and context

Rewrite Home, How it works, calls to action and public navigation so visitors understand coach-specific one/ten-credit calendar booking as the first feature and conditional group-event funding as the second.

## Scope and non-goals

- In scope: concise client/coach value proposition; one/ten-credit purchase and cancellation-policy explanation; threshold-funded event story; Devnet/test-EURC disclosure; truthful early-access calls to action; responsive visual hierarchy and accessibility.
- Out of scope: client-authored training requests, coach proposals, any third acquisition workflow, marketplace/event runtime, invented metrics/partners, real-money claims, detailed disputes, rebranding or broad visual-system replacement.

## Expected behavior and edge cases

The page leads with finding a coach, buying a small pass and booking from the calendar. It then explains how a coach publishes a group event and participants can collectively make it viable or receive refunds from a failed pool. It does not introduce training requests/proposals or another marketplace loop and avoids “automatic” execution, guaranteed service or production escrow claims. Unimplemented actions use honest preview/coming-soon states.

## Assumptions, decisions, and dependencies

Copy must follow `docs/mvp-spec.md`; completed historical screenshots/copy do not override it. Preserve accessible navigation and the existing coach discovery entry point. Supporting profiles, locations and social content may provide context but must not compete with the two retained product loops.

## Implementation plan

1. Audit all public copy/navigation for private-pass language.
2. Redesign Home/How it works around coach passes/calendar booking first and group funding second.
3. Connect only implemented routes and label unfinished actions.
4. Add/update responsive browser/content tests and verify accessibility/static builds.

## Acceptance criteria

- [ ] AC1: Public pages accurately explain clients, coaches, one/ten-credit booking and threshold-funded events in plain language.
- [ ] AC2: No current public surface presents pass purchase/booking or group funding as already implemented when it is not.
- [ ] AC3: Calls to action, responsive layout, keyboard navigation and unavailable/coming-soon states work at mobile and desktop widths.
- [ ] AC4: Content/browser, lint, typecheck and build checks pass.

## Validation plan

Run targeted copy search, component/browser snapshots or semantic assertions, keyboard/mobile/desktop manual checks, lint, typecheck, formatting and both builds.

## Implementation record

Not started.

### Changes and rationale

Pending implementation.

### Affected files

Planned: Home/How it works/navigation feature components, styles and focused tests.

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

No schema, program or secret changes.

## Validation results

Not run — no implementation.

## Risks, limitations, and follow-ups

Public copy can outrun implementation; keep early-access wording until the hosted rehearsal completes.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only.
- Deployment or release: None.
