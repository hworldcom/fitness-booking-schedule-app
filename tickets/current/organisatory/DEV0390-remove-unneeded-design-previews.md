# Ticket DEV0390: Remove unneeded design previews

- Status: In progress
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: Repository hygiene and push size
- Coordination: None — independent development ticket
- Related records: [DEV0389](../../archive/frontend/DEV0389-review-pending-documentation-and-browser-test-edits.md) (previous commit review); [DEV0235](../../archive/frontend/DEV0235-preview-home-aligned-explore.md) (earlier standalone Explore prototype)

## Objective and context

During an outgoing Git push, the user explicitly identifies preview files as unnecessary. The local branch has 110 commits beyond the known origin/main; their outgoing objects include roughly 30 MiB of standalone design-preview blobs, separate from real application images. Remove these preview artifacts and prevent their accidental tracking. The current [specification](../../../docs/mvp-spec.md) remains the application contract.

## Scope and non-goals

Remove tracked root previews/ and docs/previews/ standalone design artifacts, preserve application assets/code and product preview behavior, add precise ignore rules, and correct live artifact references without erasing historical design decisions. Inspect and stop only the identified active push to avoid racing publication. Reduce the outgoing unpublished history as necessary, with a local recovery backup and strict before/after checks. Never force-update a published remote commit or discard unrelated source edits. No deployment/database/account changes or remote push is authorized by this cleanup alone.

## Expected behavior and edge cases

No standalone design-preview blobs remain in the outgoing main history. Current app files/images and all other source/history content remain intact. New scratch previews are ignored. If remote main changes or the in-progress push has already published these commits, stop the unpublished-history rewrite path and report the actual boundary; do not force-push. Keep a private recovery copy outside normal pushed refs and prove that excluded paths are the only historical source differences.

## Assumptions, decisions, and dependencies

The latest user request authorizes removing unneeded previews; making the current push smaller also requires removing their blobs from unpushed history rather than merely deleting the final files. Preserve original commits in a recoverable local backup before any rewrite, and recheck the actual remote boundary. Historical archived ticket evidence stays identifiable; describe removed artifact paths as historical instead of claiming that the artifacts remain available. Current DEV0235 needs an explicit cancellation/removal handoff if its sole prototype is retired.

## Implementation plan

1. Inventory preview files, runtime/reference dependencies, outgoing blob sizes and the exact active push/remote boundary. Interrupt only the identified repository's current push while cleanup is underway.
2. Preserve the original branch/history and pending ticket work in a private local backup; prepare exact removal/ignore/reference changes under this ticket.
3. Rewrite only unpublished commits as needed to exclude the two preview prefixes. Preserve commit messages/metadata and all other paths, and retain a mapping/recovery reference locally. Abort on remote drift or unexpected source differences.
4. Validate no preview paths/blobs remain in outgoing history; compare all retained trees, source hashes and runtime assets. Run relevant static/link/collection checks for documentation-only removal; no hosted/UI fixtures are needed.
5. Finish/archive the ticket and index; commit with DEV0390, verify final clean source state and report the reduction and recovery location. Do not push automatically.

## Acceptance criteria

- [ ] AC1: Unneeded standalone previews are removed/ignored, and current/historical references accurately describe their retirement.
- [ ] AC2: Outgoing unpublished history contains no preview blobs; every non-preview historical tree is preserved and recovery evidence exists.
- [ ] AC3: Appropriate consistency/static checks pass; worktree is clean, remote publication is untouched and actual size/history changes are recorded.

## Validation plan

Read-only git object/path and remote-ref inspection; explicit process identity before interruption; private bundle/backup verification; per-commit retained-tree comparison and final source hashes; outgoing blob/path/size audit; ignore-rule checks; affected Markdown links/status/IDs and git diff --check. No application tests/build or live UAT writes for removal of unused standalone HTML/design assets if dependency inspection confirms no runtime import.

## Implementation record

2026-10-20 scope review: `migration-history` was additionally investigated at the user's request. It contains 53 original SQL files and is still read by baseline verification/generation/rehearsal and messaging upgrade tests. `node scripts/database-baseline.mjs verify` passed all archive/baseline checksums. Keep that 0.94 MiB archive unchanged; removing it safely requires a separate dependent-tooling/upgrade-test retirement task.

The exact active `git push` process and its repository working directory were verified, then only that process received SIGINT. Remote main was independently rechecked at the original `e14966c` boundary. The main range is linear (no merges); no published commit will be rewritten. Before removal, a verified private Git bundle and all tracked-file SHA256 values were recorded under ignored work/dev0390. Preserve the original bundle and an old/new commit map, while keeping other local branches/worktrees untouched.

The implementation will additionally write a compact retirement manifest for the 64 preview files (path, bytes, SHA256), update only dead artifact links to explicit historical paths with a dated retirement note, preserve product image attribution and the small prompt/source manifests required by the two retained production banners in public/images/retained-banner-provenance.json, cancel/archive incomplete DEV0235, and ignore both preview prefixes. Existing product assets/code and every migration-history byte stay unchanged.

## Validation results

`python3 work/dev0390/check-removal.py` passed: exactly 64 tracked prototype files removed; both precise ignore rules work; all application source, active migrations, 55 migration-history files and public image binaries retain their original SHA256 values; DEV0235 has one cancelled archive path; all 526 affected local file links resolve. `node scripts/database-baseline.mjs verify` still passes 53 archived checksums plus the baseline. `git diff --check` passed. No application execution/build/hosted changes are needed because no runtime imports or source bytes changed.

The removal checkpoint remains In progress until the unpublished-history filtering, per-commit retained-tree proof, remote-boundary recheck and outgoing-object audit complete. Commit IDs mentioned in older tickets will be preserved as original references, with a checked-in old/new hash map after filtering; historical deployed-source metadata is not rewritten.

Initial read-only checks passed. The preview prefixes contain 64 currently tracked files, about 30.12 MiB, with no imports in application code or executable project scripts/tests. Public banner images include byte-identical adopted variants, so their binaries and text provenance must remain; filtering only preview paths does not promise removal of a blob also reachable under a production path.

## Risks, limitations, and follow-ups

Unpublished commit IDs can change when preview artifacts are removed from their ancestor trees. Existing local branches/worktrees must be preserved and their relationships explained. Remote drift/published history blocks this rewrite path. A file deletion alone does not remove old outgoing Git blobs.

## Completion and review references

- Completed: Not completed.
- Commit: Pending.
- Review: Self-review; no independent review.
- Deployment or release: None.
