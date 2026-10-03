# Ticket DEV0009: Comprehensive repository ignore rules

- Status: Completed
- Created: 2026-09-19
- Last updated: 2026-09-19
- Milestone: M0 repository hygiene
- Coordination: None — independent development ticket
- Related tickets: DEV0008 — RepX Club frontend foundation

## Objective and context

Expand the root `.gitignore` so generated, machine-local, sensitive, and transient files used by the Next.js application and anticipated Solana development are not added to GitHub.

The existing file covers the largest current directories (`node_modules`, `.next`, test output, environment files, and TypeScript build metadata), but omits package-manager state, deployment output, debug logs, editor files, caches, local databases, and local blockchain tooling state.

A repository-boundary inspection also found that `git rev-parse --show-toplevel` currently resolves to `/Users/hoangdeveloper`, not this project directory. The project-level ignore file can protect matching paths inside this directory, but cannot define or protect the scope of sibling repositories in the parent Git worktree.

## Scope and non-goals

- In scope: organize and extend the root `.gitignore`; preserve tracked project inputs such as source, documentation, tickets, assets, `package-lock.json`, and environment examples; document and validate the rules.
- Out of scope: initialize or move a Git repository, edit the parent `/Users/hoangdeveloper/.gitignore`, remove already tracked files, delete generated files, create a commit, or change application behavior.

## Expected behavior and edge cases

- Ignore dependency directories and package-manager machine state while retaining dependency lockfiles.
- Ignore Next.js/deployment output, coverage, browser-test artifacts, caches, logs, local databases, operating-system metadata, and editor state.
- Ignore `.env` variants and common private key/certificate files while explicitly allowing documented environment example files.
- Ignore local Solana/Anchor build and validator state plus explicitly named keypair files; do not ignore program source or general JSON fixtures.
- Keep `public/`, `src/`, `tests/`, `tickets/`, documentation, configuration, and lockfiles eligible for version control.

## Assumptions, decisions, and dependencies

- The active application uses npm, Next.js, TypeScript, and Playwright. Future implementation is expected to use Solana tooling.
- Use anchored directory patterns where repository-root scope matters and narrow secret patterns to reduce accidental hiding of valid source files.
- Do not initialize a nested repository without an explicit request because that changes repository ownership and commit behavior beyond this ignore-file update.

## Implementation plan

1. Record this ticket and add it to the index before editing `.gitignore`.
2. Replace the flat list with documented categories and missing rules relevant to the repository.
3. Validate representative ignored paths and representative source paths with Git's ignore matcher.
4. Inspect the final diff, record evidence and the repository-boundary limitation, then complete the ticket.

## Acceptance criteria

- [x] AC1: Current dependency, Next.js, TypeScript, coverage, and browser-test artifacts are ignored.
- [x] AC2: Environment secrets, private key material, logs, local databases, caches, operating-system files, and editor state are ignored while example environment files remain eligible for tracking.
- [x] AC3: Local Solana/Anchor build, ledger, and keypair artifacts are ignored without hiding program source or ordinary JSON files.
- [x] AC4: Source, documentation, tickets, public assets, configuration, and `package-lock.json` remain eligible for version control.
- [x] AC5: The ticket records that the detected Git root is the user's home directory and that changing this boundary is outside the task.

## Validation plan

- Use `git check-ignore --no-index -v` against existing generated files and representative hypothetical paths.
- Confirm representative source and project inputs are not matched by `.gitignore`.
- Review the diff and run a local Markdown-link check. Application lint, typecheck, tests, and build are not needed because runtime behavior is unchanged.

## Implementation record

### Changes and rationale

The previous `.gitignore` contained nine flat patterns. It covered the current large generated directories but left several common machine-local and sensitive artifacts eligible for accidental staging.

The file now groups rules by purpose and covers:

- npm, Yarn Plug'n'Play, Yarn cache, and pnpm machine state while retaining lockfiles and the Yarn files intended for version control;
- Next.js, generic build/export, Vercel, and Storybook output;
- coverage, Playwright reports/results/cache, and test coverage metadata;
- TypeScript and common tool caches;
- all environment variants except `.env.example` and `.env.*.example`, plus common private key and certificate formats;
- local database files;
- Anchor/Solana build, validator, and keypair artifacts;
- logs, temporary files, editor settings, and operating-system metadata.

