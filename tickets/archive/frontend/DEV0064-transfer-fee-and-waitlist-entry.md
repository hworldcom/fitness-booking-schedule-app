# Ticket DEV0064: Add transfer-fee and waitlist entry

- Status: Completed
- Created: 2026-09-24
- Last updated: 2026-09-24
- Milestone: MVP product presentation
- Coordination: None — independent development ticket
- Related records: follows completed [DEV0063 — Redesign the How it works product story](DEV0063-redesign-how-it-works-product-story.md)

## Objective and context

Clarify the How it works transfer example by showing that an eligible membership transfer includes a small fee paid to the issuing fitness business. Replace the premature demo launch destination with a dedicated Coming Soon page that lets interested visitors request waitlist enrollment by email. This keeps the hackathon/investor presentation forward-looking while giving visitors a truthful next step before the complete access demo exists.

## Scope and non-goals

- In scope: add the gym-directed fee to the memorable transfer diagram; route the final How it works call to action to a new `/coming-soon` page; add a focused waitlist-by-email section and return paths; update product documentation and browser coverage.
- Out of scope: choosing the transfer-fee amount or collection mechanics; implementing membership transfer/payment behavior; storing email addresses in the application database; adding a mailing-list vendor, API, migration or dependency; changing authentication.

## Expected behavior and edge cases

The transfer strip names the fee and its recipient without claiming a percentage or fixed amount. The primary final CTA opens `/coming-soon`, where visitors understand that the complete MovX experience is being prepared and can enter a valid email address to prepare a waitlist-request email to `hello@movx.club`. The interface clearly states that the request is added only after the visitor sends that email; it does not claim persistence. Empty or malformed email addresses remain blocked by native validation. Visitors can return to Explore or How it works.

## Assumptions, decisions, and dependencies

The user's direction confirms the transfer-fee recipient, but not the amount, payer, timing or on-chain collection design; those remain future contract decisions. Because no waitlist datastore or external mailing provider exists, a transparent email handoff is the smallest working option. The page uses the established shared shell and brand styling.

## Implementation plan

1. Update the transfer strip and current product contract with the confirmed gym-directed fee boundary.
2. Add a small client-side waitlist request component and `/coming-soon` route that prepares a pre-addressed email from a validated visitor address.
3. Point the final How it works CTA to the new route and update focused browser coverage.
4. Run formatting, lint, type checks, unit tests, focused desktop/mobile browser tests and a production build; visually inspect the new page.
5. Complete and archive this ticket with validation evidence.

## Acceptance criteria

- [x] AC1: The memorable transfer diagram visibly states that a small transfer fee is paid to the gym, without asserting an amount.
- [x] AC2: The final How it works CTA opens a branded `/coming-soon` page rather than `/explore`.
- [x] AC3: The Coming Soon page accepts a syntactically valid email, prepares an explicit email request to `hello@movx.club`, and never claims the address was stored before the visitor sends it.
- [x] AC4: Empty/invalid email input, keyboard navigation, return links and desktop/mobile overflow are covered.
- [x] AC5: Relevant automated checks, formatting, type checking and production build pass.

## Validation plan

Extend Playwright coverage to verify the new fee copy, CTA destination, native email validation, encoded `mailto:` waitlist handoff, return links, keyboard focus and horizontal overflow on desktop/mobile. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, the focused browser tests and a supported production build. Inspect desktop and mobile screenshots. Database/Auth/wallet/Devnet rehearsals are not applicable because no corresponding behavior changes.

## Implementation record

### Changes and rationale

The memorable transfer strip now gives the transfer economics their own visual badge: `Small transfer fee paid to the gym`. The product contract confirms that the issuing fitness business receives the fee while leaving its amount, payer, timing, settlement and recovery mechanics unresolved for later membership-program work.

The final How it works section now invites visitors to join the waitlist and routes to the new `/coming-soon` page. That page summarizes the intended product, labels the Devnet/test-fund context, links back to How it works and Explore, and presents a validated email field. Submitting a syntactically valid address prepares a pre-addressed `mailto:` request containing that address. The page explicitly states that nothing is stored and the request reaches MovX only after the visitor sends the email, avoiding a false success state before persistent waitlist infrastructure exists.

### Affected files

