# Ticket DEV0063: Redesign the How it works product story

- Status: Completed
- Created: 2026-09-24
- Last updated: 2026-09-24
- Milestone: MVP product presentation
- Coordination: None — independent development ticket
- Related records: follows completed [DEV0059 — Rewrite public positioning and How it works](DEV0059-rewrite-public-positioning-and-guide.md), [DEV0061 — Emphasize user and business benefits](DEV0061-emphasize-user-and-business-benefits.md), and [DEV0062 — Refine guide opening proposition](DEV0062-refine-guide-opening-proposition.md)

## Objective and context

Redesign the public How it works page as a concise product-vision narrative for hackathon judges, prospective investors and potential users. The current page explains the access pivot accurately but spreads the story across many competing cards, status labels and sections. The new page should make the intended membership-transfer experience memorable, show the complete member/business value proposition, and introduce Solana only after the product is understood. This is a presentation of the intended concept rather than a restriction to already implemented runtime behavior. It remains aligned with the [current product contract](../../../docs/mvp-spec.md#confirmed-target-and-decisions) and [public presentation requirements](../../../docs/mvp-spec.md#10-definition-of-done).

## Scope and non-goals

- In scope: rebuild `/how-it-works` around a product-object hero, a four-step access journey, an illustrative member-to-member transfer, two audience benefit panels, a concise Solana-rails explanation, and a final demo call to action; preserve the existing application shell; provide responsive desktop, tablet and mobile layouts; update focused browser expectations.
- Out of scope: implementing memberships, billing, transfers, wallets or on-chain programs; changing the shared navigation; changing other product routes; copying the concept mockups pixel-for-pixel; adding image assets or dependencies.

## Expected behavior and edge cases

Visitors first see the intended transferable-membership experience, then understand how discovery, access, attendance and flexibility form one loop. The page explains benefits for members and businesses before showing the underlying Solana rails. Illustrative prices and transfer controls communicate the product concept and do not execute mutations. The shared shell remains the only navigation chrome. Content remains readable without horizontal scrolling at mobile widths, the four steps collapse predictably, and links retain visible keyboard focus.

## Assumptions, decisions, and dependencies

The supplied handoff and concept images are design references, not repository instructions. The user confirmed that the page may confidently present intended future behavior for hackathon, investor and prospective-user audiences even when it is not implemented. A compact page-level Devnet/product-concept cue provides context without weakening every product example. Business-defined transfer eligibility remains part of the concept. Existing typography, palette, buttons and shell are reused.

## Implementation plan

1. Replace the current guide component with the streamlined product narrative and semantic section structure.
2. Replace the existing guide-specific CSS with responsive styles matching the supplied visual direction while retaining the shared shell.
3. Update focused browser coverage for the new hierarchy, links and responsive behavior.
4. Run formatting, lint, type checks, focused browser tests and a production build; inspect desktop, tablet and mobile screenshots.
5. Complete and archive this ticket with validation evidence and update the ticket index.

## Acceptance criteria

- [x] AC1: `/how-it-works` presents a product-card hero, four-step journey and clear illustrative transfer from one member to another.
- [x] AC2: The page gives distinct, concise benefits to members and fitness businesses and positions Solana as underlying infrastructure after the product story.
- [x] AC3: The page uses the existing shared shell, has working navigation/CTA links, visible focus behavior and no overflow at desktop, tablet or mobile widths.
- [x] AC4: The page makes its product-concept/Devnet context clear without annotating every intended feature as unavailable.
- [x] AC5: Focused automated checks, lint, type checking, formatting and production build pass, with responsive visual evidence recorded.

## Validation plan

Update the focused Playwright redesign coverage and exercise `/how-it-works` at desktop, tablet and mobile sizes, including keyboard navigation, key content and horizontal overflow. Run `npm run lint`, `npm run typecheck`, `npm run format:check`, the focused browser spec and `npm run build`. Capture and inspect responsive screenshots. Database, payment and blockchain rehearsals are not applicable because the page is presentational and performs no mutations.

## Implementation record

### Changes and rationale

Replaced the long, status-heavy guide with a six-part product story: a dark hero containing a tangible membership object; the four-step `Discover → Get access → Show up → Keep it flexible` journey; a compact Alex-to-Sam transfer example; two audience value cards; a dark Solana-rails explanation; and a hackathon demo call to action followed by three FAQs. The page now sells the fitness problem first, makes transferable access memorable second, and explains the infrastructure only after the member and business value is clear.

The membership card, monthly example and transfer language deliberately present the intended product concept rather than limiting the narrative to already delivered runtime actions, as confirmed by the user. A single `Product concept · Solana Devnet demo` cue and the final `No real funds` status provide the relevant presentation context without repeating implementation disclaimers throughout the page. Transferability remains explicitly eligible/business-controlled, sponsored events remain part of business inventory, and network/account costs remain distinct from MovX platform pricing.

The supplied visual references informed hierarchy, palette and responsive behavior, but the implementation retains the existing shared desktop sidebar, top bar, mobile navigation and footer. The final tablet layout stacks the hero earlier because the application sidebar leaves less content width than the standalone concept mockup.

### Affected files

| File or component                                                                                     | Change and purpose                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/discovery/how-it-works.tsx` (historical path `src/features/discovery/how-it-works.tsx`) | Rebuilt the page semantics, product narrative, illustrative membership/transfer content, audience value cards, Solana rails, demo CTA and compact FAQ. |
| `src/app/how-it-works.css` (historical path `src/app/how-it-works.css`)                               | Added the scoped desktop, tablet and mobile visual treatment for the redesigned page.                                                                  |
| [`src/app/layout.tsx`](../../../src/app/layout.tsx)                                                   | Loads the page-specific global stylesheet after the established shared styles.                                                                         |
| `src/app/how-it-works/page.tsx` (historical path `src/app/how-it-works/page.tsx`)                     | Updated the route metadata to describe the new product story.                                                                                          |
| `tests/browser/discovery.spec.ts` (historical path `tests/browser/discovery.spec.ts`)                 | Replaced the old guide assertions with semantic, keyboard, narrative, responsive and CTA coverage for the redesign.                                    |
| `tests/browser/clubs.spec.ts` (historical path `tests/browser/clubs.spec.ts`)                         | Updated the business-value and club-entry checks for the condensed audience card.                                                                      |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md)                                                       | Made the redesigned public narrative and its product-concept/Devnet boundary part of the current product contract.                                     |
| [`tickets/README.md`](../../README.md)                                                                | Tracked DEV0063 through implementation and completion.                                                                                                 |

### Decisions and deviations

- 2026-09-24: The user clarified that this page is a product-vision presentation for hackathon judges, investors and prospective users. The hero therefore presents the intended membership-transfer interaction and example monthly pricing confidently rather than restricting examples to already implemented actions.
- 2026-09-24: Kept one explicit product-concept cue and the final Devnet/test-EURC/no-real-funds line so intended behavior is not confused with a production deployment.
- 2026-09-24: Stacked the hero at widths up to 1010 px instead of preserving a two-column tablet hero. Responsive screenshot review showed that the real shared sidebar makes the standalone mockup's tablet proportions too narrow.

### Contracts, configuration, and operations

No data shape, API, authentication, payment, blockchain, dependency, environment variable, setup or migration contract changed. The public route metadata and presentation hierarchy changed. The illustrative transfer state does not execute a mutation.

## Validation results

- Date and environment: 2026-09-24, local macOS workspace, Node.js 24 project toolchain, Playwright Chrome.
- `npm test` — passed, 51/51 unit tests.
- `npm run lint` — passed.
- `npm run typecheck` — passed after generating Next.js route types.
- `npm run format:check` — passed.
- `npm run build -- --webpack` — passed; all application routes, including `/how-it-works`, compiled and rendered. The default Turbopack build was also attempted twice but its CSS worker could not bind an internal local port (`Operation not permitted`) in this execution environment; this was an environment/tooling failure rather than a source diagnostic, so the supported Webpack compiler path was used for production-build evidence.
- `npm run test:e2e -- tests/browser/discovery.spec.ts tests/browser/clubs.spec.ts` — passed, 14/14 desktop and mobile checks. This covered the new narrative, keyboard links/FAQs, club-management destination, narrow-width overflow and relevant discovery regressions.
- After the tablet hero/transfer refinement, `npm run test:e2e -- tests/browser/discovery.spec.ts --grep "public guide is reachable"` — passed, 2/2 desktop/mobile projects.
- Responsive full-page screenshots were inspected at 1440 × 1040, 768 × 1024, 393 × 852 and 320 × 800. The desktop product card and four-step row, tablet stacked hero and 2 × 2 grids, and mobile stacked cards/rails were readable without horizontal overflow. Visible focus was observed on keyboard-operated links and FAQ summaries.
- Database, Auth, wallet and Devnet transaction rehearsals were not run because this presentational change introduces no server, identity, payment or blockchain behavior.

| Criterion | Evidence                                                                                                          | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Hero membership object, four tested journey headings and tested Alex/eligible-transfer/Sam strip                  | Passed |
| AC2       | Tested people/business panels followed by the four-node Solana section                                            | Passed |
| AC3       | Existing shell preserved; focused links, CTA destinations and no-overflow checks passed at all inspected widths   | Passed |
| AC4       | Product-concept cue and tested Devnet/test-EURC/no-real-funds status are visible without per-card disclaimers     | Passed |
| AC5       | Unit, lint, type, formatting, supported production build and focused browser checks passed; screenshots inspected | Passed |

## Risks, limitations, and follow-ups

The page presents intended product behavior; it does not deliver membership purchase or transfer functionality. Those capabilities require separate backend, payment and blockchain tickets before they become executable. The default Turbopack build remains subject to the recorded local worker-port restriction; the Webpack production build passed.

## Completion and review references

- Completed: 2026-09-24 — redesigned and responsively verified the complete How it works product story.
- Commit: Not created.
- Review: Self-reviewed against all acceptance criteria and the supplied desktop/mobile concepts; no independent review created.
- Deployment or release: Not deployed.
