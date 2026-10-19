# Ticket DEV0376: Curate UAT reviewed gym catalog

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: UAT coach onboarding
- Coordination: [COR0031 — Berlin training-location onboarding](../organisatory/COR0031-berlin-training-location-onboarding.md)
- Related records: Peer [DEV0377](../frontend/DEV0377-separate-berlin-gym-and-address-search.md); historical [DEV0349](../../archive/backend/DEV0349-restrict-fictional-coaches-to-local-development.md).

## Objective and context

The user explicitly requested removing all reviewed gyms from UAT and adding only Chimosa Berlin. UAT currently offers seven fictional catalog entries. Replace selectable choices without rewriting coach-owned locations or scheduling history, following [retained-data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity). This exact request authorizes the named retained catalog changes below; it does not authorize demo setup, account changes or production edits.

## Scope and non-goals

Only hosted dev project `mdzidiqosxbghmfyxphb`, active dataset `20000000-0000-4000-8000-000000000001`. Set the following seven existing gyms from active to inactive, allowing only their status and normal updated timestamp to change:

| ID | Name |
| --- | --- |
| 40000000-0000-4000-8000-000000000001 | Northside Combat |
| 40000000-0000-4000-8000-000000000002 | Fabrik Training |
| 40000000-0000-4000-8000-000000000003 | Studio Vela |
| 40000000-0000-4000-8000-000000000005 | Groundline MMA |
| 40000000-0000-4000-8000-000000000006 | Kiezstrike Club |
| 40000000-0000-4000-8000-000000000007 | Quiet Current Recovery |
| 40000000-0000-4000-8000-000000000008 | Nightshift Athletic Club |

Create one real, user-requested active catalog record: `9c5d7792-03b2-40bf-9bde-641ac2c22cbc`, slug `chimosa-berlin`, name Chimosa, Linienstraße 127, 10115 Berlin, Germany; Mitte, DE, Europe/Berlin; latitude 52.526682, longitude 13.389507; permanent-geocoding/geoapify; record source user. Factual description only: martial arts and fitness facility in Berlin-Mitte.

Exclude schema/code/seed changes, purging referenced rows, reassignment of existing locations, account/application/profile edits, local and production catalogs, and broad reseeding.

## Expected behavior and edge cases

Chimosa is the only active reviewed choice. Seven old records remain resolvable for five existing profile and five training-location references. Existing bookings and location snapshots remain byte-for-byte unchanged. Lock and verify exact original rows before changes; reject unexpected catalog/run drift rather than broadening the operation. Exact re-execution may verify the applied state without overwriting later user changes.

## Assumptions, decisions, and dependencies

Removal means retiring selectable choices, because profile/location foreign keys restrict deletion and history must survive. Official [Chimosa website](https://www.chimosaberlin.de/) confirms Linienstraße 127 and martial arts/fitness; actual Geoapify Places response confirms the coordinates. Operator SQL is available through the linked dev CLI. No runtime/operator secret is added to source or Vercel. The search behavior is separately owned by peer DEV0377.

## Implementation plan

1. Recheck linked target and exact gym identities/state against the private read-only inventory.
2. Prepare a repeatable-read transaction with bounded locks, explicit IDs, before/after fingerprints of all unrelated app/Auth/storage tables, and stable-field checks on the seven old rows.
3. Rehearse with rollback, inspect preservation and the sole-active-Chimosa result, then run the same guarded transaction with commit. Independently reread the final catalog/references.
4. Verify the actual UAT reviewed selector using a separate QA window without saving a coach draft. Record operation, rollback and preservation evidence, update index/archive when complete.

## Acceptance criteria

- [x] AC1: Chimosa is the sole active reviewed gym in the named UAT dataset with verified address, coordinates and honest provenance.
- [x] AC2: All seven exact old rows retain original fields except status/updated_at; all unrelated data and references are preserved.
- [x] AC3: Rollback rehearsal and committed operation pass; independent SQL and actual UAT selector agree, with no local/production/seed/account changes.

## Validation plan

Guarded rollback-only and committed SQL, repeatable-read table fingerprints, exact stable-field/reference checks, independent readback and native UAT selector. No migration/application tests are needed for existing-schema catalog data; no test fixtures or resets. Check ticket/index links and final diff against this manifest.

## Implementation record

### Changes and rationale

Retired exactly the seven named choices and inserted Chimosa as the sole active reviewed gym. Old fields were preserved except status/updated_at. The guarded operation rejected catalog drift, checked that referenced coaches were hidden demo profiles, and preserved all unrelated data across 57 app/Auth/storage tables. Five profile and five training-location references remain unchanged. No coach content, account, approval or schedule row was edited.

### Affected files

This operation record and [ticket index](../../README.md). Private SQL/evidence under ignored work/dev0376; hosted app.gyms is the only intended data mutation.

### Decisions and deviations

2026-10-19: Use inactive status rather than deletion to preserve foreign-key references and history. This meets the requested removal from reviewed choices.

### Contracts, configuration, and operations

No schema, API, dependency, environment, Auth or startup change. Rollback can deactivate this exact new Chimosa row and reactivate the seven original rows after checking for intervening edits/references; never delete history. No production connection is used.

## Validation results

2026-10-19 hosted dev: `supabase db query --linked --project-ref mdzidiqosxbghmfyxphb --file work/dev0376/dry-run.sql -o json` passed with rollback at 20:35:20 UTC; the same guarded apply.sql committed at 20:36:39 UTC. Both reported 57 preserved tables, all unrelated row hashes unchanged, seven inactive gyms, sole active Chimosa and five unchanged references of each kind. Independent verify.sql reread agrees. The initial read-only inventory query used a nonexistent demo_runs.record_source column, failed without writes, and was corrected before the operation. Native Chrome UAT desktop (1390×775) and emulated phone (375×568) selectors both showed only the placeholder and Chimosa at Linienstraße 127; none of the seven retired entries appeared. QA performed no profile Save.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Official website, real Geoapify response and independent final catalog readback | Passed |
| AC2 | Rollback and apply stable-field assertions plus 57-table fingerprint equality | Passed |
| AC3 | Rollback/apply/readback and actual desktop/phone selectors agree | Passed |

## Risks, limitations, and follow-ups

Old gym-linked locations may no longer be eligible for new availability while their gym is inactive; their snapshots/history remain unchanged. All five references were confirmed to belong to retained hidden demo profiles before applying. No migration of a real coach's selected location is included. Native integration is coordinated with DEV0377.

## Completion and review references

- Completed: 2026-10-19 — sole active Chimosa, exact old-row preservation, rollback/apply/readback and both responsive selectors passed.
- Commit: c8fc13a032ecf8656699e44987526ed5d5caba94 — `[DEV0376] [DEV0377] Curate UAT gyms and separate Berlin location search`; final evidence/archive follows in a documentation checkpoint.
- Review: Self-review of exact manifest, stable-field assertions, 57-table preservation and final desktop/phone selector; no independent review.
- Deployment or release: Catalog committed live in UAT at 20:36:39 UTC; no app deployment needed for the catalog alone.

### Final integration and preservation review

The catalog was checked again through the actual hosted app after DEV0377 source deployment. Desktop and 375×568 emulated phone dropdowns each show only Choose a gym and Chimosa. QA never submitted a coach profile. The original user draft window was not reloaded or saved; only a temporary window was used and closed. Existing five linked locations remain attached to hidden demo coaches and were not reassigned. Production/local seeds and accounts were untouched. Exact comparisons against the pre-QA private snapshot confirm unrelated specification/index/browser-test edits are preserved after removing only this task’s additions. No schema/application runtime edit belongs to this data ticket.