| File or component                                                                                                                                                     | Change and purpose                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/features/discovery/how-it-works.tsx` (historical path `src/features/discovery/how-it-works.tsx`)                                                                 | Added the gym-fee badge and replaced the demo-launch CTA with the waitlist destination.                       |
| `src/app/how-it-works.css` (historical path `src/app/how-it-works.css`)                                                                                               | Styled the promoted gym-fee treatment across desktop, tablet and mobile transfer layouts.                     |
| [`src/app/coming-soon/page.tsx`](../../../src/app/coming-soon/page.tsx)                                                                                               | Added the public route and metadata.                                                                          |
| [`src/features/waitlist/coming-soon.tsx`](../../../src/features/waitlist/coming-soon.tsx)                                                                             | Added the branded product summary, Devnet context, waitlist section and public return paths.                  |
| [`src/features/waitlist/waitlist-request.tsx`](../../../src/features/waitlist/waitlist-request.tsx)                                                                   | Added native email validation and the transparent, encoded email-client handoff.                              |
| [`src/app/coming-soon.css`](../../../src/app/coming-soon.css) and [`src/app/layout.tsx`](../../../src/app/layout.tsx)                                                 | Added and loaded responsive styling for the new route.                                                        |
| `tests/browser/discovery.spec.ts` (historical path `tests/browser/discovery.spec.ts`) and [`tests/browser/waitlist.spec.ts`](../../../tests/browser/waitlist.spec.ts) | Covered fee copy, CTA routing, validation, email handoff, keyboard use, return links and responsive overflow. |
| [`docs/mvp-spec.md`](../../../docs/mvp-spec.md)                                                                                                                       | Added confirmed decision C26, reconciled proposed transfer rules, and documented the Coming Soon surface.     |
| [`tickets/README.md`](../../README.md)                                                                                                                                | Tracked DEV0064 through implementation and completion.                                                        |

### Decisions and deviations

- 2026-09-24: Confirmed only the transfer-fee recipient and relative size. No amount, percentage, payer or settlement mechanism was invented.
- 2026-09-24: Used a two-step email-client handoff instead of showing a local-only or fabricated waitlist success. A real one-step subscription remains separate backend/vendor work.
- 2026-09-24: Changed the final CTA label from `Launch demo` to `Join the waitlist` so the label matches the actual destination and does not imply that the complete demo is already live.

### Contracts, configuration, and operations

No API, database, authentication, dependency, environment variable, setup or migration contract changed. The new public route is client-rendered only where it prepares the `mailto:` URI. It stores no email address locally or remotely. The product contract now fixes the transfer-fee recipient while leaving its operational mechanics open.

## Validation results

- Date and environment: 2026-09-24, local macOS workspace, Node.js 24 project toolchain, Playwright Chrome.
- `npm test` — passed, 51/51 unit tests.
- `npm run lint` — passed.
- `npm run typecheck` — passed after Next.js route-type generation, including `/coming-soon`.
- `npm run format:check` — passed.
- `npm run build -- --webpack` — passed; all 13 application pages compiled and `/coming-soon` was present in the route manifest.
- `npm run test:e2e -- tests/browser/discovery.spec.ts tests/browser/waitlist.spec.ts` — passed, 12/12 desktop/mobile checks, including all relevant discovery regressions and the new waitlist behavior.
- After promoting the gym fee to its own badge, `npm run test:e2e -- tests/browser/discovery.spec.ts tests/browser/waitlist.spec.ts --grep "public guide|coming soon page"` — passed, 4/4 desktop/mobile focused checks.
- Browser evidence confirmed that invalid email syntax cannot prepare a request; a valid normalized address appears in the encoded `mailto:hello@movx.club` URI; the page says the address is not stored; keyboard submission and reset work; both return links are correct; and neither page overflows horizontally.
- Final desktop/mobile screenshots were inspected. The gym-directed fee is visually distinct within the transfer strip, and the Coming Soon hero, waitlist card and current-preview return CTA retain the shared product hierarchy at 1440 × 1040 and 393 × 852.
- Database, Auth, wallet and Devnet rehearsals were not run because this change introduces no corresponding behavior.

| Criterion | Evidence                                                                                              | Result |
| --------- | ----------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Tested fee copy and visually inspected dedicated badge in the transfer strip                          | Passed |
| AC2       | Keyboard/browser test follows `Join the waitlist` to `/coming-soon`                                   | Passed |
| AC3       | Valid address produces tested, encoded `mailto:` request and explicit no-storage copy                 | Passed |
| AC4       | Invalid native-validation case, focus, reset, links and no-overflow assertions pass on desktop/mobile | Passed |
| AC5       | Unit, lint, type, formatting, Webpack production build and focused browser checks pass                | Passed |

## Risks, limitations, and follow-ups

The waitlist request depends on the visitor completing the prepared message in their email client. Persistent one-step signup needs a later backend/vendor ticket with consent, retention, abuse prevention and operational ownership. Transfer-fee amount and settlement behavior remain unresolved by design.

## Completion and review references

- Completed: 2026-09-24 — added the gym-directed fee treatment and responsive Coming Soon/waitlist email entry.
- Commit: Not created.
- Review: Self-reviewed against the ticket acceptance criteria and desktop/mobile screenshots; no independent review created.
- Deployment or release: Not deployed.
