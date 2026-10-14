# Ticket DEV0227: Reintroduce Home search after client feedback

- Status: Draft
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: Future discovery improvement — after client feedback
- Coordination: None — independent development ticket
- Related records: prior-removal dependency [DEV0226 — Remove Home coach or focus search](../../archive/frontend/DEV0226-remove-home-coach-focus-search.md); later Home grid baseline [DEV0228](DEV0228-build-home-coach-grid-with-discipline-filter.md); historical search implementation [DEV0197](../../archive/frontend/DEV0197-share-public-marketplace-search.md) and Home baseline [DEV0198](../../archive/frontend/DEV0198-build-search-first-marketplace-home.md)

## Objective and context

Keep an explicit future work item for bringing coach/focus search back to Home **when needed**, after more client conversations establish a useful discovery problem. On 2026-10-14 the user requested temporarily removing the named field and recording this follow-up, then clarified that this change should create tickets only. No client research or search reintroduction has occurred.

Use the [current discovery contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [confirmed decision register](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions), [definition of done](../../../docs/mvp-spec.md#11-definition-of-done) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix) as the product authority when this ticket is refined. This Draft is a reminder and a decision gate, not an approved future search design or automatic commitment to restore the current form.

## Scope and non-goals

- In scope: record client findings relevant to Home discovery; confirm whether coach/focus search solves a demonstrated need; refine and implement one bounded Home search improvement if adopted; update the specification and meaningful browser/component coverage.
- Out of scope: automatic reinstatement after a date or arbitrary conversation count, launching research or contacting clients in this change, assuming the old labels/matching behavior are the desired design, a broad Explore redesign, new provider services, or unrelated booking/maps/features.

## Expected behavior and edge cases

- Until evidence supports an adopted decision, Home keeps the simplified behavior delivered by DEV0226. Existing Explore search remains usable under its current contract.
- Before implementation, record which discovery task clients struggle with, why discipline/location browsing and coach cards are insufficient, what the proposed search matches, where it appears and how success will be assessed.
- If reintroduction is adopted, Home exposes the confirmed, accessible search flow using authoritative public coach data. Empty results, unavailable data, long/blank input, keyboard use, JavaScript-free submission and mobile layout have explicit behavior and truthful recovery.
- Search never implies a confirmed booking, verified live fixture inventory, ranking, proximity or availability that the data cannot support.
- If client feedback does not justify Home search, leave this Draft open or explicitly cancel it with the findings; do not implement merely because the ticket exists.

## Assumptions, decisions, and dependencies

- Confirmed: revisit search only when needed after more client conversations. No timeline, research quota, restoration label, matching fields or new filter set has been confirmed.
- Home design follow-up: DEV0228 records one grid, All disciplines by default and retained discipline/location search. This ticket concerns only the deferred coach/focus text search; review the delivered grid baseline when refining it.
- Dependency: DEV0226 establishes the reduced Home baseline. Its completion does not make this ticket Ready.
- Required before Ready: summarize relevant client feedback without personal details, adopt a bounded problem/design and success criteria, update this plan and its acceptance/validation criteria, and check whether the work remains one small implementation task.
- Proposed default if existing query matching satisfies the confirmed need: reuse the shared form, canonical Explore URLs and existing normalized query service. Any broader data/search behavior needs explicit scope review before implementation.
- If research changes the outcome into several implementation slices, follow the repository's pre-implementation DEV-to-COR conversion rule rather than implementing a broad project under this reminder.

## Implementation plan

1. Review the completed removal baseline and summarize relevant client conversations and the discovery need; no outreach is authorized by this ticket-only change.
2. Confirm whether Home search should return, then define placement, labels, matched fields, normalization, result/recovery behavior and measurable acceptance criteria. Update this Draft before marking it Ready or beginning implementation.
3. Reconcile the specification in the implementation change; inspect installed framework guidance and reuse current search boundaries where they meet the adopted requirements.
4. Implement the bounded Home flow and update existing component and browser tests for meaningful query/result behavior and retained Explore compatibility.
5. Validate ready/empty/unavailable, desktop/mobile, keyboard and JavaScript-free behavior; record evidence and complete/archive only when the adopted criteria pass.

## Acceptance criteria

These criteria must be refined against the client findings before implementation.

- [ ] AC1: Relevant client findings, the decision to restore Home search, its exact problem/scope and success criteria are recorded; the specification reflects the adopted contract.
- [ ] AC2: Home supports the adopted coach/focus search using authoritative public data with defined query matching and canonical result navigation, while retaining the applicable Explore contract.
- [ ] AC3: Blank/long input, no results, unavailable data, keyboard use, JavaScript-free submission and mobile/desktop layout follow the adopted behavior without fabricated inventory or booking claims.
- [ ] AC4: Meaningful focused tests and relevant browser checks, lint, type checks, formatting and build pass; exact evidence is recorded against the refined criteria.

## Validation plan

- First validate the research-to-design decision and observable criteria. Runtime validation is intentionally provisional until matching fields, placement and expected outcomes are confirmed.
- Then extend existing [shared-search tests](../../../tests/marketplace-search.test.ts), [Home tests](../../../tests/home-marketplace.test.ts) and [public browser checks](../../../tests/browser/public-story.spec.ts) using the adopted query/result examples and failure states.
- Verify keyboard/focus and JavaScript-free submission at representative mobile/desktop widths, with local directory fixtures and unavailable-data preview as appropriate.
- Run `npm test`, relevant Playwright flows, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, Markdown format/link checks and `git diff --check`. Add service/data validation only if the reviewed scope changes those contracts.

## Implementation record

Future implementation has not started. Client feedback and a confirmed design remain prerequisites.

### Changes and rationale

Created a Draft follow-up linked to the temporary Home removal. It preserves the user's request to revisit search without inventing client findings, a deadline or a final search design.

### Affected files

| File or component                                                           | Change and purpose                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| This record                                                                 | Tracks the feedback prerequisite, unresolved decisions and provisional implementation/validation plan. |
| [DEV0226](../../archive/frontend/DEV0226-remove-home-coach-focus-search.md) | Links the temporary removal to this independent future follow-up.                                      |
| [Ticket index](../../README.md)                                             | Makes the Draft follow-up discoverable with its true status.                                           |

### Decisions and deviations

2026-10-14: Recorded only the requested future work. No research, design adoption or runtime implementation occurred. No deviation from that planning scope.

### Contracts, configuration, and operations

None changed. Reintroduction may reuse the existing public query contract; no new dependency, API, environment value, schema or migration is currently proposed. Any broader requirement must be recorded before implementation.

## Validation results

Planning validation passed on 2026-10-14 in the local repository:

- `python3 /tmp/movx-search-ticket-check.py` passed 218 relative-link checks, 15 section-anchor checks, uniqueness checks for 168 DEV/COR records, template/metadata checks for both new tickets and matching index statuses/next identifiers.
- `./node_modules/.bin/prettier --check tickets/current/frontend/DEV0226-remove-home-coach-focus-search.md tickets/current/frontend/DEV0227-reintroduce-home-search-after-client-feedback.md` passed.
- `git diff --check` passed. Planning self-review confirmed the client-feedback gate and unresolved design remain explicit, and no current product behavior changed.

Client research, application tests, browser rehearsals, lint, type checks and build were not run: this is a ticket-only future Draft with unresolved requirements and no runtime change. Its acceptance criteria remain open.

| Criterion | Evidence                                                                | Result  |
| --------- | ----------------------------------------------------------------------- | ------- |
| AC1–AC4   | Pending client feedback, adopted design, implementation and validation. | Not run |

## Risks, limitations, and follow-ups

Restoring the old field without client evidence would bypass the reason for its removal. Query scope, wording, placement and success criteria remain open; there is no delivery date. Next action: discuss discovery with more clients, record the relevant findings, then decide whether and how to refine this ticket.

Commit handoff on 2026-10-14: the user authorized committing these interlinked planning records. Include DEV0226, DEV0227, DEV0228 and only their ticket-index entries. Keep all runtime criteria open and retain the existing Ready/Draft statuses. The response previews remain local under the ignored `work/` directory; do not force-add them or include the separate `.gitignore`/connection changes.

Commit-preparation validation: `python3 /tmp/movx-home-plan-commit-check.py` passed 52 relative-link checks, 12 section-anchor checks, metadata/index-status consistency for DEV0226–DEV0228 and uniqueness checks for 171 DEV/COR records. Targeted `prettier --check` for the three tickets and `tickets/README.md` and `git diff --check` passed. Staged whitespace/scope review accompanies the commit; earlier preview validation remains recorded in DEV0228. No application tests/build are needed for committing planning documents without runtime changes.

## Completion and review references

- Completed: Not completed — future Draft.
- Commit: Planning records included in `[DEV0226] [DEV0227] [DEV0228] Record Home discovery plans`; application implementation remains pending.
- Review: Planning self-review only; no independent review created.
- Deployment or release: No application change or deployment.
