# Ticket DEV0363: Refresh core coach website delivery plan

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: M10 — Coach marketplace website planning
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../../current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Amended core page [DEV0317](../../current/frontend/DEV0317-build-shareable-personal-coach-websites.md), combined proof [DEV0319](../../current/backend/DEV0319-rehearse-coach-marketplace-websites.md), independent later media [DEV0297](../../current/backend/DEV0297-add-coach-profile-photos-and-mux-video.md), completed booking baseline [COR0029](COR0029-session-types-and-flexible-bookings.md).

## Objective and context

The user confirmed updating the public coach-page plan after reviewing that DEV0317 remains unimplemented. Its older scope combines core page composition with a future gallery dependency and predates delivered duration-aware session types. Record the approved core-first delivery boundary in the [current contract](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites) and reciprocal work records. This ticket owns documentation only; it does not implement the page or media.

## Scope and non-goals

- In scope: refresh DEV0317 scope/plan/criteria, COR0028 work map/sequence/completion, DEV0319 core integration proof, DEV0297 later public-media ownership, current specification and index. Preserve historical decisions and completed records.
- Out of scope: application/test/configuration/schema edits, running or implementing DEV0317, choosing gallery/video entitlements or quotas, new media/backend pipelines, credentials/demo data, migrations, provider settings, commits and deployment.

## Expected behavior and edge cases

The core public page can be implemented after its completed content/rate/review/routing/editor/card prerequisites, using the existing banner/portrait. It includes public content, truthful service/booking/group actions, locations, consented public reviews, FAQs, username metadata/sharing and responsive current-palette navigation. Typed 60/75/90-minute booking, genuinely empty catalogs, booking-only failures and legacy compatibility remain authoritative. Gallery/video/public-media composition belongs to later DEV0297 work and does not block core-page or COR0028 completion. No deferred feature is claimed delivered or discarded.

## Assumptions, decisions, and dependencies

Confirmed 2026-10-19: update the discussed core-first plan, keeping gallery/video later and aligning booking with the delivered session-type flow. Existing media selections/open questions remain as recorded in DEV0297. Adopted planning organization: retain DEV0317 as one public-page composition slice over delivered services; retain DEV0319 as independent combined proof and DEV0297 as external follow-up. Runtime tickets stay Draft because this request is planning only. No new runtime ticket or coordination hierarchy is needed.

## Implementation plan

1. Record this documentary ticket/index before editing the contract or other records; verify unused ID and direct COR membership.
2. Rewrite DEV0317's future plan with concrete public-only sections/data sources, booking compatibility, metadata/share/privacy and acceptance evidence; preserve dated history.
3. Update COR0028, DEV0319 and DEV0297 to assign exactly one owner to core composition, combined proof and later public media; remove obsolete media completion gates without dropping the future feature.
4. Update relevant specification/milestone/definition-of-done/acceptance references and the ticket index, distinguishing confirmed scope from defaults and pending runtime.
5. Validate local links/anchors, unique identifiers, reciprocal coordination, lifecycle/status consistency, media/booking boundary wording, whitespace and documentation-only scope; finish/archive this documentary record after all criteria pass.

## Acceptance criteria

- [x] AC1: DEV0317 has concrete core-page scope, implementation order, dependencies, edge cases and testable acceptance criteria, with no gallery/video prerequisite.
- [x] AC2: COR0028, DEV0319, DEV0297 and the specification agree on core-first delivery, unique ownership and core completion independent of later media.
- [x] AC3: Delivered session-type/legacy/empty/unavailable booking behavior, optional price privacy, pair-review identity, public URLs and retained-data boundaries are preserved in the plan.
- [x] AC4: Links/anchors, IDs, membership, statuses, index, implementation record and documentation-only scope checks pass; no runtime/deployment claim.

## Validation plan

Run a scoped Python Markdown link/anchor and record-consistency check across the changed files; inspect media completion statements and changed plan/spec/index excerpts with `rg`; run scoped `git diff --check`. Compare owned before/after document snapshots and review the files written by this task to isolate this amendment from pre-existing shared work. Application tests, builds, browser and database/provider rehearsals are not applicable: no runtime/configuration/schema/data edits.

## Implementation record

Planning amendment reviewed and completed as one documentary task. No application implementation was authorized or started.

### Changes and rationale

The prior DEV0317 plan required later gallery integration and used assumptions from before session-type delivery. Refreshed it as the core public-page composition using the current banner/portrait and delivered content/rate/review/URL/editor/card services. The plan now specifies real page sections, private/group service boundaries, typed/empty/unavailable/legacy booking, safe public metadata/sharing, stable booking/reviews anchors and testable responsive/privacy/failure criteria.

