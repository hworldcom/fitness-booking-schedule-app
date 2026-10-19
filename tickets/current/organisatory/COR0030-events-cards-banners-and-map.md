# Coordination COR0030: Events cards, banners and map

- Status: In progress
- Created: 2026-10-18
- Last updated: 2026-10-19
- Milestone: Public group-session discovery
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: [DEV0356 persistence/public media](../../archive/backend/DEV0356-persist-group-session-banners.md), [DEV0357 owner uploads](../frontend/DEV0357-manage-group-session-banners.md), [DEV0358 discovery cards/map](../frontend/DEV0358-redesign-events-cards-and-map.md).
- Related records: Historical [DEV0240 Events discovery](../../archive/frontend/DEV0240-add-group-event-discovery-and-joining.md), [DEV0316 coach cards](../../archive/frontend/DEV0316-redesign-coach-directory-cards.md), [DEV0355 banners](../../archive/frontend/DEV0355-align-discovery-banner-headlines.md).

## Objective and boundaries

Coordinate Home-like event cards with a small public coach portrait, optional per-session banner, coach-banner fallback, three columns where space permits, append-only Load more and a right-hand venue map like Explore. The separate event image plus coach-banner fallback is explicitly confirmed by the user. This record groups work and does not implement runtime behavior. Published time/venue/price/capacity and registration/confirmation authority remain unchanged.

## Direct development work

| Implementation part | Development ticket | Owned deliverable | Start condition |
| --- | --- | --- | --- |
| Image authority and read contract | [DEV0356](../../archive/backend/DEV0356-persist-group-session-banners.md) | Additive banner persistence, owner/revision/Storage APIs, revocable public image reads, narrow coach/card-media projection, migrations and backend proof; current specification amendment. | May start now. |
| Owner image controls | [DEV0357](../frontend/DEV0357-manage-group-session-banners.md) | Upload/replace/remove on saved draft/upcoming owner session, independent-save/retry feedback and frontend proof. | Stable DEV0356 contract. |
| Discovery and integration | [DEV0358](../frontend/DEV0358-redesign-events-cards-and-map.md) | Bordered Home-like cards, fallback media, responsive grid/right map/mobile switch, cursor-backed Load more/filter recovery, final real integration proof across image controls and public discovery. | DEV0356 projection stable; complete integration after DEV0357. |

All required peers exist; none has child development tickets.

## Other relationships

DEV0321 coach banner persistence, DEV0292 Storage and delivered provider-neutral map are existing dependencies, not direct members. DEV0240 group lifecycle and DEV0350–DEV0355 public design are historical baselines. COR0021/COR0028 retain their independent unfinished work; this does not complete either.

## Delivery sequence and completion conditions

Deliver DEV0356 first, then DEV0357 and DEV0358 against its stable contract. Owner controls and discovery can be developed independently after that boundary but this run is sequential. Complete only after all three peers pass their criteria and integrated owner-upload/public-card/fallback/map/paging/phone/keyboard proof passes. No commit, shared reset or hosted rollout is included. No missing prerequisite currently blocks planning; migration/runtime environment failures must be recorded accurately.

## Progress and integration record

2026-10-19: User requested Chrome rerun. DEV0357/DEV0358 validation resumes in a separate Incognito window after native control reconnected; earlier blocked results remain history pending actual checks and exact fixture cleanup.

Chrome retry added real desktop owner upload/reload/replace/remove/invalid/keyboard-removal evidence and public uploaded/replacement/coach-fallback observations. Production build and API assertions passed again; native Load more reached 23 and focused the first appended article. The 375 px owner picker then stalled, and subsequent native observations lost page content. DEV0357 AC1 is now met; remaining phone/recovery and public keyboard/filter-reset integration keep both frontend peers Blocked. Their records separate observed passes from attempted checks; no runtime code or hosted migration changed in this retry.

The Chrome retry removed its exact temporary fixtures and preserved all 24 retained-row fingerprints. Its preview stopped. Final native window-close/observation timed out, so the dedicated Incognito window may remain open; no other window was closed. All 326 local links checked in the updated records resolved and `git diff --check` passed.

2026-10-18 rerun: user requested retry. DEV0357/DEV0358 native validation resumed with production-mode temporary fixtures; retain the prior blocker record until replaced by fresh evidence.

Rerun result: the disposable schedule no longer crosses Berlin midnight; production build, 22 focused regressions and real API paging/media/refusal/GET-continuation checks passed again. Native Firefox signed in, but its controller returned a stale sign-in screenshot and no owner page controls despite the updated owner URL/title. Required file-picker/phone/keyboard/recovery and public keyboard/filter-reset cases still cannot be verified. DEV0357/DEV0358 return to Blocked; their records contain exact evidence and next actions. Exact fixture cleanup and all 24 retained-row fingerprints passed; the dedicated preview stopped and its test window closed.

2026-10-18: User confirmed per-session image with coach-banner fallback. Adopted defaults: portrait/initials from the public coach identity only; separate image save/revision from frozen session terms; owner may change a banner on a saved draft or future open/confirmed session, never historical/terminal sessions; three cards beside the map only at suitable widths, fewer columns below; mobile defaults to list; map pins identify displayed sessions at their published venues, not coach bases or all inventory. Unrelated work and retained demo data stay untouched.

DEV0356 interfaces are stable: isolated fresh/retained-data migrations and nine boundary checks each passed; public/owner route and Storage workflow regressions pass. Backend build, real API upload/replace/remove/current-read proof, local additive rollout and retained-data cleanup passed; DEV0356 is completed. Owner controls and public directory code exist. DEV0357/DEV0358 remain blocked on native file-picker/phone/keyboard/recovery acceptance after computer-control errors; do not close this coordination record.

## Validation results

2026-10-19 commit review: the user authorized committing the coherent DEV0350–DEV0358 delivery. Exact staged-source checks passed 51 frontend/domain tests, 16 backend tests, lint/format/type/build and 655 local documentation links. DEV0357/DEV0358 remain Blocked; this coordination stays In progress. Google-auth edits and unrelated browser-test removals remain outside the commit. No deployment or additional migration was performed.

Flat work map and final links/statuses reviewed. DEV0356 records isolated fresh/upgrade, real Auth/Storage and unchanged-term proof. DEV0358 records passed public 1600/1200/375 px cards/map, 20→23 pagination and 503/provider fallback cases, 22 frontend and 16 backend regressions, lint/type/build/source comparisons and exact fixture cleanup. Owner controls rendered after native sign-in, but file-picker/keyboard/recovery proof remains blocked by computer-control failures. Finish those cases in the production-mode fixture companion before completing DEV0357/DEV0358 and this record.

## Risks, limitations, and follow-ups

Media must remain private for drafts/hidden coaches and cease serving obsolete references; fallback must not impersonate an event-specific image. Appended pages must reset on filter changes, deduplicate stable session IDs and retain authoritative cursors without claiming a complete map. No new gallery/video, live location, pricing/ranking filters or bookings changes.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0356 Completed; DEV0357 Blocked; DEV0358 Blocked.
- Commit: Not applicable — coordination IDs never enter commit subjects.
- Review: Initial scope/work-map self-review; independent review not performed.
- Deployment or release: None.
