# Ticket DEV0056: Staging release and domain rehearsal

- Status: In progress
- Created: 2026-09-23
- Last updated: 2026-10-03
- Milestone: M0 hosted integration environment
- Coordination: [COR0004 — Hosted staging deployment](../organisatory/COR0004-hosted-staging-deployment.md)
- Related records: [DEV0054 — Cloudflare Workers runtime foundation](../../archive/backend/DEV0054-cloudflare-workers-runtime-foundation.md), [DEV0055 — Hosted Supabase staging environment](DEV0055-hosted-supabase-staging-environment.md), [DEV0046 — Email OTP registration and application profiles](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md), [DEV0027 — Phantom wallet connection foundation](../../archive/blockchain/DEV0027-phantom-wallet-connection-foundation.md), and [DEV0047 — Personal wallet linking and replacement](DEV0047-personal-wallet-linking-and-replacement.md)

## Objective and context

Deploy the reviewed MovX Club Workers build against the dedicated staging Supabase project, attach the exact hostname `https://staging.movx.club`, and retain evidence that public browsing, email accounts, protected profiles and current wallet behavior operate correctly in the hosted environment.

This is the integration/release peer under [COR0004](../organisatory/COR0004-hosted-staging-deployment.md). It begins after DEV0054 proves the runtime and DEV0055 proves the hosted database, restricted runtime login, Auth and SMTP foundation. DEV0055's remaining browser-visible secret review, access boundary and two-account isolation evidence are completed through this deployed integration rather than blocking it. A successful staging rehearsal does not mean production readiness or completion of later persistent-payment, reservation or blockchain tickets.

## Scope and non-goals

- In scope:
  - Configure an unmistakably staging-only Cloudflare Worker target and deployment command.
  - Supply required public build variables and private runtime secrets through Cloudflare's supported environment/secret mechanisms.
  - Create one cache-disabled staging Hyperdrive configuration using the restricted Supabase runtime role, bind it to the Worker and keep its origin credential out of source control and browser assets.
  - Onboard `movx.club` to Cloudflare DNS while preserving every Porkbun email record used by `hello@movx.club`.
  - Bind `staging.movx.club` as a Worker Custom Domain and verify Cloudflare-created Domain Name System (DNS) and Transport Layer Security (TLS) state.
  - Apply the staging access/abuse boundary adopted in DEV0055.
  - Run hosted public, responsive, Auth, protected-profile, account-isolation, error/recovery and current Phantom connection smoke tests.
  - Keep database clients and their network promises within one Cloudflare request context; no cached PostgreSQL connection may leak across Worker requests.
  - Record the deployed commit, redacted provider configuration, validation outcomes, rollback and secret-rotation steps.
- Out of scope:
  - Production hostname or production Supabase deployment.
  - Changing Porkbun as the domain registrar or moving the purchased mailbox to another provider.
  - Production availability, backup or disaster-recovery guarantees.
  - Claiming persistent product data, payments, reservations, attendance or Solana transactions that are not implemented.
  - Treating a connected Phantom wallet as account identity. DEV0047 owns optional personal linking when completed.
  - CI/CD automation unless required to make the first controlled deployment reproducible; otherwise create a follow-up ticket.

## Expected behavior and edge cases

