# Ticket DEV0124: Present the coach-pass and group-funded story

- Status: In progress
- Created: 2026-10-04
- Last updated: 2026-10-07
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

- [x] AC1: Public pages accurately explain clients, coaches, one/ten-credit booking and threshold-funded events in plain language.
- [x] AC2: No current public surface presents pass purchase/booking or group funding as already implemented when it is not.
- [x] AC3: Calls to action, responsive layout, keyboard navigation and unavailable/coming-soon states work at mobile and desktop widths.
- [x] AC4: Content/browser, lint, typecheck and build checks pass.

## Validation plan

Run targeted copy search, component/browser snapshots or semantic assertions, keyboard/mobile/desktop manual checks, lint, typecheck, formatting and both builds.

## Implementation record

Implementation started after confirming that the active DEV0121 work changes only the shared Solana program, IDL/generated client, group-event helper/tests and its own ticket record. DEV0124 is isolated to public story/navigation components, styles and browser assertions; the ticket index is the only shared coordination file and receives only the required status update.

### Changes and rationale

- Rebuilt Home around the two retained product loops: coach discovery followed by one/ten-credit private booking first, then one-seat conditional group-event funding. The story states the early/late cancellation branches, successful-pool payout and failed-pool pull-refund outcome without implying automatic deadline execution.
- Reworked How it works into separate private-booking and group-funding sequences, plus explicit place, credit and pool boundaries. The page distinguishes the available discovery/schedule foundation from transaction flows that remain previews.
- Updated shared navigation, the About dialog, metadata and the coming-soon page so all public entry points use the same two-feature story, test-EURC disclosure and platform-paid-SOL boundary.
- Added focused browser assertions for content order, honest unavailable states, stable links, keyboard focus/submission, native invalid-email handling and horizontal-overflow protection at desktop and mobile sizes.
- Updated the existing auth and wallet browser journeys to assert the new Home heading, preserving cross-feature return-to-public-browsing coverage after the story rewrite.

### Affected files

| File                                                                                      | Role                                                                                                                  |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [`src/features/public/coach-story.tsx`](../../../src/features/public/coach-story.tsx)     | Defines the two-loop Home and How it works narratives, preview boundaries, cancellation outcomes and calls to action. |
| [`src/app/coach-story.css`](../../../src/app/coach-story.css)                             | Adds responsive group-funding previews, outcome cards and mobile/desktop layout rules.                                |
| [`src/app/page.tsx`](../../../src/app/page.tsx)                                           | Aligns Home metadata with private coaching and group-funded training.                                                 |
| [`src/app/how-it-works/page.tsx`](../../../src/app/how-it-works/page.tsx)                 | Aligns How it works metadata with both marketplace loops and platform-paid Solana costs.                              |
| [`src/components/shell.tsx`](../../../src/components/shell.tsx)                           | Updates navigation framing, demo-status disclosure and the About dialog without exposing unfinished actions as live.  |
| [`src/features/waitlist/coming-soon.tsx`](../../../src/features/waitlist/coming-soon.tsx) | Presents private booking and group funding as the two early-access paths while retaining the existing email handoff.  |
| [`tests/browser/public-story.spec.ts`](../../../tests/browser/public-story.spec.ts)       | Verifies two-loop ordering, precise claims, preview routes, focus behavior and responsive overflow.                   |
| [`tests/browser/waitlist.spec.ts`](../../../tests/browser/waitlist.spec.ts)               | Verifies the revised waitlist story plus keyboard and invalid-email behavior.                                         |
| [`tests/browser/auth.spec.ts`](../../../tests/browser/auth.spec.ts)                       | Keeps the cross-feature sign-in return-to-Home assertion aligned with the revised primary heading.                    |
| [`tests/browser/wallet.spec.ts`](../../../tests/browser/wallet.spec.ts)                   | Keeps the wallet-guidance return-to-Home assertion aligned with the revised primary heading.                          |
| [`tickets/README.md`](../../README.md)                                                    | Tracks DEV0124 as active implementation work.                                                                         |

### Decisions and deviations

- `/explore` remains the only marketplace feature linked as available. Pass purchase, booking and group funding route to existing explanatory or coming-soon destinations; this ticket deliberately creates no placeholder transaction route.
- Discovery and published schedules are described as available, while all value movement and booking actions are labelled preview work. This is more precise than presenting the whole marketplace as either live or unavailable.
- Home keeps the established visual system and coach imagery instead of introducing a broad rebrand. New cards and step sequences extend the existing responsive styles.
- DEV0121 ran concurrently without a code overlap: its Solana program, generated client and group-event tests were not changed by DEV0124. The ticket index and COR0010 are the only shared planning surfaces and receive narrow DEV0124 updates.

### Contracts, configuration, and operations

No data shape, API, database schema, Solana program, environment variable, secret, dependency, migration or operator setup changed. Public metadata and copy now identify test EURC rather than a generic or former asset, and clarify that MovX pays SOL fees/rent while users retain purchase, booking, cancellation, payout and refund authority. Existing route contracts remain unchanged.

## Validation results

| Check                                                                                                | Result                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`                                                                                  | Passed.                                                                                                                                                                                                                                                |
| `npm run lint`                                                                                       | Passed.                                                                                                                                                                                                                                                |
| `npm run format:check`                                                                               | Passed.                                                                                                                                                                                                                                                |
| `npm test`                                                                                           | Passed: 86 tests, including the concurrent DEV0121 group-event client coverage.                                                                                                                                                                        |
| `npm run build`                                                                                      | Passed with all 13 static pages generated under Next.js 16.3.8.                                                                                                                                                                                        |
| Historical `npm run build:vinext`                                                                    | Passed before DEV0139 retired the Cloudflare adapter path; future checks use standard Next.js/Vercel builds.                                                                                                                                           |
| `npx --no-install playwright test tests/browser/public-story.spec.ts tests/browser/waitlist.spec.ts` | Passed: 8 tests across desktop and mobile projects. The first run exposed two test-selector assumptions (multiple Explore links and the intentionally hidden mobile demo strip); the selectors were corrected and the complete targeted run passed.    |
| `npm run test:e2e` coverage audit                                                                    | Passed: 30 tests across desktop and mobile. The first audit run found 26 passing and 4 failing cases because the auth and wallet journeys still asserted DEV0124's replaced Home heading; those assertions were updated and the complete rerun passed. |
| Targeted copy search                                                                                 | Passed: current public story surfaces contain no training-request, coach-proposal, completed-class or legacy membership story.                                                                                                                         |
| Screenshot review                                                                                    | Passed at 1440 × 1040 and 393 × 852 for Home and How it works: the two-loop hierarchy remained readable with no horizontal overflow.                                                                                                                   |

## Risks, limitations, and follow-ups

DEV0122, DEV0123, DEV0129 and DEV0130 still own the actual transaction and application interfaces, so the public calls to action must remain in preview state. COR0010 requires a final terminology and state comparison once DEV0123 presents the group-event interface; that integration check remains before DEV0124 is archived. The hosted rehearsal in DEV0125, not this local UI validation, proves deployed behavior.

## Completion and review references

- Completed: Not completed — implementation and current validation pass, but the planned final copy comparison with DEV0123 remains.
- Commit: Initial implementation and validation are in `4549483` (`[DEV0124] Present coach-pass and group-funded story`); the full-suite correction is committed under `[DEV0124] Align cross-feature browser coverage`.
- Review: Implementation self-review complete; independent review not performed.
- Deployment or release: None.
