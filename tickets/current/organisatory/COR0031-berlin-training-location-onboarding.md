# Coordination COR0031: Berlin training-location onboarding

- Status: In progress
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: UAT coach onboarding
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: DEV0376, DEV0377
- Related records: Historical UAT/search baseline DEV0372 and DEV0375; these are not direct members.

## Objective and boundaries

Deliver the user's UAT request: Chimosa replaces the fictional reviewed gym choices; gym search comes first, a separate own-address option remains, and both searches cover Berlin. This record coordinates two peer tasks and implements no runtime behavior. The current contract remains in [the specification](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity).

## Direct development work

| Implementation part | Development ticket | Owned deliverable | Start condition or dependency |
| --- | --- | --- | --- |
| UAT reviewed gym catalog | [DEV0376](../backend/DEV0376-curate-uat-reviewed-gym-catalog.md) | Retire seven exact fictional choices, add verified Chimosa, prove unrelated data preservation | Explicit user authorization and inspected UAT inventory |
| Search behavior and hosted interface | [DEV0377](../frontend/DEV0377-separate-berlin-gym-and-address-search.md) | Gym-first and own-address modes, Berlin restrictions, tests/specification and UAT release | User clarification received: gym first, own address second |

No required development ticket is missing. Both direct members link back here.

## Other relationships

[DEV0375](../../archive/backend/DEV0375-enable-uat-gym-and-place-search.md) supplies the live key/configuration baseline; [DEV0372](../../archive/organisatory/DEV0372-deploy-reviewed-release-to-uat.md) supplies the dedicated UAT project. Independent coach approval DEV0374 is preserved and outside this work.

## Delivery sequence and completion conditions

The catalog operation can finish independently of source changes. Perform its rollback rehearsal and bounded transaction first, then ship the tested search source through the existing Preview project in Frankfurt. Final desktop/phone UAT validation must see Chimosa as the sole selectable reviewed gym, gym-first lookup, separate Berlin address lookup and usable manual fallback. Complete only when both DEV tickets are Completed and integration evidence passes. Do not reset seeds, edit retained coach content, change production/staging, or save a user's draft during QA.

## Progress and integration record

2026-10-19: Read-only UAT inventory found seven active fictional gyms, one active dataset and five profile/location references. Official Chimosa address and actual Geoapify coordinates agree. The user clarified that gym search should be the first option and adding an own address the second. No implementation had begun at planning time.

## Validation results

Work map and links reviewed at creation. Final integration pending; ticket-specific evidence belongs to each DEV record.

## Risks, limitations, and follow-ups

Provider coverage is incomplete and outside MovX control. Retired catalog records remain for existing history. No change to retained coach accounts or their location snapshots is authorized.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: Both In progress.
- Commit: Not applicable — coordination IDs never appear in commit subjects.
- Review: Planning self-review; final integration pending.
- Deployment or release: Pending.