- `https://staging.movx.club` resolves to the staging Worker with a valid certificate and never to a production-labelled environment.
- The exact staging origin is used consistently by application origin checks and Supabase Auth redirects. Requests from unexpected origins fail closed.
- `DATABASE_URL` is an ignored direct-access input for local development, verification and Hyperdrive provisioning; it is not uploaded to the staging Worker. Public Supabase values and `NEXT_PUBLIC_SITE_URL` are supplied at the correct build/runtime phases without leaking private values, and server code obtains the hosted database endpoint only from `MOVX_DATABASE`.
- Public routes remain browsable when signed out. Sign-in sends a real OTP, first login enrolls a profile, refresh preserves the session, recovery/cancellation remains understandable, and sign-out clears application access.
- Two accounts remain isolated. A session/wallet mismatch or disconnected wallet is represented honestly and never grants another profile or club authority.
- Current Phantom extension connect/account-change/disconnect behavior works on the HTTPS custom domain without requesting a transaction signature. Optional message-signature linking is rehearsed only if DEV0047 is completed and included in the deployed commit.
- Existing `hello@movx.club` inbound and outbound mail continues to work after nameserver delegation. Missing MX/SPF/DKIM/DMARC records block cutover.
- A failed Worker release can roll back to the previous version without altering the staging database; DNS rollback and credential rotation are documented separately.
- Repeated and concurrent database-backed requests create and close request-scoped clients against the Worker-local Hyperdrive binding. Hyperdrive owns the reusable origin pool to Supabase; application modules must not share direct sockets across Worker requests. Cloudflare must not report cross-request promise resolution, cancel Explore as a hung request or reject a normal catalogue read for exceeding the Free-plan subrequest ceiling. A caught catalogue database failure keeps the public recovery state but emits a bounded server-only diagnostic so staging failures can be distinguished without exposing credentials.

## Assumptions, decisions, and dependencies

- DEV0054 must be complete and DEV0055 must have passed its hosted migration, restricted-runtime, Auth and SMTP foundation before deployment starts. DEV0055 may remain In progress while DEV0056 supplies the exact-origin browser and two-account evidence required to complete both tickets. The preceding interface baseline is already committed independently at `7038f2e`, so the eventual deployed revision can identify it explicitly.
- Cloudflare must be authoritative for the active `movx.club` zone before a Worker Custom Domain can own `staging.movx.club`.
- Add the hostname through Workers > Settings > Domains & Routes or the equivalent reviewed Wrangler `custom_domain` route; do not create a competing Porkbun or Cloudflare CNAME first. Cloudflare creates the required DNS record and certificate.
- Preserve Porkbun registration and email service. Only authoritative DNS hosting moves, after every mail record is copied and checked.
- The stable staging Custom Domain is public so signed-out discovery does not require a separate Cloudflare login. DEV0055's project-wide email cap, per-address resend interval and default IP-based Auth limits form the low-volume staging abuse boundary. Cloudflare Access remains enabled for temporary preview deployments.
- External references: [Cloudflare Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) and [Cloudflare full DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/).

## Implementation plan

1. Confirm the clean DEV0054 runtime and foundation-ready DEV0055 inputs, then record the exact commit selected for staging.
2. Verify Cloudflare CLI authentication and account/zone state without deploying or changing DNS.
3. Create/configure the staging Worker target, build-time public values and runtime secrets. Verify secret names without printing values.
4. Deploy first to the temporary `workers.dev` hostname and validate Worker startup, public routes, server boundaries and secret placement before any DNS cutover.
5. Export/copy Porkbun DNS records to Cloudflare, paying special attention to MX, SPF, DKIM, DMARC and verification records; disable old DNSSEC if required before nameserver change and restore it after Cloudflare becomes authoritative.
6. Change Porkbun nameservers to the pair assigned by Cloudflare and wait for the zone to become Active without losing mail service.
7. Add `staging.movx.club` as the Worker Custom Domain, keep Cloudflare Access on temporary previews only, and verify public access, DNS, TLS and exact-origin behavior.
8. Run the hosted smoke matrix at mobile and desktop widths, including two-account Auth/profile isolation and current Phantom states; record the corresponding DEV0055 evidence there as well.
9. Exercise rollback of the Worker version or document a safe dry run if rollback would disrupt the active rehearsal; record database independence and secret-rotation steps.
10. Update deployment/setup documentation and the ticket with redacted evidence. Do not mark Completed while any acceptance flow remains untested.
11. Correct the 2026-09-28 hosted regression by replacing the module-global PostgreSQL client in application repositories with a bounded request-scoped helper. If the recoverable catalogue state remains, add a credential-safe server diagnostic, reproduce it in Cloudflare, correct the Worker-specific failure and then verify repeated live Explore requests and Worker logs after deployment.
12. After direct request-scoped PostgreSQL still exceeds the Free-plan subrequest ceiling, create a cache-disabled staging Hyperdrive configuration from the existing restricted runtime credential, add and validate its Worker binding, use it only in the Cloudflare runtime while preserving direct `DATABASE_URL` access for local/tests, and repeat the live catalogue/log checks.

