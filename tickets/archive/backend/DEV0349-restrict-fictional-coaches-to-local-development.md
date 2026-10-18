# Ticket DEV0349: Restrict fictional coaches to local development

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: UAT readiness / environment data integrity
- Coordination: None — independent development ticket
- Related records: Historical [DEV0335](../../archive/backend/DEV0335-provision-nonproduction-demo-coaches.md), [DEV0337](../../archive/backend/DEV0337-preserve-existing-demo-coach-data.md), [DEV0347](../../archive/backend/DEV0347-preserve-test-coach-public-urls.md).

## Objective and context

The user confirmed that fictional test coaches belong only in local runs; deployed UAT at test.movx.club will use real coaches. Existing scripts also provision the six fixtures on hosted development. Restrict creation/publication to the exact local project and retire only those fictional hosted coach identities without deleting history or affecting real users. Update the [identity/data contract](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity).

## Scope and non-goals

- In scope: fail closed before network/credential access for hosted demo setup and URL publication; preserve local stable fixture defaults; exact guarded hosted-dev retirement operation; setup/specification guidance and preservation/identity/public visibility proof.
- Out of scope: deleting Auth users/profiles/content/history, resetting a dataset, retiring the shared active dataset, changing real coach approval/onboarding, new production deployment, broad temporary-rehearsal cleanup or modifying independent active work.

The explicitly authorized hosted record allowlist is foundation run `20000000-0000-4000-8000-000000000001`, with these immutable profile IDs and corresponding original slugs:

| Coach       | Profile UUID                         | Original slug |
| ----------- | ------------------------------------ | ------------- |
| Daniel Park | 10000000-0000-4000-8000-000000000002 | daniel-park   |
| Sam Lee     | 10000000-0000-4000-8000-000000000005 | sam-lee       |
| Nora Klein  | 10000000-0000-4000-8000-000000000007 | nora-klein    |
| Idris Malik | 10000000-0000-4000-8000-000000000008 | idris-malik   |
| Elif Demir  | 10000000-0000-4000-8000-000000000009 | elif-demir    |
| Jake Miller | 10000000-0000-4000-8000-000000000013 | jake-miller   |

## Expected behavior and edge cases

Local explicit setup still creates missing demo accounts with stable URLs and preserves existing accounts/content. Hosted `--environment dev`, production/unknown targets and old hosted setup/URL commands must refuse before opening credential journals, selecting CLI targets or invoking Auth.

A separate explicit operator command may inspect or retire the above hosted fixtures on the exact allowlisted movx-dev project. Validate immutable ownership, `is_demo`, original slug, reserved Auth ID/email and tagged hosted-demo metadata for claimed fixtures. Missing fixtures are a no-op; conflicting ownership aborts the whole batch. Set only their coach visibility to `hidden` and dataset participation to `revoked` with the required revocation time/updated timestamps. This removes public availability and application actor authority, including old sessions; enrollment must not reactivate revoked participants. It preserves names, passwords/Auth rows, media, reviews, bookings/messages/group history and all real profiles/memberships. Never revoke the whole shared dataset. Repeating retirement is a no-op; seed replay must not reactivate it.

## Assumptions, decisions, and dependencies

- User authorization: current request is the narrowly scoped retained-fixture change required by DEV0337. Choose reversible hide/revocation instead of deletion so real testers retain historical records.
- UAT uses the existing dev Supabase project; verify the exact manifest/runtime/Auth project match before operator access. No production writes.
- Existing public coach/group gates enforce coach visibility, and actor/enrollment gates require active participation. Prove those behaviors on disposable records and the actual target.
- Existing historical dev tester files are retained privately; they are not active UAT login instructions and are never password-reset or rewritten by this operation.

## Implementation plan

1. Restrict all demo account/URL entry points to local and remove their hosted provisioning path. Keep explicit refusal for obsolete hosted commands so they cannot silently run against local instead.
2. Add exact-target check/apply retirement with ownership checks, atomic two-table writes and before/after preservation evidence; validate it on disposable local databases first.
3. Inspect/apply only the authorized hosted fixtures, verify public visibility and revoked actor/enrollment access, preserve real data and local fixtures/journals, then document the operational result.
4. Run relevant tests/static checks, finish/archive the record, and commit this independent slice under the user's current commit authorization. Keep unrelated unready implementation out of commits.

## Acceptance criteria

- [x] AC1: Hosted demo provisioning and URL publication refuse before network/Auth/file mutations, including direct helper calls; local creation/default URLs still work.
- [x] AC2: Exact hosted fictional coaches are hidden and their application participation revoked; their public profiles/group offers and actor authority are unavailable, with no automatic enrollment reactivation.
- [x] AC3: All other application/Auth/Storage data and real users remain unchanged; local test coaches and private tester files are preserved; repeat retirement/seed replay do not restore retired fixtures.
- [x] AC4: Setup/contract, exact validation results and remaining deployment limitations are recorded; requested commits include only their owned changes.

## Validation plan

