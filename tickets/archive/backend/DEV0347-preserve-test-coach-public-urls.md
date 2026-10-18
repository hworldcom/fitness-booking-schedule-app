# Ticket DEV0347: Preserve test coach public URLs

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: Development fixtures / M10 public coach URLs
- Coordination: None — independent development ticket
- Related records: Historical [DEV0331](../../archive/backend/DEV0331-enable-username-based-public-coach-urls.md), [DEV0335](../../archive/backend/DEV0335-provision-nonproduction-demo-coaches.md), [DEV0337](../../archive/backend/DEV0337-preserve-existing-demo-coach-data.md).

## Objective and context

The user explicitly requested URLs for the test coaches that survive recreation. Existing local test coaches have no saved or published username. Add checked-in defaults, creation support and a narrow explicit update for these six fictional identities under [specification section 8](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) and [public username rules](../../../docs/mvp-spec.md#196-cards-username-urls-and-scheduling-compatibility). This request authorizes only their missing canonical username/public reservation and private tester-file URL fields; all other retained data stays authoritative.

## Scope and non-goals

| Coach / legacy slug       | Exact profile UUID                   | Default public path |
| ------------------------- | ------------------------------------ | ------------------- |
| Daniel Park / daniel-park | 10000000-0000-4000-8000-000000000002 | /@daniel_park       |
| Sam Lee / sam-lee         | 10000000-0000-4000-8000-000000000005 | /@sam_lee           |
| Nora Klein / nora-klein   | 10000000-0000-4000-8000-000000000007 | /@nora_klein        |
| Idris Malik / idris-malik | 10000000-0000-4000-8000-000000000008 | /@idris_malik       |
| Elif Demir / elif-demir   | 10000000-0000-4000-8000-000000000009 | /@elif_demir        |
| Jake Miller / jake-miller | 10000000-0000-4000-8000-000000000013 | /@jake_miller       |

- In scope: fixed fixture usernames; initialize them only for newly created fixture logins; explicit URL-only command for existing exact fixtures; add absolute public URLs to existing private tester entries without changing saved passwords; local application and preservation proof; readiness inspection for allowlisted hosted dev.
- Out of scope: profile/content/visibility/location/password resets, general seed backfills, automatic startup provisioning, production/hosted schema rollout, real-user automatic publication, changing username routing or deletion/tombstone policy.

## Expected behavior and edge cases

Fresh explicit setup creates the same public handles after binding the original fixture identities. Normal setup leaves existing accounts alone. A separate explicit URL-only mode sets missing usernames and reserves the defaults atomically for the six fixtures, without creating Auth accounts. Repeating it performs no data writes once initialized. Later owner renames remain canonical; the published default stays a working alias. An unrelated current claim, reserved alias/tombstone, wrong identity or custom unconfirmed username aborts the entire URL batch without replacing it or choosing unstable suffixes. Ordinary users still confirm their own URL. Hidden/suspended coaches remain unavailable publicly.

Private tester files gain `publicUrl` only for existing credential entries; absent journals never authorize password recovery. Fresh creation writes the same field. Local origin is localhost:3100; hosted development uses its configured application site origin. No credentials are printed. Missing public-URL schema blocks URL initialization before Auth creation or data changes. Fresh database recreation is covered; deleting a published profile and retaining its reserved tombstone still requires a separately authorized repair.

## Assumptions, decisions, and dependencies

- User authorization: current explicit request is the narrow retained-fixture exception required by DEV0337; no other retained fields may change.
- Fixed lowercase underscore handles are adopted implementation defaults matching the existing username syntax. No new schema or dependency is needed; DEV0331 migration must be installed.
- Explicit URL-only mode shares existing strict loopback/allowlisted-dev guards and ownership checks, but never invokes account creation or credential rotation.
- Existing confirmed owner renames are preserved rather than overwritten to restore a fixture default.

## Implementation plan

1. Add exact fixture handles and an atomic, ownership/collision-checked URL initializer using existing canonical username and reservation tables.
2. Use it for newly created logins; add a separate explicit URL-only mode for retained fixtures and private URL enrichment. Keep normal startup/seed/existing-account setup write protection.
3. Add disposable database tests for creation/recreation, idempotence, aliases, collisions/rollback and preservation, plus focused credential/target tests.
4. Apply only the authorized local URL additions, compare exact fixture/Auth/content fingerprints, verify six public routes and legacy redirects; inspect hosted readiness without deploying schemas. Update setup guidance and record results.

## Acceptance criteria

- [ ] AC1: All six checked-in defaults reproduce canonical public URLs when fresh demo accounts are created, with unique valid handles.
- [ ] AC2: Existing local fixtures receive only the authorized username/reservation additions; six public routes resolve and old slugs redirect.
- [ ] AC3: Repeat setup/URL application preserves credentials, private identity, profile/media/website/scheduling/history; owner renames and alias history survive; foreign claims/tombstones/ownership conflicts fail atomically.
- [ ] AC4: Tester files include usable environment-specific `publicUrl` values, keep passwords unchanged and stay private; docs and durable validation describe commands and hosted readiness honestly.

## Validation plan

Run focused unit tests and real disposable PostgreSQL tests using the installed DEV0331 schema. Test fresh creation/default binding twice on independent clean databases, repeated URL-only application, owner rename, foreign current/alias/tombstone collisions, unconfirmed custom usernames and wrong identities. Hash all unaffected application/Auth/Storage data before/after the local operation and credential fields before/after journal enrichment. Request six canonical and legacy routes. Run lint, scoped formatting/type checking and relevant existing demo/startup tests. No interface layout change or application build is needed for operational-script changes. Never reset the retained local database or deploy hosted migrations for this task.

## Implementation record

### Changes and rationale

Before this change all six exact local fixtures had no canonical or published username. Their checked-in defaults now match the table above. Fresh explicit setup binds a missing account and assigns/reserves its public username in the same database transaction. Both current setup commands and the older local provisioning alias use this shared path. Startup and full-seed replay remain unchanged.

`demo:urls:local` / `demo:urls:dev` explicitly initialize only the six already bound fixture identities. The batch locks profiles before the shared username reservation lock, validates dataset/ownership, sets only missing canonical usernames (advancing an existing Account revision once), and reserves the corresponding public handles. Repeating it preserves the stored rows and timestamps. Later owner renames retain their canonical value and the fixed default alias. Foreign current claims, foreign reservations, deleted-owner tombstones, a custom private handle or wrong fixture identity abort the batch rather than replacing data or choosing a suffix. Hidden coaches remain hidden.

Private tester entries gain optional `publicUrl`, with local origin `http://localhost:3100` and the configured application origin for hosted dev. URL-only saves preserve the original file note and every credential field, use the existing lock/atomic mode-0600 storage, and add nothing for absent credential entries. Losing a tester file still never authorizes password recovery.

### Affected files

| File                                                                                                                                             | Change and purpose                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [local-coach-accounts.ts](../../../scripts/lib/local-coach-accounts.ts)                                                                          | Six explicit, stable username defaults attached to the immutable fixture identity allowlist.                                                                         |
| [demo-coach-fixtures.ts](../../../scripts/lib/demo-coach-fixtures.ts)                                                                            | Atomic URL initialization and integration with fresh account-binding SQL; the existing binding-only helper remains compatible with older schema rehearsals.          |
| [provision-demo-coaches.ts](../../../scripts/lib/provision-demo-coaches.ts) / [demo-coach-target.ts](../../../scripts/lib/demo-coach-target.ts)  | Explicit URL-only/readiness mode, strict existing target/identity checks, schema prerequisite and new-account URLs; existing account setup still performs no writes. |
| [demo-coach-credentials.ts](../../../scripts/lib/demo-coach-credentials.ts)                                                                      | Validated application origins, optional URL field, current confirmed handle enrichment and note-preserving URL-only saves.                                           |
| [package.json](../../../package.json) / [README](../../../README.md)                                                                             | Local/dev commands, six local links, prerequisites, preservation and deletion caveats.                                                                               |
| [demo-coach-urls.test.ts](../../../tests/demo-coach-urls.test.ts) / [demo-preservation.test.ts](../../../tests/demo-preservation.test.ts)        | Stable defaults, URL safety, credential/note preservation, idempotence and new-account versus existing-account scope.                                                |
| [database checks](../../../tests/database/demo-coach-urls.test.ts) / [disposable runner](../../../scripts/rehearse-demo-coach-urls-database.mjs) | Fresh/recreated databases, complete unaffected-table fingerprints, owner aliases, visibility gates and atomic conflict rollback.                                     |
| [Specification section 8](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) / [index](../../README.md)                               | Exact user-authorized fixture exception, current contract and lifecycle.                                                                                             |

### Decisions and deviations

- 2026-10-18: fixed handles are implementation defaults; explicit user authorization applies only to the six fictional fixtures, not general automatic publication.
- Initial local preservation validation detected the older credential-store helper replacing the file's explanatory note on save. Application/Auth/Storage and private personal-field hashes were unchanged. The exact original note was restored only after reconstructing the complete original credential-field fingerprint from the unchanged dev note. URL-only mode now preserves it; a focused regression and repeated actual local applications pass. Passwords never changed.
- The first two disposable runs rejected the synthetic wrong-identity test setup under the existing portrait-reference constraint. The final test clears that synthetic portrait when changing its slug; all twelve final checks pass. No retained database was reset or altered by those runs.
- The shared app was not listening on port 3100. An isolated current-source app on port 3147 initially returned the unavailable page because unfinished session-type integration calls missing `app.public_session_type_catalog(text)`. Only the temporary copy's public-page renderer was then restored from committed HEAD; all six complete pages and six legacy redirects passed. Shared application files were not edited to conceal or fix that independent issue.

### Contracts, configuration, and operations

No new schema, migration, dependency or public application API. Requires the existing DEV0331 migration `20261018000600_public_coach_usernames.sql` before creating fresh accounts or applying URLs. Private `DemoCredential` gains optional `publicUrl`; checked-in fixture identity gains `username`. New commands are `npm run demo:urls:local` and `npm run demo:urls:dev`; `-- --check` inspects exact target, identity and schema readiness without account/data/file writes. Hosted dev reads its existing `NEXT_PUBLIC_SITE_URL`; no new environment variable or secret is introduced.

The authorized local update is applied. Hosted dev is missing the URL migration, so its data and tester file were left unchanged. No hosted rollout or production action occurred. Rollback of scripts must preserve already published canonical names/reservations; ordinary owner renames retain aliases. Do not delete retained data or recycle tombstones to roll back source code.

## Validation results

2026-10-18, Node 24.21.0, installed Supabase JS 2.116.0, local Docker project `movx-club-local`.

- `node --import tsx --test --test-concurrency=1 tests/demo-coach-urls.test.ts tests/demo-coaches.test.ts tests/demo-preservation.test.ts tests/development-startup.test.ts`: **14 passed**, zero skipped/failed. Node 24 was explicitly selected for child commands. Covers existing-account no-write traps, new-account URL creation, private-file note preservation and all launchers.
- `node scripts/rehearse-demo-coach-urls-database.mjs`: **12 passed**, six each in independent `dev0347_81778e8363da_fresh` / `_recreated`; both databases removed. Applied active migrations only through DEV0331 plus the complete seed, then tested all-app/Auth/Storage fingerprints, canonical public reads, repeated initialization, owner rename/aliases, hidden visibility and five conflict rollback cases. Retained `postgres` was never reset/migrated.
- `node --import tsx /tmp/dev0347-validation/apply-local.mjs`: actual exact local URL-only initialization and repeat runs passed. Ordinary setup then reported **six verified, zero created**, with the same canonical names/reservations and byte-identical private file. Before/after fingerprints covered every fixture-linked application/Auth/Storage row, personal fields other than the authorized username/revision, all saved credential fields, the original file note and unchanged dev journal. Local credential file mode stayed 0600. All six public handle projections returned their original coach slug. Hash-only results were written to `/tmp/dev0347-validation/local-results.json`; no credential was logged.
- `node --import tsx /tmp/dev0347-validation/check-routes.mjs`: **six full canonical HTTP 200 pages containing the correct coach name and six legacy HTTP 307 redirects** on the isolated port-3147 app using the committed public-page renderer. Results: `/tmp/dev0347-validation/route-results.json`. Temporary server stopped after validation. Initial port-3100 connection refusal and current-source unavailable page are recorded above; those are not claimed as successful current-worktree page checks.
- `npm run demo:urls:local -- --check`: passed with no writes. `npm run demo:urls:dev -- --check`: **blocked as intended** by missing migration 20261018000600; no data or private file changed. Independent read-only query confirmed the unrelated local session-type catalog function is absent.
- `npm test`: 294/296 unit/development tests passed. Failures were the two unfinished session-type services importing `drizzle-orm` outside `src/server/db`, and a local-startup child timeout during concurrent checks. Sequential focused startup rerun above passed all three cases. Since `&&` prevented the server phase, it was run separately with `node --import tsx --conditions=react-server --test tests/server/*.test.ts`: **46 passed**, zero skipped/failed.
- `npm run lint`: passed across the shared worktree. After final fixes, direct installed ESLint on all nine affected implementation/test files passed; scoped Prettier check passed those files and package.json.
- `npx tsc --noEmit -p /tmp/dev0347-validation/tsconfig.json`: all-real-source check failed on four unrelated pending session-type `PrivateBookingProjection.sessionType` property errors in coach-client-cards and client-sessions. Changed-module check `node node_modules/.bin/tsc --noEmit -p /tmp/dev0347-validation/tsconfig-focused.json` **passed**, using the real project options, installed Node types and all affected TypeScript modules/tests. The first temporary focused config omitted type roots; fixing that external validation configuration resolved the missing Node-type errors without repository compiler changes.
- Scoped formatting, repository link/lifecycle consistency and `git diff --check`: passed. Build and responsive/keyboard rehearsal not applicable: no interface or framework integration was changed; HTTP/data execution proves the operational slice. Incomplete independent work remains untouched.

| Criterion | Evidence                                                                                                                                                                                | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Explicit unique defaults, new-account unit check and identical six public mappings in two clean database creations.                                                                     | Passed |
| AC2       | Exact retained local update, six public SQL projections, six full pages and six legacy redirects using the committed renderer; current-source rendering limitation separately recorded. | Passed |
| AC3       | Complete isolated fingerprints and conflicts; actual retained fixture/Auth/Storage/credential fingerprints; byte-identical repeated URL-only and normal setup.                          | Passed |
| AC4       | Real local `publicUrl` entries/mode 0600, original note/password hashes retained; hosted-origin unit proof and honest missing-schema readiness result.                                  | Passed |

Commit checkpoint validation on 2026-10-18: the exact standalone HEAD-plus-DEV0347 tree passed all 14 focused demo/startup tests on Node 24; unrelated pending session-type/Auth/card work and private files were excluded.

## Risks, limitations, and follow-ups

Hosted dev requires the independently owned DEV0331 schema rollout before its canonical username URLs/private entries can be initialized. Its journal is unchanged. Private saved initial passwords can already be stale and were not reset. Published-profile deletion tombstones remain reserved. The separate in-progress session-type work currently prevents complete public-page rendering with the shared source and installed local schema; its missing catalog and source-boundary/type errors belong to DEV0340/DEV0342/DEV0343 delivery, not a URL-data rollback. The URL slice is validated against the committed renderer. No independent review or hosted delivery is claimed.

## Completion and review references

- Completed: 2026-10-18 — stable six-coach creation defaults, explicit local URL initialization, private URLs and preservation/recreation proof complete.
- Commit: Included in the user-requested `[DEV0347] Preserve test coach public URLs` checkpoint; unrelated active work and private credential files are excluded.
- Review: Self-reviewed exact allowlist, privacy/consent boundaries, collision/rollback, preservation and validation; no independent review.
- Deployment or release: No hosted deployment authorized by this slice.
