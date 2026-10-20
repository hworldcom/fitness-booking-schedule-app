# Ticket DEV0362: Explain group minimums and invite friends

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: M7 — Group training presentation
- Coordination: None — independent development ticket
- Related records: Historical How it works preview [DEV0359](DEV0359-preview-athlete-and-coach-how-it-works.md), navigation refinement [DEV0361](DEV0361-simplify-how-it-works-preview-navigation.md); independently queued Events cards/map baseline DEV0358 in the [reservation register](../../README.md#reserved-identifiers); commit packaging [DEV0364](DEV0364-isolate-group-minimum-styles-for-commit.md).

## Objective and context

The user requests an explanation that group classes need a minimum number of participants, visible minimum requirements on Events cards, and encouragement to invite others. Follow [group-training rules](../../../docs/mvp-spec.md#15-group-training-and-events), including manual coach confirmation and preservation of confirmed groups after withdrawals. The How it works proposal is still a separate preview; this ticket updates that explanation and the real shared Events card.

## Scope and non-goals

- In scope: preview athlete/coach/FAQ minimum explanations; an Events card minimum and aggregate remaining-count callout; invitation copy when joining is available; current specification amendment, focused state/render tests and responsive review.
- Out of scope: live How it works adoption, real invitations/messages/share API, participant identities, count polling, joining/confirmation/deadline logic, maximum-capacity changes, data/migrations/demo edits, unrelated card/map/media work, deployment or commits.

## Expected behavior and edge cases

Every card discloses its configured minimum with correct singular/plural wording. An open class below minimum shows how many more participants are needed before coach confirmation; at/above minimum it says the minimum is reached and coach confirmation is still pending. Confirmed/ended/closed/draft classes never display an outstanding minimum or minimum-reached confirmation claim. A confirmed class whose count falls below its original minimum remains presented as confirmed.

Invitation encouragement appears only on open/confirmed classes with authoritative `canJoin` and an available seat. Full, closed, terminal, draft and non-joinable classes receive no invitation prompt. Below-minimum copy invites a friend to help the class happen; other joinable classes encourage training together. This is copy encouraging users to share/invite using their own channels, not a new delivery workflow. Only aggregate public fields are read; no browser clock or private roster data is used.

The preview explains the minimum-before-confirmation rule, encourages inviting friends and says that reaching the minimum never confirms automatically. Keep the retained single audience navigation bar and no numeric maximum in public copy.

## Assumptions, decisions, and dependencies

Confirmed: explain minimum enrollment, expose it on cards and encourage invitations. Adopted defaults: use existing `minimumParticipants`, `maximumParticipants`, `participantCount`, `displayStatus` and `canJoin`; plain invitation text avoids inventing a messaging/invitation service. Keep the white/purple palette and existing card links/actions. This is one small presentation slice across its explanation and discovery surface; DEV0358 remains responsible for its original integration criteria.

Installed Next.js 16.3.8 server/client and CSS documentation was inspected before edits. No new interactive boundary or dependency is needed. Native verification may use explicitly labelled synthetic presentation fixtures when current retained inventory does not cover edge states; fixtures must not alter accounts/data.

## Implementation plan

1. Allocate this ticket/index before source changes.
2. Add state-aware minimum/progress/invitation copy to the existing shared EventCard and scoped white/purple styling.
3. Update the preview group explanation, coach setup wording and confirmation FAQ; amend specification section 15 with the requested disclosure and adopted state rules.
4. Add meaningful rendered-state cases for below/at minimum, singular/plural, confirmed count drop, full/terminal/non-joinable cases and public privacy. Run focused Events tests, scoped lint/format, isolated type/build checks as appropriate.
5. Inspect preview and card layouts at desktop and phone widths, including keyboard links/FAQ and non-joinable states; review scope, record evidence and archive only after all criteria pass.

## Acceptance criteria

- [x] AC1: Preview explains group minimums, coach confirmation and inviting friends while preserving the single navigation bar and omitted numeric maximum.
- [x] AC2: Cards show the actual minimum and truthful remaining/met state; confirmed count drops and terminal states never imply new confirmation requirements or automatic confirmation.
- [x] AC3: Invitation copy appears only for joinable open/confirmed classes with room; public aggregate/privacy boundaries and existing links/pricing/map actions remain.
- [x] AC4: Desktop/phone/keyboard/state review and focused tests, applicable static/compile checks, specification and implementation evidence are complete.

## Validation plan

Render EventCard state variants in focused tests; run existing Events/directory/coach Events checks. Run scoped ESLint/Prettier and whitespace/links checks; use an isolated source snapshot for Next type/build output to preserve the user's running server. Native desktop/375 px review covers callout wrapping, long venue text and existing navigation, plus preview disclosure/keyboard FAQ. Full/confirmed/closed variants are covered by rendered-state tests. Use the current read-only app if suitable, otherwise a labelled rendering of real components/CSS with synthetic data. No database rehearsal is needed because server/lifecycle/data code is unchanged. No new invitation error state exists because no sending/copy API is introduced.

Validation execution choice, 2026-10-19: the running application already contains a published class with zero reservations and a minimum of four. Use that real read-only public card for desktop/phone layout, and rendered tests for lifecycle variants, rather than creating or changing retained data for visual states. No temporary accounts, invitations or registrations are needed.

## Implementation record

### Changes and rationale

Added a quiet lavender enrollment panel to the shared Events card, after its existing reserved-seat/price terms. It shows the configured minimum and, for Open groups, the exact remaining public count or “Minimum reached. Awaiting coach confirmation.” A below-minimum joinable group says “Invite a friend to help this class happen”; other joinable Open/Confirmed groups encourage training together. Full, closed, draft, terminal and non-joinable groups receive no invitation prompt. Confirmed/ended groups label the threshold “Initial minimum,” so a later withdrawal cannot imply that confirmation was revoked.

Updated the standalone How it works athlete callout, group-size checklist, coach setup wording and confirmation FAQ. The explanation covers minimum enrollment, explicit coach confirmation and the decision deadline, with an invitation encouragement and the retained single audience bar. Public preview copy still omits the numeric maximum. Added the user-requested display contract and adopted lifecycle presentation rules to specification section 15.

### Affected files

| File                                                                                                       | Role                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [EventCard](../../../src/features/events/event-ui.tsx)                                                     | Minimum, remaining/met count and joinability/status-gated invitation text using existing aggregate fields.                                            |
| [Events CSS](../../../src/features/events/events.css)                                                      | White/purple enrollment panel; moved unchanged from queued `event-directory.css` under DEV0364 for independent delivery.                              |
| [Events tests](../../../tests/events.test.ts)                                                              | Rendered singular/plural, below/at/above minimum, confirmed withdrawal, full/non-joinable/terminal behavior. Existing privacy/term assertions remain. |
| Preview (retired artifact: `previews/how-it-works/index.html`) and guide (retired artifact: `previews/how-it-works/README.md`) | Minimum/confirmation/deadline explanation and invitation encouragement, with proposal boundaries.                                                     |
| [Specification section 15](../../../docs/mvp-spec.md#15-group-training-and-events)                         | User request and adopted minimum/progress/invitation state contract.                                                                                  |
| This record and [index](../../README.md)                                                                   | Scope, verification evidence and lifecycle status.                                                                                                    |

### Decisions and deviations

2026-10-19 commit annotation under DEV0364: the user authorized the checkpoint. Initial implementation placed the panel rules in the shared tree's untracked directory stylesheet; packaging moved the same declarations into baseline `events.css` so this feature does not depend on the queued redesign. Only the minimum/progress/invitation additions to EventCard are staged, preserving the redesign separately. Original combined-tree evidence below is retained; DEV0364 supplies exact staged-tree verification. DEV0358's context link points to the reservation register because its implementation is excluded.

2026-10-19: invitation encouragement is plain copy, with no new sending workflow. Available real public inventory made synthetic browser fixtures unnecessary; rendered tests cover states unavailable in that inventory. The first isolated build used the machine's Node 20 default outside the repository, so the type/build commands were repeated successfully with the explicit supported Node 24 executable. No product-scope deviations.

### Contracts, configuration, and operations

No data/API/schema/dependency/environment/migration changes. Existing public fields drive presentation; no private participant metadata or browser-clock eligibility is introduced. No invitations/messages are sent and no copied-link service is claimed. Existing card title/coach/map actions, fees and reserved-seat count remain. No database, account, media, provisioning or demo changes were made. The existing dev application picks up the card source normally; the standalone preview remains at port 3191. Rollback is presentation-only.

## Validation results

- 2026-10-19: `node --import tsx --test tests/events.test.ts tests/event-directory.test.ts tests/coach-events.test.ts tests/event-banner-editor.test.ts` — **26 passed, 0 failed** on Node 24.21.0. Four new tests cover the requested state rules, including minimum one, exact remaining counts, at/above threshold without confirmation, confirmed count drop, full and non-joinable/terminal invitation suppression. Existing public privacy, terms, links, registration/filter and media-fallback assertions also passed.
- `npx eslint src/features/events/event-ui.tsx tests/events.test.ts` and scoped `npx prettier --check`/`git diff --check` — passed. Inline Python HTMLParser/source checks passed for minimum/confirmation/invitation copy, the retained single audience bar, no visible numeric maximum, unique IDs and valid fragments. Runtime component/CSS bytes match the isolated build snapshot.
- Native Safari, normal desktop window and 375×844 Responsive Design Mode: visited the existing local `/events` without editing any records. Its existing class showed `0 / 10 seats reserved`, `Minimum 4 participants`, `4 more participants needed before coach confirmation.` and the invitation encouragement. Desktop/phone screenshots showed a complete wrapping lavender panel and preserved price, venue and Show on map control. Long venue text wrapped on phone without observed horizontal overflow. No programmatic DOM measurement is claimed.
- Native preview review at desktop and 375 px: the updated athlete/coach explanation appeared in accessibility state; Common questions reached the correct section. Opened the confirmation FAQ and observed the minimum, explicit coach confirmation and deadline explanation. Return closed the native disclosure, and its off state was observed; reopened on phone and verified the expanded text wraps within the viewport. No duplicate role buttons or numeric maximum returned.
- Some browser operations initially returned a blank page, an inactive binding or `noWindowsAvailable`. Refreshing the Safari app binding and page restored actual HTML state; subsequent observations above passed. The displayed pre-existing Next development issue badge/map tile appearance was not changed or treated as a new card failure.
- Isolated snapshot: `/private/tmp/movx-dev0362-1Spofs`, containing copied application source/configuration/public assets and a dependency symlink, with no environment files. Initial `npm run typecheck && node node_modules/next/dist/bin/next build --webpack` passed but used `/usr/local/bin/node` 20.12.2 in that folder, emitting deprecation/experimental warnings; that run is not the supported-environment proof. The final supported Node 24.21.0 commands all passed: `/Users/hoangdeveloper/.local/node/24.21.0/bin/node node_modules/next/dist/bin/next typegen`, `/Users/hoangdeveloper/.local/node/24.21.0/bin/node node_modules/typescript/bin/tsc --noEmit`, and `/Users/hoangdeveloper/.local/node/24.21.0/bin/node node_modules/next/dist/bin/next build --webpack`. The build compiled successfully, completed TypeScript, generated all 27 static pages and exited zero without those warnings. Output/caches remained outside the user's running app.
- Checker correction: an initial source-equality check also looked for tests in the source-only build snapshot. The tests run from the repository; correcting the checker to compare its actual runtime component/CSS files passed. No source failure was concealed.
- Not run/not applicable: database, migration, real invitation/message delivery or hosted checks, and broad unrelated app suites. This changes public presentation only. Full/confirmed/terminal states are verified through actual component rendering in tests, not new retained-data mutations or a claim of native browser inventory for those states.

| Criterion | Evidence                                                                                                             | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Native desktop/phone preview FAQ and accessible audience copy; static copy/navigation assertions.                    | Passed |
| AC2       | New actual-component state tests, existing real zero-of-four-minimum public card and retained confirmation badge.    | Passed |
| AC3       | Full/non-joinable/terminal rendering tests plus existing privacy/links/pricing tests; no new sending workflow.       | Passed |
| AC4       | 26 focused tests, lint/format/browser/source/link checks and final supported Node 24 isolated type/build all passed. | Passed |

## Risks, limitations, and follow-ups

The How it works design remains a standalone preview; the Events card change is implemented locally and is not a deployment. Counts use the existing public projections and refresh behavior; no new polling or notification/invitation delivery is added. Required scope and validation are complete. Existing DEV0358 integration blockers remain independent and unchanged. Native review used Safari; lifecycle states absent from real current inventory are covered by rendered component tests, not a new multi-account browser rehearsal.

## Completion and review references

- Completed: 2026-10-19 — minimum/invitation explanation and card presentation, focused tests, native review and supported type/build checks passed.
- Commit: User-authorized checkpoint with subject `[DEV0359][DEV0361][DEV0362][DEV0364] Add How it works preview and group minimums`.
- Review: Scope, source, product-contract, state/privacy, visual and keyboard self-review complete; no independent review.
- Deployment or release: None.
