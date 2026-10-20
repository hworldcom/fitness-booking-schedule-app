# Ticket DEV0391: Remove unused public images

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: Repository asset hygiene
- Coordination: None — independent development ticket
- Related records: [DEV0390](../organisatory/DEV0390-remove-unneeded-design-previews.md) (previous standalone preview removal)

## Objective and context

The user identifies unused pictures in public/images while investigating slow pushes. The push of `125a36c` has now succeeded and remote main matches it; measured SSH output advanced from 19,268,966 to 20,305,778 bytes during the final ten-second sample. No published history may be rewritten for this cleanup. Remove pictures without runtime/data consumers while preserving the [current product contract](../../../docs/mvp-spec.md) and retained demo data.

## Scope and non-goals

Remove six unused image files: club-friends-hero.webp, muay-thai-studio.webp, strength-studio.webp, home-coaching-banner.png, home-training-collage.png and run-club.webp. The running photo is referenced only by an exported Artwork component with no application/script/test callers; remove that dead component and its now-unused imports. Preserve its other shared UI exports and avoid unrelated CSS cleanup. Keep the actual Home/Explore/Events photos and six seeded/demo coach portraits, prompt files and provenance. Move the retired banner provenance JSON from public serving into docs/design and update affected current/historical file links with dated retirement context. Keep the SQL migration archive unchanged.

No photo transformations, new image assets, route/visible layout changes, dependency/environment/database/account writes, deployment or remote push. This is a normal forward commit; no force-push or further published-history filtering.

## Expected behavior and edge cases

All live page images and dynamically resolved demo portraits still exist at the same paths and with identical bytes. No runtime reference to a removed image remains. A filename search alone is insufficient for portraits: seed/provisioning and slug-derived paths establish their current use. Retired generation prompts/attribution remain documentary evidence without pretending retired files are present. User-uploaded images live behind the existing Storage adapter and are not part of this deletion.

## Assumptions, decisions, and dependencies

Source searches cover src, scripts, tests, seeds and active migration SQL, with dynamic demo fixture construction reviewed. The current build uses Next.js 16.3.8; relevant bundled Image documentation was read before removing the unused integration. A read-only UAT stored-reference check will confirm no account/content row refers to the six candidate static paths. If a candidate is referenced, retain it and narrow scope before deletion. The user's unused-picture report authorizes this cleanup; earlier commit authorization covers its concrete record/source commit. Existing published image history remains available rather than rewriting the now-published boundary.

## Implementation plan

1. Complete static/dynamic consumer and stored-UAT-reference audit; record the exact removal manifest and before hashes.
2. Remove the six files and unused Artwork component/imports, move retired provenance into docs, and correct affected asset/ticket links without discarding past validation history.
3. Validate live image/portrait paths and unchanged asset/source/SQL hashes, remaining exports, full unit/server tests and isolated lint/type/build checks as appropriate. No browser rehearsal is needed for removal of an uncalled component and unreferenced assets; no rendered UI changes.
4. Finish/archive this ticket and update the index, commit only the owned scope, verify a clean tree and report that the earlier push completed successfully. Leave the new commit local unless asked to push.

## Acceptance criteria

- [x] AC1: Six unused files and their dead component consumer are removed without deleting live images/portraits or altering retained data.
- [x] AC2: Retired artwork/source provenance remains documented; affected paths and index/ticket links are accurate.
- [x] AC3: Meaningful static/unit/build checks and preservation comparisons pass, scope is committed cleanly, and published history is unchanged.

## Validation plan

Read-only source/seed/dynamic-path analysis and bounded UAT aggregate reference counts; exact removal and retained image hashes; affected local links/anchors and diff whitespace; npm test plus lint/typecheck in a fresh isolated source snapshot excluding unrelated ignored work/tmp copies. Use a production build if needed to validate module/export removal. No new implementation-mirroring test, UI fixture, database migration or image-generation tool is needed for deleting unreferenced artifacts.

