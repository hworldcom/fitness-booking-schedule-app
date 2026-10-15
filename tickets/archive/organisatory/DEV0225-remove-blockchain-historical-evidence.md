# Ticket DEV0225: Remove blockchain historical evidence

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: Scheduling documentation and historical-record pruning
- Coordination: None — independent development ticket
- Related records: backlog-maintenance dependency [DEV0224](DEV0224-refresh-scheduling-ticket-backlog.md); scheduling contract baseline [DEV0140](DEV0140-adopt-scheduling-only-contract.md); current relationship work [COR0020](COR0020-athlete-terminology-and-connections.md)

## Objective and context

Remove blockchain-related ticket files and historical documentary evidence from the scheduling repository's working tree. The user explicitly authorized removing archived blockchain evidence on 2026-10-14, then asked for a separate ticket for that work. This instruction overrides the normal archived-record preservation rule for the identified blockchain evidence; independent scheduling, email identity, media, hosted operations and contributor history still need an accurate review trail. Implement against the [current scheduling specification](../../../docs/mvp-spec.md#1-product-status-and-document-authority).

## Scope and non-goals

- In scope:
  - Inventory and remove dedicated blockchain/wallet/payment/group-funding ticket and coordination records, including Completed or Cancelled records.
  - Remove the three superseded documents in `docs/archive/2026-09-18/` and their obsolete navigation references.
  - Remove blockchain-specific narrative/evidence and links from mixed historical records while retaining their reusable scheduling, identity, database, frontend and contributor outcomes. Explain dated pruning where retained evidence changes; do not fabricate replacement implementation or validation.
  - Reconcile the ticket index, removed/retired/reserved ID registers, affected coordination ownership and every repository link to removed records.
  - Update current documentation that promises retained blockchain history or links to deleted documents. Keep the current product's explicit blockchain exclusion.
- Out of scope:
  - Runtime source, dependencies, environment values, SQL migration history, stored data or live services.
  - Rewriting Git history, deleting other branches/repositories, importing hackathon files or reusing their IDs.
  - Removing current athlete terminology/connections, booking requests, notes/plans, native iOS, account deletion, admin review or hosted scheduling work.

## Expected behavior and edge cases

- No dedicated blockchain ticket or archived blockchain product document remains in this checkout. A file's topic and owned outcome determine removal; an incidental word such as wallet in an exclusion does not justify deleting a reusable scheduling or account record.
- A mixed record retains only its relevant independent outcome, exact dated evidence and a dated explanation of documentary pruning. Blockchain proofs, screenshots/log links, contract narratives and obsolete future delivery are removed rather than merely marked inactive.
- Deleted record IDs remain permanently unavailable in a minimal register. The register records removal, not the deleted feature's implementation evidence.
- Retained DEV/COR membership must remain truthful. Removing a direct DEV requires reconciling its retained COR; an archived COR that primarily coordinates removed work can also be removed.
- No dangling Markdown destinations, current-work entries or navigation directories advertise deleted history. Empty archive directories may be removed after navigation is updated.
- Existing app/database behavior and prior unrelated edits remain intact. Ordinary Git history retains earlier revisions; this ticket removes working-tree evidence only.

## Assumptions, decisions, and dependencies

- DEV0224 first cancels/archives COR0001 and refreshes the active backlog. That separate maintenance ticket does not delete historical evidence.
- User authorization covers documentary deletion, including archived records. No additional approval gate is introduced by the ordinary archive-preservation policy.
- Initial inventory below identifies clear dedicated removals and mixed-record review targets. Before the first deletion, record the final exact path/ID manifest and reasons in this ticket; update scope first if the inventory exposes a material additional category.
- This is one documentary pruning task because deletion, reference repair and unavailable-ID preservation must be reviewed together. Runtime retirement or database retention would require independent tickets.

### Final removal manifest adopted before deletion — 2026-10-14

Read-only audit and image inspection identified **36 development/coordination records, three superseded product documents, seven design screenshots and two empty-area navigation files (48 files total)**. Dedicated records are removed because their owned outcome is the excluded product or its chain-specific retirement, not because an incidental exclusion contains a keyword. The cancelled DEV0118/DEV0119 workflow belongs to the removed marketplace and delivered no implementation; current coach-confirmed booking requests retain their independent DEV0187–DEV0190 evidence. COR0001's old work map is removed as planned; its independently reusable database/server/frontend/workflow member evidence is retained with dated ownership corrections.

