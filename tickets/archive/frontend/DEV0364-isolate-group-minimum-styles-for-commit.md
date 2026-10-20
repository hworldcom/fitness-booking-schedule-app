# Ticket DEV0364: Isolate group minimum styles for commit

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../../current/organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-20
- Milestone: Public marketplace commit preparation
- Coordination: None — independent development ticket
- Related records: [DEV0359](../../archive/frontend/DEV0359-preview-athlete-and-coach-how-it-works.md), [DEV0361](../../archive/frontend/DEV0361-simplify-how-it-works-preview-navigation.md), [DEV0362](../../archive/frontend/DEV0362-explain-group-minimums-and-invite-friends.md); independently queued Events redesign DEV0358 in [reserved work](../../README.md#reserved-identifiers).

## Objective and context

The user requests committing this conversation's How it works preview and minimum-participant work. The shared working tree includes an independent Events redesign: DEV0362's enrollment CSS currently lives in its untracked directory stylesheet, which the committed application baseline does not import. Make the requested work independently buildable while excluding unrelated changes. Follow [group presentation](../../../docs/mvp-spec.md#15-group-training-and-events) and the repository commit rule.

## Scope and non-goals

- In scope: move unchanged enrollment CSS into the existing Events stylesheet; prepare only owned component/spec/index changes, preview, tests and records; add dated packaging notes and truthful commit references; validate the exact proposed commit tree.
- Out of scope: independent Events/media/map, authentication/Home/Explore or coach website work, new product behavior, data, dependencies, migrations, deployment or pushing.

## Expected behavior and edge cases

The panel retains its appearance and also receives styles on the committed baseline. Selected EventCard additions compile without queued redesign imports. The preview uses tracked local fonts. Preserve unrelated staged/worktree changes; the index is initially empty. New record links resolve in the proposed commit; references to uncommitted records use the reservation register. Dated annotations preserve original implementation/validation history.

## Assumptions, decisions, and dependencies

The commit is explicitly authorized. Adopted choice: relocate identical CSS instead of importing the unrelated redesign. One focused commit includes DEV0359/DEV0361/DEV0362/DEV0364 because the same preview evolved across the first three records and this packaging correction makes the result independent. Every owned ID appears in the subject and all four implementation records accompany their changes. DEV0363 is allocated to independent coach website planning and is excluded.

## Implementation plan

1. Allocate this ticket/index before stylesheet or archived-record edits.
2. Move only enrollment rules to `events.css`; annotate prior records with the dated packaging follow-up and commit authorization.
3. Prepare selected index blobs from HEAD plus owned EventCard/spec/index changes; add exact preview/test/ticket files. Preserve all unrelated working-tree changes.
4. Export the index to a disposable snapshot and run tracked Events/coach tests, scoped lint/format, Node 24 type/build and documentation-link checks.
5. Complete/archive this record, verify the final staged scope and create the requested commit; report its hash without pushing.

## Acceptance criteria

- [x] AC1: Identical enrollment rules live in the baseline Events stylesheet without depending on the queued directory stylesheet.
- [x] AC2: Staged content includes only this conversation's work and the packaging correction; independent changes remain unstaged.
- [x] AC3: Exact staged-tree tests, lint/format, Node 24 type/build and documentation links pass; records and DEV commit subject are correct.

## Validation plan

Compare the moved CSS block byte-for-byte and component additions against HEAD. Export the index with `git checkout-index` to a fresh temporary directory and link installed dependencies; run Events/coach Events tests, scoped ESLint/Prettier and explicit Node 24 types/build. Resolve new-record links against that tree. DEV0362's native desktop/phone evidence remains relevant because declarations/output are unchanged; no new interaction/database rehearsal is needed. Verify exact staged paths/blobs and whitespace immediately before commit.

## Implementation record

### Changes and rationale

Moved the exact four `.event-card-enrollment` rules (22 lines) from the independently queued directory stylesheet into the existing `events.css`, already imported by the baseline Events page. Current working-tree cards retain the same declarations; the selected baseline card receives its styling without the queued redesign. No new import, property, API, behavior or dependency is needed.

Prepared three minimal index-only patches from HEAD for EventCard, the specification and ticket index. They add only 33 lines of minimum/progress/invitation logic and markup, the three-line specification amendment and owned work-record entries/reservations. Eleven exact owned preview/CSS/test/record files complete the 14-file change set. The working-tree redesign, media/map/API, public theme, Home/Explore, Auth and core coach website planning remain unstaged.

Dated annotations on DEV0359/DEV0361/DEV0362 preserve their original evidence and record the user-authorized checkpoint. Independently queued palette/Events references use the reservation register rather than missing record files. All four records accompany one commit because the same reviewed preview evolved across the first three tickets and this final correction makes it independently buildable.

### Affected files

| File                                                                                                                                                                                          | Role                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [Events stylesheet](../../../src/features/events/events.css)                                                                                                                                  | Owns the unchanged minimum-panel rules on baseline and current card layouts.                                              |
| Independently queued `src/features/events/event-directory.css`                                                                                                                                | Removed only the four rules previously introduced by DEV0362; this untracked file is excluded from the commit.            |
| [DEV0359](DEV0359-preview-athlete-and-coach-how-it-works.md), [DEV0361](DEV0361-simplify-how-it-works-preview-navigation.md), [DEV0362](DEV0362-explain-group-minimums-and-invite-friends.md) | Dated packaging/context annotations and authorized commit subject, retaining historical validation.                       |
| Preview guide (retired artifact: `previews/how-it-works/README.md`)                                                                                                                                     | Links this focused packaging/verification record.                                                                         |
| [Work index](../../README.md)                                                                                                                                                                 | Owned entries, next ID and explicit reservation of concurrent DEV0363; unrelated pending rows/formatting remain unstaged. |

### Decisions and deviations

2026-10-19: isolate the authorized commit; no product behavior change. DEV0363 was allocated concurrently to independent coach website planning before this ticket was written, so this task uses DEV0364 and excludes/reserves DEV0363. An initial patch did not apply; this task created or overwrote no DEV0363 record.

### Contracts, configuration, and operations

Only stylesheet ownership changes. No product/data/API/dependency/environment/migration change; no push or deployment.

## Validation results

- Environment: 2026-10-19, Node 24.21.0. Exported the exact index with `git checkout-index --all --prefix /private/tmp/movx-dev0364-index-z2zyv3b_/` and linked installed dependencies. No environment files or untracked implementations were copied. Verified all 14 staged paths against an explicit manifest and base HEAD `0b03711` before export.
- Relocated CSS matched `/private/tmp/movx-dev0364-enrollment.css` byte-for-byte. The exported tree contains tracked preview fonts and excludes `event-banners.ts`, `event-directory.css`, `event-results.tsx` and `google-auth-setup.md`. EventCard has 33 additions and no queued redesign imports/markup; the specification has three additions only.
- Against that export, `/Users/hoangdeveloper/.local/node/24.21.0/bin/node --import tsx --test tests/events.test.ts tests/coach-events.test.ts`: **19 passed, 0 failed**. DEV0362's earlier 26-test combined-tree run also included seven independently queued tests, so the counts deliberately differ.
- Exact-tree scoped ESLint and Prettier passed using the same explicit Node 24 executable with `node_modules/eslint/bin/eslint.js src/features/events/event-ui.tsx tests/events.test.ts` and `node_modules/prettier/bin/prettier.cjs --check` over the owned runtime, tests, preview and records.
- Exact-tree Node 24 `node_modules/next/dist/bin/next typegen`, `node_modules/typescript/bin/tsc --noEmit` and `node_modules/next/dist/bin/next build --webpack`: passed. Production compilation, TypeScript and all 27 static pages completed successfully; no shared build output or server was altered.
- Python link/source validation resolved all **43** relative links in the preview guide and four records against the export, confirmed the tracked fonts/unchanged CSS and verified queued-file exclusion. Final archived links, index status and staged whitespace are rechecked immediately before commit; no runtime source changes follow the passed build.
- Native desktop/375 px panel/text wrapping and keyboard FAQ evidence remains in DEV0362. This packaging step changes declaration ownership and commit composition only; no new control, lifecycle/data logic or service error path requires a repeated database/interaction rehearsal.

| Criterion | Evidence                                                                                       | Result |
| --------- | ---------------------------------------------------------------------------------------------- | ------ |
| AC1       | Identical 22-line CSS block in tracked stylesheet/export; no queued directory stylesheet.      | Passed |
| AC2       | Explicit 14-path index manifest, minimal shared-file patches and excluded queued source files. | Passed |
| AC3       | 19 tests, scoped lint/format, 43 links and supported Node 24 types/build passed.               | Passed |

## Risks, limitations, and follow-ups

The reviewed preview remains separate from the live How it works route. Queued Events redesign and other shared-worktree work remain independent, with their existing status/evidence unchanged. This checkpoint is a local commit, not a push, deployment or independent review. Native evidence covers the reviewed combined-tree presentation; exact commit isolation is additionally proved by the exported-tree tests and build.

## Completion and review references

- Completed: 2026-10-19 — focused packaging and exact-tree verification passed.
- Commit: User-authorized checkpoint with subject `[DEV0359][DEV0361][DEV0362][DEV0364] Add How it works preview and group minimums`.
- Review: Focused source/index/link/build self-review; no independent review.
- Deployment or release: None.
