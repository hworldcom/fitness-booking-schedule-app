# Ticket DEV0073: Rewrite the multi-gym public story

- Status: Completed
- Created: 2026-09-25
- Last updated: 2026-09-26
- Milestone: M0 truthful positioning and guide
- Coordination: [COR0007 — Core multi-gym membership MVP](../../current/organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: depends on completed [DEV0072](DEV0072-remove-legacy-product-ui.md); uses the contract adopted by [DEV0069](../organisatory/DEV0069-adopt-core-multigym-membership-mvp.md) and amended by [DEV0070](../organisatory/DEV0070-revise-multigym-plan-pricing.md); discovery followed in completed [DEV0074](DEV0074-preview-multigym-discovery.md)

## Objective and context

Rewrite Home, metadata and How it works so a hackathon judge, potential member or gym understands the focused product without prior explanation: choose four participating gyms, select Basic or Classic, use included check-ins, optionally pay the member price at another participating gym, and see transparent usage-based provisional gym allocation.

The public story must lead with user value and gym value. Solana/Devnet appears as supporting infrastructure only after the product loop makes sense.

## Scope and non-goals

- In scope: Home proposition and calls to action; document metadata; complete responsive How it works journey; Basic €80/ten and Classic €150/unlimited plan explanation; one included check-in per day; four-core-gym selection; illustrative €15 non-core visit; member and gym benefits; provisional-not-final allocation; minimal social explanation; honest demo/coming-soon states; accessible responsive content and focused tests.
- Out of scope: Explore catalogue implementation, selection mechanics, membership activation, wallet transactions, real balances, check-in controls, gym dashboard, database work, final payout promises, real partner claims and deployment.

## Expected behavior and edge cases

The opening copy names one product and two plans. “Unlimited” is always paired with the one-included-check-in-per-day rule. Four gyms is explained as the member's selected core set for a period, not access to only four gyms in the whole network. The €15 visit is clearly available only to an active member at an eligible participating non-core gym and remains illustrative.

The gym explanation distinguishes provisional allocation from claimable payout and avoids asserting final economics. Public calls to action route to Explore or Coming Soon; they never imply that clicking activates or pays for a membership. Social copy mentions only follows and explicitly shared verified check-ins.

## Assumptions, decisions, and dependencies

- Completed DEV0072 removed contradictory legacy copy and CSS first, avoiding overlapping deletion/redesign changes in the same files.
- Exact production prices and allocation economics remain hypotheses even though €80/€150/€15 are the current demo values.
- Reuse the established visual language where it supports clarity, but do not preserve transfer-card composition merely for historical consistency.
- No new image asset is required unless implementation review shows the product cannot be explained accessibly with interface-native visuals.

## Implementation plan

1. Define the Home and guide information hierarchy against C18/C20–C27 and the public journey in the specification.
2. Rebuild Home/metadata around one multi-gym membership and direct calls to Explore/How it works.
3. Rebuild How it works around plan choice, four gyms, check-in use, non-core visit, provisional gym allocation and optional sharing.
4. Add honest demo labels, member/gym benefit sections, responsive layout and keyboard/semantic structure.
5. Update copy assertions and desktop/mobile browser tests; run the standard frontend validation suite.

## Acceptance criteria

- [x] AC1: A first-time reader can identify the product, two plans, prices, allowances, daily rule and four-gym selection from the first public sections.
- [x] AC2: The guide explains included core-gym visits, the separate €15 non-core member visit and provisional gym allocation without presenting unavailable actions or final payouts.
- [x] AC3: Member freedom, gym discovery/revenue transparency and minimal verified-participation social are explicit; transfers, passes, events, sponsorships, challenges and reactions are absent.
- [x] AC4: Solana/Devnet appears as supporting payment/integrity infrastructure after the product explanation, with no production/legal/partner claim.
- [x] AC5: Home and guide pass content assertions, semantic/keyboard review, responsive desktop/mobile browser checks, lint, typecheck, format and build.

## Validation plan

Add focused content assertions for all price/allowance/core-gym/non-core/provisional terms and absence of removed-product language. Exercise navigation and reading order at representative desktop/mobile widths and with keyboard-only interaction. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and affected `npm run test:e2e` cases.

## Implementation record

Completed on 2026-09-26 after DEV0072 established the truthful baseline and removed the overlapping legacy guide code.

### Changes and rationale

Home now opens with the exact product shape—one membership and four selected core gyms—then presents Basic at €80 for ten included check-ins, Classic at €150 with no numerical allowance, the one-included-check-in-per-day rule and the illustrative €15 eligible non-core visit. The membership summary is explanatory rather than selectable, and every activation-oriented call to action stops at Explore, How it works or the Coming Soon waitlist.

How it works now explains the complete member journey in product order: select four gyms, choose a plan, receive staff-confirmed core check-ins, optionally pay €15 directly to an eligible non-core gym, understand provisional allocation and explicitly choose whether to share verified participation. Separate member and gym benefit cards make the two-sided value clear. Solana Devnet and test EURC appear only in the final supporting-infrastructure section, after the product, usage and business story.

The non-core demo price changed from €8 to €15 before implementation. The current MVP specification, downstream selection assumptions and active coordination records now use €15; archived DEV0070 remains unchanged as historical evidence. Project metadata, navigation prompts and README status were updated to match the delivered frontend rather than the removed legacy product.

### Affected files

- `src/features/feed/feed.tsx` and `src/app/club-theme.css`: replaced the generic Home proposition with a four-gym hero and responsive Basic, Classic and non-core price summary while preserving the minimal shared-check-in community preview.
- `src/features/discovery/how-it-works.tsx` and `src/app/how-it-works.css`: rebuilt the guide around plan choice, the six-step member journey, direct-to-gym non-core payment, member/gym benefits, provisional allocation and supporting Devnet rails.
- `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/how-it-works/page.tsx`, `src/components/shell.tsx` and `src/app/globals.css`: aligned metadata and shared framing, and added the missing cream/forest theme tokens found during visual review.
- `tests/browser/redesign.spec.ts` and `tests/browser/discovery.spec.ts`: assert plan/pricing/daily-rule content, information order, removed-product absence, truthful destinations, keyboard behavior and responsive layouts.
- `docs/mvp-spec.md`, `README.md`, `tickets/archive/frontend/DEV0075-preview-membership-selection.md`, `tickets/current/organisatory/COR0006-persistent-access-catalogue.md` and `tickets/current/organisatory/COR0007-core-multigym-membership-mvp.md`: adopted €15 as the current illustrative non-core value and updated current status/downstream assumptions.

### Decisions and deviations

- 2026-09-25: Public storytelling is separated from mechanical legacy deletion so each change has a clear before/after review boundary.
- 2026-09-26: The user raised the illustrative non-core member visit from €8 to €15 before implementation. DEV0073 owns the current specification and presentation update; completed DEV0070 remains an unchanged historical record of the earlier value.
- 2026-09-26: Visual review found that the intended dark guide and non-core panels referenced undefined theme tokens. `--cream` and `--forest` were added centrally so the product hierarchy and text contrast render as designed.

### Contracts, configuration, and operations

The confirmed illustrative non-core price in C24 and the proposed configuration value in P18 changed from €8 to €15. The target payment remains a separate Devnet-EURC payment made directly to the eligible destination gym; it does not consume Basic usage or enter the membership pool. No database, API, wallet transaction, environment variable, migration, dependency or deployment contract changed.

## Validation results

- `npm test` — passed: 45 unit tests.
- `npm run lint` — passed after correcting one unescaped JSX apostrophe.
- `npm run typecheck` — passed; Next.js route types and TypeScript completed without errors.
- `npm run format:check` — passed.
- `npm run build` — blocked by the restricted execution environment because Turbopack's PostCSS worker could not bind an internal local port (`Operation not permitted`); no application compile error was reported.
- `./node_modules/.bin/next build --webpack` — passed on the final source, including TypeScript, page-data collection and all 12 static pages.
- `npm run build:vinext` — passed all five build phases; Wrangler emitted only a non-fatal warning when its debug logger could not write outside the workspace.
- `npm run test:e2e -- tests/browser/redesign.spec.ts tests/browser/discovery.spec.ts` — passed: 14 desktop/mobile browser tests covering content, navigation, keyboard focus, removed routes, narrow layouts and browser errors.
- Manual screenshot review covered full-page Home and How it works at desktop and mobile widths. It caught and resolved the missing dark-theme tokens; the final pages have coherent reading order, contrast, card stacking and no horizontal overflow.
- A targeted source audit found no public-story copy for transfers, passes, events, sponsorships, challenges, reactions or the superseded €8 price. `git diff --check` passed.

## Risks, limitations, and follow-ups

The pages remain a concept preview: no plan can be selected, activated or paid for, and the three-gym Explore fixtures present at this ticket's completion were not partnership claims. DEV0074 was then scoped for five gyms and later recorded the user-approved seven-gym discovery/plan result; DEV0075 owns browser-local four-gym selection and the My Membership draft. Every unavailable activation action therefore continues to end at Coming Soon/waitlist.

The default Turbopack production command remains unexercised in this restricted environment because its internal worker requires a prohibited local port. Both the Webpack Next.js build and the Cloudflare/vinext build completed on the final source.

## Completion and review references

- Completed: 2026-09-26.
- Commit: Not created.
- Review: Implementation self-review against AC1–AC5 plus desktop/mobile screenshot review; no independent review.
- Deployment or release: None.