## Acceptance criteria

- [x] AC1: A reviewed commit is deployed to a staging-only Worker with required variables/secrets in their correct scopes and no secret committed or exposed to the browser.
- [ ] AC2: `https://staging.movx.club` resolves to that Worker with valid TLS, exact-origin checks work, and no conflicting manual DNS record exists.
- [ ] AC3: Porkbun email service for `hello@movx.club` still sends and receives after Cloudflare becomes authoritative, with MX/SPF/DKIM/DMARC records present and checked.
- [ ] AC4: Signed-out public routes, responsive navigation and honest preview labels work on representative desktop and mobile browsers.
- [ ] AC5: Real hosted OTP first login, returning login, refresh, cancellation/error recovery, profile enrollment and sign-out pass for two isolated accounts.
- [ ] AC6: Current Phantom HTTPS connect, account-change and disconnect behavior passes without an unintended transaction signature; optional wallet-link proof is tested only when its owning ticket is complete.
- [ ] AC7: Unauthorized origins/access and missing or invalid session states fail closed without making public discovery unavailable.
- [ ] AC8: The deployed commit, provider boundaries, rollback, DNS recovery and secret-rotation procedure are documented with redacted evidence.
- [ ] AC9: Repeated public catalogue and protected database requests complete without a module-global connection, a Cloudflare cross-request promise warning or a hung-request cancellation.

## Validation plan

- Inspect the final Worker configuration and built browser assets for secret leakage and correct staging identifiers.
- Use DNS and TLS queries plus Cloudflare dashboard/CLI status to verify the custom domain and certificate.
- Send and receive a controlled message through `hello@movx.club`; validate SPF/DKIM/DMARC using provider-visible headers or an accepted diagnostic tool without publishing sensitive message content.
- Run existing automated domain/browser tests against the selected commit before deployment, then execute a hosted manual/browser smoke matrix at mobile and desktop widths.
- Complete two-account OTP/profile-isolation flows using non-production addresses, including refresh and sign-out.
- Rehearse real Phantom extension states on Devnet over HTTPS; distinguish simple wallet connection from any optional account link.
- Verify an unexpected Origin, unauthenticated protected route and invalid/expired OTP fail safely.
- Record deployment and rollback command results with identifiers redacted where appropriate.

## Implementation record

Implementation began after DEV0054 completed its supported-host Worker validation and DEV0055 passed the hosted migration, restricted-runtime, Auth and SMTP foundation. The first release phase is intentionally read-only: verify Cloudflare authentication and zone state before creating a Worker, adding secrets, deploying or changing DNS.

### Changes and rationale

Added a guarded staging-release command that validates the expected Worker name, exact staging origin, hosted Supabase project, publishable-key form and restricted transaction-pooler connection before building. It passes only allowlisted environment values to Wrangler through a temporary owner-only secrets file, deletes that file even on failure and requires a clean committed worktree for a real deployment. The validation-only and dry-run paths do not create or update a Worker.

The Worker is deployed at its temporary `workers.dev` hostname and at the Cloudflare-managed `https://staging.movx.club` Custom Domain. Worker-level Cloudflare Access protects temporary preview deployments only; the stable Custom Domain is public and the application still enforces its own Supabase sign-in and protected server boundaries. The dependency order permits this integration deployment to supply DEV0055's remaining exact-origin, browser-secret and two-account evidence.

The 2026-09-28 catalogue regression replaces the module-global PostgreSQL client with `withDatabaseConnection`, which creates one client for a repository operation and awaits bounded cleanup in `finally`. Public catalogue reads and application-identity operations use the helper directly; actor-scoped membership, reservation and wallet operations own one client around their database transaction. The lower-level factory remains available for explicit test and operational connections, but application repositories cannot retain a client or promise across Worker requests.