COR0028 and DEV0319 now complete on the combined core outcome without waiting for gallery/video. DEV0297 remains the sole later media authoring/provider/component/public-composition owner, with its six-photo/one-Mux-video selections and unresolved policy/budget decisions preserved. The current specification's decision register, definition of done, milestone, acceptance row and section 19 match that boundary. Preserved dated 17/18 October history; recorded the accepted 19 October amendment rather than treating old media requirements as passed work.

DEV0317, DEV0319 and DEV0297 retain Draft status and unchecked runtime criteria. Their completed local foundations are recorded as start dependencies, with DEV0318 public-review integration and DEV0319 combined proof downstream of the core page. This request changed planning only.

### Affected files

| File | Role |
| --- | --- |
| [DEV0317](../../current/frontend/DEV0317-build-shareable-personal-coach-websites.md) | Actionable core public-template/data/booking/share plan, dependencies, edge cases and AC1–AC5; runtime remains unstarted. |
| [COR0028](../../current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md) | Twelve-member flat work map, start order, explicit media follow-up and core completion criteria. |
| [DEV0319](../../current/backend/DEV0319-rehearse-coach-marketplace-websites.md) | Combined core/privacy/review/URL/current-booking proof, with gallery/video excluded as a gate. |
| [DEV0297](../../current/backend/DEV0297-add-coach-profile-photos-and-mux-video.md) | Later media/public-composition ownership and core-template dependency, preserving confirmed selections/open questions. |
| [Specification](../../../docs/mvp-spec.md) | Single current core-first contract and delivered session-type compatibility, including milestone/definition-of-done/acceptance alignment. |
| [Index](../../README.md) | Planning-ticket allocation/lifecycle, updated runtime scope summaries and unchanged runtime statuses. |

### Decisions and deviations

2026-10-19: use a dedicated direct COR0028 documentary member for the cross-record amendment, maintaining flat ownership. DEV0317 stays one coherent page-composition slice over existing services; any independent new authority/schema capability discovered later requires its own scoped dependency before implementation. Runtime remains unstarted because the current user request is planning only. No new media-policy decision or other deviation.

### Contracts, configuration, and operations

Delivery-plan/specification amendment only. No runtime API/data/schema/package/environment/migration/credential/demo-data change.

## Validation results

2026-10-19, repository documentation only.

- `python3 /tmp/dev0363/validate-plan.py`: passed local targets/anchors, prefixed-record uniqueness, reciprocal twelve-member COR0028 map, index paths/statuses, current/archive lifecycle and scoped whitespace. Final post-archive result: **7 documents, 526 local links, 41 Markdown anchors, 278 unique records and 12 reciprocal direct members**; DEV0317/DEV0319/DEV0297 remain current Draft records.
- The same check compares unchanged specification C43 media selections, the complete section 18.6 booking contract, section 19.4 review contract and DEV0297 confirmed/open-decision subsection against `/tmp/dev0363/before/`; all are preserved byte-for-byte. No new quota/premium or booking/review rule is selected.
- Scoped `git diff --check` passed for the seven owned Markdown records. Reviewed before/after document diffs and targeted `rg` media/completion/status statements: core composition, later public media and combined proof each have one owner; original dated histories remain. The twelve direct members comprise three documentary records and nine runtime peers; DEV0317/DEV0319/DEV0297 stay Draft with no completed runtime acceptance criteria.
- Application tests, lint/build/types, browser, database, Auth/Storage/Mux and deployment checks: not run — no application/configuration/schema/provider/data changes. Existing unrelated working-tree implementation and archived completed records were preserved. The pre-edit snapshots explain the owned documentary delta; no runtime evidence is inferred from these checks.

2026-10-19 commit preparation: the seven-file documentary snapshot over `cc050b4` passed 510 local links, 41 anchors, 268 committed work records and twelve reciprocal members. Confirmed media and current booking/review contracts remain unchanged; unrelated pending discovery/Events/How it works/authentication edits are excluded. Record-count differences from the original workspace check reflect excluded pending records.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Refreshed core-only scope/steps/dependencies/AC1–AC5 with actionable public data and error cases | Passed |
| AC2 | Reciprocal flat work map, core completion conditions, DEV0319/DEV0297 boundary and matching specification | Passed |
| AC3 | Typed/empty/unavailable/legacy contract preserved; optional price/public review/URL/data rules retained; no new media policy | Passed |
| AC4 | Final link/anchor/ID/status/lifecycle/whitespace and documentation-only scope review | Passed |

## Risks, limitations, and follow-ups

The public website remains on its older layout until DEV0317 is separately implemented. Media decisions/capability and hosted rollout remain separate. Preserve unrelated working-tree changes.

## Completion and review references

- Completed: 2026-10-19 — core public-page plan, current booking compatibility, independent later media and core combined-proof boundary aligned across the current contract/work records.
- Commit: User-requested on 2026-10-19; included in `[DEV0363] Refresh core coach website delivery plan`.
- Review: Planning scope/ownership/acceptance self-review passed; no independent or runtime review.
- Deployment or release: None.
