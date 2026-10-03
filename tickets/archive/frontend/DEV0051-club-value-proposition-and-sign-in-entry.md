# Ticket DEV0051: Club value proposition and sign-in entry

- Status: Completed
- Created: 2026-09-22
- Last updated: 2026-09-23
- Milestone: M0 club onboarding and public guidance
- Coordination: None — independent development ticket
- Related records: follows the public guide delivered by [DEV0020 — Discovery and How it works](DEV0020-discovery-and-how-it-works.md) and the account-backed shell/profile delivered by [DEV0052 — Account-backed personal profile](DEV0052-account-backed-personal-profile.md); reuses the email account flow from [DEV0046 — Email OTP registration and application profiles](../backend/DEV0046-email-otp-registration-and-application-profiles.md); consumes the functionally implemented singular club eligibility/authority contract from [DEV0041 — Club wallet authorization](../backend/DEV0041-club-wallet-authorization.md), whose separate real-Phantom completion rehearsal remains pending; persistent public organization data is coordinated by [COR0006 — Persistent access catalogue](../organisatory/COR0006-persistent-access-catalogue.md), converted from retired DEV0017

## Objective and context

Explain why fitness and sports clubs should use MovX Club and give their administrators a clear, dedicated sign-in entrance without creating a second authentication system or shared club credentials. This delivers the club-facing part of the MVP specification's [Discovery and How it works](../../../docs/mvp-spec.md#discovery-and-how-it-works) and [club sign-in screen](../../../docs/mvp-spec.md#2-screens-and-actions) contracts within [M0 — Foundation and frozen product contracts](../../../docs/mvp-spec.md#m0--foundation-and-frozen-product-contracts).

The current `/how-it-works` guide explains the participant experience but does not present a club value proposition. The general `/sign-in` route also does not make it clear how an administrator reaches a club workspace. This ticket adds the public explanation and a club-oriented entrance that reuses the administrator's existing personal email identity and DEV0041's server-derived club authority.

## Scope and non-goals

- In scope: add a **For fitness and sports clubs** section to `/how-it-works`; explain club discovery, classes/events, sponsored challenges, participation/retention and separated club-wallet authority; distinguish currently available previews from planned persistent/payment behavior; add a visible **Manage a club** call to action; add `/clubs/sign-in` as the dedicated club explanation and bounded access-status page; send signed-out visitors to the existing canonical `/sign-in?returnTo=%2Fclubs%2Fsign-in` flow; after authentication, consume DEV0041's server-derived club state and show only the eligible prepared club, authorized club-wallet state or an honest no-access/error state; verify responsive and keyboard behavior.
- Out of scope: rendering or forking a second email one-time-passcode form on `/clubs/sign-in`; a second Supabase tenant/user for the same person; shared club email/password credentials; self-service club creation, applications or invitations; administrator management; multi-club selection; public profile persistence owned by DEV0017; organization-role or wallet proof owned by DEV0041; a separate club dashboard or other workspace features; balances, payments or transactions; claiming that preview/planned capabilities are already live.

## Expected behavior and edge cases

Visitors can understand that MovX Club is intended to help clubs reach participants, publish activities, strengthen community participation and later operate transparent test-fund flows through a distinct club wallet. Copy must identify preview or planned capabilities honestly until their owning tickets complete.

`Manage a club` opens `/clubs/sign-in`, which explains that an administrator signs in as an individual and then acts in a club context. The route does not host another email form. When signed out, its **Sign in with email** action opens the existing canonical `/sign-in` route with the fixed safe return `/clubs/sign-in`. The existing email field, one-time code, Supabase session and application profile remain the only authentication path; no separate club login identity is created.

After successful authentication, `/clubs/sign-in` becomes the bounded club access page. The server determines whether the person is the active primary administrator of one prepared club. An eligible administrator sees only that server-returned club and can use DEV0041's existing club-wallet authority controls. An administrator with active authority remains on the same page and sees the club identity, authority expiry and explicit leave/disconnect controls. This ticket does not redirect to or imply a separate dashboard.

A person with no eligible club remains normally signed in but sees a clear no-access explanation rather than club data, organization existence details or an automatic club-creation claim. If inconsistent prepared data would yield several club contexts, the current singular DEV0041 contract fails closed and the page shows an unavailable/conflict state without listing clubs. Multi-club selection requires a later contract and ticket.