The first corrected release removed the cross-request warning and hung-request cancellation, but live Explore still reached its recoverable error state. The same runtime-role join returned 12 rows and the exact catalogue service produced two plans and seven gyms outside Cloudflare, isolating the remaining fault to the Worker execution path. The catalogue service now records only the caught error name, optional code and a length-bounded message with PostgreSQL URLs redacted; the browser continues to receive the existing generic recovery copy.

The authorized Hyperdrive correction creates the cache-disabled `movx-club-staging-database` configuration against Supabase's direct PostgreSQL endpoint using the existing restricted runtime role. Vinext server code detects the documented `Cloudflare-Workers` runtime, loads `MOVX_DATABASE` through `cloudflare:workers` and gives its generated connection string to a new request-scoped Postgres.js client. Node/local execution continues to use `DATABASE_URL`. The deployment guard requires the reviewed binding identifier, validates the ignored direct URL as an input and uploads only the remaining eight string bindings, so the direct database credential is no longer a Worker environment variable.

### Affected files

| File or component                                           | Change and purpose                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/deploy-staging-worker.mjs`                         | Validates the exact staging origin, Supabase project, publishable-key shape, transaction-pooler login, Worker name and reviewed Hyperdrive identifier; builds and supplies only the eight allowlisted string bindings to Wrangler. |
| `tests/staging-deployment.test.ts`                          | Exercises accepted and rejected staging configuration without connecting to Cloudflare or printing values.                                                                                                                         |
| `package.json`                                              | Adds explicit validation, dry-run and clean-commit deployment commands for staging.                                                                                                                                                |
| `wrangler.jsonc`                                            | Binds the reviewed staging Hyperdrive configuration, declares the eight required string bindings without values and removes `DATABASE_URL` from the Worker secret contract.                                                        |
| `README.md`                                                 | Documents the secret-safe release commands, Hyperdrive binding contract and the `workers.dev`-before-DNS boundary.                                                                                                                 |
| Cloudflare staging Worker and bindings                      | Latest release deploys commit `a8a7cdd` as Worker version `a3872449-5831-49c7-af3f-dd2f9e8707e4`; Wrangler showed the reviewed Hyperdrive binding and eight hidden string values, with no `DATABASE_URL` binding.                  |
| Cloudflare DNS / `staging.movx.club`                        | Cloudflare is authoritative and the public Worker Custom Domain resolves through Cloudflare with a valid certificate and direct `200` application response.                                                                        |
| Porkbun nameserver and email DNS state                      | Nameserver delegation was submitted after the imported website and mail records were compared; the Cloudflare authorities preserve the expected mail records.                                                                      |
| `src/server/db/client.ts`                                   | Replaces the warm-instance singleton with an owned connection helper that closes after success or failure in the same request context.                                                                                             |
| `src/server/db/config.ts`, `env.ts` and `cloudflare-env.ts` | Select direct `DATABASE_URL` configuration locally and the `MOVX_DATABASE` binding only inside Cloudflare, while preserving explicit validation and transport ownership.                                                           |
| `src/server/catalogue/service.ts`                           | Preserves the bounded public recovery state while emitting a credential-safe server diagnostic for a caught catalogue database failure.                                                                                            |
| Catalogue, identity and actor repositories                  | Route public, identity and actor-scoped operations through request-owned connections so Cloudflare never resumes PostgreSQL promises from an earlier request.                                                                      |
| Database and boundary tests                                 | Prove cleanup on success/failure and reject a return to module-global application repository connections.                                                                                                                          |
| `supabase/README.md`                                        | Corrects the hosted runtime runbook from warm-instance pooling to request-scoped connection ownership and records the Hyperdrive staging boundary.                                                                                 |

### Decisions and deviations

- 2026-09-23: Assigned custom-domain/DNS operations to this release ticket rather than DEV0054 so local runtime compatibility can complete without external mutation.
- 2026-09-23: Proposed Cloudflare Access for staging; final adoption remains dependent on DEV0055's abuse-control decision.
- 2026-09-23: With user approval, changed the sequence so DEV0056 starts after DEV0054 completion and DEV0055's foundational database/Auth checks, while DEV0055's remaining browser and account-isolation checks run against the deployed staging origin. The temporary `workers.dev` deployment must pass before any nameserver or custom-domain change.
- 2026-09-23: Confirmed Wrangler OAuth authentication and that no existing `movx-club-staging` deployment is present. Adopted a filtered temporary `--secrets-file` deployment rather than putting public or private values in Wrangler configuration; the temporary file is owner-only and removed in `finally`, and real deployment refuses an uncommitted worktree.
- 2026-09-23: Attempted the first real release from commit `ef93a01`. Wrangler registered the account-level `workers.dev` subdomain and uploaded 61 static assets, then Cloudflare rejected Worker creation with error `10034` because the account email was not verified. A subsequent deployment-list query returned an empty list, so no Worker release is claimed. No DNS or custom-domain change occurred.
- 2026-09-23: After the user verified the Cloudflare account email, the clean retry deployed commit `60e2cfe` successfully to `https://movx-club-staging.movx-club.workers.dev`. Wrangler reported a 25 ms Worker startup time and hid all four binding values. No `movx.club` DNS or Custom Domain change occurred.
- 2026-09-23: Added `staging.movx.club` through the Worker's Custom Domain interface with Production and Preview enabled. Cloudflare created the specific hostname record and certificate; no competing manual record was created. The specific Worker hostname takes precedence over the retained Porkbun wildcard record.
- 2026-09-24: At the user's request, narrowed Worker-level Cloudflare Access from All traffic to Previews only. The stable `staging.movx.club` deployment is public without an extra Cloudflare login; temporary preview deployments retain the configured authentication policies. DEV0055's bounded Supabase Auth email and request limits remain the staging abuse boundary.
- 2026-09-24: At the user's request, released the then-current product-guide and waitlist revision from clean commit `b2ff5b7`. The guarded deployment retained the existing Worker/custom-domain configuration and uploaded only changed assets plus the new `/coming-soon` application route.
- 2026-09-28: Live Worker diagnostics after deploying the persistent catalogue captured Cloudflare's cross-request promise warning and hung-request cancellation. The cause is the module-global `postgres`/Drizzle connection cached by `src/server/db/client.ts`; the catch in the catalogue service converted the exception into a generic unavailable state. The adopted correction is explicit request-scoped connection ownership with awaited cleanup. The compatibility flag suggested by the runtime warning is not used to conceal unsafe connection reuse.
- 2026-09-28: The request-scoped release exposed a second Cloudflare-only failure: the PostgreSQL call exceeded the Free-plan ceiling of 50 subrequests. Increasing `limits.subrequests` cannot fix a Free-plan Worker because 50 is also that plan's maximum. A trial of Postgres.js `fetch_types: false` did not bring the invocation below the ceiling and database integration tests proved it invalid for this schema because PostgreSQL arrays and JSON snapshots then arrived as strings. Normal type decoding is retained. After reviewing the credential boundary, the user explicitly authorized a cache-disabled staging Hyperdrive configuration. DEV0056 owns that infrastructure correction because it already owns the Cloudflare/Supabase staging integration; the Worker receives only the binding while Cloudflare stores the restricted origin credential.

