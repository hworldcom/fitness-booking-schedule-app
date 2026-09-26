# Ticket DEV0041: Club wallet authorization

- Status: In progress
- Created: 2026-09-20
- Last updated: 2026-09-25
- Milestone: M0 identity / M2 club authority prerequisite
- Coordination: [COR0002 — Phantom authentication and demo access](../organisatory/COR0002-phantom-auth-and-demo-access.md)
- Related records: depends on completed [DEV0039 — Prepared identity and wallet bindings](../../archive/backend/DEV0039-prepared-identity-and-wallet-bindings.md), [DEV0040 — Protected access and database context](../../archive/backend/DEV0040-protected-access-and-database-context.md) and [DEV0046 — Email OTP registration and application profiles](../../archive/backend/DEV0046-email-otp-registration-and-application-profiles.md), plus in-progress [DEV0047 — Personal wallet linking and replacement](DEV0047-personal-wallet-linking-and-replacement.md); supplies club authority consumed by completed [DEV0051 — Club value proposition and sign-in entry](../../archive/frontend/DEV0051-club-value-proposition-and-sign-in-entry.md) and later financial tickets; implements C14 from [DEV0007 — EURC-only wallet contract](../../archive/blockchain/DEV0007-eurc-only-wallet-contract.md)

## Objective and context

Authorize a prepared fitness or sports club's distinct Phantom wallet only when the current MovX Club session belongs to that club's active primary administrator and a fresh club-scoped wallet proof succeeds. Preserve the administrator's personal application identity while keeping personal and club signing authority, balances and future financial actions separate.

A club workspace is not a separate Supabase identity. Every administrator signs in with their own email account, then deliberately acts in an authorized club context. DEV0051 owns the dedicated club-facing sign-in entrance and public explanation; this ticket owns the server-derived club authority that entrance consumes.

This is an authorization prerequisite, not a payment ticket. It implements the identity-side portion of C12/C14 and the specification's [role](../../../docs/mvp-spec.md#roles) and [wallet-integrity](../../../docs/mvp-spec.md#9-asset-wallet-and-demo-integrity) rules without constructing, signing, simulating or submitting a transaction.

## Scope and non-goals

- In scope: consume DEV0039's mutually exclusive `wallet_bindings` schema and DEV0047's shared one-time `auth_challenges` contract; add a club-specific challenge purpose plus prepared organization-wallet configuration and organization binding/proof repository/service methods; verify an active organization membership with the primary-admin role from the wallet-independent actor context; issue and consume challenges bound to the organization, demo run, administrator, wallet, origin, cluster and purpose; expose explicit personal-versus-club authority state; preserve the email-authenticated application session during an intentional club-wallet switch; invalidate club authority on disconnect, account change, expiry or role/binding revocation; test wrong personal/club/staff/run combinations and concurrent proof use.
- Out of scope: a separate or shared club authentication identity; self-service club creation, invitations or administrator management; changing DEV0039's shared wallet-binding schema owner; adding another personal-link signature; Supabase account registration or profile enrollment; a general club-management dashboard; multiple primary administrators; wallet replacement/recovery or multisignature custody; balance reads; transaction construction, simulation, signature or submission; EURC transfers, sponsorships, receipts, refunds or on-chain verification.

## Expected behavior and edge cases

An administrator enters through the club-oriented interface but authenticates with the same personal email identity used everywhere else. The server derives the clubs that account may administer; browser-submitted organization IDs or roles never grant access. For the MVP, each prepared club has one prepared primary administrator and one distinct club wallet stored in server-controlled database/configuration rather than frontend code.

The active primary administrator deliberately enters a club workspace, connects the prepared wallet registered to that organization and approves a fresh club-scoped message. Success yields a bounded, short-lived server-verified authority result identifying the personal administrator, demo run, organization, club wallet, purpose and expiry. The interface shows `Club wallet · Solana Devnet · Test funds` separately from both the personal session and any personal wallet.

The administrator's personal wallet cannot substitute for the club wallet. Another club's wallet, another run, an unrelated organizer, inactive/revoked organization role, staff/check-in role, a copied/expired/consumed proof or browser-selected club ID cannot authorize the club. The same wallet address cannot be both personal and organization-owned in one run.

