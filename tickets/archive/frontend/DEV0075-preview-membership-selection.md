# Ticket DEV0075: Preview membership selection

- Status: Completed
- Created: 2026-09-25
- Last updated: 2026-09-26
- Milestone: M2 frontend membership setup preview
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: depends on discovery contracts from completed [DEV0074](DEV0074-preview-multigym-discovery.md) and public terminology from completed [DEV0073](DEV0073-rewrite-multigym-public-story.md); future membership activation/payment work is a not-yet-created COR0007 peer

## Objective and context

Create an honest frontend-only membership setup and My Membership preview so the four-gym choice and Basic/Classic rules can be evaluated before database and Devnet implementation. The flow ends at a clearly non-activating review/Coming Soon state and never fabricates paid membership ownership.

## Scope and non-goals

- In scope: select Basic or Classic; select exactly four distinct eligible gyms; selection progress and validation; plan/gym review summary; explicit demo price/daily-rule/non-core explanation; editable browser-local draft selection; My Access relabelled/presented as My Membership with a draft or empty state; reset/recovery behavior; activation handoff to Coming Soon/waitlist; responsive/keyboard behavior and focused tests.
- Out of scope: real membership period, payment/wallet prompt, entitlement, balance, check-in, reservation, allocation, gym operations, database/API storage, authentication requirement changes, automatic renewal, cancellation/refund and deployment.

## Expected behavior and edge cases

A visitor can compare plans and start a preview selection. The interface permits exactly four unique gyms that are eligible for the chosen plan, shows `0/4` through `4/4`, disables review until valid, and supports removing/replacing a choice. Switching plans revalidates the selection and removes or clearly identifies now-ineligible gyms rather than keeping an invalid hidden state.

The review shows plan name, €80 or €150 monthly demo price, ten or unlimited allowance, one included check-in per day, four gym names and the separate illustrative €15 non-core visit. The final action does not create an active membership or ask for a transaction; it routes to Coming Soon/waitlist with explicit language.

My Membership distinguishes `Draft selection` from `Active membership`. It never shows remaining check-ins, payment confirmation or ownership unless a later backend ticket supplies verified state. Browser-local drafts are namespaced/versioned, validated on load and safely reset when corrupt or when fixture eligibility changes.

## Assumptions, decisions, and dependencies

- Completed DEV0073 provides the public terminology and current €15 non-core value. Completed DEV0074 now provides the typed plan/gym read contracts and seven fictional fixtures required by this ticket.
- Keeping `/my-access` as the initial route is acceptable for compatibility, but the visible label becomes My Membership. A route rename requires redirects and must be decided before implementation starts.
- Local draft persistence is presentation convenience only and must not reuse financial or entitlement language.
- A later activation ticket replaces the Coming Soon handoff and owns wallet/payment/reconciliation behavior.

## Implementation plan

1. Define a versioned, validated browser-only membership-draft shape over DEV0074's plan/gym identifiers.
2. Build accessible plan choice and exactly-four gym selection with deterministic eligibility/revalidation behavior.
3. Add a review summary and truthful Coming Soon handoff with no transaction or ownership mutation.
4. Replace the My Access empty presentation with My Membership draft/empty states and safe reset/recovery.
5. Validate rules, storage corruption/version changes, keyboard interaction, responsive layouts and the standard frontend suite.

## Acceptance criteria

- [x] AC1: The preview accepts exactly four distinct active gyms eligible for the selected plan and blocks fewer, more, duplicates and incompatible choices with understandable feedback.
- [x] AC2: Basic/Classic prices, allowances, daily rule and separate €15 non-core visit are consistent across selection, review and My Membership.
- [x] AC3: Review/submit creates no membership, payment, entitlement, check-in or allocation; unavailable activation routes honestly to Coming Soon/waitlist.
- [x] AC4: Local draft load/save/reset handles malformed, stale-version and changed-eligibility state without implying ownership or breaking retained public routes.
- [x] AC5: Rule/storage tests, content assertions, lint, typecheck, format, build and desktop/mobile keyboard/browser flows pass.

## Validation plan

Test zero-to-four selection, duplicate/fifth/ineligible choices, removal/replacement, plan switching, stale fixture identifiers, corrupt storage, reload and reset. Verify no wallet transaction or protected mutation is invoked and no `Active`/paid/remaining-access state is fabricated. Exercise the full preview at desktop/mobile widths and with keyboard-only interaction. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and affected `npm run test:e2e` cases.

## Implementation record

Implementation started with the completed DEV0074 plan/gym contracts as the only selectable catalogue source.

### Changes and rationale

- Added a pure membership-draft state machine over the DEV0074 catalogue. It enforces a known Basic/Classic plan, at most four unique eligible gym identifiers, deterministic plan-switch cleanup and review readiness only at exactly four choices.
- Added a versioned browser adapter under `movx-club:membership-draft:v1`. It validates every load, removes retired or newly ineligible gyms, resets corrupt/incompatible versions and continues in memory when browser storage is unavailable.
- Added `/membership/setup` with accessible plan radios, gym checkboxes, `0/4`–`4/4` progress, plan-switch feedback, keyboard operation and an explicit review screen. Review shows the selected plan, price, allowance, daily rule, four gyms and €15 non-core visit, then routes to the existing Coming Soon/waitlist without payment or activation.
- Linked both Explore plan cards into the setup preview. Reframed the retained `/my-access` route and navigation label as My Membership, where browser-local choices are visibly a `Draft selection`/`Not active` state and can be continued, edited or reset.
- Updated the specification and README to distinguish this local preview from future verified membership state. Added domain and Playwright coverage for selection bounds, eligibility changes, storage recovery, responsive keyboard use, persistence and truthful handoff.