| ID or supporting path                                             | Exact path                                                                            | Removal reason                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| DEV0027                                                           | `tickets/archive/blockchain/DEV0027-phantom-wallet-connection-foundation.md`          | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0097                                                           | `tickets/archive/blockchain/DEV0097-create-coach-package-offers.md`                   | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0098                                                           | `tickets/archive/blockchain/DEV0098-purchase-training-packages-with-devnet-usdc.md`   | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0099                                                           | `tickets/archive/blockchain/DEV0099-redeem-and-reconcile-training-sessions.md`        | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0121                                                           | `tickets/archive/blockchain/DEV0121-implement-group-event-funding-program.md`         | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0122                                                           | `tickets/archive/blockchain/DEV0122-integrate-devnet-group-event-funding.md`          | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0127                                                           | `tickets/archive/blockchain/DEV0127-implement-coach-client-credit-ledger.md`          | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0130                                                           | `tickets/archive/blockchain/DEV0130-integrate-devnet-coach-pass-operations.md`        | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0131                                                           | `tickets/archive/blockchain/DEV0131-implement-coach-credit-booking-lifecycle.md`      | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0132                                                           | `tickets/archive/blockchain/DEV0132-make-coach-pass-operations-platform-funded.md`    | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0134                                                           | `tickets/archive/blockchain/DEV0134-adopt-eurc-for-marketplace-payments.md`           | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0136                                                           | `tickets/archive/blockchain/DEV0136-integrate-coach-wallet-replacement.md`            | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0038                                                           | `tickets/archive/backend/DEV0038-phantom-supabase-web3-authentication.md`             | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0039                                                           | `tickets/archive/backend/DEV0039-prepared-identity-and-wallet-bindings.md`            | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0047                                                           | `tickets/archive/backend/DEV0047-personal-wallet-linking-and-replacement.md`          | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0105                                                           | `tickets/archive/backend/DEV0105-book-private-classes-with-pass-credits.md`           | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0106                                                           | `tickets/archive/backend/DEV0106-rehearse-hosted-coach-booking-loop.md`               | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0120                                                           | `tickets/archive/backend/DEV0120-persist-group-event-catalogue-and-projections.md`    | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0125                                                           | `tickets/archive/backend/DEV0125-rehearse-hosted-marketplace-loops.md`                | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0128                                                           | `tickets/archive/backend/DEV0128-persist-credit-backed-private-bookings.md`           | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0095                                                           | `tickets/archive/frontend/DEV0095-present-coach-first-public-story.md`                | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0123                                                           | `tickets/archive/frontend/DEV0123-present-group-event-creation-and-funding.md`        | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0124                                                           | `tickets/archive/frontend/DEV0124-present-coach-pass-and-group-funded-story.md`       | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0129                                                           | `tickets/archive/frontend/DEV0129-present-coach-passes-bookings-and-client-cards.md`  | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0094                                                           | `tickets/archive/organisatory/DEV0094-adopt-coach-first-training-package-mvp.md`      | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0103                                                           | `tickets/archive/organisatory/DEV0103-adopt-private-class-booking-contract.md`        | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0117                                                           | `tickets/archive/organisatory/DEV0117-adopt-group-funded-coach-marketplace-mvp.md`    | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0126                                                           | `tickets/archive/organisatory/DEV0126-adopt-coach-pass-and-group-funding-contract.md` | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0135                                                           | `tickets/archive/organisatory/DEV0135-narrow-marketplace-mvp-to-two-loops.md`         | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| COR0001                                                           | `tickets/archive/organisatory/COR0001-project-structure.md`                           | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| COR0003                                                           | `tickets/archive/organisatory/COR0003-account-first-identity-and-wallet-linking.md`   | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| COR0009                                                           | `tickets/archive/organisatory/COR0009-coach-first-training-package-mvp.md`            | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| COR0010                                                           | `tickets/archive/organisatory/COR0010-group-funded-coach-marketplace-mvp.md`          | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0142                                                           | `tickets/archive/backend/DEV0142-retire-blockchain-runtime.md`                        | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0118                                                           | `tickets/archive/backend/DEV0118-persist-training-requests-and-coach-proposals.md`    | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| DEV0119                                                           | `tickets/archive/frontend/DEV0119-present-training-requests-and-coach-proposals.md`   | Dedicated excluded-product/coordination evidence; ID remains unavailable.                                                                       |
| `docs/archive/2026-09-18/implementation-plan.md`                  | `docs/archive/2026-09-18/implementation-plan.md`                                      | Superseded product contract, delivery plan or review.                                                                                           |
| `docs/archive/2026-09-18/fitness_social_hackathon_mvp_summary.md` | `docs/archive/2026-09-18/fitness_social_hackathon_mvp_summary.md`                     | Superseded product contract, delivery plan or review.                                                                                           |
| `docs/archive/2026-09-18/mvp-review.md`                           | `docs/archive/2026-09-18/mvp-review.md`                                               | Superseded product contract, delivery plan or review.                                                                                           |
| `docs/design/DEV0044-desktop.png`                                 | `docs/design/DEV0044-desktop.png`                                                     | Inspected obsolete UI evidence: on-chain branding and/or Phantom/payment controls; retained photo assets are outside this documentary deletion. |
| `docs/design/DEV0043-preferred-concept.png`                       | `docs/design/DEV0043-preferred-concept.png`                                           | Inspected obsolete UI evidence: on-chain branding and/or Phantom/payment controls; retained photo assets are outside this documentary deletion. |
| `docs/design/DEV0045-mobile.png`                                  | `docs/design/DEV0045-mobile.png`                                                      | Inspected obsolete UI evidence: on-chain branding and/or Phantom/payment controls; retained photo assets are outside this documentary deletion. |
| `docs/design/DEV0045-desktop.png`                                 | `docs/design/DEV0045-desktop.png`                                                     | Inspected obsolete UI evidence: on-chain branding and/or Phantom/payment controls; retained photo assets are outside this documentary deletion. |
| `docs/design/DEV0043-mobile.png`                                  | `docs/design/DEV0043-mobile.png`                                                      | Inspected obsolete UI evidence: on-chain branding and/or Phantom/payment controls; retained photo assets are outside this documentary deletion. |
| `docs/design/DEV0044-mobile.png`                                  | `docs/design/DEV0044-mobile.png`                                                      | Inspected obsolete UI evidence: on-chain branding and/or Phantom/payment controls; retained photo assets are outside this documentary deletion. |
| `docs/design/DEV0043-desktop.png`                                 | `docs/design/DEV0043-desktop.png`                                                     | Inspected obsolete UI evidence: on-chain branding and/or Phantom/payment controls; retained photo assets are outside this documentary deletion. |
| `tickets/archive/blockchain/README.md`                            | `tickets/archive/blockchain/README.md`                                                | Navigation for an area with no retained records.                                                                                                |
| `tickets/current/blockchain/README.md`                            | `tickets/current/blockchain/README.md`                                                | Navigation for an area with no retained records.                                                                                                |

