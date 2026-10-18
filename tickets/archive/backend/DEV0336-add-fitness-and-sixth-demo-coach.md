# Ticket DEV0336: Add Fitness and a sixth demo coach

- Status: Completed
- Created: 2026-10-18
- Last updated: 2026-10-18
- Milestone: Coach discovery and nonproduction fixtures
- Coordination: None — independent development ticket
- Related records: [DEV0335 — Nonproduction demo coaches](../../archive/backend/DEV0335-provision-nonproduction-demo-coaches.md); [DEV0321 — Website content](../../archive/backend/DEV0321-persist-coach-website-content-and-banners.md).

## Objective and context

Add Fitness as a selectable coaching discipline and one additional fictional male demo coach, with the user's requested white, casual college-sports appearance. Extend the [identity/demo contract](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) without resetting any existing tester account or editing completed records. This is one vertical slice: a discoverable Fitness demo coach with a usable nonproduction account.

## Scope and non-goals

- In scope: Fitness in shared discipline validation, typed search, shortcuts, profile/group selectors and database constraints/mutation validation; one new fictional portrait, profile, active Berlin venue and local/dev tester credentials; fresh/preserved database setup; current specification and evidence.
- Out of scope: production demo data/users, applying unrelated migrations, new training formats, nutrition/medical advice, fabricated reviews/credentials, existing coach edits/passwords, copying bookings/availability, production deployment or commits.

## Expected behavior and edge cases

All disciplines remains the default. Fitness can be typed, selected, persisted and filtered like existing disciplines. Existing disciplines remain valid; unsupported values remain rejected by client/server/database. Add Jake Miller (adopted fictional name), Fitness, with a relaxed athletic portrait, strength/conditioning biography and an existing fictional Berlin gym as his confirmed primary location. No real fraternity membership or qualification is implied by the appearance. He remains Demo coach. Preserve existing accounts, edited profiles, passwords and history. Add only the exact new fixture to preserved local/hosted-dev databases; refuse ID/slug/location collisions. The production-capable category migration contains no fixture/account data. Only guarded nonproduction seeding/provisioning creates Jake.

## Assumptions, decisions, and dependencies

The user authorized another dummy coach and Fitness. Continue DEV0335's private unique credentials and production refusal. Reuse guarded setup without bumping its global initialization version or resetting existing passwords. The foundation dataset and fictional Fabrik Training gym must exist. Use a forward migration, preserving the immutable baseline and function owners/grants/security attributes. Local and hosted-dev application is authorized only for this migration and exact fixture. Concurrent website/Auth work retains its own ownership.

## Implementation plan

1. Inspect shared discipline consumers, database allowlists and provisioning; review this scope and reserve the ID.
2. Generate one fictional gym portrait with built-in imagegen; inspect and save its optimized asset/prompt/provenance.
3. Add Fitness to domain/UI and forward SQL constraints/mutation validation. Add Jake's exact seed block, reused by guarded preserved-database setup.
4. Extend the account/content allowlist; remove hard-coded five-account assumptions while preserving initialization markers. Update current requirements/guidance.
5. Validate SQL acceptance/rejection, fresh/preserved seeding, original-account preservation, real local/dev login and responsive Fitness discovery/profile editing; finish/archive only after checks pass.

Compatibility note: historical migration rehearsals stop before Fitness exists. Exclude only the marked new fixture block from those older-schema rehearsals; normal setup continues to require the current schema and complete seed. This avoids invalidating existing website/rate/review/baseline replay checks.

## Acceptance criteria

- [x] AC1: Fitness is searchable/selectable on Home/Explore and coach/group editors; SQL/domain validation accept it and still reject unsupported disciplines.
- [x] AC2: Jake has a distinct inspected portrait, meaningful Fitness content, one active confirmed primary venue and a Demo label; local/dev logins resolve the original new profile.
- [x] AC3: Fresh seed and preserved local/dev setup create only the new fixture as needed, preserve the five prior coaches/passwords/history and are safe to repeat; production provisioning remains refused.
- [x] AC4: Automated, migration/real database/Auth and desktop/mobile/keyboard checks pass; documentation and implementation evidence are complete.

## Validation plan

Add category/parser/filter and SQL persistence/rejection tests, including profile mutation and group allowlists. Check forward-migration ownership/grants and ledger continuity. Fingerprint only the existing five fixture rows/credentials and scheduling counts around setup, using narrow hosted queries. Verify the sixth password/public profile in each available environment. Use an isolated current-source app for responsive Home/Explore typed search, filter links and owner Fitness persistence. Run existing tests, lint and type checks. No production connection or unrelated migrations; synthetic tests roll back rather than rewriting tester data.