Unit dependency traps prove hosted rejection before CLI/credentials/Auth, plus local default regressions. Disposable real database proof covers claimed/unclaimed/missing/foreign-ownership fixtures, atomic rollback, idempotence, revoked actor/enrollment checks, coach/group visibility and synthetic real-user preservation. Actual hosted check/apply uses all-row fingerprints excluding only named field changes, with exact before/after allowlist summaries and unchanged local data/journal hashes. Verify deployed UAT/read-only public projections where possible. No hosted migration, seed or reset. Run focused tests, lint, type/format and document/link checks.

## Implementation record

### Changes and rationale

All fictional-coach account/URL entry points now accept only the exact local project. The hosted provisioning branch (including remote Auth key lookup) was removed. The direct missing-account helper and private credential store also reject hosted use before touching a journal or invoking Auth. Obsolete hosted npm aliases remain explicit refusals, with their environment-file loading removed. Local creation still gets the fixed usernames and preserves existing content/passwords; normal startup remains create-free.

A separate explicit check/apply operator tool validates the exact dev project and six immutable fixture identities. It hides only those coach profiles and revokes only their dataset participation, preserving the active/public dataset real registrations use. Both prior untouched fixtures and correctly tagged claimed demo identities are supported; unexpected roles/metadata/slugs/Auth bindings fail before any updates. Missing fixtures are a no-op. Revoked participation blocks original application identities, existing actor authority and re-enrollment; hidden coach visibility suppresses public profiles/group offers without cancelling or deleting history. Repeating retirement does not update already-retired rows. The complete seed's existing no-op guard preserves retirement.

The operator transaction hashes every app/Auth/Storage table before and after, within one repeatable-read snapshot. Only visibility/updated time on the exact six coach rows and participation/revocation/updated times on their exact foundation memberships are excluded. Every other field, row, Auth credential and real user must match or the whole transaction rolls back. Concurrent unrelated tester activity is isolated by the database snapshot, rather than being overwritten or misidentified as this operation.

### Affected files

