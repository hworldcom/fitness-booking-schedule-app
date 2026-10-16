# Ticket DEV0256: Rehearse calendar and availability

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: M9 — Coach calendar and effective availability
- Coordination: [COR0023 — Coach calendar and availability](../organisatory/COR0023-coach-calendar-and-availability.md)
- Related records: contract owner [DEV0251](../organisatory/DEV0251-define-coach-calendar-and-availability.md); peer dependencies and external M7 relationships are mapped in COR0023.

## Objective and context

Prove the complete adopted calendar/availability flow with real local coach and athlete accounts, authoritative database outcomes and responsive recovery after all M9 runtime peers deliver.

Implement against [specification section 18](../../../docs/mvp-spec.md#18-coach-calendar-and-effective-availability), [M9](../../../docs/mvp-spec.md#12-delivery-milestones) and the [acceptance matrix](../../../docs/mvp-spec.md#13-acceptance-matrix). Confirmed choices and adopted operating defaults are distinguished in the specification; reference Everfit controls are not additional requirements.

## Scope and non-goals

- In scope: A dedicated localhost app using explicitly selected hosted dev, exact tagged rehearsal fixtures/cleanup and a reproducible command; combined private/group/calendar/editor/public-date/request flows; actual concurrency/recovery/privacy assertions and desktop/mobile/keyboard evidence; README command documentation and durable integration handoff.
- Out of scope: Implementing missing peer features under a test ticket, resetting shared data, hosted deployment, repeating independent M7 lifecycle implementation, external calendar/provider setup or simulating away required real application/database flows.

## Expected behavior and edge cases

Use at least one approved coach with two venues, two athletes, pending and confirmed private sessions, policy/manual closures and real published groups. Include group time beyond the old seven-day horizon, cancellation on a retained day off, restored new occurrence identities, month overflow and no coach visit on horizon advancement. Unavailable/uncertain/stale responses must show honest recovery; private responses must not contain unrelated athletes or coach-private metadata.

## Assumptions, decisions, and dependencies

DEV0252–DEV0255 must complete their required checks. DEV0271 has applied the unchanged owner-calendar migration to the adopted hosted-dev project, whose expected ledger is baseline/effective-availability/owner-calendar. DEV0239 has completed its real group-owner checks, and DEV0254 has completed actual calendar-to-original-detail Auth/browser evidence; their archived records supply these prerequisites. DEV0253/DEV0255 completed their live criteria and exact cleanup under checkpoint `ed963f8`; their archived records are prerequisites for this combined rehearsal. Discover current namespace/migration/fixture state before setup. Existing M7 and note/application work remain independent; final rehearsal cannot silently omit group links or overwrite their fixtures. Do not recreate the retired Docker stack or apply another migration under this proof ticket.

Scope review: this record owns one delivery boundary under a flat coordination. The listed peer criteria are complete; implementation starts under the user's existing authorization on 16 October 2026. Inspect actual versions/bundled documentation before framework or SDK integration changes and update this plan before material deviations.

## Implementation plan

1. Map section 18 scenarios to exact completed peer evidence. Reuse their maintained hosted fixture/guard helpers where appropriate; define one explicit `--environment dev --check|--run` command, private source snapshot and dedicated localhost app. Require the confirmed dev project, restricted runtime, exact migration ledger, real Auth OTP sessions without email, independently tagged accounts and no shared-data reset. Refuse production, existing-account enrollment, foreign cleanup and provider changes.
2. Exercise weekly copy/range saves, custom/day-off override, retained private/group warnings, pending closure, reload and explicit restoration; follow original request/booking/group links and verify history/new request identities.
3. Exercise all calendar views/filters/overflow and complete public 30-day navigation/requests with time-boundary and concurrency evidence. Combine relevant existing M7/M8 authorization/card/race suites rather than inventing browser-only authority checks.
4. Capture desktop/375/430 px and keyboard/error-state outcomes, stop owned processes and verify exact fixture cleanup plus preservation of pre-existing application/Auth/Storage records. Retain private UUID-only recovery IDs if cleanup fails; do not restore fingerprints by overwriting data. Document the actual command in README and resolve failures in their owning peers. Complete only after all required scenarios pass.

## Acceptance criteria

Concrete integration plan (2026-10-16, before implementation): once DEV0253/DEV0255 finish their focused live criteria, reuse their maintained real-account suite through a single-invocation exported runner with explicit DEV0256 options and stage callbacks. Parameterize only the helper's rehearsal identity/tag/output through an allowlist of DEV0253/DEV0256; retain exact-dev, ledger, restricted runtime, no-email OTP, cleanup and original-row hash gates. The CLI entry remains compatible and imports do not start a run. DEV0256 gets its own documented `test:calendar-hosted -- --environment dev --check|--run` command and evidence directory; credentials remain in memory.

Use one fixture cohort across weekly save, pending requests/booking/group, custom venue replacement, day off/cancellation and fresh restoration. At those checkpoints read the real coach Day calendar through a separate authenticated owner page and assert exact row counts, actual venues, original booking/group/request destinations, closed IDs/history and withheld capacity. Verify default Week, Month/More and type/venue filters against the same records, including desktop/375/430 and keyboard. Prepare an independent published group beyond the private horizon and prove it appears without fabricated private capacity. Exercise an actual concurrent availability-save/group-publication pair through restricted runtime calls and require no published-group/open-private overlap, using the completed backend race suites for detailed acceptance/cancellation permutations. Reuse peer privacy/card/retry/unavailable evidence explicitly while the full shared run repeats their real stages. Failures remain owned by the appropriate peer. The source archive and production build are pinned to the committed integration checkpoint before live execution. The prerequisite criteria have now passed; this is the reviewed implementation plan.

- [x] AC1: A documented explicit-dev command serves its own localhost app against the confirmed hosted-dev environment, exercises real integrated flows and cleans up only its exact tagged records/accounts while preserving existing data.
- [x] AC2: Combined proof covers 30-day public eligibility, mixed Day/Week/Month calendar, whole-date replacement, retained-session warnings, pending closure, fresh restoration and cancellation without reopening day-off capacity.
- [x] AC3: Actor/media/roster/candidate privacy and request-card/history integrity survive stale/retry/concurrent scheduling/group operations without overlapping coach time.
- [x] AC4: Desktop/mobile/keyboard/overflow/unavailable checks and required existing regression/static/build results are recorded against scenarios; no missing group/runtime dependency is labelled a pass.

## Validation plan

Run the new documented command against the adopted hosted-dev Auth/PostgreSQL environment, with an owned localhost app and exact tagged cleanup. Do not run legacy destructive Docker rehearsals unchanged. Reuse completed peer database race/migration evidence, and run npm test plus relevant maintained availability/request/group/public/browser suites, lint, typecheck, format:check and build where applicable. Inspect final desktop and 375/430 px rendered states and keyboard focus, not just action attempts. Record failed, blocked and not-run evidence explicitly; hosted dev validation is separate from UAT/production deployment.

## Implementation record

Implementation started on 16 October 2026 after DEV0253/DEV0255 checkpoint `ed963f8`. The concrete plan above was recorded before runtime edits.

### Changes and rationale

The maintained availability/public runner now exports one explicitly invoked run and optional stage callbacks; importing it has no target/fixture side effects. The DEV0256 wrapper observes the same real records at mixed, custom, day-off/cancelled, restored and final checkpoints. It compares the owner projection with rendered Day items, follows original request/booking/group destinations, verifies default Week and complete Month/More/filter behavior, and checks responsive privacy/recovery plus independent future groups and concurrent policy/group publication. The full peer suite remains present and runs under the separate DEV0256 Auth tag and localhost port.

### Affected files

- [Integration runner](../../../scripts/rehearse-hosted-calendar-integration.mjs): same-cohort calendar UI/projection/destination assertions and group/concurrency fixtures.
- [Shared flow](../../../scripts/rehearse-hosted-coach-availability.mjs): explicit exported invocation and five observation checkpoints; existing CLI cases remain compatible.
- [Guarded helper](../../../scripts/lib/hosted-availability-rehearsal.mjs): allowlisted DEV0253/DEV0256 tag, port, evidence and exact recovery ownership; existing target/ledger/Auth/cleanup/preservation gates remain mandatory.
- [Runner tests](../../../tests/hosted-calendar-integration-runner.test.ts): inert imports, production/unknown/partial selection refusal and private-value redaction before fixtures. The existing DEV0253 guard test remains unchanged.
- [package.json](../../../package.json) and [README](../../../README.md#checks): actual `test:calendar-hosted` command, prerequisites, output and exact cleanup. No app route/service, schema or migration changes.

### Decisions and deviations

2026-10-16: Created from the confirmed feature scope and section 18 operating defaults. No runtime decisions/deviations or implementation evidence yet.

2026-10-16 planning correction: hosted dev is now the repository's adopted local-app database/Auth target, and DEV0270 removed the old Docker services. Updated this still-Draft plan and AC1 before any runtime edit. DEV0271 supplies the required migration rollout. DEV0253/DEV0255 are currently validating their own live flows, while DEV0254/DEV0239 retain their independent acceptance work. This change authorizes no missing peer implementation and does not mark the combined rehearsal started or passed.

### Contracts, configuration, and operations

No application contract, dependency, environment variable, schema, grant, migration or deployment changes. The new opt-in command uses the existing ignored hosted-dev settings and a separate localhost port 3156. Exact recovery must use the DEV0256 wrapper because the helper validates the manifest's original ticket/run/UUID tags; DEV0253 cannot delete DEV0256 fixtures. Credentials and Auth cookies remain in memory. Screenshots/logs are ignored under `test-results/dev0256-hosted/<run-id>/`.

## Validation results

Final review: 31 relative links across this record and COR0023 resolved; all six direct peers are uniquely archived/Completed with reciprocal coordination links and one index row each. Full `git diff --check` passed. The final change contains evidence/status/lifecycle links only; the live-tested runtime/runner source remains `526e749`, and unrelated workspace work is preserved.

Final live result (2026-10-16): `npm run test:calendar-hosted -- --environment dev --run` exited 0 for run `a3319062-7e2a-436e-a045-dbafdf42932e`, pinned application source `526e749`, confirmed hosted dev `mdzidiqosxbghmfyxphb`, production localhost app port 3156 and five new genuine OTP identities. All five same-cohort calendar checkpoints, full real editor/public/recovery stages, actual concurrent group/policy operations, desktop/375/430/keyboard and access checks passed with zero recorded page errors. Exact tagged application/Auth fixture cleanup and every original non-temporary application/Auth/Storage row hash passed. The production build had no compilation database URL. No email, reset, migration, Docker operation, existing-account change or deployment was performed.

Acceptance evidence:

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Exact-dev command, pinned production source, independently tagged real Auth, exact cleanup and all original row hashes preserved.                                                                                                                                                                                                                                                                                                                                      | Passed |
| AC2       | Same-cohort Mixed/Custom/Off/Restored/Final calendar: original destinations; Week/Day/Month and full paging/exact More; seven replacement-venue hours; retained group/booking; zero private hours after day-off cancellation; eight fresh restored hours and new pending identity; complete public thirty dates/final-day request/reload/withdrawal.                                                                                                                   | Passed |
| AC3       | Calendar projection excludes actual athlete identifiers; public candidate isolation and atomic neutral closure cards; exact/altered/stale save recovery; genuine concurrent group publication and custom policy save both commit with zero open private overlap; independent group at day +35 with no invented private capacity. DEV0252 owns detailed accept/cancel race permutations; DEV0254/DEV0239 own real unauthorized original-detail/media/roster boundaries. | Passed |
| AC4       | Production full flow plus visually inspected 1440/375/430 calendar renders, shared editor/public widths/keyboard/access, actual unavailable-read retention/reload, guarded import/selection tests, full pinned regression/lint/type/format/build checks. DEV0254 supplies its previously passed real dirty-navigation/roster scenarios; no simulated Auth/SQL outcome is claimed.                                                                                      | Passed |

Historical progress below records what was pending at each earlier checkpoint; this final result supersedes those pending statuses.

The Restored checkpoint and full shared recovery/public stages subsequently passed in the same run: eight fresh open private items, one pending on the new ID, no old pending/booking in the default calendar; manual closure, exact/altered/stale saves, inactive/unavailable recovery, thirty actual date links, final-day request/reload/withdrawal, explicit sign-in return and native guest/DST/forged checks. Final calendar screenshots at 1440/375/430 were visually inspected: nine readable mixed agenda items, explicit pending/open/group labels, actual long venues, no horizontal overflow and mobile controls. The final unavailable/future-group/concurrency checks and cleanup remain running.

Live continuation in the same run: Day-off passed with no open private items, the retained group, and the original cancelled booking visible through explicit history. The shared real cancellation/restoration flow then passed with a fresh requested occurrence and exactly two original/new athlete attempts; the restored calendar checkpoint is still running. Earlier Mixed/Custom, static and guard evidence remains valid. No completion is claimed before final/concurrency and exact cleanup.

Live progress, run `a3319062-7e2a-436e-a045-dbafdf42932e` against `526e749`: the same-cohort Mixed and Custom checkpoints passed. Mixed rendered nine actual day items, original confirmed booking and two-candidate pending occurrence, original request/booking/group destinations, default Week, complete 42-date Month paging with three summaries/exact nine-item More, and group/venue filters. Custom rendered seven eligible replacement-venue hours with no old pending ID, preserving the original booking/group and excluding athlete identifiers from the calendar projection. The shared runner independently verified the atomic two-request/card closure and persisted custom policy. Day-off/restoration/final/concurrency/cleanup stages remain pending; these partial passes do not complete the ticket.

Pinned-source static check: an environment-free `git archive` of `526e749` at `/private/tmp/movx-calendar-integration-final-_fy__0xb`, with installed dependencies linked and explicit Node 24.21.0, passed `npm run format:check`, `npm run lint`, `npm run typecheck` and `npm test` (201 application plus 20 server tests). The larger workspace count below additionally includes five independently owned uncommitted runner tests; these are not claimed as part of this checkpoint. The live command's production build also passed without a compilation database URL. Real combined checkpoints and cleanup remain pending.

Preparation checks (2026-10-16): `npm run test:calendar-hosted -- --environment dev --check` passed exact project, three-version ledger and restricted runtime without fixtures. Three focused guard/import tests passed, including ten prior DEV0253 selections and seven integrated unsafe/missing-configuration selections. Full workspace `npm test` passed 206 application plus 20 server tests; focused ESLint and `npm run typecheck` passed. Initial typecheck caught a widened test `NODE_ENV` string; annotating its fixture environment as `NodeJS.ProcessEnv` resolved it before the passing rerun. Production/live combined proof has not yet run; acceptance remains open.

| Criterion | Evidence                                                                    | Result |
| --------- | --------------------------------------------------------------------------- | ------ |
| AC1–AC4   | Final real combined evidence and preserved-data cleanup are recorded above. | Passed |

## Risks, limitations, and follow-ups

Hosted-dev previews/saves took roughly 14–27 seconds and requests roughly 14 seconds in this production-mode run. Performance needs follow-up before rollout; no response-time target or cause is adopted here. Detailed backend migration/lock/acceptance/cancellation permutations remain the completed DEV0252 evidence; the new race proves real publication/policy integration, not every possible interleaving. Real midnight was not awaited: database predicates/model cases prove DST/date boundaries, and real guest lazy materialization proves no coach visit is required. Session-type templates remain the independent Draft DEV0257 proposal; M7's own combined delivery and UAT/production rollout are separate.

Handoff: rerun the documented explicit-dev command only with its guarded new-account setup and exact cleanup. No required M9 criterion remains open. Existing data and independent workspace edits were preserved. Completion is local/hosted-dev verification and self-review, with no deployment or independent review claim.

## Completion and review references

- Completed: 2026-10-16 — combined calendar/editor/public/recovery/concurrency and exact cleanup criteria passed.
- Commit: `526e749` prepared the reproducible integration command; the user-authorized DEV0256 completion checkpoint contains this final evidence and lifecycle links.
- Review: Source/acceptance self-review and recorded real integration validation; no independent review.
- Deployment or release: None.
