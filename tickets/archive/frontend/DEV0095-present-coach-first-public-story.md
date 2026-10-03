# Ticket DEV0095: Present the coach-first public story

- Status: Completed
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first M0 truthful positioning
- Coordination: [COR0009 — Coach-first private-class booking MVP](../../current/organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on [DEV0094](../organisatory/DEV0094-adopt-coach-first-training-package-mvp.md); replaces the current public multi-gym story delivered by archived DEV0073/DEV0076 without rewriting their history; navigation hands public discovery to [DEV0108 — Add the Mapbox coach Explore map](../../current/frontend/DEV0108-add-mapbox-coach-explore-map.md); [DEV0109 — Retire membership schema and preserve gyms](../../current/backend/DEV0109-retire-membership-schema-and-preserve-gyms.md) preserves gyms only as optional coach locations

## Objective and context

Make the public application explain one current product: discover martial-arts coaches who may train independently or at a fictional gym, see capacity-one availability for the coming week, book a private class, buy or use a one-session/ten-session pass, retain the credit after cancellation and follow the coach. DEV0101 already removed the old gym/membership routes and installed a truthful early-access home; this ticket turns that safe transitional state into the complete public coach-first story without turning gyms back into the primary marketplace product.

## Scope and non-goals

- In scope: build Home and How it works from the coach-first early-access baseline; update navigation/route names and metadata, including the `/explore` entry owned by DEV0108; introduce coach, private-class, slot and pass terminology; show the complete choose-slot, use-or-buy-pass, cancel-with-credit-retained and completed-session loop with honest Devnet/test-money labels; preserve accessible responsive design and intentional not-found behavior for retired routes.
- Out of scope: persistent coach/availability/booking data, working offer creation/purchase/redemption, social persistence, destructive database cleanup, new branding, production payment claims or implementing the coach discovery and booking capabilities owned by backend/blockchain peers.

## Expected behavior and edge cases

A guest understands the coach-first product without seeing contradictory claims about four-gym access, Basic/Classic, gym-managed classes, included check-ins, membership pools, gym allocation or wallet membership cards. The story makes clear that a client explores coach-selected public locations—which may show an optional fictional gym name—chooses an open private slot, uses or purchases a one-session/ten-session pass, keeps an unused credit after cancellation and consumes one session only after a completed class. Calls to action lead only to delivered coach discovery/booking routes or clearly labelled preview states. Pages must not imply that a gym controls the coach's offer or booking, that a public Mapbox pin is live tracking/current presence/availability, or that a real coach/gym partnership, live slot, real USDC payment or production entitlement exists.

Legacy links should fail safely or redirect to an appropriate coach-first route; they must not expose a half-functional multi-gym purchase flow. Existing signed-in identity and wallet controls remain intact.

## Assumptions, decisions, and dependencies

DEV0094 must first make the coach-first specification authoritative. Use **coach** in public copy. The first niche is martial-arts coaching; coaches may be independent or associated with a fictional gym, but the page structure must not hard-code one discipline or revive gym-membership discovery. Reuse the existing design system rather than redesigning the brand.

## Implementation plan

1. Inventory the transitional early-access home, navigation, metadata and shared styles left by DEV0101.
2. Start with a focused hero-copy slice that states the martial-arts coach marketplace value directly while the page remains explicitly labelled as coming soon.
3. Implement the remaining coach-first private-class booking loop, cancellation/credit explanation, client/coach benefits and Devnet explanation.
4. Connect only delivered coach discovery/availability/booking or clearly labelled preview/coming-soon calls to action while preserving auth/profile behavior; DEV0108 owns `/explore` list/map implementation.
5. Update focused unit/browser coverage for desktop, mobile, keyboard and truthful unavailable states.

## Acceptance criteria

- [x] AC1: Home and How it works describe only the list/map coach discovery/weekly-slot/one-session-or-ten-session-pass/booking/completed-session/social loop, support an optional fictional gym label without presenting gym membership/classes/check-ins, distinguish a chosen public pin from live location/availability and clearly label Devnet test USDC.
- [x] AC2: Current navigation and calls to action contain no active four-gym, Basic/Classic, pool-allocation, non-core-visit or wallet-membership-card product path.
- [x] AC3: Legacy links resolve safely, and authenticated account/wallet controls remain usable.
- [x] AC4: Representative mobile/desktop and keyboard checks pass with no fabricated availability or misleading partnership/production-payment claim.

## Validation plan

Search current frontend sources for superseded product terms, review each retained technical identifier, run focused UI tests, `npm test`, lint, typecheck and production build, then manually inspect Home/How it works at mobile and desktop widths with keyboard navigation.

## Implementation record

Completed the public coach-first product story. Home now presents the complete private-training loop, `/how-it-works` explains the client and coach journeys, shared navigation exposes that explanation, and every action leads to a delivered public page or the clearly labelled early-access waitlist. The unfinished `/explore` implementation remains unavailable until DEV0108 delivers it.

### Changes and rationale

- Rewrote the early-access hero headline as “Find the right martial arts coach for you.” and the supporting description around discovering independent coaches, disciplines, availability and goal-oriented private training. The previous “getting ready to move” language described launch status but did not communicate the marketplace value.
- Replaced the transitional waitlist-only Home with a responsive product overview covering coach discovery, coach-selected public locations, capacity-one weekly slots, one-session/ten-session TrainingPasses, cancellation with the unused credit retained, completed-class redemption and coach posts.
- Added a dedicated How it works page that separates the client journey, coach journey, location semantics, pass semantics and social boundary. Both pages explain that fictional gym names are location labels only and that public pins are not live tracking, presence or availability.
- Kept financial and supply claims truthful: the pages label coaches, gyms and availability as fictional preview data and describe Solana Devnet plus test USDC with no real funds or partnership claim.
- Added How it works to shared desktop/mobile navigation and the top-bar help link. Explore remains intentionally absent and returns not found because DEV0108 owns the real synchronized list/map route.
- Retargeted “continue public browsing” links in sign-in and protected-access failure states from the unavailable `/explore` route to the new public Home.
- Updated the early-access page so independent and fictional-gym-associated coaches, weekly private slots, one-session/ten-session passes, cancellation and completed-session deduction agree with the final public story.

### Affected files

- `src/features/public/coach-story.tsx`: reusable server-rendered Home and How it works product-story sections, disclosures and calls to action.
- `src/app/coach-story.css`: responsive public-story layout and component styling using the existing brand tokens.
- `src/app/page.tsx`: coach-first Home route and route metadata.
- `src/app/how-it-works/page.tsx`: new public explanation route and metadata.
- `src/app/layout.tsx`: loads the public-story stylesheet.
- `src/components/shell.tsx`: exposes How it works in desktop/mobile navigation and the top bar while preserving account and wallet controls.
- `src/features/auth/sign-in.tsx` and `src/features/auth/protected-access.tsx`: return users to delivered public Home instead of the not-yet-delivered Explore route.
- `src/features/waitlist/coming-soon.tsx`: aligns early-access copy with optional fictional-gym association, weekly private booking and TrainingPass behavior.
- `tests/browser/public-story.spec.ts`: focused desktop/mobile product-copy, CTA, keyboard-focus, disclosure and overflow coverage.
- `tests/browser/authorization.spec.ts`: treats How it works as public while retaining not-found assertions for legacy and not-yet-delivered Explore routes.
- `tests/browser/waitlist.spec.ts`: asserts the corrected early-access description and existing waitlist behavior.
- `tests/browser/auth.spec.ts` and `tests/browser/wallet.spec.ts`: verify public fallback and wallet/sign-in navigation against the new Home rather than the retired Explore page.

### Decisions and deviations

The copy uses the specification's public term **coach** rather than trainer. It leads with the marketplace outcome and describes private training by goals and schedule; the surrounding product-preview and early-access labels distinguish the target experience from delivered functionality.

- 2026-10-03: The later database-cleanup decision retained fictional gyms as optional public coach locations. The completed story supports independent and fictional-gym-associated coaches without presenting gyms as marketplace sellers or reviving memberships, managed classes or check-ins.
- 2026-10-03: DEV0108 owns the real Explore list/map experience. Linking users to a fabricated Explore page would violate the truthful-preview requirement, so DEV0095 keeps `/explore` unavailable and sends public calls to action to How it works or early access.

### Contracts, configuration, and operations

The public route contract adds `/how-it-works`; `/`, `/coming-soon`, account/profile and wallet controls remain compatible. `/explore` and retired membership/gym-wallet routes remain unavailable. No schema, server interface, dependency, environment variable, secret, migration or rollback change is introduced.

## Validation results

- Passed — `npx prettier --check src/features/waitlist/coming-soon.tsx tests/browser/waitlist.spec.ts tickets/current/frontend/DEV0095-present-coach-first-public-story.md tickets/current/organisatory/COR0009-coach-first-training-package-mvp.md tickets/README.md` reported all five changed records/sources formatted.
- Passed — `npx eslint src/features/waitlist/coming-soon.tsx tests/browser/waitlist.spec.ts` completed without findings; `git diff --check` also passed.
- Passed — `npm run build` compiled Next.js 16.3.5, completed TypeScript checking and generated all routes successfully.
- Passed — `npx playwright test tests/browser/waitlist.spec.ts` after the production build: 2/2 tests passed across the 1440 × 1040 desktop and 393 × 852 mobile projects. The flow covers the new headline/description, keyboard submission, waitlist handoff, preview disclosure and horizontal-overflow check.
- Passed — visual review of the Playwright screenshots confirmed that the new headline and description remain legible without clipping or overflow at both tested widths.
- Investigated and resolved — the first focused Playwright run failed 2/2 because `next start` served an older `.next` production build containing the prior headline. Rebuilding refreshed the test artifact; the unchanged runtime assertion then passed on both projects.
- Passed — `npm test`: 43/43 unit and architecture tests passed.
- Passed — `npm run typecheck`: Next.js route types generated and TypeScript completed without errors, including the new route.
- Passed — `npm run lint`: repository-wide ESLint completed without findings; `git diff --check` also passed.
- Passed — `npm run build`: Next.js 16.3.5 compiled, type-checked and generated `/`, `/how-it-works`, `/coming-soon`, account and API routes successfully.
- Passed — `npx playwright test tests/browser/public-story.spec.ts tests/browser/waitlist.spec.ts tests/browser/authorization.spec.ts`: 10/10 tests passed across 1440 × 1040 desktop and 393 × 852 mobile projects. Coverage includes both public-story pages, truthful disclosures, keyboard focus, early-access handoff, configured-guest access, private-route redirects, legacy/not-yet-delivered route unavailability and horizontal overflow.
- Passed — final `npx playwright test`: 18/18 browser tests passed across both desktop and mobile, additionally covering sign-in, profile privacy and safe Phantom guidance against the new Home/navigation.
- Passed — manual review of the four full-page Playwright screenshots confirmed readable hierarchy, intact navigation, usable calls to action and no clipping at both widths.
- Investigated and resolved — the first public-story browser run failed 2/10 assertions on both widths because Home said “not live location” while the focused check required the clearer “not live tracking” distinction. The copy was corrected, the production artifact rebuilt and all 10 tests passed.
- Investigated and resolved — the first full browser regression found four stale auth/wallet assertions and two public fallback links that still targeted the unavailable legacy `/explore` page. Sign-in, protected-access fallback and their tests now use the delivered coach-first Home; the final 18-test run passed.
- Not applicable — database/migration validation belongs to the simultaneously active DEV0109 and was not run or modified for this frontend ticket.

## Risks, limitations, and follow-ups

The pages describe the confirmed target flow but do not make coach discovery, availability, purchase, booking, redemption or social persistence live. Preview disclosures and early-access routing must remain until DEV0096–DEV0105 and their blockchain peers deliver those actions. DEV0108 must add Explore to navigation only when its accessible list fallback and map boundary are usable.

## Completion and review references

- Completed: 2026-10-03.
- Prior commit: `[DEV0093][DEV0094][DEV0095][DEV0101][DEV0103] Adopt coach-first pivot` (first hero-copy slice).
- Commit: This commit — `[DEV0095][DEV0109] Present coach story and plan schema cleanup` (DEV0095 implementation and DEV0109 planning boundary; DEV0109 runtime draft remains uncommitted).
- Review: Self-review against all four acceptance criteria, focused browser evidence and desktop/mobile screenshots completed.
- Deployment or release: None.
