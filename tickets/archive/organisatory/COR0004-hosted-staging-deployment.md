# Coordination COR0004: Hosted staging deployment

- Status: Cancelled
- Created: 2026-09-23
- Last updated: 2026-10-07
- Milestone: M0 hosted integration environment
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: historical direct members are completed [DEV0054 — Cloudflare Workers runtime foundation](../backend/DEV0054-cloudflare-workers-runtime-foundation.md) and cancelled [DEV0056 — Staging release and domain rehearsal](../backend/DEV0056-staging-release-and-domain-rehearsal.md); [DEV0055 — Hosted Supabase staging environment](../../current/backend/DEV0055-hosted-supabase-staging-environment.md) was transferred to independent ownership when this Cloudflare coordination was cancelled
- Related records: [DEV0015 — Supabase database foundation](../backend/DEV0015-supabase-database-foundation.md), [DEV0046 — Email OTP registration and application profiles](../backend/DEV0046-email-otp-registration-and-application-profiles.md), [DEV0047 — Personal wallet linking and replacement](../../archive/backend/DEV0047-personal-wallet-linking-and-replacement.md), replacement hosting readiness in [DEV0138 — Prepare Vercel deployment](../backend/DEV0138-prepare-vercel-deployment.md), and current marketplace release ownership in [COR0010](../../archive/organisatory/COR0010-group-funded-coach-marketplace-mvp.md)

## Objective and boundaries

Coordinate the first reproducible hosted staging environment for MovX Club at `https://staging.movx.club`: a Cloudflare Worker capable of running the current Next.js application, a dedicated non-production Supabase project, and an end-to-end deployment and smoke-test record.

This coordination record does not implement runtime behavior. It separates repository/runtime compatibility, hosted database and authentication setup, and release/domain operations so that each has its own security boundary and validation evidence. It does not authorize production deployment, production data, real funds, Solana mainnet use, or completion claims for unfinished product features.

## Direct development work

| Implementation part                  | Development ticket                                                                                                    | Owned deliverable                                                                                                       | Start condition or dependency                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Cloudflare runtime compatibility     | [DEV0054 — Cloudflare Workers runtime foundation](../backend/DEV0054-cloudflare-workers-runtime-foundation.md)        | Reviewed vinext/Workers dependencies, configuration, scripts and local compatibility validation without deploying       | Completed historically; runtime later retired by DEV0139                                             |
| Hosted data and identity environment | [DEV0055 — Hosted Supabase staging environment](../../current/backend/DEV0055-hosted-supabase-staging-environment.md) | Dedicated staging project, reviewed schema/runtime role, Auth/SMTP/origin controls and secret-safe operating record     | Transferred to independent ownership for the Vercel path on cancellation                             |
| Integrated staging release           | [DEV0056 — Staging release and domain rehearsal](../backend/DEV0056-staging-release-and-domain-rehearsal.md)          | Staging Worker, runtime/build variables, `staging.movx.club`, preserved Porkbun mail DNS and hosted smoke-test evidence | Cancelled with partial historical deployment evidence; Vercel replacement belongs to DEV0138/DEV0125 |

All required implementation parts have a direct development ticket. These tickets are peers; DEV0056 depends on the outputs of DEV0054 and DEV0055 rather than nesting under either ticket.

## Other relationships

- DEV0015 is the historical schema, migration and least-privilege runtime-role baseline. DEV0055 deploys that contract to a hosted non-production project; it does not rewrite DEV0015.
- DEV0046 supplies the email one-time-passcode (OTP) application flow that hosted Auth must support.
- DEV0047 is a downstream hosted wallet-linking rehearsal when completed. It does not block deploying and testing the currently committed account flow.
- The preceding interface baseline is separately committed at `7038f2e`. Deployment tickets must preserve it and keep their implementation/commit evidence separate.
- Cloudflare, Supabase, Porkbun DNS/email and the chosen Simple Mail Transfer Protocol (SMTP) service are external dependencies. Their credentials and private values must never be recorded in tickets or committed files.

## Delivery sequence and completion conditions

1. DEV0054 reviews the initializer output, proves the application builds for Workers and preserves the existing Next.js workflow.
2. DEV0055 independently creates and verifies a staging-only Supabase database/Auth environment with least-privilege runtime access.
3. DEV0056 combines completed DEV0054 runtime work with DEV0055's verified hosted foundation, deploys to `workers.dev` first, then transfers authoritative DNS safely, binds `staging.movx.club` behind the access boundary and performs the hosted rehearsal. That rehearsal supplies DEV0055's remaining browser-secret and two-account evidence.

COR0004 completes only when all three direct tickets are Completed or explicitly Cancelled/replaced, no required deliverable is left ownerless, and the integrated hosted validation proves the expected public, authentication, protected-profile and failure paths without exposing secrets or disrupting `hello@movx.club` mail.

## Progress and integration record