### Mixed-history review manifest

The following paths are reviewed before implementation for independent evidence, deleted links and scope/exclusion wording. Their reusable outcomes remain; correction is required only where they contain removed evidence, invalid ownership or navigation. Keyword-free current behavior and ordinary validation language such as “checks pass” is not a removal trigger. Current growth, iOS and migration-continuity records retain their explicitly independent boundaries. Retained legacy photo-generation provenance remains accurate; deleted screenshot/reference links are pruned.

- `AGENTS.md`
- `README.md`
- `docs/design/DEV0043-assets.md`
- `docs/design/DEV0044-assets.md`
- `tickets/README.md`
- `tickets/TEMPLATE.md`
- `tickets/archive/README.md`
- `tickets/archive/backend/DEV0015-supabase-database-foundation.md`
- `tickets/archive/backend/DEV0025-nextjs-backend-boundary.md`
- `tickets/archive/backend/DEV0040-protected-access-and-database-context.md`
- `tickets/archive/backend/DEV0046-email-otp-registration-and-application-profiles.md`
- `tickets/archive/backend/DEV0054-cloudflare-workers-runtime-foundation.md`
- `tickets/archive/backend/DEV0056-staging-release-and-domain-rehearsal.md`
- `tickets/archive/backend/DEV0065-rename-demo-run-participants.md`
- `tickets/archive/backend/DEV0093-reduce-cloudflare-auth-render-cpu.md`
- `tickets/archive/backend/DEV0096-persist-coach-profiles-and-discovery.md`
- `tickets/archive/backend/DEV0100-coach-follows-and-chronological-posts.md`
- `tickets/archive/backend/DEV0101-retire-multigym-membership-runtime.md`
- `tickets/archive/backend/DEV0104-publish-weekly-coach-availability.md`
- `tickets/archive/backend/DEV0109-retire-membership-schema-and-preserve-gyms.md`
- `tickets/archive/backend/DEV0110-activate-coaching-during-account-onboarding.md`
- `tickets/archive/backend/DEV0111-upgrade-nextjs-security-patch.md`
- `tickets/archive/backend/DEV0114-persist-recurring-coach-availability.md`
- `tickets/archive/backend/DEV0116-provision-local-seeded-coach-accounts.md`
- `tickets/archive/backend/DEV0133-normalize-availability-deadlock-conflicts.md`
- `tickets/archive/backend/DEV0138-prepare-vercel-deployment.md`
- `tickets/archive/backend/DEV0139-retire-cloudflare-deployment-path.md`
- `tickets/archive/backend/DEV0141-persist-direct-private-bookings.md`
- `tickets/archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md`
- `tickets/archive/frontend/DEV0021-local-preview-navigation-performance.md`
- `tickets/archive/frontend/DEV0030-frontend-screen-module-boundaries.md`
- `tickets/archive/frontend/DEV0031-preview-data-and-domain-boundaries.md`
- `tickets/archive/frontend/DEV0050-add-public-contact-email.md`
- `tickets/archive/frontend/DEV0052-account-backed-personal-profile.md`
- `tickets/archive/frontend/DEV0108-add-mapbox-coach-explore-map.md`
- `tickets/archive/frontend/DEV0115-add-coach-schedule-calendar.md`
- `tickets/archive/frontend/DEV0137-fix-secondary-button-contrast.md`
- `tickets/archive/frontend/DEV0143-present-scheduling-only-experience.md`
- `tickets/archive/frontend/DEV0198-build-search-first-marketplace-home.md`
- `tickets/archive/organisatory/COR0004-hosted-staging-deployment.md`
- `tickets/archive/organisatory/COR0011-scheduling-only-product.md`
- `tickets/archive/organisatory/DEV0003-consolidate-project-documentation.md`
- `tickets/archive/organisatory/DEV0009-comprehensive-gitignore.md`
- `tickets/archive/organisatory/DEV0026-ticket-directory-structure.md`
- `tickets/archive/organisatory/DEV0029-ticket-area-archive-organisation.md`
- `tickets/archive/organisatory/DEV0032-flat-coordination-record-workflow.md`
- `tickets/archive/organisatory/DEV0033-prefixed-work-record-identifiers.md`
- `tickets/archive/organisatory/DEV0034-explicit-coordination-membership.md`
- `tickets/archive/organisatory/DEV0035-track-project-work-records.md`
- `tickets/archive/organisatory/DEV0036-explicit-architecture-boundaries.md`
- `tickets/archive/organisatory/DEV0107-adopt-mapbox-coach-discovery-contract.md`
- `tickets/archive/organisatory/DEV0112-prune-superseded-product-tickets.md`
- `tickets/archive/organisatory/DEV0113-reconcile-current-project-status.md`
- `tickets/archive/organisatory/DEV0140-adopt-scheduling-only-contract.md`
- `tickets/archive/organisatory/DEV0151-publish-standalone-scheduling-repository.md`
- `tickets/archive/organisatory/DEV0191-reconcile-no-minimum-notice-documentation.md`
- `tickets/archive/organisatory/DEV0219-adopt-athlete-connections-contract.md`
- `tickets/archive/organisatory/DEV0224-refresh-scheduling-ticket-backlog.md`
- `tickets/current/README.md`
- `tickets/current/backend/DEV0055-hosted-supabase-staging-environment.md`
- `tickets/current/backend/README.md`
- `tickets/current/organisatory/COR0013-native-ios-application.md`
- `tickets/current/organisatory/COR0017-public-marketplace-redesign.md`
- `tickets/current/organisatory/DEV0232-restore-local-migration-continuity.md`
- `tickets/current/organisatory/DEV0233-define-group-training-and-events-growth-scope.md`

