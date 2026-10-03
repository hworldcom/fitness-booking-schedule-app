# Ticket DEV0044: Club illustration and brand polish

- Status: Completed
- Created: 2026-09-21
- Last updated: 2026-09-21
- Milestone: M0 visual refinement
- Coordination: None — independent development ticket
- Related records: Historical baseline [DEV0043](DEV0043-playful-club-ui-redesign.md)

## Objective and context

Bring the homepage closer to the accepted first concept in the [visual specification](../../../docs/mvp-spec.md#visual-design-direction--21-september-2026): small shoe/star doodles, a friendly group photograph blending into lilac, a stacked wordmark and the visible “Social fitness, onchain.” slogan.

## Scope and non-goals

In scope: hero asset/composition, decorative SVG marks, shared wordmark and slogan, responsive styling and current specification/asset evidence. Out of scope: authentication, data, wallet/payment and social behavior.

## Expected behavior and edge cases

Retain existing links, public browsing and wallet/sign-in controls. Decorations are hidden from assistive technology and cannot intercept input. At narrow widths the image blends vertically; copy and controls remain readable with no horizontal overflow. Preserve meaningful image alternative text, keyboard focus and reduced-motion behavior.

## Assumptions, decisions, and dependencies

User confirmed the first concept and these refinements. Use generated illustrative photography rather than imply actual members or partnerships. Keep the wordmark as accessible text and doodles as lightweight native SVG. Existing DEV0043 theme is the baseline; no new product functionality or dependency is necessary.

## Implementation plan

1. Generate and save a standalone hero photograph using the accepted concept as visual reference.
2. Refine the hero blend and decorations; replace the symbol logo with stacked text and strengthen the slogan in sidebar/footer.
3. Update the specification and image provenance; run static/build and browser layout/navigation checks and inspect desktop/mobile screenshots.
4. Finish the record and archive it with the index updated.

Scope review: one bounded visual refinement; no coordination record or split needed.

## Acceptance criteria

- [x] AC1: Hero has a friendly group photo blending into lilac and restrained shoe/star doodles.
- [x] AC2: Stacked desktop and compact mobile wordmarks and visible slogan match the accepted direction.
- [x] AC3: Desktop/mobile navigation, keyboard controls and narrow layout remain usable.
- [x] AC4: Current specification and asset provenance reflect the delivered work.

## Validation plan

Run lint, typecheck, formatting and production build. Run existing redesign and relevant shared navigation/wallet browser checks; inspect screenshots at desktop and narrow mobile widths. No database or devnet rehearsal applies because this change does not alter those contracts.

## Implementation record

### Changes and rationale

Replaced the hero's hard-edged running photograph with an illustrative group of four friends after a run. A horizontal image mask blends it into the lilac background on desktop; phones use a vertical transition. Added a small outlined shoe and star with no pointer events or accessibility-tree noise. Replaced the slash-symbol logo with the first concept's stacked RepX / Club wordmark, retaining a compact header version. The slogan now has an italic, lime-underlined sidebar treatment and a visible footer version on phones.

### Affected files

- Feed (historical path `src/features/feed/feed.tsx`): consumes the new photo and decorative marks; existing destinations and feed behavior remain intact.
- [Decorative SVG components](../../../src/components/club-doodles.tsx): small reusable shoe/star marks.
- [Shared UI](../../../src/components/ui.tsx) and [shell](../../../src/components/shell.tsx): accessible wordmark and brand signature.
- [Club theme](../../../src/app/club-theme.css): responsive image blend, decoration placement, logo/signature typography.
- Browser checks (historical path `tests/browser/redesign.spec.ts`): confirms the footer signature and home link remain visible across narrow/intermediate widths.
- [Asset provenance](../../../docs/design/DEV0044-assets.md) and [specification](../../../docs/mvp-spec.md#visual-design-direction--21-september-2026): durable image prompt and accepted design contract.

### Decisions and deviations

Kept the existing locally served display font for italic signatures rather than add another dependency. Visual review found that an older mobile footer selector hid the slogan; increased the new selector's specificity and added a visibility assertion before final verification. No scope change.

### Contracts, configuration, and operations

No data, API, environment, authentication or payment contract changes. No new dependency or migration. Hero WebP is approximately 97 KB. Existing image assets remain available; rollback consists of reverting this ticket's component/style/asset changes.

## Validation results

2026-09-21, Node 24.21.0 / Next.js 16.3.5, local production build, Playwright Chrome desktop/mobile projects:

- `npm run lint && npm run typecheck && npm run format:check` — passed, including final footer/test changes.
- `npm run build` — passed before browser checks and again after the final mobile footer fix.
- `npm run test:e2e -- tests/browser/redesign.spec.ts tests/browser/preview.spec.ts tests/browser/auth.spec.ts tests/browser/wallet.spec.ts --grep 'home discovery|club layout|four surfaces|keyboard dialog|sign-in|wallet-free'` — 14 passed, covering public destinations, keyboard operation, storage error recovery, absent-wallet guidance and sign-in controls.
- `npm run test:e2e -- tests/browser/redesign.spec.ts` — final 4 passed after the footer selector fix and visibility assertion.
- Visual inspection of desktop 1440px, mobile 393px, and narrow/intermediate 320/600px screenshots: faces and copy remain readable, photo transitions into lilac, decorations do not cover actions, compact brand fits the header, footer signature is visible. Automated checks also cover 820/1100px and reduced motion.
- `python3 /private/tmp/repx-DEV0044-doc-check.py` — validates local document/anchor links and unique record/index status. `git diff --check` — passed.
- Restarted this workspace's production server; `curl --fail --silent http://localhost:3100/ -o /private/tmp/repx-DEV0044-served.html` — successful response; verified new hero path and wordmark markers.
- No database tests or devnet transaction rehearsal: no changes to those contracts. No new live authentication rehearsal; existing browser guidance and keyboard checks cover the shared header change.

| Criterion | Evidence                                                                                          | Result |
| --------- | ------------------------------------------------------------------------------------------------- | ------ |
| AC1       | [Desktop screenshot](../../../docs/design/DEV0044-desktop.png), image/decorative component review | Passed |
| AC2       | [Mobile screenshot](../../../docs/design/DEV0044-mobile.png), final footer/home-link assertions   | Passed |
| AC3       | 14 broad checks plus 4 final responsive/navigation checks                                         | Passed |
| AC4       | Specification and provenance links checked                                                        | Passed |

## Risks, limitations, and follow-ups

Generated people are illustrative. No live membership or partnership claims. No remaining acceptance work.

## Completion and review references

- Completed: 2026-09-21; all acceptance criteria passed.
- Commit: Included in `[DEV0043] [DEV0044] [DEV0045] Refine club design and simplify navigation` under the user’s 2026-09-21 commit/push request.
- Review: Self-reviewed changed files, screenshots and acceptance evidence; no independent review.
- Deployment or release: Local preview only.

### Commit handoff — 21 September 2026

The user authorized committing and pushing the completed UI work. DEV0043–DEV0045 share successive edits in the theme, shell, specification and browser checks; the final tested state is committed together with all three development IDs. Earlier validation results above remain the implementation evidence. No additional product change is introduced by this handoff.
