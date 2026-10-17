# Ticket DEV0320: Adopt the coach marketplace website contract

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M10 — Coach marketplace websites (contract and planning)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../../current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Historical discovery [DEV0236](../frontend/DEV0236-align-explore-with-home-discovery.md); existing independent media plan [DEV0297](../../current/backend/DEV0297-add-coach-profile-photos-and-mux-video.md); independent future username URLs [DEV0296](../../current/organisatory/DEV0296-define-username-login-and-profile-url-contract.md).

## Objective and context

Record the user's 17 October 2026 agreement with richer directory cards and structured personal coach websites inspired by the reviewed Everfit directory and Kelly Colburn page. Create a flat, reviewable delivery map with directory cards and public coach pages owned by separate development tickets. The delivered product currently has compact cards and public biography/location/schedule pages; banners, richer content, private prices and booking-linked reviews are future work.

Use the [confirmed decision register](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions), [discovery flow](../../../docs/mvp-spec.md#42-discover-a-coach-and-time), [coach website contract](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites), [milestones](../../../docs/mvp-spec.md#12-delivery-milestones) and [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix).

## Scope and non-goals

- In scope: adopt the agreed direction in the specification, distinguish confirmed outcomes from implementation defaults, define safe presentation/pricing/review boundaries, create COR0028 and bounded peer tickets, reconcile earlier discovery exclusions, and validate documentation ownership/links/statuses.
- Out of scope: application code, database migrations, coach media/provider operations, hosted settings, external communications, deployment, commits, a general website builder and implementing any runtime peer during this request.

## Expected behavior and edge cases

Cards introduce the coach with public branding, place, short introduction, disciplines, service formats, real price units and actual rating/count. A shareable page expands those details into approach, experience, training media, services, locations, FAQs and schedule/contact actions. Missing fields and unavailable services remain truthful. Private identities, fake ratings, inferred prices and in-app payments are excluded. The current slug route remains usable; an optional account username is not a new public URL.

## Assumptions, decisions, and dependencies

Confirmed: the user accepted all points of the preceding reference review and explicitly requested separate card and page development tickets plus a coordination record. This request authorizes planning documents, not runtime work.

Adopted defaults to record separately in the specification: use the current public slug route and a structured template; initially support one optional fixed EUR price for the existing one-hour private format, with collection by the coach at the session; preserve reviewed price terms on saved requests/bookings; collect reviews only from the athlete on an elapsed, non-cancelled confirmed/completed private booking, with explicit public attribution consent. These operating details were not individually selected by the user.

DEV0297 retains gallery/Mux ownership and its unresolved video eligibility and photo-allowance questions. New work owns banners and integration slots, not a duplicate gallery engine. The gallery dependency must pass its still-photo scope review and delivery before the full photographic website outcome can complete; optional Mux video does not block this coordination. DEV0296 remains independent; existing coach slugs require no username decision.

## Implementation plan

1. Inspect current public cards/pages, specification exclusions, all record IDs/templates and existing media/username plans.
2. Add the accepted M10 target and explicit operating defaults to the specification without claiming delivery or overwriting earlier implementation evidence.
3. Create one flat COR with separate owners for public presentation persistence, private price terms, review authority, owner editing, directory cards, public websites, review composition and combined proof.
4. Validate local links/anchors, unique and retired IDs, index lifecycle, reciprocal membership, complete ownership and documentation scope. Complete/archive only this documentary ticket after these checks; keep runtime peers Draft.

## Acceptance criteria

- [x] AC1: The specification records the confirmed website/card outcome separately from defaults and delivered behavior, with testable content, price, review, privacy and compatibility boundaries.
- [x] AC2: COR0028 maps every required deliverable to one direct peer, separates cards from pages, names external dependencies and defines ordering, blockers and completion.
- [x] AC3: Each new runtime peer follows the development template, declares reciprocal membership, has bounded scope/acceptance/validation and remains Draft with no runtime claim.
- [x] AC4: Links/anchors, ID allocation, index/status consistency, formatting and scope review pass while unrelated workspace edits are preserved.

## Validation plan

Use a scoped standard-library Python documentation validator, focused Prettier checks on new records and `git diff --check`. Check existing specification references, all direct peer fields and work-map ownership, namespace uniqueness/retired IDs and final archive/index links. Compare pre-edit and final snapshots of existing shared documents to isolate this ticket's additions. Application/database/browser checks are not applicable to documentation-only planning.

## Implementation record

### Changes and rationale

2026-10-17: Adopted specification C45/section 19 and M10 after reviewing the existing compact-card/public-page implementation and independent media/username plans. Created COR0028 and eight Draft runtime peers with separate card/page ownership, real price-term/review authority, explicit external media/Storage dependencies and combined proof. Updated the work index/next identifiers and reconciled earlier discovery/review exclusions with the accepted future target. No runtime implementation started.

### Affected files

| File or component                                                                                                   | Change and purpose                                                 |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Specification](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites)                         | Single accepted future product contract and scenario boundaries.   |
| [COR0028](../../current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md) and its direct peers | Flat implementation ownership, dependencies and required evidence. |
| [Ticket index](../../README.md)                                                                                     | Record navigation, status and independent next-ID allocation.      |

