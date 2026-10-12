# Coordination COR0018: Authenticated workspace redesign

- Status: In progress
- Created: 2026-10-12
- Last updated: 2026-10-12
- Milestone: Scheduling interface authenticated-workspace follow-up
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: completed [DEV0202 — Adopt the authenticated workspace redesign contract](../../archive/organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md), completed [DEV0203 — Introduce the authenticated workspace shell](../../archive/frontend/DEV0203-introduce-authenticated-workspace-shell.md), completed [DEV0204 — Redesign client My sessions](../../archive/frontend/DEV0204-redesign-client-my-sessions.md), completed [DEV0205 — Redesign coach Schedule](../../archive/frontend/DEV0205-redesign-coach-schedule.md), completed [DEV0206 — Redesign coach Bookings](../../archive/frontend/DEV0206-redesign-coach-bookings.md), completed [DEV0207 — Redesign account and coach Profiles](../../archive/frontend/DEV0207-redesign-account-and-coach-profiles.md) and ready [DEV0208 — Polish authenticated workspace accessibility](../frontend/DEV0208-polish-authenticated-workspace-accessibility.md)
- Related records: public redesign [COR0017 — Public marketplace redesign](COR0017-public-marketplace-redesign.md), navigation baseline [DEV0153 — Separate client and coach navigation](../../archive/frontend/DEV0153-separate-client-and-coach-navigation.md), coach tab baseline [DEV0170 — Separate coach Schedule and Bookings tabs](../../archive/frontend/DEV0170-separate-coach-schedule-and-bookings-tabs.md) and navigation alignment [DEV0171 — Unify coach Profile navigation](../../archive/frontend/DEV0171-unify-coach-profile-navigation.md)

## Objective and boundaries

Coordinate the approved authenticated-interface direction so `My sessions`, `Coach workspace` and personal/coach Profile no longer fall back to the older visual system after a user leaves the redesigned public marketplace. Preserve all existing routes, actor capabilities, privacy boundaries, authoritative scheduling data, actions and failure states while applying one coherent authenticated layout at desktop and mobile widths.

This record coordinates peer development tickets and does not implement runtime behavior. The October authenticated interactive preview is visual input, not a data or navigation contract. Existing confirmed behavior wins where the concept is illustrative: coaches retain client capability and `My sessions`; coach pages keep stable `Profile → Schedule → Bookings` navigation; account Profile remains separately reachable through account-avatar controls.

## Direct development work

| Implementation part    | Development ticket                                                                                                                                     | Owned deliverable                                                                                                                        | Start condition or dependency          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Product contract       | [DEV0202 — Adopt the authenticated workspace redesign contract](../../archive/organisatory/DEV0202-adopt-authenticated-workspace-redesign-contract.md) | Add the confirmed visual/interaction boundary to the MVP specification and establish this complete flat work map.                        | Completed; DEV0203 is ready.           |
| Authenticated shell    | [DEV0203 — Introduce the authenticated workspace shell](../../archive/frontend/DEV0203-introduce-authenticated-workspace-shell.md)                     | Modernize shared private desktop/mobile navigation, framing and account controls without changing capability-aware destinations.         | Completed 2026-10-12.                  |
| Client sessions        | [DEV0204 — Redesign client My sessions](../../archive/frontend/DEV0204-redesign-client-my-sessions.md)                                                 | Recompose the client request, upcoming-session and history presentation around the approved authenticated visual hierarchy.              | Completed 2026-10-12.                  |
| Coach Schedule         | [DEV0205 — Redesign coach Schedule](../../archive/frontend/DEV0205-redesign-coach-schedule.md)                                                         | Apply the new workspace framing to location-aware draft editing and dated capacity without changing save or occurrence semantics.        | Completed 2026-10-12.                  |
| Coach Bookings         | [DEV0206 — Redesign coach Bookings](../../archive/frontend/DEV0206-redesign-coach-bookings.md)                                                         | Recompose request decisions, recent request history and confirmed booking cards while preserving private actor-scoped actions.           | Completed 2026-10-12.                  |
| Account/coach Profiles | [DEV0207 — Redesign account and coach Profiles](../../archive/frontend/DEV0207-redesign-account-and-coach-profiles.md)                                 | Align personal identity, public coach profile and location editing with the authenticated workspace while keeping media scopes distinct. | Completed 2026-10-12.                  |
| Integration polish     | [DEV0208 — Polish authenticated workspace accessibility](../frontend/DEV0208-polish-authenticated-workspace-accessibility.md)                          | Resolve cross-page responsive/accessibility defects and run the complete representative actor/state browser matrix.                      | Starts after DEV0203-DEV0207 complete. |

Every required authenticated redesign surface has exactly one direct development owner. These tickets are flat peers; delivery dependencies do not create child ticket hierarchies.

## Other relationships

- COR0017 owns only the public marketplace redesign. Its compact public header and public-flow validation are dependencies, not direct members of this coordination record.
- DEV0153 owns capability-aware primary destinations. This redesign changes presentation only and must not expose coach links to ordinary, pending or rejected accounts.
- DEV0170-DEV0172 own the stable coach Profile/Schedule/Bookings information architecture and header order. The concept preview's illustrative four-tab workspace is not adopted.
- Existing booking-request, location, availability and profile-image tickets remain the behavior/privacy baselines. No peer here changes their server contracts.