The page maps DEV0041's snapshot states explicitly:

- `preview`: explain that authenticated club management is not configured; do not invent club access;
- `signed-out`: explain the personal-account boundary and link to `/sign-in?returnTo=%2Fclubs%2Fsign-in`;
- `forbidden`: explain that the application profile could not be authorized without disclosing club data;
- `unavailable`: show a retryable failure without assuming or exposing club access;
- `no-club-access`: retain the personal session and explain that the account has no prepared club access;
- `eligible`: show only the server-returned prepared club and explain that a separate readable wallet proof is still required;
- `authorized`: show the server-returned club, bounded authority expiry and exit controls without implying payment authority or available funds.

Invalid, expired or replayed codes retain DEV0046's existing bounded authentication behavior on `/sign-in`; DEV0051 does not reimplement it. Refresh, sign-out and direct navigation cannot convert ordinary personal access into club access. `/clubs/sign-in` does not accept a browser-supplied club, organization, role or arbitrary post-authentication destination. Mobile and keyboard users can reach and recover from every state.

## Assumptions, decisions, and dependencies

Confirmed with the user on 2026-09-22:

- fitness and sports clubs need their own public value proposition;
- club administrators should have a distinct club-oriented sign-in interface;
- the interface must use the same personal email identity and authentication system rather than shared club credentials;
- the signed-in person remains accountable while acting through a separate club workspace;
- prepared clubs are sufficient for the MVP; self-service club creation and invitations come later.

The public term is `club`; the backend may retain `organization` for the broader internal entity. DEV0041 has delivered the authoritative singular club eligibility/authority contract and remains in progress only for its separately owned real-Phantom rehearsal. That deferred rehearsal does not block DEV0051 from consuming the implemented snapshot contract or validating its presentation. DEV0051 does not own or duplicate DEV0041's proof validation.

DEV0052 is completed and committed, so DEV0051 starts from the account-backed shell/profile rather than overlapping that work. The club route delegates authentication to DEV0046's existing canonical `/sign-in` screen and uses its safe-return utility with the fixed `/clubs/sign-in` destination. It must not broaden the set of canonical authentication paths.

The club value proposition should cover:

- reach new participants through public class, event and challenge discovery;
- publish club activities and community experiences;
- sponsor challenges that support participation and retention;
- connect confirmed attendance with visible community progress;
- later sell class passes/event tickets and operate sponsorships/refunds with a distinct club wallet;
- keep club authority and funds separate from each administrator's personal account and wallet.

## Implementation plan

1. Review the account-backed `/how-it-works`, shared navigation/footer and account presentation; place `Manage a club` visibly in the new club section without restoring header clutter removed by DEV0045.
2. Add the club value-proposition section with direct links to relevant public discovery views and honest current-versus-planned labels.
3. Add `/clubs/sign-in` as the club explanation and access-status page. For signed-out visitors, link to the canonical `/sign-in` flow with the fixed `/clubs/sign-in` return; do not embed or fork the OTP form and do not create a club Auth subject.
4. Consume DEV0041's exact `preview`, `signed-out`, `forbidden`, `unavailable`, `no-club-access`, `eligible` and `authorized` states. Reuse the existing club-wallet authority controls for eligible/authorized administrators and fail closed for inconsistent singular-club data.
5. Add focused component/contract checks and desktop/mobile Playwright coverage for public copy, the canonical sign-in handoff/return, keyboard navigation, responsive layout, state presentation and unauthorized access. Run the existing Auth and club-wallet suites as regression evidence rather than duplicating their internal OTP/proof cases.

## Acceptance criteria

