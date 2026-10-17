# Ticket DEV0330: Refine coach marketplace pricing reviews and URLs

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-18
- Milestone: M10 — Coach marketplace websites (planning amendment)
- Coordination: [COR0028 — Coach marketplace cards and personal websites](../../current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md)
- Related records: Historical contract [DEV0320](DEV0320-adopt-coach-marketplace-website-contract.md); username enrollment [DEV0325](../backend/DEV0325-collect-registration-names-and-unique-username.md); independent username policy [DEV0296](../../current/organisatory/DEV0296-define-username-login-and-profile-url-contract.md); independent media [DEV0297](../../current/backend/DEV0297-add-coach-profile-photos-and-mux-video.md).

## Objective and context

Amend the [M10 contract](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites) and current tickets after the user's review: coach-defined `Sessions start from …` pricing with optional public disclosure, one review per athlete–coach pair after at least one eligible session, username-based public coach URLs and media-allowance decisions after directory cards. The user accepted the remaining plan. This is a new dated correction; preserve DEV0320 and other completed history.

## Scope and non-goals

- In scope: confirm existing username storage versus undelivered public routing; amend current specification/tickets/index/COR; create a bounded routing peer; remove superseded fixed booking-price/snapshot and per-booking review requirements; make deferred media decisions non-blocking for directory cards; documentation checks and lifecycle handoff.
- Out of scope: feature code, database/provider operations, commits, deployment, picking photo/video allowances or premium access, username login and reopening archived records.

## Expected behavior and edge cases

An owner chooses an indicative starting rate and whether it appears publicly. Hidden rates never enter public data/markup/metadata. Booking requests keep their existing behavior; the indicative rate is not a locked quote. A qualifying athlete can maintain one review of a coach after their first eligible session; later bookings, retries and withdrawal/republication cannot add another review. A visible published coach uses their saved username for the public URL without exposing another account field or a hidden/non-coach account. Missing legacy usernames and old links require compatible handling. Media decisions remain deferred until cards complete.

## Assumptions, decisions, and dependencies

Confirmed: starting-price wording, coach ownership and public disclosure choice; one review after a session, interpreted as one per athlete–coach pair; username URLs; remaining direction accepted; photo/video allowance clarification deferred until cards finish. Existing registration/account code and DEV0325 prove saved canonical unique usernames, not public username routing.

Adopted defaults remain labelled separately: EUR indicative private-session starting amount, initially hidden disclosure, existing elapsed non-cancelled confirmed/completed private booking eligibility, and a distinct `/@username` public route with compatibility for old `/coaches/[slug]` links. The routing peer must preserve private accounts and prevent a renamed public handle from being reassigned to another coach. No username login is enabled.

## Implementation plan

1. Inspect current registration/Account username normalization/uniqueness, coach routes and current M10 records.
2. Amend section 19 and affected identity/acceptance/milestone wording, with the explicit user choices separated from operating defaults.
3. Align the pricing, review, editor, card, website and integration peers; create the username-routing peer and reciprocal COR ownership; reconcile DEV0296 without changing its independent login scope or historical implementation evidence.
4. Check links/anchors, unique/retired IDs, index/lifecycle, template/membership, superseded language and media/card sequence. Complete/archive only this documentary record; runtime peers stay Draft.

## Acceptance criteria

- [x] AC1: Starting-rate publicity and one-review-per-pair rules replace fixed price snapshots/per-booking reviews consistently; other accepted features remain.
- [x] AC2: Existing usernames are accurately distinguished from planned public routing; a direct routing peer and current policy/specification boundaries cover public identity, legacy links and rename safety.
- [x] AC3: Cards stay separate from full websites, precede media-allowance decisions and have no gallery/video-decision dependency; all current scopes/ownership/start conditions agree.
- [x] AC4: Documentation links/anchors/IDs/membership/index/format/scope checks pass; archived history and unrelated workspace changes are preserved with no runtime claim.

## Validation plan

Run a scoped standard-library Python validator, focused Markdown formatting and `git diff --check`. Check all current consumers of changed pricing/review/URL language, the new routing peer, reciprocal COR membership and completed/archive/index links. Application/database/browser tests are not applicable to this planning amendment; future runtime evidence remains owned by feature tickets.

## Implementation record

### Changes and rationale

2026-10-17: Updated specification C45/section 19 plus identity, completion, milestone and acceptance language. Reworked DEV0313 into an optional owner-defined starting-rate/disclosure slice, changed DEV0314/DEV0318 to pair review uniqueness and multi-booking retry evidence, aligned editor/cards/pages/proof and created DEV0331 for saved-username public routes. Reconciled DEV0296 remaining scope and DEV0297 deferred decisions, updated COR0028/index and kept every feature peer Draft. Existing Account/registration source and DEV0325 confirm stored unique usernames; the coach route still resolves by slug. No runtime implementation started.

### Affected files

