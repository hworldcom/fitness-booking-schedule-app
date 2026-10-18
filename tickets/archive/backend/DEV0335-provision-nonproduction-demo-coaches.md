# Ticket DEV0335: Provision nonproduction demo coaches

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: Development and tester fixtures
- Coordination: None — independent development ticket
- Related records: Historical local accounts [DEV0116](../../archive/backend/DEV0116-provision-local-seeded-coach-accounts.md); exact Daniel password setup DEV0332 (independent record awaiting its own commit; see [reserved identifiers](../../README.md#reserved-identifiers)); concurrent website storage [DEV0321](../../archive/backend/DEV0321-persist-coach-website-content-and-banners.md).

## Objective and context

Give testers complete fictional coach examples and usable password logins by default on local Docker and the explicitly configured hosted development database, with no production provisioning. Follow [identity and demo integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity). Five existing published demo coaches are Daniel Park, Sam Lee, Nora Klein, Idris Malik and Elif Demir. Only Daniel currently has a portrait. Existing provisioning creates confirmed passwordless accounts and requires a separate manual invocation.

## Scope and non-goals

- In scope: four distinct fictional portraits, retain Daniel's existing portrait; fuller coach biographies and sample website content where the delivered website schema is available; deterministic existing fixture identities with private tester credentials; default local/hosted-dev setup; production refusal, idempotency and tester-edit preservation; documented reproducible commands.
- Out of scope: production data/users, real coach approval, fabricated reviews/qualifications, schema or website-editor redesign, scheduling resets, changing ordinary users, deploying the application, committing unrelated work.

## Expected behavior and edge cases

Only loopback Auth/PostgreSQL or the exact allowlisted hosted-dev project may be targeted. Reject mixed/unknown/production targets before writes. Five accounts remain Demo coaches with their original profile/scheduling IDs. Provision missing accounts and an initial generated password per tester; explicitly initialize existing demo credentials once for this request, then preserve subsequent password changes. Store credentials in a mode-0600 ignored environment-specific local file, never source or logs. On subsequent starts preserve coach edits, uploads, cleared images, visibility and credentials; fail safely on identity collisions. New local databases receive defaults through the normal seed plus provisioning. Hosted dev initializes only the exact existing foundation fixtures, without copying unrelated local rows or resetting the database. Missing schema or administrative access must produce a clear failure, never fall back to production.

## Assumptions, decisions, and dependencies

The user explicitly requested dev and local defaults and tester passwords. Hosted development means `config/supabase-environments.json`'s dev project, independently of NODE_ENV. Portraits are fictional AI-generated sample assets; retain Demo labels. Existing website content is preserved; sample content is inserted only when absent and its schema is installed, so concurrent DEV0321 remains its owner. Do not apply another session's migration. No generated ratings, approvals or professional credentials. Runtime production startup/build does not import or run provisioning. Use the existing privileged CLI channel for hosted setup; keep admin credentials out of Next.js.

## Implementation plan

1. Review local/hosted fixture state and guards, inspect the portrait style and installed Auth SDK contract.
2. Generate and inspect four fictional portraits using built-in imagegen; save optimized repository assets and prompt/provenance records.
3. Add guarded fixture/profile/account initialization with private recoverable credentials and one-time defaults; integrate local and explicit hosted-dev launchers, preserving all later edits. Keep production scripts untouched.
4. Update fixture/environment guidance and the current specification; validate negative target/collision paths, fresh/repeated setup, real password login/coach ownership and visible portraits/content.
5. Record exact evidence, review the diff and archive only after acceptance passes.

## Acceptance criteria

- [x] AC1: All five published dummy coaches have a distinct portrait and meaningful fictional coaching descriptions; existing Daniel profile content and tester edits are preserved.
- [x] AC2: Each coach has a confirmed email/password login resolving the original profile and Demo authority; credentials are available privately to testers.
- [x] AC3: Normal local and explicit hosted-dev startup prepare defaults without resetting data; subsequent setup preserves profile/password changes and other users/history.
- [x] AC4: Production, unknown and mixed endpoints are refused before mutation, and production startup/build never provision fixtures.
- [x] AC5: Focused automated checks, real database/Auth and desktop/mobile public/owner checks pass; documentation, assets and ticket evidence are complete.

## Validation plan

Use meaningful unit tests for target guards, collision and preservation decisions, fixture coverage and private credential handling. Inventory exact local/hosted-dev fixture identities before writes. Run setup twice and compare profile/credential/history fingerprints; exercise edits in a rolled-back database test rather than changing tester data. Verify five real password sign-ins and original actor/profile ownership, public portrait/image responses and responsive desktop/mobile visibility. Run relevant existing tests, lint and type checks; build if runtime code changes. Production checks use rejected synthetic configurations only, with no production connection. Record missing environmental prerequisites explicitly.

## Implementation record

### Changes and rationale

Retained Daniel's existing portrait and generated four distinct fictional gym portraits for Sam, Nora, Idris and Elif with built-in imagegen. Inspected each result and delivered 1024-square WebP assets (about 88–131 KiB each), with exact prompts and source/delivery SHA-256 provenance. All five have fuller discipline-specific biographies and sample introduction, approach, focus labels and FAQs. Sample experience text explicitly identifies fictional development content; no professional credentials, reviews, prices or booking history were fabricated.

The guarded provisioner now upgrades only the original five foundation fixture identities. Existing local Auth IDs were reused; hosted dev's previously unclaimed fixtures received their deterministic Auth subjects. Confirmed email/password accounts retain the original application profile and scheduling IDs and Demo status. Former fixture operator participation becomes ordinary member authority, matching the historical local account contract. No fixture is promoted to Verified coach.

Each initial password is unique and generated with cryptographic randomness. An ignored mode-0600 per-environment JSON file journals it before Auth writes, allowing an interrupted setup to retry. Local and hosted dev use separate credentials. One-time administrative metadata markers prevent later starts from resetting passwords, replacing edited biographies, repopulating removed portraits or changing visibility. A newer initialization version is preserved by an older checkout; malformed markers and conflicting ID/email/profile/environment ownership fail before credential mutations. Losing the private file does not reset an account. Explicit `--reset-passwords` is the intentional five-account rotation operation.

Normal local development and explicit hosted-dev launchers run the same initialization before Next.js. Local operations require the exact repository Supabase project/configuration, ports and loopback database/Auth endpoints. Hosted operations validate the dev runtime/Auth configuration and pinned dev project before using its existing privileged CLI channel. Production, unknown and mixed targets are rejected. Hosted Auth inventory is restricted to the five reserved IDs/emails. Admin keys stay in the provisioning process and never enter Next.js. Existing production build/start scripts do not import or execute provisioning.

Initial Docker SQL seeding supplies portraits/descriptions only to unclaimed fictional fixtures. Operational initialization fills only original/blank biographies and absent portraits once. Existing website rows are never overwritten. If the website schema is absent, its sample content remains unmarked and initializes on a future start after the separately owned migration is installed. No other ticket's migration was applied here.

### Affected files

| File/component | Purpose |
| --- | --- |
| [Fixture manifest and SQL](../../../scripts/lib/demo-coach-fixtures.ts) | Exact five profiles, sample content, ownership guards, monotonic initialization markers and transactional defaults. |
| [Provisioning service](../../../scripts/lib/provision-demo-coaches.ts), [target guards](../../../scripts/lib/demo-coach-target.ts), [private credential store](../../../scripts/lib/demo-coach-credentials.ts) | Bounded local/dev setup, exact identity validation, private credential journaling, retries and explicit rotation. |
| [New CLI](../../../scripts/provision-demo-coaches.ts), [compatible local command](../../../scripts/provision-local-coach-accounts.ts), [package scripts](../../../package.json) | Manual local/dev setup and retention of `auth:provision:coaches`. |
| [Local launcher](../../../scripts/start-local-development.ts), [hosted-dev launcher](../../../scripts/start-hosted-development.mjs) | Default nonproduction initialization; check-only modes remain read-only. |
| [Seed](../../../supabase/seed.sql) | New/unclaimed fixture portrait/biography defaults; claimed profiles preserved. |
| [Portrait assets and prompts](../../../public/images/coaches/README.md) | Four new fictional faces, retained Daniel portrait and generation provenance. |
| [Fixture/credential tests](../../../tests/demo-coaches.test.ts), [database preservation test](../../../tests/database/demo-coaches.test.ts), [launcher tests](../../../tests/development-startup.test.ts) | Real target/collision/credential safety, initialization/edit preservation and bounded startup ordering. |
| [README](../../../README.md), [database guide](../../../supabase/README.md), [specification](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity), [index](../../README.md) | Commands, credential-file locations, production boundary, current requirements and work evidence. |

### Decisions and deviations

2026-10-18: allocated DEV0335 after another session reserved DEV0334 during read-only planning; the failed DEV0334 patch made no implementation edits. No coordination conversion was needed: this ticket owns one nonproduction fixture/account slice.

Hosted dev already contained the exact five unclaimed foundation fixtures, but lacked the current password-method and website schemas. Prepared provider accounts, profiles and original application identities without applying those migrations. Full current-app hosted Auth remains DEV0286's rollout responsibility. Conditional website initialization was planned explicitly and is not reported as a delivered hosted website UI.

A broad hosted preservation query was rejected by automatic approval review because it exceeded the fixture scope. It did not run. Replaced it with checks limited to the five fixture projections and their booking/request counts. Local non-target preservation remained a separate loopback-only check.

The shared app and current website/reviews code changed during verification. Initial public-page unavailable responses and compilation/request timeouts did not establish a fixture failure. A temporary current-source app on port 3135, with routes warmed before assertions, passed every local coach/browser case. The source copy and server were removed afterward. One failed browser helper printed a local test-session cookie in its error output; the exact session was revoked and its absence confirmed. Helper failure logs were then sanitized. No password or administrative key was written to repository source.

### Contracts, configuration, and operations

No schema migration, dependency upgrade or application DTO/API change. Reviewed the installed SDK and official [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser) / [updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) documentation before implementing administrative account setup. New scripts: `demo:setup:local` and `demo:setup:dev`, with optional `--check` or explicit `--reset-passwords`. Existing local command remains available. Hosted dev startup now requires the operator's existing Supabase CLI project access. Production commands are unchanged.

Private tester files are `work/demo-coaches/local.json` and `dev.json`, each mode 0600 inside a mode-0700 directory, and verified ignored by Git. They contain initial passwords, not ongoing password synchronization. Tester password changes remain authoritative. Serialized operator setup is required across workspaces; an interrupted local lock must be checked before removing that exact lock directory. Exact ID/email conflicts require manual investigation, never reassignment or a database reset.

Initial credential setup intentionally replaced old demo passwords once, including Daniel's, and ended prior demo sessions. Later default setup preserves credentials. Rollback of scripts/assets alone does not revert those data/account changes; retain tester data and use an explicitly scoped maintenance operation for any later removal. No production target was inspected or modified.

## Validation results

2026-10-18; Node 24.21.0, Supabase JS 2.116.0, CLI 2.120.0; real Docker `movx-club-local` and exact allowlisted hosted dev only. Ignored supporting evidence is under `work/dev0335/`; the results below are the durable record.

- `npm run demo:setup:local`, repeated: passed. Five original local subjects/profiles retained; private credentials created; five biographies, portraits and available website samples initialized. Before/after fingerprints matched across 49 local tables for non-target users, application history and Storage. Repeating setup preserved the complete stored-table fingerprints, including initialized profile and password rows, before subsequent sign-in verification.
- `npm run demo:setup:dev`, repeated: passed. Five hosted provider accounts bound to the original fixture profiles. All five restricted preservation checks matched: existing coach scheduling fields and booking/request counts. Full coach-row fingerprints matched after the repeat. No production connection, broad hosted seed or migration occurred.
- `node --import tsx --conditions=react-server work/dev0335/local-fixture-proof.mjs`: passed five real provider password sign-ins, exact Auth subjects, original profile IDs, full public runtime projections, biographies, portrait paths and Demo labels. Verification sessions signed out.
- `node --env-file=.env.development.local --import tsx work/dev0335/hosted-login.mjs`: passed all five hosted provider passwords and exact expected subjects; each session signed out. Provisioning independently verified all five original application profile IDs and member authority through `app.current_application_identity`. This is not a claim that the absent hosted current-app Auth migration has shipped.
- `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --test tests/database/demo-coaches.test.ts`: passed one real transaction test. It initializes all five untouched states, checks exact original bindings/portraits/biographies, simulates changed display name and biography, hidden visibility and a cleared portrait, reruns defaults and the complete normal seed, and proves those edits and booking-history fingerprints survive. Every synthetic edit is rolled back. Early test-harness attempts used the wrong historical booking table and an unsupported transaction rollback method; corrected to `app.coach_private_bookings` and a rollback sentinel, then passed without persisting synthetic edits.
- Focused credential/target/startup checks passed 19 cases; the final additional exact Auth/environment reuse check passed with the fixture/account tests (11 cases). Tests cover production/mixed/unknown targets, existing identity conflicts, future/malformed initialization markers, safe content, private file permissions, target binding, concurrent local setup lock, symlink refusal and preservation. Launcher fixture timeout was raised from 10 to 30 seconds after child-process timeouts on the busy shared machine; the real fixture startup sequencing then passed.
- `node --import tsx work/dev0335/isolated-ui.mjs`: passed all five real local application password logins, exact private application profile IDs, Demo authority, public and owner profiles at 1440×1000 and 393×852 (20 captured views), loaded portraits, narrow-width overflow checks and keyboard Tab focus. The public pages displayed each coach's matching portrait/biography and Demo label. Visual review included Sam's public desktop page and Elif's mobile owner page. Temporary current-source server/copy removed; original app left running.
- Final `npm test`: **263 general tests + 45 server tests = 308 passed, zero failed**. Earlier runs caught transient unfinished website pricing projection and reviews-boundary failures in concurrent work; the final current-source run passed after those files changed in their owning work.
- `npm run typecheck`: passed, including a final run after the last guard change. `npm run lint`: passed; final scoped ESLint and Prettier checks passed for every changed implementation/test script. Scoped `git diff --check` passed. Final ticket/index/link checks recorded below.
- Inline `node --input-type=module` link/lifecycle checker passed all 26 owned relative Markdown links, exactly one archived DEV0335 record and no stale current-ticket links in the affected guides/index.
- Private credential files verified mode 0600 and ignored by Git. Four generated portraits inspected, hashes/provenance recorded; Daniel's existing asset retained unchanged.
- Production build not run: this ticket changes development scripts, fixture data and static assets, without changing production runtime source/dependencies/framework integration. Type checking, tests and the isolated real Next.js flow establish the applicable criteria. No deployment or independent review is claimed.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | Five real public runtime projections; portrait/content checks and desktop/mobile pages; existing edited fields preserved. | Passed |
| AC2 | Ten real provider password logins, five full local application logins, exact profile/subject identity and Demo authority. | Passed |
| AC3 | Repeated actual local/dev setup; 49-table local preservation; five-record hosted preservation; rollback edit/cleared-photo test and launcher sequencing. | Passed |
| AC4 | Exact local/project guards, synthetic production/mixed/unknown refusal and unchanged production startup/build scripts. | Passed |
| AC5 | 308 tests, real SQL/Auth, 20 responsive views, keyboard/overflow checks, lint/types/formatting and completed documentation. | Passed |

## Risks, limitations, and follow-ups

Hosted dev's current-application authentication rollout remains [DEV0286](../../current/backend/DEV0286-implement-password-authentication-and-recovery.md); these provider accounts do not prove that rollout complete. Hosted website samples will initialize after the independent website schema is installed. Local full browser verification passed. Initial password files can become stale after tester changes and must remain private. Provision one environment from one operator workspace at a time. No availability, bookings, reviews, prices, production rollout or real coach approval was created by this work.

2026-10-18 commit validation: exported the exact staged tree to a temporary checkout with shared installed dependencies, excluding all unrelated working-tree source and environment files. That tree passed `npm test` (251 general + 40 server = 291 tests), `npm run lint`, `next build --webpack`, `node scripts/rehearse-fitness-database.mjs` (fresh/upgrade) and `node scripts/rehearse-coach-website-database.mjs` (7 checks in each fresh/upgrade mode). Disposable databases and temporary checkout were removed. This is separate from the earlier 311-test whole-workspace result, which also included uncommitted peer work. Staged Markdown links and portrait hashes were checked; credentials/environment/captured-session files were excluded.

## Completion and review references

- Completed: 2026-10-18 — five local/hosted-dev fictional coach fixtures and private tester logins provisioned, with preservation and real local responsive proof.
- Commit: Included in the combined `[DEV0335][DEV0336] Provision demo coaches and add Fitness` commit; the sixth coach extends the previously uncommitted provisioner, so these two implementation records travel together.
- Review: Ticket/criteria, target boundaries, identity preservation, private credential handling, assets and current-source UI self-review passed; no independent review.
- Deployment or release: None.