### Affected files

- `src/domain/membership-draft.ts` (historical path `src/domain/membership-draft.ts`) owns the framework-independent draft shape, parser, transition rules and review validation.
- `src/features/membership/draft-store.ts` (historical path `src/features/membership/draft-store.ts`), `setup.tsx` (historical path `src/features/membership/setup.tsx`) and `my-membership.tsx` (historical path `src/features/membership/my-membership.tsx`) own browser persistence and the setup/My Membership presentation. The former `src/features/access/my-access.tsx` screen was removed after its retained route moved to the membership feature boundary.
- `src/app/membership/setup/page.tsx` (historical path `src/app/membership/setup/page.tsx`), `src/app/my-access/page.tsx` (historical path `src/app/my-access/page.tsx`), [`src/components/shell.tsx`](../../../src/components/shell.tsx), `src/features/discovery/explore.tsx` (historical path `src/features/discovery/explore.tsx`) and `src/app/membership.css` (historical path `src/app/membership.css`) expose and style the flow while retaining `/my-access` compatibility.
- `tests/membership-draft.test.ts` (historical path `tests/membership-draft.test.ts`) and `tests/browser/membership.spec.ts` (historical path `tests/browser/membership.spec.ts`) cover the new contract and browser flow; the retained navigation/discovery assertions in `tests/browser/preview.spec.ts` (historical path `tests/browser/preview.spec.ts`) and `tests/browser/redesign.spec.ts` (historical path `tests/browser/redesign.spec.ts`) now use My Membership.
- [`docs/mvp-spec.md`](../../../docs/mvp-spec.md) and [`README.md`](../../../README.md) describe the draft preview and keep future authoritative activation separate.

### Decisions and deviations

- 2026-09-25: The frontend-first approach deliberately stops before activation. This tests whether the four-gym concept is understandable without introducing fake financial state.
- 2026-09-26: The draft remains independent of the older social-preview store so resetting or migrating follows cannot create or erase membership-looking state. The membership key has its own version and parser.
- 2026-09-26: `/my-access` remains protected under the existing application-access policy. Only its visible label and content changed; no authentication requirement or redirect was relaxed.
- 2026-09-26: Query parameters from Explore preselect a plan through the same reducer used by direct interaction, so an existing selection is revalidated rather than bypassing eligibility rules.

### Contracts, configuration, and operations

The new local contract is `{ version: 1, planId: "basic" | "classic" | null, gymIds: string[] }`, stored under `movx-club:membership-draft:v1`. `gymIds` must be unique, contain at most four current catalogue identifiers and be eligible for the selected plan; a reviewable draft contains exactly four. This is presentation state, not an entitlement, financial record or activation request.

No API, database table, migration, program account, environment variable, wallet transaction, setup step or deployment contract changed. A future activation ticket must replace this draft with server/chain-authoritative state explicitly; it must not silently reinterpret browser storage as ownership.

## Validation results

- `npm test` — passed: 55/55 tests, including six membership-draft rule/recovery cases and existing architecture-boundary coverage.
- `npm run lint` — passed with no errors or warnings.
- `npm run typecheck` — passed after Next.js route type generation.
- `npm run format:check` — passed.
- `npm run build` — could not complete in this restricted runner because Turbopack attempted to bind an internal local port and returned `EPERM`, including on the permitted retry. `npm exec next build -- --webpack` passed for the final configured build; a separate preview-mode build also passed to exercise protected My Membership without configured Auth.
- `npm run build:vinext` — passed all five client/server/RSC/SSR stages. Wrangler emitted a non-fatal `EPERM` while trying to write its user-level debug log outside the workspace; the command exited successfully and produced the route build.
- `npm run test:e2e -- tests/browser/membership.spec.ts tests/browser/preview.spec.ts tests/browser/redesign.spec.ts tests/browser/waitlist.spec.ts` — passed 22 desktop/mobile checks. Four preview-only checks skipped under the configured-auth build by design.
- Preview-mode `npm run test:e2e -- tests/browser/membership.spec.ts --grep "My Membership shows"` after an environment-empty production build — passed 2/2 desktop/mobile checks, proving saved choices render as `Draft selection`, never active access, and reset safely.
- Playwright screenshots were inspected at 1440×1040 and 393×852. The full setup remained within the viewport width, preserved readable plan/gym hierarchy and kept actions reachable above the responsive footer/navigation.

## Risks, limitations, and follow-ups

Local state is device/browser-specific and can disappear when storage is cleared. It is intentionally unsuitable for cross-device continuation, activation, check-in or financial recovery. `Draft`, `Preview only`, `Not active` and the no-payment/access notices remain visible to prevent ownership ambiguity.

The configured-auth run cannot enter protected My Membership without a real signed-in session, so its component flow was additionally verified through a separate preview-mode production build. Real account-backed persistence and activation remain owned by a future COR0007 peer.

## Completion and review references

- Completed: 2026-09-26. All acceptance criteria and required frontend validation passed; the ticket is archived with no deployment implied.
- Commit: Not created.
- Review: Implementation self-review completed against AC1–AC5; no independent review or pull request.
- Deployment or release: None.