## Implementation record

Read-only audit found no stored references across all 54 UAT application tables. Source/seed/migration/script/test searches confirm five candidate pictures are unreferenced; run-club.webp is referenced only in the uncalled Artwork export. Remove that component and its Image/decorative-icon imports, keeping all other shared UI exports intact. The exact six-file byte/hash manifest is docs/retired-unused-images.json. Retired banner source/prompt payloads move to docs/design/retired-banner-provenance.json with current retirement metadata; original prompt/manifest payloads remain intact.

No route, visible layout, profile/seed, schema, image bytes or image provider behavior is changed. Corrected asset links now identify retired paths and include dated notices; published original files remain accessible at 125a36c. No history rewrite or remote push is part of this change.

## Validation results

2026-10-20, Node.js 24.21.0 / Next.js 16.3.8:

- Read-only `node work/dev0391/audit-stored-references.mjs`: passed, zero candidate references across all 54 UAT application tables on explicit hosted-dev `mdzidiqosxbghmfyxphb`; SELECT-only scan ended with rollback. Two initial diagnostic queries were rejected (reserved SQL column label, then temporary-table creation in read-only mode); neither wrote application data. The final implementation uses metadata enumeration plus read-only SELECT unions.
- `python3 work/dev0391/check-removal.py`: passed. Exactly six binaries totalling 5,034,021 bytes (4.80 MiB) were removed; nine current images remain. Every other application source file, SQL/SQL-history file and retained public image matches its original SHA256. The eight retained shared UI function bodies match their originals exactly. Original nested prompt/manifest payloads for both retired banners are preserved in docs/design. No source/seed/script/test/migration reference to any removed filename remains. All 364 affected local file links resolved before archive closure; all 368 final file/anchor references resolved after archival links were updated.
- `npm test`: 360 unit plus 68 server tests passed (428 total), zero failures/skips. No permanent test was added merely to mirror a file deletion.
- Full `npm run lint` and `npm run typecheck`: passed in a fresh git-archive source snapshot overlaid with the actual pending changes. This excludes the unrelated ignored work/tmp copies already documented by DEV0371; no project check configuration was changed.
- `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack`: passed in the same isolated source snapshot, including production compilation, TypeScript and static generation. The installed CLI's supported Webpack flag was used for validation; no application/deployment configuration was changed. Private source path and logs are under ignored work/dev0391.
- Targeted Prettier checks for ui.tsx and both new/moved JSON documents passed; git diff --check passed. No new rendered interface was introduced: the deleted export has no caller, so no desktop/mobile browser rehearsal or live user writes were needed. Existing active page source and image bytes are unchanged.

### Files and roles

[Shared UI module](../../../src/components/ui.tsx) loses only the uncalled Artwork component and its now-unused image/icon imports. [Removal manifest](../../../docs/retired-unused-images.json) records exact six paths, original sizes/hashes and the published recovery revision. [Retired banner provenance](../../../docs/design/retired-banner-provenance.json) preserves source/prompt content outside public serving. [Public asset guide](../../../public/images/README.md), historical DEV0043/DEV0044 asset notes and DEV0308/DEV0390 records carry dated retirement/move notes and corrected links. This ticket/index record the scoped validation and completion. No API, database, dependency, environment, seed or migration contract changed.


## Risks, limitations, and follow-ups

Deleting files now removes them from the working release; existing published Git objects remain in history. Current page photos are intentionally retained even when large. No claim that every upload-network problem is fixed by deleting assets.

## Completion and review references

- Completed: 2026-10-20 — unused assets/dead consumer retired; required data-reference, source/asset preservation, test/static/build checks passed.
- Commit: Included with implementation/validation evidence in `[DEV0391] Remove unused public images`.
- Review: Removed paths, dynamic portrait consumers, stored-reference audit, retained export/source hashes and staged scope self-reviewed against AC1–AC3; no independent reviewer.
- Deployment or release: None. Earlier user push succeeded at 125a36c.