## Delivery sequence and completion conditions

1. DEV0202 records the authoritative authenticated design boundary and resolves preview-versus-product differences.
2. DEV0203 modernizes shared private chrome before page-specific work.
3. DEV0204 and DEV0205 may proceed after the shell; sequential delivery is preferred because both touch shared responsive styles.
4. DEV0206 follows the coach framing established by DEV0205; DEV0207 follows the shell and coach framing.
5. DEV0208 runs only after all page tickets meet their own criteria.
6. Complete this coordination only when every direct ticket is Completed or explicitly cancelled/replaced and ordinary-client, approved-coach, suspended/unavailable, desktop/mobile and keyboard flows pass without a scheduling or privacy regression.

## Progress and integration record

- 2026-10-12: A live review found that the redesigned public header links into the unchanged authenticated interface. Investigation confirmed this was a planning gap: COR0017 deliberately preserved old private presentation even though the later authenticated preview had been approved.
- 2026-10-12: Created a separate authenticated workstream rather than expanding DEV0201 beyond its public accessibility scope. The adopted direction preserves actual routes and actor permissions and treats the preview as visual input only.
- 2026-10-12: DEV0202 completed the authenticated design contract and flat DEV0203-DEV0208 work map. Formatting, 263 relative links, unique headings, reciprocal membership, index counters and contract assertions passed; DEV0203 is ready for visible shell implementation.
- 2026-10-12: DEV0203 started the shared authenticated desktop/mobile shell implementation. Actor-derived destinations, public/private route separation and personal Profile avatar routing remain behavioral invariants.
- 2026-10-12: DEV0203 completed the forest desktop workspace sidebar, compact private header, capability-derived mobile navigation and signed-in client/browser validation. Public marketplace chrome remained isolated; DEV0204 is now ready to modernize the My sessions interior.
- 2026-10-12: DEV0204 started the My sessions interior redesign after signed-in visual evidence confirmed the remaining legacy stacked-panel transition.
- 2026-10-12: DEV0204 completed the unified My sessions hierarchy, responsive request/booking rows and coach-as-client context. Node 24 development and production lifecycle rehearsals passed; DEV0205 is ready for the Coach Schedule interior.
- 2026-10-12: DEV0205 started the shared coach heading/tabs and Schedule redesign while preserving the existing location-aware draft/save contract.
- 2026-10-12: DEV0205 completed the shared paper workspace heading, truthful publication summary, stable real tabs and responsive weekly editor/dated-capacity presentation. The full location-aware save/conflict/closed-state rehearsal passed; DEV0206 is ready to modernize Bookings inside this frame.
- 2026-10-12: DEV0206 started the Bookings interior redesign after the shared coach frame was committed and its Schedule workflow passed.
- 2026-10-12: DEV0206 completed the distinct request, terminal-history and booked-session hierarchy with responsive full-width rows. The authenticated 24-request decision/closure/booking rehearsal passed; DEV0207 is ready to align account and coach Profiles.
- 2026-10-12: DEV0207 started the Account Profile and Coach Profile/location redesign. Existing private-avatar/public-portrait boundaries, profile/location actions and provider fallbacks remain authoritative; unsupported concept-only account fields will not be introduced.
- 2026-10-12: DEV0207 completed the private Account Profile and public Coach Profile/location visual alignment, extracted one shared coach heading and added a real-data draft/public preview. Component/application checks, five authenticated rehearsals, targeted map/provider tests, desktop/mobile screenshot review and the production build passed; DEV0208 is ready for the final integration accessibility matrix.

## Validation results

- DEV0202 contract validation completed on 2026-10-12: Prettier and diff checks passed; a targeted validator resolved 263 local links and confirmed unique record IDs, reciprocal COR0018 membership, one index row per DEV, next IDs DEV0209/COR0019 and preserved navigation/privacy requirements.
- DEV0207 validation completed on 2026-10-12: 133 application tests, focused Profile tests, auth/profile/location/availability/request rehearsals, targeted desktop/mobile map anchoring and provider-failure tests, lint, type-check, formatting, diff check, build and visual review passed. Its ticket records the corrected profile-image cleanup assumption and the remaining stale public CTA assertion for integration follow-up.
- Runtime validation will be accumulated from DEV0203-DEV0208; no coordination-only result substitutes for those ticket records.

## Risks, limitations, and follow-ups

- Shared legacy CSS spans private routes, so each page ticket must prevent accidental public-marketplace regressions and avoid unbounded selector rewrites.
- Authenticated test fixtures require local Supabase Auth/PostgreSQL and representative client/coach accounts; DEV0208 must distinguish environment failures from interface failures.
- Session notes remain a separate future workflow under COR0015 and are not implied by visual `View details` or `View notes` examples in the concept.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0202-DEV0207 Completed; DEV0208 Ready.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: Authenticated preview was approved in conversation; no independent implementation review exists.
- Deployment or release: Not deployed or released.