Adopted editing boundary: prune chain-only sentences, rows, schema/projection fields, commands and linked artifacts from mixed records; retain independent technical decisions, exact dated commands/results and unrelated negative scope. Add a dated correction explaining that the document is a retained excerpt, that original aggregate test totals are historical run totals, and that pruning performs no new runtime validation. Preserve original completion dates. Remove deleted direct-membership links and reconcile retained COR work maps rather than silently redirecting ownership. Original content stays recoverable in ordinary Git history.

No additional approval is needed for the recorded documentary deletion: the user authorized DEV0225 and its existing scope explicitly overrides archived-record preservation for these targets. DEV0222/DEV0234 are concurrent independent work; preserve their files, index rows and staging, and do not claim their unfinished work is committed.

## Implementation plan

1. Audit all repository Markdown and checked-in documentary artifacts; classify exact paths as dedicated removal, mixed-history correction or retained independent evidence. Record the manifest before deletion.
2. Delete the dedicated records/documents and any identified checked-in chain-only evidence, then record every removed prefixed ID in the minimal unavailable-ID register.
3. Correct retained references, dated mixed-history notes, reciprocal coordination ownership, indexes and README/AGENTS/archive navigation without adding false validation claims.
4. Validate no targeted evidence remains, every retained local link resolves, IDs are unique/unavailable, statuses/locations/index sections agree and no runtime/configuration/data file changed.
5. Complete this record only after all criteria pass; archive it and update its affected links/index.

