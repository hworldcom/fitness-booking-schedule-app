# Ticket DEV0389: Review pending documentation and browser-test edits

- Status: In progress
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: Repository maintenance
- Coordination: None — independent development ticket
- Related records: [DEV0388](../../archive/backend/DEV0388-preserve-accepted-requests-when-rescheduling.md) (separate completed booking fix); [DEV0326](../../archive/frontend/DEV0326-separate-profile-from-workspace-navigation.md) (historical profile behavior)

## Objective and context

The user requests committing all pending changes. Besides completed ticket-owned UAT work, the worktree already contains specification/index formatting and reordering, small index wording changes, and deletion of two public browser cases. Review and record that existing maintenance diff before committing it. These edits predate this ticket; this record does not claim they were originally implemented under DEV0389. The current [specification](../../../docs/mvp-spec.md) remains the product contract.

## Scope and non-goals

Own the existing maintenance changes in docs/mvp-spec.md, tickets/README.md and tests/browser/public-story.spec.ts, plus this review record. Preserve the supplied edits, including removed tests, as requested. Other DEV tickets own their new index entries and UAT evidence. No runtime, dependency, environment, database, authentication or deployment changes; no replacement browser coverage is invented.

## Expected behavior and edge cases

Application behavior is unchanged. Specification text retains its requirements while moving the M11 milestone/scenario and DEV0315 paragraph into related sections and normalizing tables. The index retains allocated IDs/record links while reordering completed entries and refining historical reservation/status wording. The public-story suite loses the compact marketplace header and independent Profile framing cases; these are not duplicated elsewhere. The coverage reduction must be explicit rather than claimed as a test improvement.

## Assumptions, decisions, and dependencies

The explicit request to commit all changes authorizes including this existing test deletion. Do not restore or extend it silently. Preserve every existing source byte while reviewing, apart from ticket/index lifecycle metadata necessary for this maintenance record. Completed UAT source/operation evidence belongs to DEV0374, DEV0375 and DEV0386–DEV0388, with their own commit IDs. No further hosted writes are needed.

## Implementation plan

1. Inventory the complete diff and map new UAT records/source to their owning tickets.
2. Compare normalized specification content and index records; inspect deleted browser cases and confirm remaining test collection.
3. Validate changed source with focused lint and full isolated-source type/lint checks, excluding unrelated ignored work/tmp copies; resolve only defects introduced by this work.
4. Check record links, unique allocated IDs, whitespace, staged scopes and sensitive-file exclusions. Finish/archive this record and commit each coherent ticket scope; preserve all user-requested pending edits.

## Acceptance criteria

- [x] AC1: Existing unassigned edits are reviewed and accurately described, including the two removed browser cases and unchanged runtime/product requirements.
- [x] AC2: Remaining public-story tests collect; applicable static checks and documentation consistency checks pass with limitations recorded.
- [ ] AC3: Every pending tracked/untracked source or record is included in a ticket-bearing commit; generated private work/secrets remain ignored, and the final worktree is clean.

## Validation plan

Use normalized specification/index comparisons, Playwright --list (collection only), focused ESLint and isolated full lint/typecheck. Reuse DEV0388's completed 428 unit/server tests, 23 database checks and actual UAT verification for its unchanged fix; do not rerun hosted fixtures for a commit-only request. No build or native UI test is required for formatting/reordering and test deletion without a product change. Check local links/anchors and git diff --check; compare pre-commit hashes and inspect staged files/subjects.

## Implementation record

Reviewed the existing source bytes without modifying the specification or remaining browser test. Specification normalization/reordering retains the same multiset of nonblank requirement lines. The index has existing table/reordering changes, small historical reservation wording updates, the DEV0363 outcome wording refresh and new UAT entries. The browser diff removes exactly two cases (126 lines); no replacement case was found. Their reduced assertions are recorded below.

Commit grouping keeps the independent DEV0374 approval and DEV0375 search setup separate. DEV0386/DEV0387 share one evidence checkpoint because their new peer records and coordination integration form the same requested approval/QA outcome. That checkpoint retains the actual reviewed Draft DEV0388 defect record; the next DEV0388 commit contains its forward migration, source regression/rehearsal, completed record, README command and archival link changes. DEV0389 owns the remaining supplied maintenance edits and this review. No implementation code was changed for commit preparation.

No API, schema, dependency, environment or setup contract changes under DEV0389. DEV0388 owns the separately validated schema repair. Temporary QA scripts/logs, credential manifests, environment files and generated evidence remain ignored.

## Validation results

- `node_modules/.bin/playwright test tests/browser/public-story.spec.ts --list`: passed; three remaining scenarios collect in desktop and mobile projects (six cases total). This is collection, not execution. Two removed scenarios would have supplied four additional project cases.
- `node_modules/.bin/eslint scripts/rehearse-request-booking-rescheduling-database.mjs tests/database/request-booking-rescheduling.test.ts tests/browser/public-story.spec.ts`: passed.
- Full `npm run lint` and `npm run typecheck` on a fresh `git archive HEAD` snapshot overlaid with every pending tracked/untracked source/record: passed, exit 0. Snapshot path/logs are ignored under work/dev0389. This excludes ignored work/tmp copies known to interfere with root checks (DEV0371); it contains the actual pending source, including the browser deletions. No configuration changes hide failures.
- Normalized comparison confirms the exact same specification requirement-line multiset. All 43 local links/anchors across the seven new work records resolved before commit preparation. Source SHA256 comparisons confirm README, specification, browser test and all three DEV0388 source files exactly match the initially requested pending bytes. Staged source scopes and unique ticket paths were reviewed, and `git diff --check` passed. Final committed-source/clean-worktree verification remains before AC3 closure.
- DEV0388's unchanged migration/regression already passed 428 unit/server tests, 23 database checks and hosted desktop/phone lifecycle/cleanup proof in its own record. No hosted mutations or full browser execution were repeated solely to commit files.


## Risks, limitations, and follow-ups

Removed cases reduce automated assertions for public header navigation/keyboard/mobile behavior and independent profile boundaries/overflow. Remaining accessibility/browser tests do not establish identical replacement coverage. Full browser interaction is not run for this commit-only housekeeping task.

## Completion and review references

- Completed: Not completed.
- Commit: `[DEV0389] Record pending documentation and browser-test edits` contains the reviewed maintenance source and this in-progress record; a final evidence checkpoint will archive the record after committed-source and clean-worktree verification.
- Review: Self-review; no independent reviewer.
- Deployment or release: None under this ticket.

### Commit progress — 2026-10-20

Completed checkpoints: `ae0a5e2` (DEV0374), `af47753` (DEV0375), `65426b3` (DEV0386/DEV0387 and original Draft DEV0388 finding), `c270df0` (DEV0388 implementation/validation and archive). No push or deployment was performed for this commit request. The maintenance source checkpoint is next; AC3 stays open until its actual commit and clean-worktree verification pass.
