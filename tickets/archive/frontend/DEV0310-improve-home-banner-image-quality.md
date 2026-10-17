# Ticket DEV0310: Improve Home banner image quality

- Status: Completed
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3 — Public discovery refinement
- Coordination: None — independent development ticket
- Related records: selected collage [DEV0307](../../archive/frontend/DEV0307-preview-curved-banner-with-ropes-and-kick.md); adoption [DEV0308](../../archive/frontend/DEV0308-adopt-curved-training-collage-home-banner.md); framing [DEV0309](../../archive/frontend/DEV0309-lower-home-banner-slogan-and-expand-framing.md)

## Objective and context

Before the authorized Home/banner checkpoint was committed, the user asked to fix apparent loss of picture quality. Nothing was staged or committed. Diagnose website compression/scaling versus source softness and improve fidelity while preserving the curved composition, lower slogan and [Home discovery contract](../../../docs/mvp-spec.md#42-discover-a-coach-and-time).

## Scope and non-goals

In scope: source-versus-served comparison, a bounded Home fidelity/delivery fix, necessary asset/provenance references and focused quality/responsive validation. Keep commit preparation on hold during this work and accurate in existing records.

Out of scope: new sports/scenes/people, redesigning search/other routes, auth/database/calendar changes, deployment, or claiming compression settings restore detail absent in the source.

## Expected behavior and edge cases

Keep curved windows, central ropes, kick, lower bright-area slogan and compact discovery. Avoid unnecessary lossy recompression/enlargement. Inspect desktop at normal/high pixel density and phones; retain readable fallback and first coach names. Record decoded dimensions/bytes and payload tradeoffs.

## Assumptions, decisions, and dependencies

Confirmed: apparent quality reduction should be addressed before committing. Initial evidence: source PNG is 2170 × 725 and Next.js defaults to quality 75; neither alone proves the cause. Prefer a small delivery correction if actual comparison supports it. If softness is already in the composite, consider native curved windows preserving original photograph detail; update this plan with evidence before changing approach. Inspect installed Next.js 16.3.8 bundled Image/quality documentation and optimizer code. Original photographs remain locally available.

## Implementation plan

1. Compare source PNG with browser-selected optimized images at desktop DPR 1/2 and phone widths; record source detail, dimensions and bytes.
2. Adopt banner-only quality 95 with an explicit Next.js quality allowlist `[75, 95]`, preserving other images' default 75. Correct `sizes` to request at least 480 CSS pixels on phones because the 160 px-tall image covers a roughly 479 px width behind its crop. Verify the optimizer accepts 95 before claiming the override works. Keep the PNG unchanged; no new generation/native-collage rewrite is needed for this delivery loss.
3. Verify actual Home quality, payload, slogan/coach bounds, keyboard/fallback and applicable code/static checks.
4. Update handoff/spec if delivery changes and finish this record. Resolve quality before returning to the requested checkpoint.

## Acceptance criteria

- [x] AC1: Evidence identifies website/source limits and explains the selected correction.
- [x] AC2: Actual Home preserves the chosen composition with improved delivered fidelity, accurate provenance and unchanged slogan/discovery behavior.
- [x] AC3: Responsive/high-density/fallback and applicable code/static checks pass; payload tradeoffs and remaining limits are recorded.

## Validation plan

Use installed Chrome/Playwright on the local app. Compare equal-size source/served renders, actual URLs, decoded dimensions/bytes and source identity at desktop DPR 1/2 and phones. Reuse Home bounds/keyboard/failure checks; run relevant existing unit/lint/type/build checks if component/configuration changes. Check original hashes, links and diff. No service reset/provisioning or account/booking mutations.

## Implementation record

### Changes and rationale

Diagnosis: actual browser-selected WebP at desktop DPR 1 is 1920 × 641 / 141,900 bytes; DPR 2 requests 3840 but the optimizer correctly caps output at the 2170 × 725 source (167,264 bytes). A 393 px DPR-3 phone selects 1200 × 401 / 76,234 bytes, below the roughly 1437 device pixels needed for its 479 CSS-pixel crop. Equal-size screenshots show the raw PNG is visibly sharper than the served quality-75 image. Raising delivery quality can preserve that detail; it cannot add detail beyond the PNG's native resolution.

### Affected files

- [Home image props](../../../src/features/public/coach-story.tsx): banner-only quality 95 and minimum 480 CSS-pixel phone sizing; existing image/layout/copy retained.
- [Next.js configuration](../../../next.config.ts): bounded `[75, 95]` allowlist; other images keep default 75.
- [Asset handoff](../../../public/images/README.md): delivery correction, provenance and payload/native-resolution limits.
- This ticket/index and earlier banner-ticket commit references record the quality correction and renewed checkpoint authorization. No artwork, auth or database files changed under this ticket.

### Decisions and deviations

Commit preparation paused before staging for the quality correction. After the recorded validation and quality handoff, the user renewed commit authorization on 2026-10-17.

2026-10-17: Choose the bounded quality/sizing correction based on actual raw/served comparisons. The 2.5 MB raw PNG would avoid compression but imposes a much larger initial payload. Quality 95 keeps responsive WebP delivery and preserves the original composition without another generative edit. A native original-photo rebuild is unnecessary for this measured delivery issue and is not implemented.

### Contracts, configuration, and operations

The optimizer additionally accepts quality 95; unsupported qualities still fail. Only this banner requests 95, and its phone sizing accounts for the cover crop. No image bytes, app data/API shapes, dependencies, environment variables or migrations change. Next dev detected the configuration automatically. Existing local Supabase settings were used privately for an owned production build/server; no reset/provisioning/account/booking mutation. The pre-quality staging patch is superseded. The renewed checkpoint includes DEV0310 with the completed Home/banner work; concurrent authentication and coach-website planning changes remain excluded.

## Validation results

2026-10-17, Next.js 16.3.8, installed Chrome/Playwright, actual local app and owned production build/server.

- `node work/dev0310/compare-banner.mjs`: baseline raw/served comparison at 1440 px DPR 1/2 and 393 px DPR 3, with decoded dimensions/bytes and equal-size source/served crops. Evidence is under ignored `work/dev0310/evidence/`.
- `node work/dev0310/verify-banner-quality.mjs`: **passed** actual quality-95 URLs/status/dimensions and visual inspection. Desktop DPR 1 is 1920 × 641 / 376,696 bytes; DPR 2 is capped at the source 2170 × 725 / 455,798 bytes. DPR-3 phone now selects 1920 × 641 / 376,696 bytes instead of 1200 × 401 / 76,234 bytes. All remain below the 2,577,090-byte PNG. Equal-size crops retain better face/hair/equipment detail without reinterpreting subjects.
- At equal native dimensions, decoded RGB mean absolute channel error against the PNG falls from 2.9543 to 1.4991; peak signal-to-noise ratio rises from 35.39 to 41.03 dB. This measures fidelity to the saved PNG, not recovered original-photo detail or subjective quality. Recorded in `improved.json` beside the screenshots.
- `node work/dev0310/check-home-ui.mjs`: **passed** ten Home sizes, including desktop/tablet/phone breakpoints and 375 × 667. First two actual coach names fit, search remains 64 px, controls at least 44 px, no overflow/page JavaScript errors. Desktop/phone image-failure fallback and footer keyboard/focus restoration passed. Artwork, slogan and layout remain unchanged.
- `npm run lint`, `npm run typecheck`, `npm test`: **passed**, 227 general/unit and 25 server checks. The initial sandboxed test launch could not open the TypeScript runner's IPC pipe; the identical suite passed with local IPC access. Static-render execution outside Next emits a default-config quality warning; actual application URLs request 95 and return 200, and the production build uses the correct allowlist. No test-only workaround was added.
- `node --import tsx work/dev0310/start-production.mjs`: guarded `npm run build` **passed**; owned production server ready at 3134. Production optimizer probes confirm 75/95 return 200 and unsupported 100 returns 400. The temporary server is stopped after checks; the user's development app remains running.
- Scoped Prettier, unchanged source-image SHA-256, local links and `git diff --check`: passed; archive references are checked during final handoff. No deployment; commit authorization was renewed after validation.

| Criterion | Evidence                                                                                         | Result |
| --------- | ------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Source/served metadata and equal-size crops identify compression/scaling and source limits.      | Passed |
| AC2       | Actual quality-95 requests improve pixel fidelity; artwork/layout/copy are unchanged.            | Passed |
| AC3       | Desktop/phone density and ten-size/fallback proof; lint/types/252 tests/build and static checks. | Passed |

## Risks, limitations, and follow-ups

Delivery is sharper but larger (about 377 KB standard desktop and 456 KB high-density desktop, versus 142/167 KB previously). The generated 2170 × 725 source still limits large/retina displays; no extra original-photo detail is claimed. Earlier artwork and unrelated authentication edits remain intact. The user requested committing after the quality handoff on 2026-10-17.

## Completion and review references

- Completed: 2026-10-17 — higher-fidelity responsive delivery and corrected phone crop sizing, with source/layout preserved and validation recorded.
- Commit: User authorized committing on 2026-10-17; included in `[DEV0298][DEV0300][DEV0301][DEV0302][DEV0303][DEV0304][DEV0305][DEV0306][DEV0307][DEV0308][DEV0309][DEV0310] Refine Home banners and compact coach discovery`.
- Review: Source/served crop, high-density/responsive/fallback and code/static self-review passed; the user requested the checkpoint after the quality handoff; no independent review.
- Deployment or release: None.