- [x] AC1: `/how-it-works` includes a clear **For fitness and sports clubs** section with concrete reasons to join and honest preview/planned labels.
- [x] AC2: A visible **Manage a club** action opens a dedicated `/clubs/sign-in` interface on desktop and mobile.
- [x] AC3: `/clubs/sign-in` delegates authentication to the canonical `/sign-in?returnTo=%2Fclubs%2Fsign-in` flow and reuses the person's existing email OTP identity, Supabase session and application profile; it embeds no second OTP form and creates no shared club credentials, second authentication system or duplicate person.
- [x] AC4: Only a server-authorized active primary administrator receives the singular prepared-club context. Preview, signed-out, forbidden, unavailable, no-access and inconsistent/multiple-context cases fail closed without exposing club data or removing ordinary personal access; the browser cannot submit club, organization, role or destination authority metadata.
- [x] AC5: Eligible and authorized states explain the personal-versus-club context, wallet-proof requirement, bounded authority and exit controls. The interface never implies that email sign-in proves wallet authority, grants funds/payment capability or opens a completed dashboard/product feature.
- [x] AC6: Focused tests, lint, typecheck, formatting, production build and desktop/mobile keyboard/browser checks pass with exact evidence recorded.

## Validation plan

Test the public guide and club sign-in route as a guest, ordinary enrolled person, prepared primary administrator and stale/unavailable session. Verify the guest action opens the canonical sign-in URL with exactly `/clubs/sign-in` as its safe return, successful enrollment returns to the club page and the same personal identity remains active when entering or leaving club context. Exercise direct route access, refresh, sign-out, no-access and every DEV0041 snapshot state; confirm the route sends no organization, club, role or arbitrary return destination to the server. Reuse DEV0046's existing invalid/replayed OTP tests and DEV0041's proof/authority suites as regression evidence rather than recreating those implementations here. Check the guide, access page and all notices at desktop and 393-pixel mobile width with keyboard-only navigation. Run focused unit/boundary tests, lint, typecheck, formatting, webpack build and affected Playwright scenarios.

## Implementation record

Implemented on 2026-09-23 after the readiness review confirmed that DEV0041's snapshot and wallet-authority panel were functionally available. DEV0041's separate real-Phantom completion rehearsal remains pending and was neither required nor claimed as DEV0051 evidence.

### Changes and rationale

`/how-it-works` now includes a **For fitness and sports clubs** section covering public discovery, browser-only planning previews, planned participation data and prepared club authority. Each capability is labelled as preview, prepared or planned, and the section explicitly states that passes, tickets, funding, refunds, balances and transactions are not live. Its keyboard-accessible **Manage a club** action opens the new public `/clubs/sign-in` route.

The club entry page explains that an administrator signs in as an individual, receives only server-derived singular club eligibility and proves the distinct club wallet separately. It delegates signed-out visitors to the canonical `/sign-in?returnTo=%2Fclubs%2Fsign-in` flow and embeds no email form. Preview, signed-out, forbidden, unavailable and no-access states disclose no club data. Eligible and authorized states reuse DEV0041's existing wallet-authority panel, including the prepared club, readable message proof, authority expiry and explicit leave/disconnect controls.

Client state is keyed to the current authenticated session. A previous eligible or authorized club snapshot is hidden as soon as the personal actor changes or signs out, and a fresh server snapshot is required for the next account. The page sends only the existing club-wallet requests; it accepts no browser-selected club, organization, role or return destination.

### Affected files