### Contracts, configuration, and operations

The release uses `https://staging.movx.club`, eight allowlisted string bindings, one `MOVX_DATABASE` Hyperdrive binding, Cloudflare-managed TLS and a staging-only Worker. Public Supabase/site and browser Devnet RPC values are present before the build so vinext can inline only explicitly public configuration; server-only RPC and fee-sponsor values remain runtime secrets. `DATABASE_URL` is validated as a deployment input but excluded from the temporary secrets file and deployed Worker. Cloudflare stores the restricted database origin credential inside the cache-disabled Hyperdrive configuration; no value is recorded here.

## Validation results

The local release guard, application checks and Cloudflare upload dry run pass. Commands and output below omit all values, account identifiers and provider credentials.

- 2026-09-28 regression reproduction — repeated deployed Explore React Server Component requests were cancelled as hung; Worker logs reported promises resolving from a different request context and pointed to the cached `postgres` client. A runtime-role database query itself succeeded, isolating the failure to Worker connection lifetime rather than credentials or grants.
- 2026-09-28 local correction — `npm test` passed 83 tests, including the new repository-boundary check; `npm run test:db` passed 31 integration tests, including request-owned cleanup after success and failure; `npm run db:test` passed all 156 pgTAP assertions from a reset deterministic local database. `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` and `git diff --check` passed. One earlier pgTAP run encountered pre-existing disposable local membership/reservation rows; the documented local-only reset and runtime-role recreation restored the deterministic baseline before the clean passing rerun.
- 2026-09-28 first corrected staging release — eight concurrent Explore requests returned HTTP `200` without cross-request promise warnings or hung-request cancellations, but their application payloads still reported the recoverable catalogue error. A read-only invocation of the exact hosted join returned 12 rows, and the exact service returned `ready` with two plans and seven gyms from the same environment. The credential-safe caught-error diagnostic was added for the next Worker reproduction; `npm test` passed 83 tests, `npm run lint` and `npm run typecheck` passed, and focused formatting passed after applying Prettier to this record.
- 2026-09-28 Worker diagnostic release — deployed commit `00a0708` as Worker version `d3009366-1086-406a-8b44-5df39a36214a`. One live Explore request reproduced the recovery state and logged only `Too many subrequests by single Worker invocation`; no database URL or credential was emitted. The round-trip reduction adds `fetch_types: false` plus a boundary regression assertion. `npm test` passed 83 tests, and `npm run lint`, `npm run typecheck` and focused Prettier checks passed before deployment.
- 2026-09-28 Hyperdrive pre-deployment validation — Wrangler created configuration `390007706c314f3f808535332a802f7d` as `movx-club-staging-database`; read-back showed the expected direct Supabase host, restricted runtime role, 20-connection Free-plan origin limit and disabled query caching without displaying its password. An initial database integration run exposed that the preceding `fetch_types: false` experiment returned schema arrays/JSON as strings and failed five mapping tests; reverting that option produced a clean 31/31 database integration pass. `npm test` then passed 85 tests; `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, the deployment validation and `git diff --check` passed. The staging dry run built all five Vinext environments and showed `MOVX_DATABASE` plus eight hidden string bindings, with no `DATABASE_URL` Worker binding.
- 2026-09-28 Hyperdrive staging release — deployed commit `a8a7cdd` as Worker version `a3872449-5831-49c7-af3f-dd2f9e8707e4`. Eight concurrent `https://staging.movx.club/explore` requests returned HTTP `200` in approximately 0.06–0.55 seconds. None contained the catalogue-unavailable recovery copy; every response contained persistent-catalogue evidence, and the unfiltered response contained the Basic and Classic plans plus all seven expected fictional gyms. The Worker tail reported successful requests with no subrequest-limit, cross-request-promise or hung-request errors. Deployment output showed `MOVX_DATABASE` plus eight hidden string bindings and no `DATABASE_URL` Worker binding.