## Acceptance criteria

- [x] AC1: The final manifest accounts for every dedicated blockchain record/document and mixed-history review target; targeted working-tree evidence is removed rather than simply labelled historical.
- [x] AC2: Retained scheduling/account/hosted/workflow records keep accurate independent evidence, with dated corrections, truthful memberships and no blockchain-only future handoff.
- [x] AC3: Every deleted DEV/COR ID remains unavailable; indexes, directory navigation and retained Markdown references resolve without advertising removed history.
- [x] AC4: Relevant Markdown/link/identifier/consistency checks and `git diff --check` pass, with exact deletion/correction counts and no runtime/configuration/database/Git-history changes.

## Validation plan

- Run installed Prettier over every changed Markdown file and `git diff --check`.
- Use targeted keyword/path searches plus the final manifest to prove dedicated records and evidence are absent while product exclusions remain accurate.
- Validate local Markdown destinations, relevant current specification anchors, unique headings/filenames, all retained reciprocal DEV/COR memberships, one correct index entry per retained record and unavailable-ID completeness.
- Review every deletion and changed mixed record against its original independent outcome; report any pre-existing unrelated broken historical link separately rather than quietly claiming repository-wide validity.
- Compare changed paths with the documentation-only scope. Application, database, browser and build tests are not applicable unless implementation unexpectedly changes runtime scope, which must be split first.

## Implementation record

Completed the adopted documentary manifest on 2026-10-14: deleted 36 dedicated DEV/COR records, three superseded product documents, seven obsolete design PNGs and two navigation files for the now-empty area. Preserved original revisions in Git history, all runtime/public image assets, dependencies, environment files, SQL migration history and stored/provider data.

### Changes and rationale

Removed feature-specific documentary evidence rather than relabelling it inactive. Mixed records retain independently relevant scheduling, PostgreSQL/authorization, email onboarding, hosting, frontend and workflow outcomes. Dated excerpt notices identify pruning, preserve original completion dates and make clear that code/data fragments are historical subsets and aggregate test totals belong to their original runs. Deleted future handoffs are removed; historical dead source links become labelled historical paths rather than invented current destinations.

Retained the database foundation's organization/member/class scheduling fields, protected actor/isolation outcomes, real email-code/onboarding results, explicit forward migration/gym retention and hosting/build guidance. Corrected retained metadata when its coordination was deleted. COR0011 now maps exactly DEV0140/DEV0141/DEV0143; the removed retirement member is not reassigned or represented as a new validation. Current product exclusions, branch-ID reservations, growth/iOS/notes/account plans and scheduling behavior remain unchanged.

### Affected files

