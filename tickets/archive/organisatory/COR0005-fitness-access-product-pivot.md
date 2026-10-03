# Coordination COR0005: Fitness-access product pivot

- Status: Completed
- Created: 2026-09-24
- Last updated: 2026-09-24
- Milestone: MVP product pivot and public presentation
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: completed [DEV0058 — Adopt the fitness-access MVP contract](DEV0058-fitness-access-mvp-contract.md); completed [DEV0059 — Rewrite public positioning and How it works](../frontend/DEV0059-rewrite-public-positioning-and-guide.md); completed [DEV0060 — Replace challenge surfaces with access navigation](../frontend/DEV0060-replace-challenge-surfaces-with-access-navigation.md); completed [DEV0061 — Emphasize user and business benefits](../frontend/DEV0061-emphasize-user-and-business-benefits.md); completed [DEV0062 — Refine guide opening proposition](../frontend/DEV0062-refine-guide-opening-proposition.md)
- Related records: revises completed [DEV0005 — Consolidate the community fitness MVP](DEV0005-consolidate-community-fitness-mvp.md), [DEV0020 — Discovery improvements and How it works](../frontend/DEV0020-discovery-and-how-it-works.md), [DEV0022 — Social contract and delivery plan](../backend/DEV0022-social-contract-and-delivery-plan.md), [DEV0048 — Remove gym membership access](../backend/DEV0048-remove-gym-membership-access.md), and [DEV0053 — Distinct personal and club guide](../frontend/DEV0053-distinct-personal-and-club-guide.md); the affected DEV0017 plan later converted to [COR0006](./COR0006-persistent-access-catalogue.md), while cancelled [DEV0018](../backend/DEV0018-class-pass-reservations-and-confirmed-visits.md), [DEV0023](../backend/DEV0023-minimal-shared-activity-feed.md), and cancelled [DEV0024](../blockchain/DEV0024-verified-challenge-activity.md) retain their records

## Objective and boundaries

Coordinate the 24 September 2026 product decision to focus MovX Club on flexible fitness access and lightweight participation-based community. The retained product families are programmable memberships, class or visit passes, ordinary events and sponsored events. Challenge creation, voting, prize pools and winner settlement leave the current MVP. The social layer remains deliberately small and has no reactions, comments, general-purpose posts or engagement ranking.

This record is the durable pivot map, not a second product specification and not authorization to implement runtime behavior. [The MVP specification](../../../docs/mvp-spec.md) remains the single current product contract. Archived tickets preserve the superseded challenge-first and no-membership decisions as history rather than being rewritten.

The first coordinated delivery covers the product-contract reconciliation and current public-interface transition. Persistent membership storage, Solana membership-program delivery, transferable-entitlement recovery, event-sponsorship settlement and production business operations require later development tickets after their unresolved rules are frozen; they are not implemented under this coordination record by implication.

## Direct development work

| Implementation part                              | Development ticket                                                                                                                      | Owned deliverable                                                                                                                                                              | Start condition or dependency |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Product contract and planning reconciliation     | [DEV0058 — Adopt the fitness-access MVP contract](DEV0058-fitness-access-mvp-contract.md)                                               | Replace the challenge-first contract with memberships, passes, events, sponsored events and reaction-free social boundaries; reconcile current planning records                | Completed 24 September 2026   |
| Public product description and guide             | [DEV0059 — Rewrite public positioning and How it works](../frontend/DEV0059-rewrite-public-positioning-and-guide.md)                    | Rewrite and redesign the public proposition, audience explanation, access-product walkthrough, honest status labels and calls to action                                        | Completed 24 September 2026   |
| Current challenge/reaction interface retirement  | [DEV0060 — Replace challenge surfaces with access navigation](../frontend/DEV0060-replace-challenge-surfaces-with-access-navigation.md) | Remove current challenge and reaction-oriented navigation/content, introduce the agreed access-focused information architecture and preserve safe legacy browser data handling | Completed 24 September 2026   |
| Audience-benefit and fee-transparency refinement | [DEV0061 — Emphasize user and business benefits](../frontend/DEV0061-emphasize-user-and-business-benefits.md)                           | Make transferable access, participation-based community and minimal, predictable business costs explicit without claiming zero network cost                                    | Completed 24 September 2026   |
| Opening proposition refinement                   | [DEV0062 — Refine guide opening proposition](../frontend/DEV0062-refine-guide-opening-proposition.md)                                   | Use the user-selected member/business headline and supporting proposition in the first viewport                                                                                | Completed 24 September 2026   |

No development ticket yet owns persistent membership products/entitlements, the membership Solana program, paid transfer or transfer recovery, sponsored-event funding settlement, or production partner operations. These tickets must be created and reviewed before implementation after DEV0058 resolves or explicitly records the remaining policy questions.

## Other relationships

- DEV0017 remains the planned shared catalogue/draft foundation, but its challenge catalogue/draft scope must be removed and membership/pass/event discovery supplied instead.
- DEV0018 retains class-pass reservation, staff confirmation and visit evidence. Membership-derived access must not be added silently; it needs its own reviewed entitlement contract and then becomes an explicit upstream access source.
- DEV0023 remains the future minimal chronological activity delivery after its reaction work is removed. It is not a direct COR0005 implementation member because it delivers later backend behavior rather than the current presentation transition.
- DEV0024 was cancelled and archived by DEV0058 with its planning history intact after challenge activity left the MVP.
- Completed challenge and social tickets remain historical baselines. They do not authorize carrying superseded behavior forward.
- Existing identity, personal-wallet, club-wallet and hosted-staging work remains reusable infrastructure and does not itself grant membership, payment, sponsorship or redemption authority.