| File or component                                                                                                                                                                                                         | Role                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Specification](../../../docs/mvp-spec.md#19-coach-marketplace-cards-and-personal-websites)                                                                                                                               | Single current pricing/review/URL and card-first/media-later contract.                                       |
| [COR0028](../../current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md), current runtime peers and [DEV0296](../../current/organisatory/DEV0296-define-username-login-and-profile-url-contract.md) | Revised ownership, dependencies and acceptance criteria; saved usernames remain distinct from routing/login. |
| [Ticket index](../../README.md)                                                                                                                                                                                           | New records, current scopes and next-ID allocation.                                                          |

### Decisions and deviations

2026-10-17: User replaced the initial fixed-price and per-booking review defaults, selected username URLs and deferred media clarification. Current plans must change before runtime edits; completed DEV0320 remains historical evidence. Starting-rate display replaces the over-scoped immutable booking-price workflow.

### Contracts, configuration, and operations

Documentation-only contract amendment. No application interface, schema, migration, dependency, environment variable, credential, account, provider configuration, media asset or deployment changes. The new routing peer owns later actual compatibility/migration/rollback work.

## Validation results

- Date/environment: 2026-10-17, local repository documentation review.
- Passed `python3 /tmp/dev0330-planning/validate.py`: 16 scoped documents, 579 local links, 62 heading anchors, 243 unique work records, eleven reciprocal COR0028 direct members and nine Draft runtime peers. It checks template/index/status/path/retired-ID consistency, renamed DEV0313 links, owner-hidden rates/public payload coverage, pair uniqueness and competing eligible-booking cases, username ownership/current-versus-planned behavior and card-before-media sequencing.
- Passed focused Markdown formatting with the exact command below and `git diff --check`. Shared specification/index and DEV0297 historical tables were not reformatted wholesale; scoped whitespace/link checks include them directly.
- Read-only source review: existing Account normalization/global unique constraint, registration enrollment and current public coach route prove stored canonical usernames and undelivered public username routing. This is not a claim that new routing, rate hiding or pair reviews work at runtime.
- Reviewed the specification/index deltas against `/tmp/dev0330-planning/spec.before.md` and `/tmp/dev0330-planning/index.before.md`; preserved concurrent navigation/registration edits and all archived implementation history. DEV0313's stable ID is retained with its new scope/file path; no identifier is reused or converted.
- Application/database/browser/provider/migration/SMTP/Storage/Mux/hosted checks: Not run — documentation-only amendment. No feature, account, secret, provider setting, media object, dependency or deployment change occurred.

```sh
node_modules/.bin/prettier --check tickets/archive/organisatory/DEV0330-refine-coach-marketplace-pricing-reviews-and-urls.md tickets/current/organisatory/COR0028-coach-marketplace-cards-and-personal-websites.md tickets/current/organisatory/DEV0296-define-username-login-and-profile-url-contract.md tickets/current/backend/DEV031[349]-*.md tickets/current/backend/DEV0321-*.md tickets/current/backend/DEV0331-*.md tickets/current/frontend/DEV031[5678]-*.md
python3 /tmp/dev0330-planning/validate.py
git diff --check
```

| Criterion | Evidence                                                                                                                                                                                                 | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Section 19.3/19.4, revised pricing/review peers and acceptance rows consistently use optional owner starting-rate disclosure and one stable pair review; old booking quote/snapshot scope is superseded. | Passed |
| AC2       | Source/DEV0325 distinguish saved handles from routes; DEV0331 owns public routing/legacy/alias safety and DEV0296 retains deferred login/non-coach policy.                                               | Passed |
| AC3       | COR work map/order, DEV0316 independence, DEV0317 start conditions and DEV0297 note all place card completion before media allowance decisions.                                                          | Passed |
| AC4       | Scoped links/anchors/IDs/templates/index/status/membership, formatting/whitespace and source/document boundary review pass; final archive/link check recorded below.                                     | Passed |

Final post-archive verification passed on 2026-10-17: the exact commands above confirmed 16 scoped documents, 579 local links, 62 anchors, 243 unique records, eleven reciprocal members, nine Draft feature peers and correct Completed/archive/index links. All twelve focused Markdown records are formatted and whitespace checks pass.

## Risks, limitations, and follow-ups

Public username routing still needs implementation and safe legacy/rename behavior. Starting-rate privacy must be enforced in projections, not CSS. Media questions remain deferred until cards complete. Feature peers stay Draft; no feature delivery is claimed.

## Completion and review references

- Completed: 2026-10-17 — user-selected plan amendment and current peer/ownership/lifecycle checks complete; runtime remains unimplemented.
- Commit: User authorized the 18 October 2026 foundation checkpoint after completion. This record is included under DEV0330; the shared checkpoint also contains the directly required Storage, accepted-contract/amendment and website-content implementation records (DEV0292/DEV0320/DEV0330/DEV0321). No unrelated runtime work is included.
- Review: Planning/source/documentation self-review passed; no independent/runtime review.
- Deployment or release: None.
