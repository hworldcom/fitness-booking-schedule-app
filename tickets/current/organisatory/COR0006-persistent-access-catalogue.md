# Coordination COR0006: Persistent membership catalogue

- Status: In progress
- Created: 2026-09-24
- Last updated: 2026-09-26
- Milestone: M1 participating gym and membership-plan catalogue
- Converted from: Retired `DEV0017`
- Tracked development tickets: completed [DEV0067 — Add membership catalogue schema](../../archive/backend/DEV0067-membership-catalogue-schema.md) and [DEV0078 — Revise the multi-gym catalogue schema](../../archive/backend/DEV0078-revise-multigym-catalogue-schema.md); one required direct peer ticket identified below has not yet been created
- Related records: planned by [DEV0014](../../archive/backend/DEV0014-database-and-backend-plan.md); depends on completed database, identity and protected-context work; current contract adopted by [DEV0069](../../archive/organisatory/DEV0069-adopt-core-multigym-membership-mvp.md) and amended by [DEV0070](../../archive/organisatory/DEV0070-revise-multigym-plan-pricing.md); downstream membership delivery [COR0007](COR0007-core-multigym-membership-mvp.md); historical contracts [DEV0058](../../archive/organisatory/DEV0058-fitness-access-mvp-contract.md), [DEV0066](../../archive/organisatory/DEV0066-freeze-membership-product-rules.md) and [DEV0068](../../archive/organisatory/DEV0068-revise-subscription-and-pass-resale-contract.md)

## Objective and boundaries

Coordinate the shared persistent catalogue for the focused multi-gym membership MVP. Guests and signed-in users can discover fictional participating gyms and compare accurate versioned Basic/Classic plan terms. Authorized operators can manage private catalogue state without exposing drafts or deriving authority from client-supplied actor, dataset, gym or wallet identifiers.

The original DEV0017 draft combined schema, repositories, public browsing, editors, follows and bookmarks. Pre-implementation review split that work into focused tickets. The new product pivot narrows this coordination record further: it owns participating-gym and membership-plan catalogue data only. Membership activation, ownership, check-ins, payments, provisional allocation and social behavior belong to COR0007. Passes, resale and ordinary/sponsored events have left the MVP and require no catalogue ticket.

Catalogue publication never implies payment, membership ownership, reservation, attendance, allocation or payout. A backend outage must report failure rather than silently presenting fixtures as persistent data. This coordination record does not authorize runtime implementation; each row below needs its own DEV ticket.

## Direct development work

| Implementation part                                           | Development ticket                                                                                                  | Owned deliverable                                                                                                                                                               | Start condition or dependency                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Initial membership product storage                            | Completed [DEV0067 — Add membership catalogue schema](../../archive/backend/DEV0067-membership-catalogue-schema.md) | Historical product/version foundation, two obsolete private drafts, Drizzle mappings and database tests; no entitlement or UI                                                   | Delivered under the superseded DEV0066 contract                        |
| Multi-gym plan and gym-eligibility schema revision            | Completed [DEV0078 — Revise the multi-gym catalogue schema](../../archive/backend/DEV0078-revise-multigym-catalogue-schema.md) | Additive Basic/Classic version fields, participating-gym eligibility, fictional fixtures and retirement of obsolete draft publication paths without rewriting migration history | Delivered after DEV0069 and completed DEV0074/DEV0075 contracts        |
| Persistent catalogue services and preview-adapter replacement | Required backend-primary peer ticket not yet created                                                                | Safe public gym/plan projections, authorized catalogue mutations and replacement of DEV0074's preview adapter without redesigning its Explore/detail presentation               | After the schema revision and reviewed DEV0074 frontend read contracts |

Every direct ticket must link back to COR0006. No pass/event or social schema may be added under this record.

## Other relationships