Switching to the club wallet must not sign the browser in as the club, create a second application profile or merge identities. The personal Supabase/application session remains the accountable administrator identity, while the active wallet is treated only as separately proved club signing authority. Disconnect, account switch, proof expiry, role revocation or binding change removes club authority before a later financial prompt. Leaving the club workspace restores an honest personal context and requires the matching personal wallet before a future personal wallet-signing action.

An authenticated person without an active primary-admin role remains signed in personally but receives no club workspace or club authority. Future support for one person administering several clubs must present only a server-derived eligible list and rebind proof to the selected organization; the MVP may start with one prepared club per primary administrator.

## Assumptions, decisions, and dependencies

Confirmed with the user on 2026-09-22:

- user-facing language is **fitness or sports club**, **club workspace** and **club wallet**; the database retains the broader internal term `organization`;
- clubs receive a dedicated sign-in interface, but not separate credentials or a separate authentication system;
- administrators authenticate individually through the existing email one-time-passcode flow and remain the accountable application actors while acting for a club;
- prepared MVP clubs have public organization records, one primary administrator and a distinct club wallet; self-service creation and invitations come later;
- the public club value proposition and sign-in entrance are separate frontend work in DEV0051.

DEV0039 owns the shared `wallet_bindings` table and its one-owner-per-run/cluster constraints. DEV0047 owns the shared `auth_challenges` table because optional personal-wallet linking is delivered first. This ticket extends that reviewed organization-owner/purpose contract rather than creating a competing challenge or club-wallet table. DEV0046/DEV0040 supply the verified email subject, demo run, profile and organization-role context.

Use message signatures only for authority proof. A successful proof does not establish funds, token accounts, a valid recipient, a transaction signature or chain finality. Later financial tickets must recheck current administrator/club authority and request explicit transaction approval for each operation.

Implementation default locked when work started on 2026-09-22: club authority lasts ten minutes at most and still ends immediately on disconnect, account change or current role/binding mismatch. The one-time proof challenge retains DEV0047's shorter five-minute lifetime.

The user chose to begin this implementation before DEV0047's deferred real-Phantom rehearsal. DEV0047's clean database replay, automated proof tests and local generated-signer rehearsal are sufficient to reuse its contract; DEV0041 and DEV0047 both remain incomplete until their required real-wallet evidence is recorded.

## Implementation plan

1. Review DEV0047's delivered and automatically validated binding/challenge contracts plus DEV0046/DEV0040's authorization context; lock the club authority lifetime, invalidation and prepared-club configuration. Defer the real-Phantom rehearsal without treating it as implementation evidence.
2. Extend the shared challenge purpose/organization-owner contract only as needed, then add organization binding and club-proof repository/service methods with active primary-admin checks and atomic challenge consumption.
3. Add explicit club-workspace authority state that retains the personal application session while treating the selected Phantom account only as club signing authority. Supply the bounded contract consumed by DEV0051's club sign-in entrance.
4. Invalidate authority on mismatch, disconnect, expiry, role/binding revocation or account change; never trust a club ID or role supplied by the browser.
5. Add database/service/browser tests plus a real prepared administrator/club-wallet rehearsal. Confirm no transaction or balance request is made.

## Acceptance criteria

- [x] AC1: An individually authenticated active primary administrator can prove only the prepared distinct wallet bound to their club/run and receives a bounded, expiring club-authority result.
- [x] AC2: Club authority is tied to the administrator's existing verified personal email identity and creates no shared club credentials, second Supabase user or duplicate personal profile.
- [x] AC3: Personal wallet, unrelated club wallet, foreign run/organization, non-admin/staff-only actor, revoked organization role/binding and browser-selected club metadata cannot grant authority.
- [x] AC4: Personal and organization ownership are mutually exclusive for one wallet within a run/cluster, including concurrent binding/proof attempts.
- [x] AC5: Intentional club-wallet switching retains the administrator's personal application session but never signs in or merges the club as a user. Disconnect/account change/expiry/revocation clears club authority.
- [x] AC6: The interface distinguishes personal session from `Club wallet · Solana Devnet · Test funds`; success claims no balance, payment, transaction signature or finality.
- [ ] AC7: SQL/repository/service tests, unit/boundary checks, lint, typecheck, build, desktop/mobile browser checks and a real prepared club-wallet message-proof rehearsal pass with exact evidence recorded.