## Implementation record

Fitness is the seventh supported discipline; All disciplines remains the default. [The domain list](../../../src/domain/coaches.ts) supplies typed search, profile validation and group forms. [Discipline navigation](../../../src/features/coaches/marketplace-discipline-navigation.tsx) adds a dumbbell icon. [The server projection](../../../src/server/db/coaches/repository.ts) now validates against the same list instead of its duplicated six-value allowlist; the first browser rehearsal exposed that duplicate rejecting Fitness and hiding the directory. The restricted-runtime regression now covers that failure. [Drizzle's schema](../../../src/server/db/schema/coaches.ts) matches the new CHECK contract. Home/Explore metadata includes fitness.

[Migration 20261018000500](../../../supabase/migrations/20261018000500_fitness_discipline.sql) extends three CHECK constraints and three existing profile/legacy-group validators. It recreates only the known installed definitions, preserving intervening body changes, signatures, owner, grants, security mode and search-path settings. Unexpected validator definitions stop the transaction. It inserts no sample rows or Auth accounts; the immutable baseline remains unchanged. This exact migration and ledger entry were applied atomically to local Docker and the allowlisted hosted-dev project only. No other migration was applied by this work.

The marked block in [seed.sql](../../../supabase/seed.sql) inserts only Jake's reserved profile, foundation membership, visible Demo coach and Fitness discipline. It requires the active foundation dataset and existing fictional confirmed Fabrik Training venue; the existing primary-location trigger creates one active confirmed venue. ID/slug/ownership collisions stop setup. Claimed profiles, later discipline choices and deleted/edited content are preserved. [Fixture content](../../../scripts/lib/demo-coach-fixtures.ts) and [account identities](../../../scripts/lib/local-coach-accounts.ts) add Jake without changing the original five or bumping their initialization version. Biography, introduction, approach, focus labels and FAQs explain strength/conditioning and remain explicitly fictional. No reviews, bookings or availability were invented.

[The provisioner](../../../scripts/lib/provision-demo-coaches.ts) checks Fitness schema capability, runs only that exact additive block after nonproduction target validation, then uses the existing reserved-account and initialization guards. Hardcoded counts/messages now follow the allowlist. Jake's unique local/dev initial passwords are in ignored mode-0600 credential files; the store updates only its descriptive note on loading older files. Original tester passwords and edited data remain untouched. Email: `jake.miller@coaches.movx.test`; profile/Auth IDs end `...0013` in the existing `10000000`/`90000000` namespaces. No new environment variables or production provisioning paths.

[Jake's delivered portrait](../../../public/images/coaches/jake-miller.webp) is an original built-in imagegen result, inspected before delivery, converted to a 1024×1024 WebP (145,858 bytes). [The prompt](../../../public/images/coaches/prompts/jake-miller.txt) and [provenance](../../../public/images/coaches/provenance.json) record generation mode and source/delivery hashes. The casual gym appearance implies no real fraternity membership or credential. Existing portraits remain unchanged.

[The compatibility helper](../../../scripts/lib/seed-compatibility.mjs) removes only Jake's marked seed block for older baseline/website/rate/review migration rehearsals capped before Fitness. Current setup always uses the full seed. [The new rehearsal](../../../scripts/rehearse-fitness-database.mjs) checks current fresh and preserved-database upgrade paths in disposable databases and cleans them up. README, Supabase guidance and the current specification now describe six demo coaches and the seven-discipline contract.

## Validation results

- AC1: `node --import tsx --test tests/fitness.test.ts tests/coach-events.test.ts tests/demo-coaches.test.ts tests/local-coach-accounts.test.ts` — 20 passed. Covers typed/case-normalized Fitness, canonical filters/default All, rendered selected shortcut/suggestion, profile/group validation, unknown Yoga rejection, exact seed extraction, credentials/target/ownership guards. Final full `npm test` — 266 general + 45 server tests passed (311 total), zero failures.
- AC1–AC3: `node scripts/rehearse-fitness-database.mjs` — fresh and upgrade paths passed, both disposable databases removed. Existing coach rows survived migration unchanged; full current seed produced Jake. SQL tests saved Fitness through the restricted owner profile function, current group-draft command and legacy group create/update functions; unknown values were rejected and Wrestling remained valid. Repeating the exact seed preserved claimed Jake's edited biography and changed discipline. Function signatures, owners, ACLs, security mode and settings matched before/after. Restricted-runtime Fitness directory projection returned Jake as Demo. CHECK definitions include Fitness and exclude Yoga.
- AC1–AC3: `DATABASE_TEST_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres node --import tsx --conditions=react-server --test --test-concurrency=1 tests/database/fitness.test.ts tests/database/demo-coaches.test.ts` — 2 passed, synthetic changes rolled back. Demo-default tests also preserved edited/hidden profiles, cleared portraits, display names and booking history across complete seed repetition.
- AC2–AC3: `npm run demo:setup:local` and `npm run demo:setup:dev`, then each command repeated — succeeded, six exact Demo identities. Temporary bounded target checks in `work/dev0336/target.mjs` verified real Jake password login, original profile/member identity, Fitness, portrait, visible status and exactly one active confirmed primary venue in each environment. Hashes/counts scoped to the original five profiles, coach rows, disciplines, venues, existing website content, encrypted passwords, bookings/requests and private credential entries were unchanged before/after/repeat. No secret was printed. Production/unknown/mixed-target refusal remained covered by automated tests; no production connection occurred.
- AC4: `node --import tsx work/dev0336/isolated-ui.mjs` — passed against a temporary current-source Next.js app on port 3136. Desktop 1440×1000 and mobile 393×852: default All showed all six coaches; typed Fitness showed only Jake; Yoga was invalid; Explore selected Fitness; public portrait loaded with Demo label; actual password login resolved Jake; profile Fitness checkbox toggled by keyboard; new group form offered Fitness; no horizontal overflow. Ten flow screenshots plus initial/diagnostic screenshots and `ui-results.json` are under ignored `work/dev0336/`. Images were visually inspected. An exact-label selector initially timed out on the wrapped group select; using its stable `name` verified the unchanged form successfully. All test app sessions signed out; temporary app/source copies were removed.
- AC4: `node scripts/rehearse-coach-website-database.mjs` — 7 tests passed in each of fresh/upgrade modes, confirming compatibility of the older rehearsal seed; disposable databases removed. The unchanged baseline/rate/review SQL replay suites were not repeated individually; their only new change uses the same tested exact-block exclusion helper.
- AC4: `npm run lint` — passed with no warnings; `npm run typecheck` — passed. `node work/dev0336/build.mjs` ran `next build --webpack` in a temporary current-source copy — production compilation/type checking/static generation passed; the running app's build directory was untouched. Relevant Prettier checks and `git diff --check` passed. No reset, broad hosted seed, deployment, commit or independent review.

## Risks, limitations, and follow-ups

Fitness broadens discipline coverage beyond martial arts; private/group scheduling behavior is unchanged. Hosted dev still lacks the independently owned website/password-method schema rollout: provider password login and exact application identity are verified there; full current-app hosted Auth and website samples depend on that separate rollout. Local full application login and UI passed. This limitation already existed under DEV0335 and was not bypassed by applying unrelated migrations. Jake starts without copied bookings, reviews or availability. Before reverting the Fitness schema, intentionally remove/reclassify Fitness records through a reviewed forward change; never silently discard data. Concurrent edits were preserved and remain outside this ticket.

2026-10-18 commit boundary: the commit includes DEV0335 and DEV0336 source/assets/evidence only. Shared README/spec/index/package changes were staged by owned paragraphs/commands. The committed older website rehearsal is capped at its existing banner migration and uses the compatibility helper; working-tree pricing changes and the new pricing/review rehearsal files remain with their owning tickets. Their calls to the committed helper are retained in the workspace. No private credentials, environment files, captured sessions or unrelated implementation are included.

2026-10-18 commit validation: exported the exact staged tree to a temporary checkout with shared installed dependencies, excluding all unrelated working-tree source and environment files. That tree passed `npm test` (251 general + 40 server = 291 tests), `npm run lint`, `next build --webpack`, `node scripts/rehearse-fitness-database.mjs` (fresh/upgrade) and `node scripts/rehearse-coach-website-database.mjs` (7 checks in each fresh/upgrade mode). Disposable databases and temporary checkout were removed. This is separate from the earlier 311-test whole-workspace result, which also included uncommitted peer work. Staged Markdown links and portrait hashes were checked; credentials/environment/captured-session files were excluded.

## Completion and review references

- Completed: 2026-10-18.
- Commit: Included in the combined `[DEV0335][DEV0336] Provision demo coaches and add Fitness` commit; the sixth coach extends the previously uncommitted provisioner, so these two implementation records travel together.
- Review: Self-review against all four acceptance criteria completed; no independent review.
- Deployment or release: None.