### Decisions and deviations

2026-10-17 allocation correction: concurrent authentication planning established DEV0311/DEV0312 while these draft files were being prepared. Assigned fresh DEV0320 to this contract and DEV0321 to public content before finalizing the records; retained all uncontested DEV0313–DEV0319 IDs and the authentication records/edits. No established implementation history or retired identifier was reused.

2026-10-17: Use the existing coach slug and media-plan boundaries to avoid duplicating username routing or Mux/gallery work. Keep detailed operating choices labelled as adopted defaults. No runtime work or commit is included in this planning request.

### Contracts, configuration, and operations

This ticket changes the future product contract and planning documents only. No runtime interface/schema, migration, dependency, environment variable, account, secret, storage object or deployment changes. Each runtime peer must record its actual compatibility, rollout and rollback requirements when implemented.

## Validation results

- Date/environment: 2026-10-17, local repository planning; no runtime/provider operation.
- Passed `python3 /tmp/dev0311-planning/validate.py` before archival: 12 scoped documents, 508 local links, 62 anchors, 233 unique work records and nine reciprocal direct members. The standard-library validator checks link targets/Markdown heading anchors, retired/duplicate IDs, one work-map owner per direct ticket, required template sections, single index/status/path agreement, all eight Draft runtime peers and confirmed/default/current-target language. The final post-archive pass below must verify the moved record and every affected link.
- Passed focused `node_modules/.bin/prettier --check` over all ten new records after formatting their tables, and `git diff --check`. The exact final formatting command is below.
- Reviewed the marketplace additions to the shared specification/index against saved pre-edit snapshots at `/tmp/dev0311-planning/mvp-spec.before.md` and `/tmp/dev0311-planning/tickets-index.before.md`. Concurrent authentication/Apple-deferral changes remain owned by DEV0311/DEV0312 and were preserved; this ticket changes no authentication requirement. Scope review covered one-hour private terms, review eligibility/consent/aggregates, card/page separation, public-only slug sharing and the still-photo dependency versus optional video.
- Application/database/browser/Auth/Storage/Mux/SMTP/hosted checks: Not run — documentation-only planning. Runtime evidence remains pending in the eight Draft peers and external dependencies. No feature, migration, configuration, credential, account, email, asset or deployment change is claimed.

```sh
node_modules/.bin/prettier --check tickets/archive/organisatory/DEV0320-adopt-coach-marketplace-website-contract.md tickets/current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md tickets/current/backend/DEV031[349]-*.md tickets/current/backend/DEV0321-*.md tickets/current/frontend/DEV031[5678]-*.md
python3 /tmp/dev0311-planning/validate.py
git diff --check
```

Shared existing specification/index tables were changed locally without whole-file reformatting of unrelated edits. The validator directly checks all scoped new untracked files for trailing whitespace/final newlines as well.

| Criterion | Evidence                                                                                                                                                                                   | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | C45, sections 4.2/11–13/19 and M10 separate accepted direction, adopted defaults and delivered baseline; price history, review consent/privacy, media and slug compatibility are explicit. | Passed |
| AC2       | COR0028 maps nine direct peers, separates DEV0316 cards from DEV0317 pages, names DEV0292/DEV0297 blockers/independent consumers and defines branches/order/completion.                    | Passed |
| AC3       | Eight runtime peers remain Draft with reciprocal membership, bounded scope/non-goals, testable criteria, future validation, planned affected files and pending runtime records.            | Passed |
| AC4       | Link/anchor/template/ID/index/member checks, focused formatting, whitespace and manual scope review pass; final archive/link verification recorded below.                                  | Passed |

Final post-archive verification passed on 2026-10-17: the three commands above confirmed all ten record files are formatted, 12 scoped documents/508 local links/62 anchors/233 unique records/nine reciprocal members agree, Completed/archive/index links resolve, all eight runtime peers remain Draft and whitespace checks pass. No runtime check was substituted for documentary evidence.

## Risks, limitations, and follow-ups

New runtime peers remain Draft. DEV0297's photo delivery/allowance scope review is a real dependency; video premium eligibility stays unresolved and outside this website coordination. Price/review migrations, moderation operations and actual responsive flows require the respective runtime evidence. No deployment or external review is implied.

## Completion and review references

- Completed: 2026-10-17 — accepted target and flat ticket planning validated; runtime remains unimplemented.
- Commit: User authorized the 18 October 2026 foundation checkpoint after completion. This record is included under DEV0320; the shared checkpoint also contains the directly required Storage, accepted-contract/amendment and website-content implementation records (DEV0292/DEV0320/DEV0330/DEV0321). No unrelated runtime work is included.
- Review: Contract/peer/ownership and documentation self-review passed; no independent or runtime review.
- Deployment or release: None.
