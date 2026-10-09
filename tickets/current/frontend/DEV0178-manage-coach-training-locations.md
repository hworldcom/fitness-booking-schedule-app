# Ticket DEV0178: Manage coach training locations

- Status: Draft
- Created: 2026-10-09
- Last updated: 2026-10-09
- Milestone: Scheduling-only multi-location follow-up
- Coordination: [COR0014 — Multi-location coach scheduling](../organisatory/COR0014-multi-location-coach-scheduling.md)
- Related records: depends on completed [DEV0175 — Adopt the multi-location coach scheduling contract](../../archive/organisatory/DEV0175-adopt-multi-location-coach-scheduling-contract.md) and [DEV0176 — Persist coach training locations](../../archive/backend/DEV0176-persist-coach-training-locations.md); supplies [DEV0179 — Edit a location-aware working week](DEV0179-edit-location-aware-working-week.md) and [DEV0180 — Pin coaches at primary locations](DEV0180-pin-coaches-at-primary-locations.md); reuses the provider-neutral location interface from [DEV0174](../../archive/frontend/DEV0174-decouple-location-services.md)

## Objective and context

Replace the coach Profile's single training-place field with an accessible location manager. Approved/demo coaches and eligible applicants can add multiple gym or independent locations, inspect their status, edit bounded public metadata, select one active primary location and safely deactivate locations. Public profiles show all active training locations without implying live presence.

## Scope and non-goals

- In scope: owner Profile location list/cards; add/search/manual-confirm flow through the existing provider-neutral module; explicit edit/save; primary selection; safe deactivate/replacement interaction; ordering and status feedback; publication gating; all-active-locations public profile section; pending/rejected/approved/suspended capability handling; responsive, keyboard and failure-state tests.
- Out of scope: persistence and mutation authority (DEV0176), schedule assignment (DEV0179), Explore map rendering (DEV0180), global point-of-interest administration, gym ownership, live location, image changes, travel times or native UI.

## Expected behavior and edge cases

- The owner sees every active location and any inactive location needed for bounded historical context, with one unambiguous Primary badge.
- Adding a location uses a reviewed gym choice, storage-permitted provider result or manual confirmation through the provider-neutral boundary; map/search failure leaves manual entry usable.
- Location edits remain local until an explicit save. Loading, conflict, validation and unavailable states do not present unsaved input as persisted.
- Selecting a new primary saves atomically and updates the badge. The interface never allows two primaries.
- Deactivating a non-primary location explains the effect on future open availability. A primary requires selecting a replacement in the same flow.
- The interface does not offer destructive deletion for referenced locations and does not expose database/provider identifiers as authority.
- A visible profile cannot be published without one confirmed active primary location. Pending/rejected applicants may prepare only the contract-approved private draft; suspended coaches cannot publish location changes.
- The public coach profile lists all active locations and clearly labels the primary one. It does not expose inactive locations or claim the coach is presently there.

## Assumptions, decisions, and dependencies

- DEV0176 provides authorized location mutations and multi-location projections; the browser never writes tables directly.
- Reuse `src/location/` contracts and components. UI code may depend on the provider-neutral boundary but not directly on Geoapify, OpenFreeMap or MapLibre implementations.
- Proposed default: present compact location cards ordered primary first and then stable coach order, with separate `Set as primary`, `Edit` and `Deactivate` actions. Confirm exact copy/accessibility during implementation.
- Proposed default: a coach-owned external search selection stores a bounded snapshot only; it does not add a shared `app.gyms` catalogue record.
- One coach scheduling timezone remains visible at profile level. This ticket does not provide a separate recurrence timezone per location.

## Implementation plan

1. Replace the singleton editor section with a list/manager using stable location IDs and explicit action states.
2. Reuse the existing search/map/manual picker to create confirmed provider-neutral location input.
3. Add edit, primary replacement and deactivate flows with conflict/unavailable recovery and truthful schedule-impact copy.
4. Update publication gating and profile summary to require and identify one active primary.
5. Present all active locations on the public coach profile with primary labeling and provider-neutral map/list fallback as appropriate.
6. Add component/action tests plus desktop/mobile/keyboard manual or browser automation evidence.

## Acceptance criteria

- [ ] AC1: An authorized coach can add and edit multiple confirmed locations through provider-neutral search or manual fallback, with no mutation before explicit save.
- [ ] AC2: The coach can choose exactly one primary location and cannot deactivate it without a valid replacement; conflicts preserve recoverable input.
- [ ] AC3: Capability and publication gates prevent unauthorized, suspended or incomplete profiles from publishing location changes.
- [ ] AC4: The public profile shows all and only active locations, labels the primary location and never implies live presence or global gym ownership.
- [ ] AC5: Responsive desktop/mobile, keyboard, error-state, component/action, lint, type and build checks pass.

## Validation plan

Add focused validation/action/component tests and browser scenarios for approved, pending, rejected, suspended and unrelated accounts. Rehearse add via search, manual fallback, edit, set-primary, attempted primary deactivation, replacement plus deactivation, stale conflict, service failure and reload. Verify desktop and mobile widths, labels/focus order, keyboard-only control and public-profile output. Run relevant unit, lint, type and build commands.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                                                              | Change and purpose                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `src/features/coaches/coach-profile-editor.tsx`                                | Planned multi-location owner manager.                      |
| `src/features/coaches/coach-location-picker.tsx` and `src/location/` consumers | Planned reusable search/map/manual add flow.               |
| Coach profile routes/actions/services                                          | Planned bounded location action integration.               |
| Public coach profile components                                                | Planned active-location presentation.                      |
| CSS and focused/browser tests                                                  | Planned responsive, accessible and failure-state evidence. |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Consumes DEV0176's location contracts and existing optional Geoapify configuration. No additional provider key, browser-secret or storage service is planned.

## Validation results

Pending validation.

| Criterion | Evidence                                | Result  |
| --------- | --------------------------------------- | ------- |
| AC1       | Add/edit/manual fallback scenarios      | Not run |
| AC2       | Primary/deactivation/conflict scenarios | Not run |
| AC3       | Capability/publication tests            | Not run |
| AC4       | Public profile review                   | Not run |
| AC5       | Responsive/accessibility/command matrix | Not run |

## Risks, limitations, and follow-ups

The location manager can become dense on mobile. Prefer progressive disclosure for edit details while keeping primary/status/action labels visible. Search-provider attribution and storage provenance must remain correct even when search is unavailable.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not deployed.