| File or component                                                                                                                                            | Change and purpose                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final removal manifest above                                                                                                                                 | Exact 48 deleted paths and 36 unavailable record IDs; additional cancelled workflow and inspected PNG decisions are recorded before deletion.                                          |
| Mixed-history review manifest above                                                                                                                          | Retained independent evidence with dated pruning/reference/ownership corrections. Original Created/Status/Completed dates remain intact; Last updated reflects documentary correction. |
| [Ticket index](../../README.md), current/archive navigation                                                                                                  | Remove deleted rows/directory links, preserve retired/reserved IDs and add the minimal permanent removal register. Preserve ongoing DEV0222/DEV0234 rows.                              |
| [README](../../../README.md), [contributor policy](../../../AGENTS.md), [specification](../../../docs/mvp-spec.md)                                           | Remove superseded archive navigation and document the specific user-authorized preservation exception; retain the scheduling contract and SQL-compatibility boundary.                  |
| [Photo provenance](../../../docs/design/DEV0043-assets.md) and [hero provenance](../../../docs/design/DEV0044-assets.md)                                     | Remove obsolete screenshot/concept links while keeping original independent generation prompts and delivered photo assets.                                                             |
| [COR0011](COR0011-scheduling-only-product.md) and its retained members                                                                                       | Restore reciprocal ownership for the three retained scheduling deliverables and distinguish historical combined integration totals from the current documentary review.                |
| [Hosted plan](../../current/backend/DEV0055-hosted-supabase-staging-environment.md), [growth plan](DEV0233-define-group-training-and-events-growth-scope.md) | Remove a superseded privilege-proof subclaim and deleted baseline links; retain every current hosted criterion, growth decision and separate-branch identifier boundary.               |

### Decisions and deviations

- Applied the explicit user-authorized archive exception only to the adopted documentary manifest and mixed-history corrections. No runtime retirement or external destructive operation was added.
- Initial inventory refinement: remove cancelled DEV0118/DEV0119 because they owned an excluded marketplace workflow with no implementation, and remove DEV0142's dedicated retirement evidence. Existing request/session records and independently useful cleanup/gym outcomes remain.
- Inspected DEV0043's concept and DEV0044/DEV0045 desktop captures; their on-chain/Phantom/payment presentation identifies the seven corresponding stored design PNGs as obsolete interface evidence. Retained independent photo-generation provenance and every public image asset.
- Preserved original aggregate results instead of fabricating a new suite for extracted history. Repaired relevant obsolete specification anchors on records already reviewed; the six unrelated pre-existing references below remain explicitly outside this change.
- DEV0222/DEV0234 are actively implemented elsewhere. Shared README/index changes are staged as only DEV0225 hunks; their code, packages, rehearsal files, records and validation remain with that session. DEV0228 was already committed as `e9e0fe6` before this work.

### Contracts, configuration, and operations

Document availability, local links, retained history excerpts and permanent identifier reservations change only. No API/data shape, dependency, environment value, setup script, migration, data, live service, other branch/repository or Git-history rewrite changes. Ordinary Git revisions can restore the deleted documents/artifacts; no runtime/data rollback is required.

## Validation results

- `python3 /tmp/dev0225-validate.py` passed the 48-path removal manifest, preservation of independent photo assets/provenance, all 36 unavailable IDs, unique/heading/status/location/index consistency for 139 retained working-tree DEV/COR records (including the separate active, uncommitted DEV0234), 53 reciprocal direct memberships, dated correction/original completion-date checks and balanced code fences. It inspected 1,316 retained local Markdown references and 108 anchor-bearing references before final archive/link repair; all changed destinations/anchors passed. Final counts and staged scope are recorded below.
- Installed `node_modules/.bin/prettier --write` and corresponding `--check` run over the owned changed Markdown list; `git diff --check` verifies whitespace. Supporting scripts are local verification helpers under `/tmp`, not new repository/runtime dependencies.
- Targeted keyword/path review confirms dedicated feature evidence and deleted future handoffs are absent. Remaining terms identify explicit exclusions, generic contributor taxonomy, SQL/dependency-chain history, separate-branch reserved IDs or this pruning audit; they do not retain transaction signatures, wallet/program implementation proofs or active delivery promises.
- Reviewed original/current mixed excerpts for independent actor, email, schema, scheduling, hosting and workflow outcomes, original dated commands/results and clearly labelled aggregate totals. No changed source/configuration/database path is included in this ticket's staged scope; shared edits belonging to DEV0222/DEV0234 are excluded.
- Application, browser, lint, type, build, database and payment checks are not run for this documentation/PNG deletion. They would not prove this ticket's criteria and no corresponding runtime contract changed. Prior application results remain dated historical evidence, not newly executed checks.