- [DEV0069](../../archive/organisatory/DEV0069-adopt-core-multigym-membership-mvp.md) supplies the focused product contract and [DEV0070](../../archive/organisatory/DEV0070-revise-multigym-plan-pricing.md) supplies the latest price/allowance amendment; neither implements the catalogue.
- [COR0007](COR0007-core-multigym-membership-mvp.md) consumes published plan and gym eligibility. It owns selection, activation, check-ins, payments, allocation, gym/member operational views and social integration.
- Completed [DEV0074](../../archive/frontend/DEV0074-preview-multigym-discovery.md) owns the frontend plan/gym read contracts and preview discovery presentation under COR0007. It is a downstream consumer, not a direct COR0006 member; the catalogue service ticket replaces its fixture adapter without taking over its screen design.
- Completed [DEV0075](../../archive/frontend/DEV0075-preview-membership-selection.md) consumes those frontend contracts for a local draft selection. It does not create catalogue or membership state.
- DEV0067 remains valid historical implementation evidence. Its `Annual Unlimited` and `Flex 12` private drafts are obsolete and must not be published as Basic/Classic.
- Follows and explicitly shared check-ins belong to DEV0023 under COR0007, not to the catalogue.
- Archived DEV0066/DEV0068 preserve prior single-gym transfer and pass-resale decisions but do not define current persistence work.

## Delivery sequence and completion conditions

DEV0067 established the first product/version foundation. DEV0074 established the reviewed frontend read contract and clearly labelled preview adapter; the additive schema peer must now model Basic/Classic and gym eligibility with forward migration history. The public service peer follows that schema and replaces the preview adapter without duplicating or redesigning the frontend. COR0007 may build membership lifecycle contracts in parallel but cannot activate an offer that is draft, inactive or ineligible.

Complete COR0006 only after every mapped row has a direct DEV ticket that is Completed or explicitly Cancelled/replaced, guests and authenticated users receive the same safe published catalogue, obsolete drafts remain private/retired, authorized mutations are isolated and durable, and no catalogue row fabricates access or financial state.

Final integration must include anonymous/private-ID probes, two independent authenticated accounts, cross-dataset denial, role derivation, restart durability, conflict/retry behavior, backend failure, public filters/details, sign-out/cache isolation and mobile/desktop keyboard/error-state coverage. Direct DEV tickets own their exact commands and evidence.

## Progress and integration record

- 2026-09-24: Converted unimplemented DEV0017 after its schema, service, UI and overlay scope proved too broad for one implementation ticket.
- 2026-09-24: Completed DEV0067 as the first bounded schema slice with price-pending private drafts.
- 2026-09-25: DEV0068 revised those intended offers toward fixed-term subscription/pass-resale behavior, leaving an additive schema update necessary before publication.
- 2026-09-25: DEV0069 replaced that direction with Basic/Classic four-gym membership only. Pass/event and follow/bookmark rows were removed; membership operations and social moved to COR0007.
- 2026-09-25: DEV0074 was created under COR0007 to own preview discovery and stable frontend read contracts. COR0006 now limits its uncreated service peer to persistence, authority and adapter integration rather than duplicating the screen.
- 2026-09-26: DEV0078 began the forward Basic/Classic plan revision and seven-fictional-gym database representation after the user approved the seed scope. Public services and frontend adapter replacement remain a separate peer.
- 2026-09-26: DEV0078 completed the additive revision with published Basic/Classic terms, seven canonical fictional gym fixtures, explicit 5/7 eligibility, default-deny security and clean-replay/idempotency evidence. COR0006 remains open for the uncreated public service and preview-adapter peer.

## Validation results

DEV0069 checks the revised work map and links. Direct implementation validation belongs to the corresponding DEV records.

## Risks, limitations, and follow-ups

The private catalogue now represents €80 Basic, €150 Classic, €15 non-core access and four core gyms as configurable demo hypotheses, not production commitments. DEV0074's adapter must stay visibly preview-only until the service peer replaces it. Later services must not expose retired legacy rows or silently fall back to frontend fixtures during backend failure.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0067 and DEV0078 Completed; one required service peer not yet created.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: Work-map revision reviewed under DEV0069; no independent implementation review.
- Deployment or release: None.