- 2026-09-23: Split the staging initiative before further implementation because runtime adaptation, hosted identity/data setup and external release operations have different rollback and validation boundaries.
- 2026-09-23: The user ran the vinext initializer before this coordination record was created. Its uncommitted output is assigned to DEV0054 for review; it is not accepted evidence merely because it was generated.
- 2026-09-23: The preceding interface baseline completed independently as commit `7038f2e`; the remaining deployment diff is no longer mixed with that feature implementation.
- 2026-09-23: Adopted `staging.movx.club` as the staging hostname. Cloudflare Workers is the application origin; Cloudflare should create its custom-domain DNS record and certificate after `movx.club` is an active Cloudflare zone.
- 2026-09-23: DEV0054 now produces a complete Workers bundle, but its required local request smoke is blocked because Cloudflare `workerd` requires macOS 13.5+ and the current host reports 13.1. Continue that validation on a supported macOS or Linux host before DEV0056 begins.
- 2026-09-23: The validation host was upgraded to macOS 27.0, removing DEV0054's `workerd` host-version blocker. Local Worker request validation has resumed before DEV0056 begins.
- 2026-09-23: DEV0054 completed after the rebuilt Worker served representative public, protected, API and image requests and passed focused desktop/mobile Chrome smokes on macOS 27.0. DEV0056 may consume this runtime after DEV0055 completes.
- 2026-09-23: DEV0055 linked the dedicated Frankfurt staging project, applied and linted all seven reviewed migrations, verified the password-bound least-privilege runtime login through the transaction pooler, and validated the MovX Club six-digit-code template through custom SMTP. The two-account rehearsal remains in progress.
- 2026-09-23: With user approval, DEV0056 began before DEV0055 completion because the exact-origin browser deployment is required to finish DEV0055's browser-secret, access-boundary and two-account evidence. This does not weaken the release gates: the Worker must pass on `workers.dev`, mail DNS must be copied and verified, and Cloudflare Access must protect the custom hostname before public staging use.
- 2026-09-23: The first DEV0056 release attempt registered the account's `workers.dev` subdomain but Cloudflare rejected Worker creation because the account email was not verified. No Worker deployment or DNS change exists; verification and a clean retry are required.
- 2026-09-23: After account email verification, DEV0056 deployed clean commit `60e2cfe` to the temporary `workers.dev` hostname. Representative public and signed-out server-boundary HTTP checks passed; responsive browser, access, DNS/mail and exact-origin rehearsals remain.
- 2026-09-23: DEV0056 enabled Worker-level Cloudflare Access for all traffic. Unauthenticated website and API requests now redirect to Access before reaching the Worker; authorized-browser confirmation and DNS/mail cutover remain.
- 2026-09-23: Cloudflare became authoritative for the imported `movx.club` zone with the Porkbun website and mail records preserved. DEV0056 added `staging.movx.club` as a Worker Custom Domain; DNS resolution, TLS verification and its unauthenticated Access redirect pass. Authorized exact-origin browser rehearsal remains.
- 2026-09-23: The user completed the allowlisted Cloudflare Access flow and confirmed that MovX Club loads at `https://staging.movx.club`. Hosted Supabase account isolation and Phantom rehearsals remain.
- 2026-09-24: The user selected public access for the stable staging site. Worker-level Access was narrowed to temporary previews, while DEV0055's bounded Supabase Auth email and request limits remain the low-volume abuse boundary. A fresh unauthenticated request to `https://staging.movx.club` returned the application directly with valid TLS.
- 2026-10-07: The user selected Vercel as the immediate hosting target and requested removal of Cloudflare settings/deployment support. DEV0139 removes the repository path, DEV0056 is cancelled with its partial evidence preserved, and DEV0055 becomes independent for reuse by Vercel. This coordination record is cancelled rather than marked complete because its authenticated integration criteria did not finish.

## Validation results

Cancellation consistency and link validation are owned by DEV0139. The planned final cross-provider rehearsal did not complete under this coordination record.

## Risks, limitations, and follow-ups

- The vinext adapter is beta and may expose Next.js compatibility gaps. DEV0054 must test this application rather than relying on the compatibility scan alone.
- Moving authoritative nameservers without first copying Porkbun mail records can interrupt `hello@movx.club`; DEV0056 treats preserved MX, SPF, DKIM and DMARC records as a release gate.
- Hosted OTP must not be exposed publicly with Supabase's demonstration sender or unreviewed abuse controls. DEV0055 owns the safe staging boundary.
- Staging is not production readiness. Backups, production billing/availability, production secrets, release automation and production-domain cutover remain later work.

## Completion and review references

- Completed: Cancelled on 2026-10-07 after the user retired the Cloudflare deployment path; the coordination outcome did not complete.
- Direct development tickets: DEV0054 Completed historically; DEV0056 Cancelled with partial release evidence; DEV0055 transferred to independent In progress ownership for the Vercel path.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: No pull request or independent review exists.
- Deployment or release: Historical external Worker/DNS state is recorded by DEV0056. DEV0139 does not perform external teardown or a replacement deployment.
