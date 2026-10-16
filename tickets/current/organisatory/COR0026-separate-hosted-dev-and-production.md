# Coordination COR0026: Separate hosted dev and production

- Status: In progress
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Hosted environment separation
- Converted from: Not applicable — created as a coordination record.
- Tracked development tickets: [DEV0266 environment guards](../../archive/backend/DEV0266-guard-hosted-environment-selection.md), [DEV0267 dev setup](../../archive/backend/DEV0267-connect-new-hosted-dev-environment.md), [DEV0268 production setup](../backend/DEV0268-prepare-isolated-production-environment.md), [DEV0269 hosted startup default](../../archive/backend/DEV0269-default-local-startup-to-hosted-dev.md).
- Related records: completed baseline [DEV0265](../../archive/backend/DEV0265-baseline-completed-database-migrations.md) and seed [DEV0249](../../archive/backend/DEV0249-repair-legacy-seed-location-compatibility.md); historical staging [DEV0055](../backend/DEV0055-hosted-supabase-staging-environment.md); independent retained Docker continuity [DEV0232](DEV0232-restore-local-migration-continuity.md).

## Objective and boundaries

Coordinate the confirmed local app and deployed UAT/test → hosted dev, production → separate hosted prod arrangement. The user created both projects and confirmed dev `mdzidiqosxbghmfyxphb` and prod `yltijwebedkraypgkqmc`; CLI project names are `movx-dev` and `movx-prod`, both healthy in `eu-central-1`. This record performs no implementation.

Keep existing retained Docker data and the old staging project unchanged. Current email-code authentication remains the contract; social/password authentication, invitations, account/file transfer, DNS, live production publication and unrelated calendar/Events work are outside this rollout.

## Direct development work

| Implementation part             | Development ticket                                                              | Owned deliverable                                                                                                                                                             | Start condition or dependency                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Explicit environment selection  | [DEV0266](../../archive/backend/DEV0266-guard-hosted-environment-selection.md)  | Public project/runtime-role mapping, local hosted startup and hosted verification/build guards, examples, focused tests and operating guidance.                               | Confirmed project mapping; no remote writes required.                                                                  |
| New hosted dev connection       | [DEV0267](../../archive/backend/DEV0267-connect-new-hosted-dev-environment.md)  | Dev preflight, exact migrations/ledger, restricted runtime role, development fixture choice, current Auth setup, ignored local connection settings and dev/UAT handoff/proof. | Confirmed CLI access, DEV0266 target checks and concrete reviewed operation plan.                                      |
| Normal app startup default      | [DEV0269](../../archive/backend/DEV0269-default-local-startup-to-hosted-dev.md) | Route ordinary/local app commands to the guarded hosted launcher; retain Docker app startup only under an explicit name and document the change.                              | DEV0266 launcher and DEV0267 local hosted configuration. Can finish before or independently of production preparation. |
| Isolated production preparation | [DEV0268](../backend/DEV0268-prepare-isolated-production-environment.md)        | Separately validated production bootstrap/runtime/Auth and production-only deployment-setting handoff, excluding demo data and live publication.                              | Dev proof passes; production operation scope and target state reviewed before work starts.                             |

All four required direct peers exist and belong only to this COR. No development ticket is a child of another.

## Other relationships

- DEV0265/DEV0249 supply the frozen baseline, forward-calendar compatibility and safe demonstration seed, without granting permission to reset or relabel an existing database.
- DEV0055 retains its dated old-project provisioning evidence and hosted rehearsal scope. This new-account rollout does not claim the old project's validation for the new projects.
- DEV0232 remains independent retained-Docker continuity. Hosted dev setup does not clear its ledger or delete retained users/uploads.
- Real Vercel deployments/domains, future authentication providers and any transfer of existing identities/data/files are downstream work unless explicitly added with bounded ownership.

## Delivery sequence and completion conditions

1. DEV0266 removes implicit old staging selection and proves dev/prod mismatch refusal before remote operations.
2. DEV0267 inspects the confirmed dev project read-only, prepares exact bootstrap/credentials/configuration, then applies only the validated dev plan and verifies the actual restricted connection. Record missing SMTP/UAT origins or external access as explicit remaining work.
3. DEV0268 follows successful dev proof, with an independent empty/existing-state check and production configuration. Production stays unchanged during the current dev setup; no demo seed or automatic live deployment is implied.
4. Complete only after all direct peers complete or are explicitly replaced/cancelled and environment selection, separate identities/data, current migrations and runtime/Auth/deployment settings have actual evidence. No planning or local-only check substitutes for hosted proof.

2026-10-16 startup-default clarification: the user confirms that usual local startup must use hosted dev without starting/creating Docker databases. DEV0269 follows the completed dev setup; it may finish independently of DEV0268 and owns the ordinary command change beyond DEV0266's historical opt-in hosted command. Existing Docker test/operator workflows and running services remain separate opt-ins and are not deleted or interrupted.

## Progress and integration record

- 2026-10-16: User confirmed two projects and their exact dev/prod mapping, then signed the CLI into the new account. Read-only listing verifies both names, region and healthy status. The first CLI login could see neither; no wrong-project change occurred.
- 2026-10-16: User selected planned UAT `https://test.movx.club` and production `https://movx.club`. DEV0266's target guards and source/static/public-preview checks pass. DEV0267 applied the two unchanged accepted migrations, full dev fixtures and restricted login; real permission and guest application reads pass. Exact local/UAT Auth origins, six-digit codes, existing Porkbun SMTP and both code templates are configured. The user authorized one email, confirmed delivery and supplied its code locally; real Auth verification and the local app's signed-in/profile-required/forbidden-before-onboarding boundary passed. The test session signed out and code was removed. DEV0268 has not started and production remains unchanged.
- 2026-10-16 final parallel-work boundary: DEV0254's newly added uncommitted owner-calendar migration `20261016000300` is outside DEV0267's reviewed two-migration cutoff. It needs its owner's validation and a separate hosted rollout before the newest calendar features can be assumed available on dev.
- 2026-10-16: DEV0269 made `dev`, `dev:local` and `dev:hosted` select the same guarded hosted-dev launcher; Docker app startup is explicit `dev:docker`. The 22 focused tests, real npm preflight, type/lint checks and 20 actual hosted permission checks passed. Existing app processes and Docker test services/data were preserved; their owners must restart existing app processes to change target.

## Validation results

DEV0266 records 25 focused and 179 complete application/server tests, type/lint/format checks and a configuration-free Vercel build. DEV0267 records exact dev ledger/bootstrap, 20 real runtime grant checks, actor-unbound row/write denial, actual hosted directory/profile/sign-in-page reads and one real new-account email/session verification without granting application authority. This remains partial rollout evidence: full browser onboarding/scheduling, deployed UAT and all DEV0268 production criteria remain unverified. DEV0266's namespace, link/index and reciprocal membership checks passed.

## Risks, limitations, and follow-ups

Local and UAT intentionally share dev data/Auth users. Migration-owner credentials must remain distinct from the restricted app runtime connection. Production has independent settings and receives no demo seed. Auth provider replacement and old data migration remain separate decisions.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0266 Completed; DEV0267 Completed; DEV0268 Draft; DEV0269 Completed. This coordination record remains open for independent production setup.
- Commit: Coordination/planning record included with user-authorized `[DEV0266][DEV0267][DEV0269] Use hosted Supabase dev for local development`; COR IDs never appear in commit subjects. DEV0268 remains Draft and production is unchanged.
- Review: Source/planning self-review only.
- Deployment or release: No deployment; production unchanged.
