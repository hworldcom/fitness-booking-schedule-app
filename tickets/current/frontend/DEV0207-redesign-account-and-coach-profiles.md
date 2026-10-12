# Ticket DEV0207: Redesign account and coach Profiles

- Status: Draft
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Coordination: [COR0018 — Authenticated workspace redesign](../organisatory/COR0018-authenticated-workspace-redesign.md)
- Related records: completed contract [DEV0202 — Adopt the authenticated workspace redesign contract](../../archive/organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), shell dependency [DEV0203 — Introduce the authenticated workspace shell](DEV0203-introduce-authenticated-workspace-shell.md), coach-frame dependency [DEV0205 — Redesign coach Schedule](DEV0205-redesign-coach-schedule.md), image baseline [COR0012 — Profile images](../../archive/organisatory/COR0012-profile-images.md) and location baseline [DEV0178 — Manage coach training locations](../../archive/frontend/DEV0178-manage-coach-training-locations.md)

## Objective and context

Align personal account Profile and coach Profile/location editing with the approved authenticated interface while keeping the two identities and media scopes unmistakably separate.

## Scope and non-goals

- In scope: personal Profile heading/summary/avatar form, coach Profile active-tab frame, public-profile editor/preview, public portrait controls, training-location manager/map and publication/application states.
- Out of scope: identity/schema changes, new profile fields, merging private avatar with public portrait, provider changes or schedule/booking redesign.

## Expected behavior and edge cases

- Account-avatar navigation always opens personal Profile; approved/demo main Profile navigation opens coach Profile.
- Personal avatar remains private account presentation; coach portrait remains explicitly public media with initials fallback.
- Coach Profile is the first stable coach tab and keeps Profile/Schedule/Bookings navigation above the view-specific hero/content.
- Location list/map and primary-location semantics remain complete during map/search failure and on narrow screens.

## Assumptions, decisions, and dependencies

- DEV0203 supplies the shell; DEV0205 supplies shared coach page framing.
- Existing upload normalization, access gates, profile actions and location services remain authoritative.
- The preview's unsourced name/timezone editing and public-preview fields will not be added unless already backed by current contracts.

## Implementation plan

1. Recompose personal Profile using the authenticated account hierarchy and existing avatar capabilities.
2. Recompose coach Profile/editor/location surfaces in the shared coach frame.
3. Extend media-scope, actor-routing, map-failure and responsive tests.
4. Run relevant application/static/build validation.

## Acceptance criteria

- [ ] AC1: Personal and coach Profiles use the authenticated visual system while retaining distinct routes, authority and image privacy.
- [ ] AC2: Coach Profile remains the first stable coach tab and profile/location actions keep existing behavior.
- [ ] AC3: Missing images, application/suspension, provider failure and mobile layouts retain complete truthful controls/content.
- [ ] AC4: Relevant tests, lint, type-check, formatting and build pass.

## Validation plan

- Extend route/component tests for actor-aware Profile destinations and public/private image boundaries.
- Run authenticated client/coach Playwright for profile/avatar/portrait/location ready/failure states at mobile/desktop widths.
- Run application tests and static/build checks.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| Pending           | Pending.           |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

No schema/API/environment/dependency/migration change is planned.

## Validation results

Pending validation.

| Criterion | Evidence | Result  |
| --------- | -------- | ------- |
| AC1       | Pending  | Not run |
| AC2       | Pending  | Not run |
| AC3       | Pending  | Not run |
| AC4       | Pending  | Not run |

## Risks, limitations, and follow-ups

- Visual reuse must not blur the private account-avatar and public coach-portrait boundaries.
- Geoapify search remains optional; manual location entry and persisted lists remain the fallback.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed or released.