## Validation plan

Use one prepared administrator session, its distinct prepared club wallet, another personal wallet, another club wallet, a staff-only actor, a revoked administrator and foreign-run/organization inputs. Test concurrent proof use and changes to the organization role/binding after proof issuance. Validate mutual exclusivity directly in PostgreSQL and through services.

In desktop Chrome, sign in through the existing application email route, enter the DEV0041 club-authority state, connect the club wallet, approve only the club-scoped message, inspect the separate authority state, then disconnect/change accounts and confirm authority disappears while the personal application session remains. Confirm a non-administrator receives no club authority without losing ordinary signed-in access. Completed DEV0051 validates the dedicated `/clubs/sign-in` presentation against this delivered contract. Run database/integration tests, unit/boundary checks, lint, typecheck, formatting, webpack build and affected desktop/mobile Playwright scenarios. No transaction approval is requested or authorized.

## Implementation record

Implementation is functionally complete and remains in progress only for the required real-Phantom validation. This ticket was created when the unimplemented DEV0016 plan was converted to COR0002. Its terminology and login boundary were refined on 2026-09-22 after the user clarified that the financial organizations are fitness and sports clubs and accepted a dedicated club-facing entrance backed by individual administrator login. It owns club authority only; public club messaging/entry UI belongs to DEV0051 and financial tickets remain separate.

### Changes and rationale

The database now supports organization-owned one-time challenges and ten-minute club authorities. Both are bound to the verified Supabase user, the exact Supabase Auth session ID, the application profile and demo run, the server-derived active primary-administrator membership, the prepared active club-wallet binding and Solana Devnet. Challenge completion is atomic; a copied, expired, consumed, differently signed or differently logged-in proof fails without granting authority.

The server exposes bounded snapshot, challenge, proof and revocation endpoints. Request bodies never accept a club ID, run ID, profile ID or role. The challenge message displays the administrator email, club identity, origin, Devnet wallet, one-time nonce/timestamps and an explicit statement that no transaction is created and no funds move. A new browser session, role/binding change or expiry invalidates authority during the next bounded server lookup.

The existing wallet dialog now offers separate `Personal wallet` and eligible `<club> club wallet` contexts without changing the email-authenticated application identity. The club state connects only the prepared address, requests `signMessage`, shows `Personal email session`, `Club authority` and `Solana Devnet · Test funds`, and provides explicit leave/disconnect actions. A guard mounted with the application shell revokes active club authority when Phantom disconnects or changes accounts even if the wallet dialog is closed. No balance lookup or transaction API was added.

Local preparation and rehearsal scripts assign an already enrolled email account as the sole active primary administrator of a chosen prepared club and install a distinct prepared wallet without storing signing material. The automated Chrome rehearsal creates a temporary email account, signs with an in-memory generated Solana key, verifies server-derived Northside Combat eligibility, denial paths, exact proof, replay rejection, ten-minute authority, responsive/keyboard presentation and explicit revocation. It is useful integration evidence but is not the still-pending real Phantom extension rehearsal.

### Affected files