Root-relative directory patterns reduce accidental matches inside source packages. The secret/key rules are deliberately narrower than ignoring all JSON, so normal fixtures and future program source remain trackable.

### Affected files

| File                                                                                                    | Change and purpose                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`.gitignore`](../../../.gitignore)                                                                     | Organized and expanded repository exclusions for current and anticipated tooling.                                                                                                       |
| [`tickets/README.md`](../../README.md)                                                                  | Added ticket 0009 and its final status to the project index.                                                                                                                            |
| [`tickets/archive/organisatory/DEV0009-comprehensive-gitignore.md`](DEV0009-comprehensive-gitignore.md) | Recorded scope, decisions, exact changes, validation evidence, and the repository-boundary limitation. It moved to the categorised ticket archive under 0026 and 0029 after completion. |

### Decisions and deviations

- Used the bracketed categories and conventional paths recognized by Next.js, TypeScript, Playwright, npm/Yarn/pnpm, common editors, and Anchor/Solana tooling.
- Kept `package-lock.json`, source, normal JSON, configuration, public assets, documentation, and tickets trackable.
- Did not initialize a nested Git repository or edit the home-level repository. There was no scope deviation.

### Contracts, configuration, and operations

No runtime contract, dependency, environment variable, schema, migration, or deployment behavior changed. Git staging eligibility changed only for paths matching the new patterns. Ignore rules do not remove files that were already committed; none of this project's files are currently tracked by the detected parent repository.

## Validation results

Validated locally on 2026-09-19:

- `git check-ignore -q --no-index` matrix passed for 14 paths expected to be ignored and 12 expected to remain trackable: `PASS ignored=14 trackable=12`.
- Positive matcher evidence identified the exact `.gitignore` rules for current `node_modules`, `.next`, and `test-results` content and representative environment, keypair, Anchor target, test-ledger, editor, database, and log paths.
- `git status --short --ignored --untracked-files=normal -- .` reports `.next/`, `next-env.d.ts`, `node_modules/`, `test-results/`, and `tsconfig.tsbuildinfo` as ignored. The project itself appears as untracked because Git resolves to the parent home repository.
- `find` found no nested `.git` directory inside this project. `git rev-parse --show-toplevel` returned `/Users/hoangdeveloper`.
- Markdown validation passed: `PASS: 116 local Markdown links resolve.`
- The first shell validation attempt failed because the loop variable `path` is a special zsh array tied to `PATH`, which made `git` unavailable inside the loop. The corrected command used `candidate` and passed. This was a test-harness issue and did not affect repository files.
- Application lint, typecheck, tests, and build were not run because this change affects Git ignore metadata only. No required validation remains outstanding.

| Criterion | Evidence                                                                                                                            | Result |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Existing generated artifacts are reported ignored; representative build, coverage, and Playwright paths passed the ignore matrix.   | Passed |
| AC2       | Environment, key/certificate, database, cache, editor, OS, and log cases passed; both example environment forms remained trackable. | Passed |
| AC3       | Anchor target, test ledger, and keypair cases were ignored; ordinary JSON and `programs/repx/src/lib.rs` remained trackable.        | Passed |
| AC4       | Source, tests, tickets, README, public assets, package files, lockfile, and Playwright configuration remained trackable.            | Passed |
| AC5       | Git root and nested-repository checks are recorded above and in Risks.                                                              | Passed |

## Risks, limitations, and follow-ups

The parent Git repository boundary remains a material operational risk: Git currently treats `/Users/hoangdeveloper` as the worktree and this entire project as one untracked directory. The project `.gitignore` protects matching content inside this directory, but it cannot prevent sibling home directories or repositories from being staged from the parent. Before the first commit or GitHub publication, an explicit repository setup task should decide whether this project needs its own `.git` directory.

## Completion and review references

- Completed: 2026-09-19. Expanded ignore rules and verified both ignored and trackable path classes.
- Commit subject (when requested or already authorized): `[0009] Expand repository ignore rules`.
- Review: Self-reviewed against all five acceptance criteria; no independent review, commit, or pull request created.
- Deployment or release: Not applicable.