| File or component                                                                                                                                                                                                                                                         | Change and purpose                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/discovery/how-it-works.tsx` (historical path `src/features/discovery/how-it-works.tsx`), [`src/app/globals.css`](../../../src/app/globals.css)                                                                                                              | Add the responsive club value proposition, honest delivery labels and visible club-management action.                                                    |
| `src/app/clubs/sign-in/page.tsx` (historical path `src/app/clubs/sign-in/page.tsx`), `src/features/clubs/club-sign-in.tsx` (historical path `src/features/clubs/club-sign-in.tsx`)                                                                                        | Add the public club entry and render every bounded access state over the shared personal-account and club-wallet contracts.                              |
| `src/features/clubs/club-entry-state.ts` (historical path `src/features/clubs/club-entry-state.ts`), `tests/club-entry-state.test.ts` (historical path `tests/club-entry-state.test.ts`), [`tests/authorization.test.ts`](../../../tests/authorization.test.ts)           | Fix the canonical return path and prevent stale club context from surviving a personal actor transition.                                                 |
| `tests/browser/clubs.spec.ts` (historical path `tests/browser/clubs.spec.ts`), `tests/browser/discovery.spec.ts` (historical path `tests/browser/discovery.spec.ts`), `scripts/rehearse-local-club-wallet.mjs` (historical path `scripts/rehearse-local-club-wallet.mjs`) | Verify public copy, keyboard/responsive entry, signed-out/preview handoff, ordinary no-access and prepared eligible states while retaining proof checks. |

### Decisions and deviations

The original wording could be read as embedding the OTP form directly on `/clubs/sign-in` and redirecting to an unspecified workspace. The reviewed plan instead keeps `/sign-in` as the only canonical authentication route and returns to `/clubs/sign-in`, which owns the club explanation, eligibility and bounded authority presentation. This avoids duplicating Auth logic and avoids implying that a club dashboard exists.

The original future multi-club selection wording was removed from this implementation. DEV0041 currently exposes one singular prepared-club context and fails closed when prepared state is inconsistent; multi-club selection needs a later server contract and development ticket. The visible entry was placed in the new guide section instead of the compact global header, preserving DEV0045's simplified navigation.

### Contracts, configuration, and operations

No authentication provider, credential type, dependency, secret, environment variable, database object or API shape changed. `/clubs/sign-in` links to `/sign-in?returnTo=%2Fclubs%2Fsign-in`; the existing `/sign-in` route remains the only place that requests and verifies an email OTP. The club page consumes `GET /api/wallet/club` through DEV0041's existing bounded `ClubWalletSnapshot` and delegates eligible/authorized actions to its existing panel. No organization, club, role or arbitrary destination is submitted by the entry page.

## Validation results

All acceptance criteria passed locally. The default Turbopack `npm run build` could not create its helper process because the execution environment denied its internal port bind, including on an escalated retry. The established `npx --no-install next build --webpack` production path compiled successfully in normal configured, local Auth/database and configuration-free modes; this was an environment limitation rather than an application compile failure.

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                           | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1–AC2   | Desktop and 393-pixel Playwright checks found the club section, four concrete benefits, delivery labels, no-live-payment notice and keyboard-accessible **Manage a club** action. Full-page guide and entry screenshots were visually reviewed with no horizontal overflow.                                                                                                                                                        | Passed |
| AC3       | The signed-out browser followed the exact `/sign-in?returnTo=%2Fclubs%2Fsign-in` link and rendered the existing email form only on `/sign-in`. Source review and browser assertions found no email input or duplicate authentication implementation on the club route. `npm run test:auth` passed two new accounts, returning sign-in, invalid/replayed-code recovery, isolation and sign-out cleanup.                             | Passed |
| AC4       | Focused unit checks proved stale eligible/authorized snapshots are hidden unless the personal actor is authorized and covered every bounded snapshot status. Configuration-free preview passed 4/4 browser checks. The local club rehearsal proved an ordinary signed-in no-access state followed by the prepared singular Kru Tiger context, while retaining server-derived eligibility, origin protection and conflict handling. | Passed |
| AC5       | The club entry labels personal identity, server-derived access and the separate club wallet. Eligible presentation reuses DEV0041's exact wallet address/proof controls; its existing rehearsal passed proof/replay rejection, ten-minute authority and explicit revocation. Copy and visual review confirmed no dashboard, payment, balance or funds claim.                                                                       | Passed |
| AC6       | `npm test` passed 49/49; `npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check` and the webpack production build passed. The affected configured browser set passed 22/22 and the configuration-free club set passed 4/4 across desktop/mobile.                                                                                                                                                           | Passed |

The repository Markdown validator passed after archival across 71 Markdown files, 812 local links and 49 unique indexed work records.

## Risks, limitations, and follow-ups

Persistent activity publishing, public organization data, passes, tickets, funds and transactions remain unavailable and visibly labelled as planned. The page is an access-status surface rather than a club dashboard. DEV0041 still owns its pending real-Phantom rehearsal; DEV0051 does not convert that missing external evidence into a frontend blocker or completion claim.

Self-service creation, invitations, multiple eligible clubs, several administrators, role transfer and club-wallet recovery remain future work. Those capabilities need separate security and lifecycle requirements before implementation.

## Completion and review references

- Completed: 2026-09-23.
- Commits: planning commit `[DEV0051] Clarify club sign-in entry`; implementation commit `[DEV0051] Add club entry and value proposition` (this change).
- Review: Implementation self-reviewed against AC1–AC6 and the DEV0046/DEV0041/DEV0052 boundaries; no independent review.
- Deployment or release: None.