| File                                                                                                                                                                                                                        | Role                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [demo-coach-target.ts](../../../scripts/lib/demo-coach-target.ts), [provision-demo-coaches.ts](../../../scripts/lib/provision-demo-coaches.ts), [demo-coach-credentials.ts](../../../scripts/lib/demo-coach-credentials.ts) | Local-only arguments/helpers/journals; no remote provisioning or credential lookup path. Existing local preservation/default URL behavior retained. |
| [demo-coach-retirement.ts](../../../scripts/lib/demo-coach-retirement.ts)                                                                                                                                                   | Explicit action parsing, exact ownership validation, atomic retirement, all-row preservation proof and bounded public/actor evidence.               |
| [retire-hosted-demo-coaches.ts](../../../scripts/retire-hosted-demo-coaches.ts)                                                                                                                                             | Guarded CLI channel on the exact dev project, private temporary SQL/config, explicit check/apply and safe summary; no Auth API/account deletion.    |
| [demo-local-only.test.ts](../../../tests/demo-local-only.test.ts), [demo-coaches.test.ts](../../../tests/demo-coaches.test.ts)                                                                                              | Hosted rejection/dependency traps and adapted local target contract.                                                                                |
| [database proof](../../../tests/database/demo-coach-retirement.test.ts), [disposable runner](../../../scripts/rehearse-demo-coach-retirement-database.mjs)                                                                  | Ordinary real coach preserved; claimed/unclaimed/empty states, conflict rollback, no-write check, retry/seed and actor/enrollment/public gates.     |
| [package.json](../../../package.json), [README](../../../README.md), [database guide](../../../supabase/README.md), [specification](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [index](../../README.md) | Refusing obsolete aliases, new explicit retirement command, local-only/UAT contract and operational evidence.                                       |

### Decisions and deviations

2026-10-18: hide/revoke rather than delete historical accounts or the shared dataset. This is the adopted reversible implementation of the user's local-only constraint, not a request to erase data. Existing provider Auth rows and private historical dev tester files remain stored; the retired profiles have no application identity or public offering. Local files/data are untouched. An initial disposable conflict setup tried to change the immutable demo flag and was rejected by the existing trigger; it was replaced with a legal conflicting participant-role state. The final seven scenarios pass. No hosted writes preceded the validated exact check/apply path.

### Contracts, configuration, and operations

No schema, migration, dependency, environment variable or application-interface change. `demoEnvironmentArgument` now returns only local; `createMissingDemoAccounts` and journal creation enforce the same rule. Historical `DemoEnvironment` data can still describe an old dev journal without granting write permission. `demo:setup:dev` / `demo:urls:dev` refuse before reading an environment file. New `npm run demo:retire:uat -- --check` or explicit `-- --apply` uses the existing operator CLI login and `.env.development.local`; exact project/runtime/Auth configuration must match the allowlisted dev target. Production/local/unknown retirement targets are refused. A lost operator reply should be recovered with `--check`; repeated apply is idempotent.

Applied only the six named hosted fixture visibility/membership changes. No hosted migration, seed, reset, password operation or new deployment. Restoring those retired fixtures on UAT would contradict the confirmed policy and require a separate explicit request/ticket; ordinary rollback must preserve the local-only guard and stored retirement. Real registrations still use the existing active dataset and ordinary application/approval rules. Fresh hosted dataset bootstrap remains separate from the fictional local seed.

## Validation results

2026-10-18, Node 24.21.0, existing local Docker project and allowlisted `movx-dev` hosted project.

- `node --import tsx --test tests/demo-local-only.test.ts tests/demo-coaches.test.ts tests/demo-coach-urls.test.ts tests/demo-preservation.test.ts`: **14 passed**, zero failed/skipped, including hosted argument rejection, direct helper/journal dependency traps, fixed URLs and existing credential/content preservation.
- `node scripts/rehearse-demo-coach-retirement-database.mjs`: **seven required scenarios passed** across owned `dev0349_2880bfe8bcdc_retirement` and `_empty` databases; counterpart tests were intentionally skipped in the inapplicable mode (one plus six). Both databases were removed. Used migrations only through DEV0331, without resetting retained `postgres`. A normal account was registered, applied, approved and published through existing repositories; it remained public and active after retirement. Every protected app/Auth/Storage fingerprint matched. Claimed/unclaimed fixtures, exact check-only no-op, repeat/seed preservation, valid role/metadata/slug conflicts and empty-schema no-op all passed. Revoked enrollment attempts failed without reactivation; original identities and public group authority became unavailable.
- `node --env-file=.env.development.local --import tsx scripts/retire-hosted-demo-coaches.ts --environment dev --check`: passed ownership and preservation checks for all six actual hosted fixtures, initially visible/active with one application identity each. No record changed.
- `node --import tsx /tmp/dev0349-commit-prep/apply-uat.mjs`: **actual hosted apply, repeat apply and post-check passed**. All six original slugs now report hidden/revoked, zero application identities and false public group eligibility. All other hosted app/Auth/Storage fields/rows remained identical within each transaction. Local fixture profile/coach/participation/personal/website/rate/Auth fingerprints and both private journal byte hashes matched before/after. Hash-only/bounded evidence: `/tmp/dev0349-commit-prep/uat-results.json` and `local-before.json`. No credentials were logged or files rewritten.
- Restricted hosted runtime verification: `node --env-file=.env.development.local --import tsx --conditions=react-server --input-type=module …` called normal `publicCoachProfileRecord` for each exact slug after validating the dev target; **zero of six public profiles returned**. This used the ordinary restricted application role, not the operator connection.
- All-real-source TypeScript check `node node_modules/.bin/tsc --noEmit -p /tmp/dev0348-validation/tsconfig.json` passed using project compiler options and installed Node types, excluding only ignored incomplete source snapshots. Scoped ESLint on all affected script/test modules passed. Focused formatting checks passed. Exact standalone commit-snapshot validation and link review are recorded below.
- Public `https://test.movx.club` verification could not complete: both web access and direct HTTPS were unavailable; direct Node reported `ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE`. No successful deployed-browser claim is made. Hosted database/runtime behavior is verified independently. No app build/layout/browser check is needed for this operational slice, which changes no interface/framework integration; existing local pages and data are preserved.

| Criterion | Evidence                                                                                                                                         | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | Hosted rejection traps, direct helper/store guards, 14 focused tests and unchanged local fixture/default behavior.                               | Passed |
| AC2       | Actual hosted check/apply/repeat, zero restricted public profiles, revoked identity/enrollment and group gates.                                  | Passed |
| AC3       | Complete same-transaction hosted fingerprints, real approved-coach disposable proof, local hashes and unchanged private files; seed/retry no-op. | Passed |
| AC4       | C51/setup/operations record, exact standalone snapshot validation, formatting/link checks and reviewed focused commit scope.                     | Passed |

- Exact standalone DEV0349 Git-tree snapshot: `node --import tsx --test --test-concurrency=1 tests/demo-local-only.test.ts tests/demo-coach-urls.test.ts tests/demo-coaches.test.ts tests/demo-preservation.test.ts tests/development-startup.test.ts`: **17 passed**, zero failed/skipped, including hosted/local launcher behavior. The candidate contains only DEV0349 plus its committed stable-URL baseline; independent Auth, directory and session-type edits were excluded. Final local Markdown links resolve and the normal staged index was checked before the focused commit.

## Risks, limitations, and follow-ups

Retired Auth records/history remain stored, but those fictional profiles have no application participation and are not public. Shared reference venues/history were preserved rather than broadly reset. Unexpected ownership blocks retirement rather than risking a real coach. Real coaches still use ordinary registration/application/platform approval; this does not finish separate hosted Auth/session-type rollout. The UAT URL's TLS handshake could not be verified here, so deployed UI remains externally unverified. Independent directory/Auth work is excluded from these focused commits.

## Completion and review references

- Completed: 2026-10-18.
- Commit: `[DEV0349] Restrict fictional coaches to local development` (this checkpoint).
- Review: Self-review against all four acceptance criteria passed; no independent review.
- Deployment or release: Exact six hosted fictional fixtures retired and verified; no new app or production deployment. Deployed UAT browser verification remains limited by TLS access as recorded above.