- Final archive/link check: `python3 /tmp/dev0225-validate.py` passed 1,325 local references, 108 anchor-bearing references, 53 reciprocal memberships and all changed-reference/metadata/ID assertions; the six unchanged unrelated issues below remain reported. Owned Prettier `--check` passed for 59 Markdown files, and `git diff --check` passed.
- `python3 /tmp/dev0225-stage.py` staged **108 owned documentary paths** and verified no source, script, test, package, environment or SQL path is included. Shared README/index/specification blobs contain only this ticket's changes; coach-rehearsal additions, live DEV0222/DEV0234 status/ID updates and their records remain unstaged. `git diff --cached --check` passed. A separate staged-snapshot check verified one correct status/index row for each of **138 committed-snapshot records**, excluding the other session's untracked DEV0234.

Commit-scope correction — 2026-10-14: the initial scoped commit `2203ba3` omitted four working-tree repairs from its staging inventory: current/archive navigation guides, the historical secondary-button contrast excerpt and DEV0232’s link to this archived record. Final status review caught the omission. The follow-up stages those four paths plus this evidence correction; runtime and active connection work remain excluded. The completed pruning owns 63 corrected Markdown files and 48 deleted files; no existing Git commit is rewritten. Final correction validation passed 1,327 local references, 108 anchors, 53 memberships, all changed-reference checks, owned formatting for 63 Markdown files and both working/staged whitespace checks. The follow-up staged five documentary paths, including this record; no runtime path is included.

### Unchanged pre-existing references, outside pruning scope

- `tickets/archive/organisatory/DEV0186-adopt-booking-request-and-notice-policies.md`: `../../../docs/mvp-spec.md#43-book-a-private-session` (anchor).
- `tickets/archive/frontend/DEV0206-redesign-coach-bookings.md`: `../organisatory/COR0018-authenticated-workspace-redesign.md` (destination).
- `tickets/archive/frontend/DEV0205-redesign-coach-schedule.md`: `../organisatory/COR0018-authenticated-workspace-redesign.md` (destination).
- `tickets/archive/frontend/DEV0144-show-client-booking-history.md`: `../../../docs/mvp-spec.md#43-book-a-private-session` (anchor).
- `tickets/archive/frontend/DEV0180-pin-coaches-at-primary-locations.md`: `../../../docs/mvp-spec.md#42-discover-and-book-a-coach` (anchor).
- `tickets/archive/backend/DEV0102-clarify-auth-service-unavailability.md`: `../../../docs/mvp-spec.md#6-architecture-and-delivery-boundaries` (anchor).

The validator distinguishes these six original unrelated problems from changed references. No new dangling destination or anchor was introduced, and none points to the deleted manifest. They are separate historical-reference maintenance; this record does not claim repository-wide link perfection.

| Criterion | Evidence                                                                                                                                                     | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Adopted 48-file/36-record manifest, inspected supporting PNGs, deleted-path assertions and reviewed mixed excerpts.                                          | Passed |
| AC2       | Dated correction/original metadata checks, retained independent outcomes and exact historical evidence, removed handoffs and 53 reciprocal ownership checks. | Passed |
| AC3       | Permanent removal register, unique/status/index checks and changed-link validation; six pre-existing unrelated problems reported separately.                 | Passed |
| AC4       | Owned Markdown formatting, whitespace, deletion/correction inventory and documentation-only staged scope review; no runtime/data/history mutation.           | Passed |

## Risks, limitations, and follow-ups

Six unrelated historical references remain as listed above; they were not caused by pruning and need separate maintenance. Historical aggregate test totals and partial code/schema fragments are labelled excerpts. SQL migration history and separate repositories/branches remain intentionally untouched. DEV0222/DEV0234 remain active independent work and are not included in this commit.

## Completion and review references

- Completed: 2026-10-14 — AC1–AC4 passed for the adopted documentary pruning.
- Commit: Initial pruning `2203ba3` (`[DEV0225] Prune blockchain documentary evidence`) and the scope-correction commit `[DEV0225] Finish documentary navigation repairs`, covered by the user’s instruction to commit remaining work and start DEV0225. Concurrent unfinished work is excluded.
- Review: Manifest/excerpt/link/ownership/scope self-review; no independent review created.
- Deployment or release: Not applicable — documentary pruning.
