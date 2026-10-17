# Ticket DEV0331: Enable username-based public coach URLs

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M10 — Coach marketplace websites (planned)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Amendment [DEV0330](../../archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md); implemented username enrollment [DEV0325](../../archive/backend/DEV0325-collect-registration-names-and-unique-username.md); existing Account username [DEV0295](../frontend/DEV0295-refine-account-names-and-section-navigation.md); independent remaining username policy [DEV0296](../organisatory/DEV0296-define-username-login-and-profile-url-contract.md); card/page/editor consumers [DEV0316](../frontend/DEV0316-redesign-coach-directory-cards.md), [DEV0317](../frontend/DEV0317-build-shareable-personal-coach-websites.md), [DEV0315](../frontend/DEV0315-edit-and-preview-coach-websites.md).

## Objective and context

Usernames are canonicalized, stored and unique under the current Account/registration implementation, but public coaches still resolve by a separate slug. The user now selected username-based public coach URLs. Implement the narrow public resolver, route and compatibility behavior in [section 19.6](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility), preserving internal coach/account identity and private account fields.

## Scope and non-goals

- In scope: reuse the existing canonical username as a public coach handle; `/@username` route/resolver; old `/coaches/[slug]` compatibility; owner-visible URL capability/result; narrowly needed Account username-write and claim-reservation integration; rename aliases/takeover defense; missing legacy handle recovery and fresh/upgrade migration/rollback evidence.
- Out of scope: username login, public athlete/account directory, a new canonical handle column, private-name exposure, full website/card layout or share metadata, custom domains, changing authentication authority and media decisions.

## Expected behavior and edge cases

Only a visible approved/demo coach resolves publicly. Hidden, pending/rejected, non-coach, missing and unknown handles return indistinguishable public unavailable/not-found outcomes. A deliberately published coach handle is the sole planned disclosure exception to owner-only stored usernames; legal name, email and unrelated private details remain private.

Canonical usernames reuse current lowercase 3–30-character syntax/normalization and the existing Account uniqueness constraint. The `/@username` namespace avoids ambiguous collisions with old coach slugs. Legacy coaches without usernames keep old pages and receive an owner prompt to claim a handle; never derive one from a private name or silently unpublish them. When available, old slug links redirect to the same coach's current username URL with only safe date/section continuation.

Renaming retains previously published handles as aliases reserved to the same owner; no other signup or Account edit may take them. Keep the current username in its existing field, using a narrow published-handle registry only for public-route ownership/aliases. Claims/rename/alias registration are atomic across signup and Account writes. Clearing a published current handle requires an explicit replacement. Aliases recheck visibility and never restore a hidden coach. Handle changes do not alter coach IDs, bookings, review-pair identity, messages or existing group records.

## Assumptions, decisions, and dependencies

Confirmed: public coach URLs use usernames. Adopted defaults: `/@username`, retained old-slug compatibility, same-owner published aliases and clear replacement feedback. Username login and non-coach URL policy remain independent DEV0296 work. This is future implementation only; DEV0325 proves stored handles, not these routes.

Starts after DEV0330's contract and current DEV0295/DEV0325 username behavior are reviewed. Coordinate narrowly with their in-progress Account/Auth consumers; preserve unrelated edits. Can proceed independently of media and content/rate/review implementation. DEV0316 consumes the public URL projection, DEV0317 owns metadata/share controls, DEV0315 presents the owner URL/claim guidance, and DEV0319 owns combined proof. Media allowance questions do not block this ticket or cards.

## Implementation plan

1. Inspect actual Account/signup username writes, current coach visibility/slug resolution and installed Next.js route/redirect docs. Record public/owner DTOs and route continuation rules before coding.
2. Design retained-data-safe published-handle ownership/alias constraints and canonical-field reuse; cover simultaneous signup/edit/rename claims without exposing a global public account lookup.
3. Implement guarded public resolution, canonical `/@username` entry and old-slug redirects with original identity and safe date/section state.
4. Integrate the necessary Account claim/rename guard and owner feedback for missing/cleared/published handles; keep existing non-coach/private username behavior compatible.
5. Prove fresh/upgrade migrations, missing/hidden/non-coach privacy, alias takeover/rename races, old links, actual routes and responsive/keyboard recovery. Document rollout/rollback order.