| File or component | Change and purpose |
| ----------------- | ------------------ |
| [`supabase/migrations/20260922000200_create_club_wallet_authority.sql`](../../../supabase/migrations/20260922000200_create_club_wallet_authority.sql), [`src/server/db/schema/foundation.ts`](../../../src/server/db/schema/foundation.ts), [`src/server/db/schema/identity.ts`](../../../src/server/db/schema/identity.ts) | Extend shared challenges with organization purpose/session binding, enforce one active primary administrator per club and add the RLS-protected authority table plus bounded database functions. |
| [`src/server/auth/session.ts`](../../../src/server/auth/session.ts), [`src/server/db/wallet/club-repository.ts`](../../../src/server/db/wallet/club-repository.ts), [`src/server/wallet/club-service.ts`](../../../src/server/wallet/club-service.ts) | Extract the immutable Supabase session ID, establish transaction-local club session context, derive the eligible club and enforce challenge/authority state without trusting browser authority claims. |
| [`src/solana/club-wallet.ts`](../../../src/solana/club-wallet.ts), [`src/app/api/wallet/club/`](../../../src/app/api/wallet/club), [`src/solana/client/club-wallet-client.ts`](../../../src/solana/client/club-wallet-client.ts) | Define the bounded public contract and same-origin snapshot/challenge/proof/revocation transport. |
| [`src/solana/client/club-wallet-authority.tsx`](../../../src/solana/client/club-wallet-authority.tsx), [`src/solana/client/wallet-connection.tsx`](../../../src/solana/client/wallet-connection.tsx), [`src/components/shell.tsx`](../../../src/components/shell.tsx), [`src/app/globals.css`](../../../src/app/globals.css) | Present separate personal/club wallet contexts, message-only proof, explicit exit controls and global disconnect/account-change invalidation. |
| [`scripts/prepare-local-club-wallet.mjs`](../../../scripts/prepare-local-club-wallet.mjs), [`scripts/rehearse-local-club-wallet.mjs`](../../../scripts/rehearse-local-club-wallet.mjs), [`package.json`](../../../package.json) | Add repeatable local fixture preparation and generated-signer Chrome rehearsal commands. |
| [`supabase/tests/database/club-wallet.test.sql`](../../../supabase/tests/database/club-wallet.test.sql), [`tests/database/club-wallet.test.ts`](../../../tests/database/club-wallet.test.ts), [`tests/club-wallet.test.ts`](../../../tests/club-wallet.test.ts), [`tests/boundaries.test.ts`](../../../tests/boundaries.test.ts) | Cover schema privileges, exact-session binding, expiry, revocation, role loss, cross-actor denial, concurrent replay, wallet-owner exclusivity, public validators, no-transaction behavior and server-only imports. |

### Decisions and deviations

The 2026-09-22 planning refinement replaced user-facing `company` terminology with `club`, while preserving `organization` as the internal data model. It also rejected a shared or separate club authentication identity: the dedicated club interface is an alternate entrance for individually authenticated administrators.

The implementation reuses DEV0047's shared `auth_challenges` table but adds an organization-only purpose instead of creating a parallel proof store. A club proof is additionally bound to the immutable Supabase `session_id`; signing out or starting another login session cannot reuse an old challenge or authority. The database remains the authority for club/run/membership/wallet selection. The browser sends only the connected address and signed message proof.

The local rehearsal initially used a production build without the local public Auth key because the direct `supabase` binary was not on the shell path. That run exposed the honest “Local authentication is not configured” state and did not reach proof creation. The command was corrected to obtain the public key through `npx --no-install supabase status`; the rebuilt local rehearsal then passed. No application code or environment file was changed for this setup correction.

### Contracts, configuration, and operations

`auth_challenges` gains nullable `auth_session_id`; it must be null for personal purposes and non-null for `authorize-club-wallet`. `organization_wallet_authorities` stores the exact user/session/profile/run/club/binding/challenge context, has a fixed ten-minute lifetime and retains revoked rows for audit. The proof challenge expires after five minutes. The migration must be applied before these endpoints are enabled; it has not been applied to hosted Supabase. Rolling back requires removing the club functions/policies/authority table and restoring the previous personal-only challenge constraints, so rollback should happen only before club-authority rows are relied upon.

The public API adds `GET`/`DELETE /api/wallet/club`, `POST /api/wallet/club/challenge` and `POST /api/wallet/club/proof`. Mutations require the configured exact origin and return only bounded status, club display/wallet context and authority timestamps. `club:prepare-local` accepts `CLUB_ADMIN_EMAIL`, `CLUB_WALLET_ADDRESS` and optional `CLUB_SLUG` (default `northside-combat`); it stores no private key. No new application environment variable or dependency was added. Completed DEV0051 consumes the delivered snapshot after the shared email authentication flow.

## Validation results

