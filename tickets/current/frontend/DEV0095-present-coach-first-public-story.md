# Ticket DEV0095: Present the coach-first public story

- Status: In progress
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first M0 truthful positioning
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on [DEV0094](../../archive/organisatory/DEV0094-adopt-coach-first-training-package-mvp.md); replaces the current public multi-gym story delivered by archived DEV0073/DEV0076 without rewriting their history

## Objective and context

Make the public application explain one current product: discover independent martial-arts coaches, see capacity-one availability for the coming week, book a private class, buy or use a one-session/ten-session pass, retain the credit after cancellation and follow the coach. DEV0101 already removed the old gym/membership routes and installed a truthful early-access home; this ticket turns that safe transitional state into the complete public coach-first story.

## Scope and non-goals

- In scope: build Home and How it works from the coach-first early-access baseline; update navigation/route names and metadata; introduce coach, private-class, slot and pass terminology; show the complete choose-slot, use-or-buy-pass, cancel-with-credit-retained and completed-session loop with honest Devnet/test-money labels; preserve accessible responsive design and intentional not-found behavior for retired routes.
- Out of scope: persistent coach/availability/booking data, working offer creation/purchase/redemption, social persistence, destructive database cleanup, new branding, production payment claims or implementing the coach discovery and booking capabilities owned by backend/blockchain peers.

## Expected behavior and edge cases

A guest understands the coach-first product without seeing contradictory claims about four gyms, Basic/Classic, included gym check-ins, membership pools, gym allocation or wallet membership cards. The story makes clear that a client chooses a coach's open private slot, uses or purchases a one-session/ten-session pass, keeps an unused credit after cancellation and consumes one session only after a completed class. Calls to action lead only to delivered coach discovery/booking routes or clearly labelled preview states. Pages must not imply that a real coach partnership, live availability, real USDC payment or production entitlement exists.

Legacy links should fail safely or redirect to an appropriate coach-first route; they must not expose a half-functional multi-gym purchase flow. Existing signed-in identity and wallet controls remain intact.

## Assumptions, decisions, and dependencies

DEV0094 must first make the coach-first specification authoritative. Use **coach** in public copy. The first niche is independent martial-arts instruction, but page structure should not hard-code one discipline. Reuse the existing design system rather than redesigning the brand.

## Implementation plan

1. Inventory the transitional early-access home, navigation, metadata and shared styles left by DEV0101.
2. Start with a focused hero-copy slice that states the martial-arts coach marketplace value directly while the page remains explicitly labelled as coming soon.
3. Implement the remaining coach-first private-class booking loop, cancellation/credit explanation, client/coach benefits and Devnet explanation.
4. Connect only delivered coach discovery/availability/booking or clearly labelled preview/coming-soon calls to action while preserving auth/profile behavior.
5. Update focused unit/browser coverage for desktop, mobile, keyboard and truthful unavailable states.

## Acceptance criteria

- [ ] AC1: Home and How it works describe only the coach discovery/weekly-slot/one-session-or-ten-session-pass/booking/completed-session/social loop and clearly label Devnet test USDC.
- [ ] AC2: Current navigation and calls to action contain no active four-gym, Basic/Classic, pool-allocation, non-core-visit or wallet-membership-card product path.
- [ ] AC3: Legacy links resolve safely, and authenticated account/wallet controls remain usable.
- [ ] AC4: Representative mobile/desktop and keyboard checks pass with no fabricated availability or misleading partnership/production-payment claim.

## Validation plan

Search current frontend sources for superseded product terms, review each retained technical identifier, run focused UI tests, `npm test`, lint, typecheck and production build, then manually inspect Home/How it works at mobile and desktop widths with keyboard navigation.

## Implementation record

Implementation started with the requested hero-copy slice. This ticket owns public positioning and route cleanup only; its broader Home, How it works and navigation work remains open.

### Changes and rationale

- Rewrote the early-access hero headline as “Find the right martial arts coach for you.” and the supporting description around discovering independent coaches, disciplines, availability and goal-oriented private training. The previous “getting ready to move” language described launch status but did not communicate the marketplace value.

### Affected files

- `src/features/waitlist/coming-soon.tsx`: early-access hero copy.
- `tests/browser/waitlist.spec.ts`: focused assertions for the public headline and supporting description within the existing waitlist flow.
- Planned later: Home, How it works, shared shell/navigation, route adapters, styles and broader browser/unit tests.

### Decisions and deviations

The copy uses the specification's public term **coach** rather than trainer. It leads with the marketplace outcome and describes private training by goals and schedule; the surrounding `COMING SOON` and product-preview labels continue to distinguish the target experience from delivered functionality.

### Contracts, configuration, and operations

This slice changes presentation copy only. It introduces no schema, interface, route, dependency, environment-variable, secret, migration, rollback or compatibility change. Route compatibility decisions for the remaining ticket scope must be recorded during implementation.

## Validation results

- Passed — `npx prettier --check src/features/waitlist/coming-soon.tsx tests/browser/waitlist.spec.ts tickets/current/frontend/DEV0095-present-coach-first-public-story.md tickets/current/organisatory/COR0009-coach-first-training-package-mvp.md tickets/README.md` reported all five changed records/sources formatted.
- Passed — `npx eslint src/features/waitlist/coming-soon.tsx tests/browser/waitlist.spec.ts` completed without findings; `git diff --check` also passed.
- Passed — `npm run build` compiled Next.js 16.3.5, completed TypeScript checking and generated all routes successfully.
- Passed — `npx playwright test tests/browser/waitlist.spec.ts` after the production build: 2/2 tests passed across the 1440 × 1040 desktop and 393 × 852 mobile projects. The flow covers the new headline/description, keyboard submission, waitlist handoff, preview disclosure and horizontal-overflow check.
- Passed — visual review of the Playwright screenshots confirmed that the new headline and description remain legible without clipping or overflow at both tested widths.
- Investigated and resolved — the first focused Playwright run failed 2/2 because `next start` served an older `.next` production build containing the prior headline. Rebuilding refreshed the test artifact; the unchanged runtime assertion then passed on both projects.
- Not run for this slice — the full unit suite, repository-wide lint and full browser suite remain part of the broader ticket validation once Home, How it works and navigation are implemented.

## Risks, limitations, and follow-ups

This first slice changes only the main hero message. The complete public story, navigation and How it works work remain to be implemented. The page must retain explicit preview/coming-soon states until DEV0096–DEV0105 deliver the linked actions.

## Completion and review references

- Completed: Not completed.
- Commit: This commit — `[DEV0093][DEV0094][DEV0095][DEV0101][DEV0103] Adopt coach-first pivot` (first hero-copy slice; ticket remains In progress).
- Review: Focused self-review against the requested hero-copy slice; broader ticket review pending.
- Deployment or release: None.
