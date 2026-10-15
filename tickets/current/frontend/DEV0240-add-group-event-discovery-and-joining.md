# Ticket DEV0240: Add group-event discovery and joining

- Status: Draft
- Created: 2026-10-15
- Last updated: 2026-10-15
- Milestone: M7 — Group training and events
- Coordination: [COR0021 — Group training and events](../organisatory/COR0021-group-training-and-events.md)
- Related records: contract owner [DEV0233](../../archive/organisatory/DEV0233-define-group-training-and-events-growth-scope.md); peer dependencies and independent visual baselines are listed below and in COR0021

## Objective and context

Add public `/events` and `/events/[slug]`, a public Events navigation destination, and My sessions → Group sessions at `/sessions/groups`. Show authoritative upcoming cards/detail, discipline/place filtering, chronological ordering, aggregate capacity, explicit Free/pay-at-session price, direct joining and own withdrawal/history. Implement against the [group contract](../../../docs/mvp-spec.md#15-group-training-and-events), [M7 milestone](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). The user confirmed free/pay-at-session pricing and direct joining with manual coach confirmation. Adopted implementation defaults are labelled separately in the contract.

## Scope and non-goals

- In scope: Add public `/events` and `/events/[slug]`, a public Events navigation destination, and My sessions → Group sessions at `/sessions/groups`. Show authoritative upcoming cards/detail, discipline/place filtering, chronological ordering, aggregate capacity, explicit Free/pay-at-session price, direct joining and own withdrawal/history.
- Out of scope: Coach event management, backend/schema, Home/Explore redesign or their coach filters/maps, event map/radius/ranking/price filters, public rosters, private avatars, payments, follows/messages and connection eligibility changes.

## Expected behavior and edge cases

Guests can discover/share events without login. Joining uses the verified email account, reserves one seat and explicitly says the coach has not confirmed while pending. Only own registrations appear privately; other identities are never public. Full, past-deadline, own-coach, hidden/suspended, retry, sign-in-return, unavailable and cancelled states are truthful. Confirmed sessions remain confirmed after withdrawals. Existing private My sessions and Home/Explore filter/map behavior remain intact.

## Assumptions, decisions, and dependencies

DEV0237 and DEV0238 completed; coordinate shared visual/nav edits after DEV0236's active work stabilizes. DEV0236 is an independent visual dependency, not direct group implementation; DEV0235's pending standalone preview checks do not gate this ticket.

This is one peer implementation boundary, not a parent of other development tickets. No runtime implementation has started under this record. Significant implementation choices and deviations must be recorded before they are implemented.

## Implementation plan

1. Inspect bundled Next.js guidance and delivered shared discovery components; build dedicated event routes/modules with native GET discipline/place filters and bounded chronological results.
2. Add truthful cards/detail and login-return/direct-join/withdraw controls against guarded services; keep payment and participant identity boundaries visible.
3. Add a distinct authenticated group destination linked from My sessions and public Events navigation without inserting group results into Home/Explore.
4. Run guest/athlete/coach-as-athlete privacy, recovery, URL/history, no-JavaScript and responsive keyboard regressions, including retained DEV0236 flows.

## Acceptance criteria

- [ ] AC1: Public event navigation, filtered upcoming list/shareable detail and Free/pay-at-session wording use real published session data without fabricated inventory.
- [ ] AC2: Verified eligible athletes join directly once; reservation and manual session confirmation are visibly distinct, and full/deadline/self/unavailable cases recover honestly.
- [ ] AC3: Own group registrations/withdrawal/history are private, other participant identities stay absent, and terminal/confirmed states remain stable.
- [ ] AC4: Mobile/desktop, keyboard, native GET/auth-return/history and Home/Explore/private-session regressions plus applicable static/build checks pass.

## Validation plan

Use real local directory/event fixtures and a configuration-free unavailable preview. Test 375/430/768/1440 widths, guest/auth returns, GET filtering and JavaScript-free recovery, full/duplicate/deadline/terminal flows, keyboard/focus and public/actor privacy. Run focused render/browser tests, `npm test`, lint/type/format/build and affected document checks. DEV0241 owns final combined rehearsal.

## Implementation record

Pending implementation.

### Changes and rationale

Not implemented — this record defines one boundary in the adopted delivery plan.

### Affected files

Planned capability-owned domain/server or feature modules and tests as described above. Record exact repository-relative file links and roles during implementation; no application file changed when this ticket was created.

### Decisions and deviations

2026-10-15: Created as a peer under COR0021. No deviation from the contract or plan.

### Contracts, configuration, and operations

Planned contracts are owned as described in Scope. No current runtime/schema/dependency/environment/migration/deployment changed when creating this record. Do not import the legacy funding runtime or record secrets.

## Validation results

Ticket-format/link/ownership planning checks are recorded under DEV0233 and COR0021. Runtime checks are not run because implementation has not started.

| Criterion | Evidence                                               | Result  |
| --------- | ------------------------------------------------------ | ------- |
| AC1–AC4   | Runtime implementation and required validation pending | Not run |

## Risks, limitations, and follow-ups

DEV0237 and DEV0238 completed; coordinate shared visual/nav edits after DEV0236's active work stabilizes. DEV0236 is an independent visual dependency, not direct group implementation; DEV0235's pending standalone preview checks do not gate this ticket. Free/pay-at-session registration proves neither payment nor attendance. No unrelated scope or unmet criterion may be delegated to a follow-up to claim completion.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: Planning self-review only; runtime/independent review not performed.
- Deployment or release: None.