## Acceptance criteria

- [ ] AC1: A visible approved/demo coach resolves at their stored username route; hidden/unrelated/private-account information is never exposed and all identity/data IDs remain stable.
- [ ] AC2: Legacy no-handle coaches remain accessible, canonical/old-slug/date links resolve safely and owner claim/rename/replace feedback is truthful without deriving private-name handles.
- [ ] AC3: Published alias reservations and current canonical claims are enforced atomically across signup/Account writes; concurrent rename/claim cannot duplicate, take over or redirect another coach's public identity.
- [ ] AC4: Fresh/preserved-data migrations, route/privacy/continuation/race and real desktop/mobile/keyboard checks pass; outward URL contracts, setup/rollback and consumer handoff are recorded.

## Validation plan

Future runtime: isolated database/service fixtures for current/absent/renamed handles, same-name legacy slugs, hidden/applicant/non-coach states and concurrent signup/edit/alias claims. Inspect guest responses/metadata for private identity, and verify exact stable bookings/reviews/messages after rename. Exercise real `/@username` and legacy redirects, safe date/section state, missing-handle owner recovery and Account rename feedback at mobile/desktop widths with keyboard. Run meaningful affected tests, lint/typecheck/build and migration checks; record exact commands/environment then. Media/provider operations are not applicable to this routing slice.

Current checkpoint: documentation/link/namespace/ownership checks only under DEV0330. Runtime proof has not run.

## Implementation record

### Changes and rationale

2026-10-17: Created this Draft peer after the user selected username URLs. Existing stored handles are reused; no routing code or schema change has started.

### Affected files

Planned implementation areas, not edited runtime files:

| File or component                                                                                                                        | Planned role                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Account contracts](../../../src/account/contracts.ts) and [account schema](../../../src/server/db/schema/account.ts)                    | Existing normalization/canonical field and uniqueness boundary.             |
| [Registration input](../../../src/auth/registration-profile.ts) and [identity repository](../../../src/server/db/identity/repository.ts) | Preserve enrollment and coordinate published-alias claim checks.            |
| [Coach service](../../../src/server/coaches/service.ts) and [legacy route](../../../src/app/coaches/[slug]/page.tsx)                     | Public visibility/resolution and safe redirect compatibility.               |
| [Account settings](../../../src/features/account/account-settings.tsx)                                                                   | Narrow live-URL/rename feedback; private Account behavior remains separate. |

### Decisions and deviations

2026-10-17: Replaces the original M10 current-slug-only default. Public URLs are selected now; username authentication remains deferred. `/@username` and rename behavior are operating defaults, distinct from the user's selected username basis.

### Contracts, configuration, and operations

Planning only. No runtime interface, migration, environment, account, credential or deployment changed. Record actual registry schema, canonical claim integration, safe redirect/cache rules, rollout/rollback and compatibility before implementation.

## Validation results

- Date/environment: 2026-10-17 planning.
- Runtime/application/database/browser checks: Not run — Draft feature work.
- Documentation checks: final results recorded under DEV0330.

| Criterion | Evidence                                                               | Result  |
| --------- | ---------------------------------------------------------------------- | ------- |
| AC1–AC4   | Future actual routing/privacy/migration/concurrency evidence required. | Not run |

## Risks, limitations, and follow-ups

Usernames are implemented as saved unique values, while public routes remain future work. Coordinate Account/signup writes carefully so old public aliases cannot be taken over. Media decisions are deferred until cards complete and are not this ticket's prerequisite. Next: inspect current contracts/docs and satisfy start dependencies before runtime edits.

## Completion and review references

- Completed: Not completed — Draft.
- Commit: Not created; not requested.
- Review: Planning self-review under DEV0330 only; no independent/runtime review.
- Deployment or release: None.