- `npx --no-install wrangler whoami` — passed; confirmed the intended authenticated Cloudflare session.
- `npx --no-install wrangler deployments list --name movx-club-staging --json` — passed; confirmed no existing deployment would be overwritten.
- `npm run deploy:staging:check` — passed against the ignored staging environment file; validated exactly four approved bindings without printing values.
- `npm run deploy:staging:dry-run` — passed; vinext built all five environments, Wrangler prepared 72 static assets and the Worker bundle, displayed only hidden values for the four approved bindings, and exited in dry-run mode without uploading or creating a Worker.
- `npm run deploy:staging` — blocked by Cloudflare after building and uploading 61 assets; all four binding values remained hidden, but Worker creation failed with account-email verification error `10034`.
- `npx --no-install wrangler deployments list --name movx-club-staging --json` after the failed release — passed and returned an empty list, confirming that no deployable Worker version was created.
- `npm run deploy:staging` after account verification — passed; deployed commit `60e2cfe59dca`, 72 static assets and the Worker to the staging-only `workers.dev` hostname with a 25 ms reported startup time. Wrangler displayed only hidden values for the four approved bindings.
- Hosted HTTP smoke against the temporary hostname — `/`, `/explore`, `/how-it-works` and `/sign-in` returned `200` HTML; `/api/auth/session` returned `200 {"status":"signed-out"}`; protected actor and personal-wallet reads returned `401 {"status":"signed-out"}`; an unauthenticated personal-wallet deletion from `https://example.com` returned `403 {"status":"forbidden"}`. The home document contained the MovX Club title and name.
- Browser-bundle scope inspection — scanned 50 generated browser JavaScript, Cascading Style Sheets (CSS), JSON and HTML files from the deployed build. The full database URL, password, restricted runtime username and pooler hostname were absent; the three expected public staging values were present.
- Hosted headless Chrome smoke — desktop at `1440 × 1040` and mobile at `393 × 852` loaded `/`, `/explore`, `/how-it-works` and `/sign-in` with `200` responses, no failure screen, browser error or horizontal overflow. Home-to-Explore navigation and studio images passed. The initial mobile image assertion ran before below-the-fold lazy images were requested; repeating it after scrolling the section into view, consistent with the existing browser suite, passed.
- Cloudflare Worker-level Access — enabled for all traffic after initializing the account's Zero Trust organization. Unauthenticated requests to both `/` and `/api/auth/session` return `302` Access redirects, confirming that the staging interface and server routes are gated before the Worker handles them.
- Pre-delegation mail DNS baseline — public queries confirm Porkbun's two MX records, the single Porkbun SPF policy, an explicit `default._domainkey` DKIM TXT public key and an explicit `_dmarc` TXT policy using `p=quarantine`. Values containing the public key and reporting addresses are intentionally not copied into this ticket; they must be copied exactly from Porkbun to Cloudflare and compared through DNS before nameserver delegation.
- DNS cutover initiated — the user confirmed Cloudflare's imported zone matched Porkbun's complete record list and saved the two assigned Cloudflare nameservers at Porkbun. No Domain Name System Security Extensions (DNSSEC) delegation signer record was active before cutover. Immediate checks through Cloudflare DNS, Google Public DNS and the `.club` registry still returned the four Porkbun nameservers, as expected during propagation; all four mail-authentication record groups continued to resolve from the old authority.
- Partial propagation and new-authority audit — Cloudflare's public resolver began returning the assigned `art.ns.cloudflare.com` and `erin.ns.cloudflare.com` pair while another registry/resolver path remained cached on Porkbun. Direct queries to both new authoritative servers returned matching MX, SPF, DKIM and DMARC data. The imported root and Porkbun CNAME records were still proxied, evidenced by Cloudflare anycast answers instead of the original Porkbun targets; they must be changed to DNS-only before the migration baseline is accepted.
- DNS-only baseline accepted — after the user disabled proxying for the two root A records plus the `www` and wildcard CNAME records, both Cloudflare authorities returned the original Porkbun IPs and CNAME targets. MX, SPF, DKIM and DMARC remained unchanged. Resolver caches were still mixed between Porkbun and Cloudflare delegation, so the exact staging hostname may remain inconsistent until convergence even after its Custom Domain is added.
- Worker Custom Domain — `staging.movx.club` resolves to Cloudflare anycast addresses, an HTTPS request verifies the certificate successfully and returns the expected `302` redirect to the Cloudflare Access login. No CNAME is exposed for the hostname because Cloudflare manages the Worker routing directly. Authenticated Access and application-flow checks remain manual.
- Authorized custom-origin load — the user completed Cloudflare Access authentication at `https://staging.movx.club` and confirmed that the deployed MovX Club application loads. Supabase account, protected-profile and Phantom flows remain to be rehearsed at this origin.
- Public custom-origin load — after changing Worker Access from All traffic to Previews only, a fresh unauthenticated HTTPS request to `https://staging.movx.club` returned `200` directly with successful certificate verification and no redirect. The user independently confirmed the site loads without the Cloudflare login. Temporary previews remain protected.
- 2026-09-24 release validation — `npm run deploy:staging:check` passed without printing values; `npm run deploy:staging:dry-run` built all five vinext environments, included `/coming-soon`, prepared 71 assets and exited without upload; the sandbox prevented Wrangler from writing its optional local debug log but did not affect the successful dry run.
- 2026-09-24 release — `npm run deploy:staging` passed from clean commit `b2ff5b7fbe53`; Wrangler uploaded 37 changed assets, reported a 21 ms Worker startup time and deployed version `5469b9a0-0123-4929-94bd-d948ed14ca16`. All four approved binding values remained hidden.
- 2026-09-24 public release smoke — `/`, `/how-it-works` and `/coming-soon` each returned final HTTP `200` from `https://staging.movx.club`. The rendered guide contained `Fitness access that`, `Small transfer fee paid to the gym` and `Join the waitlist`; the Coming Soon document contained `Flexible fitness access is getting ready to move`, `Save your place` and the explicit no-storage disclosure.
- `npm test` — passed, 52 tests including accepted configuration, rejected production-origin configuration and Wrangler binding-boundary coverage.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run format:check` — passed.
- `git diff --check` — passed.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                | Result  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| AC1       | Reviewed commit `a8a7cdd` is deployed as Worker version `a3872449-5831-49c7-af3f-dd2f9e8707e4`; the release guard showed the reviewed Hyperdrive binding and eight hidden string bindings, no direct database URL, and prior browser-secret inspection remains applicable.                                                                              | Passed  |
| AC2       | The exact origin is enforced locally; `staging.movx.club` resolves through Cloudflare, HTTPS certificate verification succeeds and the application loads after authorized Access authentication. Authenticated mutation checks remain.                                                                                                                  | Partial |
| AC3       | Porkbun and Cloudflare record lists match; MX, SPF, DKIM and DMARC remain public during pending delegation. Post-cutover DNS plus send/receive checks remain.                                                                                                                                                                                           | Partial |
| AC4       | Automated tests plus prior desktop/mobile hosted Chrome checks pass for public navigation, images and overflow. The latest root, guide and Coming Soon routes return `200`; eight concurrent live Explore requests returned the persistent Basic/Classic catalogue and seven fictional gyms without recovery copy. Honest preview-label review remains. | Partial |
| AC5       | Hosted Auth rehearsal not run.                                                                                                                                                                                                                                                                                                                          | Not run |
| AC6       | Hosted Phantom rehearsal not run.                                                                                                                                                                                                                                                                                                                       | Not run |
| AC7       | Invalid deployment configuration fails closed in tests; hosted signed-out protected reads return `401`, a wrong-origin mutation returns `403`, and public discovery returns `200` without granting application identity. Temporary previews retain Access.                                                                                              | Passed  |
| AC8       | Reproducible commands, clean-commit enforcement, deployed commit and the failed/recovered release are documented; rollback and DNS recovery remain.                                                                                                                                                                                                     | Partial |
| AC9       | Eight concurrent public catalogue requests passed through Hyperdrive without subrequest-limit, cross-request-promise or hung-request errors. An authenticated protected database request has not yet been rehearsed against this release.                                                                                                               | Partial |

## Risks, limitations, and follow-ups

- DNS and TLS propagation can delay validation; do not repeatedly rewrite records while issuance is pending.
- Nameserver mistakes can interrupt business email even when the website deploy succeeds.
- Cloudflare Workers resource limits, Supabase free-tier availability and cross-region database latency may require measured follow-up work.
- The `workers.dev` URL can be used for an initial infrastructure smoke test, but exact-origin Auth/wallet behavior is accepted only on `staging.movx.club`.
- Next action: run the Supabase email-code sign-in, protected-profile isolation and Phantom browser rehearsals at `https://staging.movx.club`.

## Completion and review references

- Completed: Not completed.
- Commit: latest deployed application commit `a8a7cdd` (`[DEV0056] Route staging database through Hyperdrive`).
- Review: No pull request or independent review exists.
- Deployment or release: commit `a8a7cdd` is deployed as Worker version `a3872449-5831-49c7-af3f-dd2f9e8707e4` at the public `https://staging.movx.club` Custom Domain. Eight concurrent Explore requests returned the complete persistent catalogue without Worker errors; prior direct `200` checks for the root, redesigned guide and Coming Soon page remain applicable. Cloudflare Access protects temporary preview deployments only.