Implementation started on 2026-09-22 after the user explicitly chose to defer DEV0047's real-Phantom rehearsal. DEV0039, DEV0040 and DEV0046 are complete, and DEV0047's implementation, clean migration replay, automated proof tests and local generated-signer rehearsal supply the shared contract. Real Phantom evidence remains required before either wallet ticket completes.

Implementation validation on 2026-09-22:

- `npm run typecheck` — passed; Next route types and TypeScript completed without errors.
- `npm run lint` — passed with no ESLint findings.
- `npm run format:check` — passed for configured scripts, source, tests and configuration files.
- `npm test` — passed, 45/45 unit and boundary tests.
- `npm run db:reset` — passed from an empty local database with all migrations and deterministic seed; run once before database validation and again after the rehearsal to remove temporary accounts/authority. `npm run db:runtime` passed after each reset.
- `npm run db:lint` — passed with no schema errors.
- `npm run db:test` — passed, 86/86 pgTAP assertions across four SQL files.
- `npm run test:db` — passed, 13/13 repository integration tests. DEV0041 coverage includes wrong wallet/actor/session, tampered and replayed proof, concurrent completion, exact ten-minute authority, expiry, explicit revocation, role loss and personal/club owner exclusivity.
- `npx --no-install next build --webpack` — passed against the unchanged hosted `.env.local`, passed against the local Auth/database stack for rehearsal, and passed again against hosted configuration after local cleanup.
- `npm run test:e2e -- tests/browser/wallet.spec.ts tests/browser/auth.spec.ts` — passed, 6/6 existing desktop/mobile guest, keyboard and wallet regression scenarios.
- `npm run test:club-wallet-auth` — passed against local Supabase and a production server using Chrome. The generated-signer rehearsal covered email enrollment, server-derived prepared club, exact-origin denial, wrong-wallet denial, message contents, signature/tamper/replay handling, ten-minute authority, explicit revocation, the keyboard-operable club tab and a 393×852 mobile viewport.
- `git diff --check` — passed before the implementation-record update.

| Criterion | Evidence | Result |
| --------- | -------- | ------ |
| AC1 | Clean migration, repository integration and local generated-signer proof establish prepared primary-admin wallet authorization with fixed expiry. | Passed |
| AC2 | API/service derive the existing email subject/profile/session and the rehearsal retains one personal Auth identity. | Passed |
| AC3 | Database joins and exact request shapes deny wrong actor/session/wallet, non-primary role, role loss and browser authority metadata. | Passed |
| AC4 | Existing active-owner uniqueness plus new primary-admin/authority indexes and concurrent proof tests enforce exclusivity. | Passed |
| AC5 | Session-bound database authority, role/binding/expiry checks, explicit exit controls and the globally mounted Phantom mismatch guard clear authority without changing personal identity. | Passed automatically; real Phantom observation pending under AC7 |
| AC6 | Browser copy and source checks distinguish all contexts and confirm only `signMessage`, with no transaction API. | Passed |
| AC7 | All required automated checks and a generated-signer Chrome rehearsal passed. The real prepared Phantom extension proof plus disconnect/account-switch observation was deliberately deferred by the user. | Incomplete |

## Risks, limitations, and follow-ups

The extension supports one active Phantom account at a time, so club context needs explicit UX and strong mismatch handling. A retained personal application session must never be mistaken for proof that the selected wallet belongs to the club. The guard makes a best-effort same-session DELETE when the browser observes disconnect/account change; the exact Auth-session binding, current-context checks and ten-minute expiry remain the server-side fail-closed protections. Later financial tickets must still display and simulate every transaction before requesting explicit user approval.

One prepared primary administrator per club is sufficient for the MVP but is not a production treasury-control model. Self-service club creation, invitations, administrator removal, wallet rotation/recovery, multisignature control and several-admin approval require separate requirements and tickets.

## Completion and review references

- Completed: Not completed.
- Commit: `[DEV0041] Add club wallet authorization` (this commit).
- Review: Requirements refined with the user and implementation self-reviewed against AC1–AC7; no independent review.
- Deployment or release: None. Local disposable Supabase only; the migration has not been applied to hosted Supabase.