## Delivery sequence and completion conditions

1. DEV0058 updates the single product contract, records confirmed versus proposed membership/event choices, reconciles the README and current plans, and removes contradictory challenge/reaction requirements.
2. Once that language is stable, DEV0059 rewrites the website description and rebuilds the public guide around the access journey for people and fitness businesses.
3. DEV0060 may audit challenge/reaction surfaces in parallel after DEV0058, but its final navigation labels and destinations integrate with DEV0059.
4. DEV0061 sharpens the delivered guide's audience benefits and transparent-cost boundary without waiting for DEV0060's route cleanup.
5. DEV0062 applies the user-selected opening proposition over the validated DEV0061 benefit hierarchy.
6. COR0005 completes only when all five direct tickets are Completed or explicitly Cancelled/replaced, their reciprocal coordination links agree, challenge/reaction promises no longer appear in the current interface, and desktop/mobile public navigation and copy jointly describe the same access-focused MVP.

DEV0059 and DEV0060 may use independent branches after DEV0058 completes. They must integrate before either claims the public experience is coherent. Later backend/blockchain membership and sponsorship tickets are downstream work and do not block this presentation-focused coordination record unless added to its direct work map.

## Progress and integration record

- 2026-09-24: User confirmed a pivot to memberships, passes, events and sponsored events, removed challenge mode from the current direction, and requested a minimal social feed without reactions.
- 2026-09-24: Initial repository audit found challenge-first language in the README, MVP specification, primary navigation, How-it-works guide, catalogue/domain fixtures and current backend/blockchain plans. The guide also mixes product explanation, implementation status and detailed financial rules in one long page; DEV0059 owns that presentation problem rather than treating it as copy-only replacement.
- 2026-09-24: DEV0058 completed the authoritative contract/README revision, reconciled DEV0017/DEV0018/DEV0023, and cancelled/archived DEV0024. DEV0059 and DEV0060 are Ready; no interface code has changed yet.
- 2026-09-24: DEV0059 completed the access-focused public description and guide, aligned shell/metadata copy, and passed focused keyboard/responsive checks at desktop, tablet and mobile widths. DEV0060 remains Ready and owns the legacy challenge navigation and product surfaces.
- 2026-09-24: The user requested stronger audience benefits: transferable memberships and community for people; minimal fees, no transaction surprises and predictable costs for businesses. DEV0061 owns the guide refinement and distinguishes no MovX transaction surcharge from unavoidable disclosed network costs.
- 2026-09-24: DEV0061 completed that benefit refinement, added the C25/P13 fee boundary and passed the focused desktop/mobile guide and club checks with tablet/narrow screenshot inspection.
- 2026-09-24: The user selected a more balanced opening proposition naming flexibility for members and growth for fitness businesses; DEV0062 owns this bounded hero-copy refinement.
- 2026-09-24: DEV0062 applied that exact proposition and passed the focused responsive guide checks at desktop, tablet and mobile widths.
- 2026-09-24: DEV0060 began with the user-requested removal of the global Create a challenge sidebar action. Focused desktop/mobile navigation checks pass; the Challenges tab, routes and other challenge content remain outstanding under DEV0060.
- 2026-09-24: The user then requested removal of the Challenges tab and related code. DEV0060 completed the route, domain, fixture, storage, search, Home/Profile and styling cleanup; added the honest My Access destination; and passed the full configured desktop/mobile browser regression.
- 2026-09-24: All five direct tickets are completed. Integration review confirmed the public guide, Home and responsive navigation present the same access-focused MVP, legacy product URLs return 404, and no challenge/reaction promise remains in the current interface.

## Validation results

DEV0058–DEV0062 have matching reciprocal coordination links, unique IDs and completed archive placement. DEV0060 records the final 51-unit-test, 44-executed-browser-test, production-build and screenshot evidence. A repository-wide audit resolved all relative Markdown links after archival. The coordination completion conditions passed; persistent access products remain downstream work rather than an incomplete part of this presentation transition.

## Risks, limitations, and follow-ups

“Sponsored event” currently means an event funding variant in which a sponsor covers some or all attendee access; it does not mean a competition, winner or prize pool. The exact sponsor-to-host payment, ticket allocation, unused-fund return and cancellation contract remains unresolved and must not be invented by the presentation tickets.

Transferable membership policy also remains incomplete: gift versus resale, recipient acceptance, transfer fee, partial-use transfer, freeze/cancellation/refund authority, wallet replacement and staff redemption require explicit decisions before a program or persistent entitlement schema begins. DEV0059 may explain only the bounded confirmed concept and honest preview status.

## Completion and review references

- Completed: 2026-09-24.
- Direct development tickets: DEV0058 Completed; DEV0059 Completed; DEV0060 Completed; DEV0061 Completed; DEV0062 Completed.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: Initial coordination self-review only; no independent review.
- Deployment or release: None.
