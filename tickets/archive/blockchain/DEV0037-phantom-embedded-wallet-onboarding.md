# Ticket DEV0037: Phantom embedded-wallet onboarding

- Status: Cancelled
- Created: 2026-09-20
- Last updated: 2026-09-25
- Milestone: Deferred post-MVP wallet onboarding history
- Coordination: None — independent development ticket
- Related records: follows completed [DEV0027 — Phantom wallet connection foundation](DEV0027-phantom-wallet-connection-foundation.md); may have refined [COR0002 — Phantom authentication and demo access](../organisatory/COR0002-phantom-auth-and-demo-access.md), especially completed [DEV0038 — Phantom Supabase Web3 authentication](../backend/DEV0038-phantom-supabase-web3-authentication.md), after the extension-first authentication slice existed; cancelled by [DEV0071](../organisatory/DEV0071-audit-active-work-after-multigym-pivot.md)

## Objective and context

Add low-friction embedded Solana wallet onboarding through Phantom Connect when Phantom Developer Portal access becomes available. Ordinary participants should be able to create or restore a Phantom-managed wallet through supported social onboarding without first installing the browser extension, while the existing external Phantom path and separate club-wallet authority remain available.

This behavior was originally planned inside DEV0027 after the user preferred Polymarket-style account onboarding. On 2026-09-20, Phantom Portal displayed `New sign ups are paused` for new developer accounts. The user chose not to block the MVP: DEV0027 continues with the prepared extension, and this record preserves the embedded-wallet outcome for later.

On 25 September 2026, the active-work audit cancelled this optional post-MVP ticket. The focused multi-gym membership demo already has email accounts plus optional external Phantom linking, and embedded onboarding is neither required nor currently implementable. A future decision to add it must use a new ticket and revalidate the provider rather than reopening this stale plan.

## Scope and non-goals

- In scope: reassess current Phantom Connect availability, SDK and pricing/terms; create a Portal application; configure public App ID, allowed origins and callback URLs; add Google/Apple or the then-supported embedded onboarding methods; normalize embedded/external session provenance; connect embedded signing to the existing application-auth boundary; accessible recovery/cancellation/expiry states; real desktop/mobile provider rehearsals; migration and account-linking guidance.
- Out of scope: blocking DEV0027 or the hackathon MVP; implementing against an unavailable/unregistered Portal application; email/SMS login unless separately approved; automatic embedded/external account merging; custody of keys or OAuth tokens; auto-confirm, delegated/server signing, fee sponsorship, payments or transaction behavior unrelated to onboarding.

## Expected behavior and edge cases

When available, a participant can choose the supported embedded path and create or restore the same Phantom-managed Solana wallet for the same provider identity. The UI identifies `Embedded` versus `External`, keeps provider connection distinct from MovX Club authentication and never merges addresses automatically. Existing extension users retain the external path, and companies continue using distinct external wallets.

Cancelled provider login, popup/callback failure, repeated or invalid callback, expired session, browser privacy restrictions, account change and provider outage preserve public browsing and recover without false connection/authentication. Migration must not silently replace an extension-authenticated MovX Club identity with an embedded address.

## Assumptions, decisions, and dependencies

Implementation is blocked until a Phantom Developer Portal developer account and public App ID can be created. The SDK, supported identity methods, session lifetime, pricing, domain verification and Supabase Sign-In With Solana compatibility must be revalidated at start because provider contracts may change while sign-ups are paused.

DEV0027 remains the external Wallet Standard foundation. This ticket must update the product specification before changing the MVP's onboarding behavior and must preserve C14's separate club-wallet authority. No Portal credential, OAuth token, private key or recovery phrase may enter source control.

## Implementation plan

1. Recheck official Phantom Connect/Portal availability, current SDK compatibility and terms. Record the evidence that unblocks implementation.
2. Create the Portal application and document public/local configuration without recording secrets.
3. Update the product specification and authentication plan with the supported embedded methods, migration/linking rules and explicit provider/application-session boundary.
4. Add the embedded provider adapter and callback/session UI alongside the external Phantom path without creating competing connection authorities.
5. Add deterministic adapter/browser tests and complete real create-or-restore, reload, expiry/recovery, disconnect and external-wallet interoperability rehearsals.

## Acceptance criteria

- [ ] AC1: Phantom Portal access and a valid development App ID are available, with current SDK/terms and supported onboarding methods recorded before implementation.
- [ ] AC2: A real supported embedded-wallet flow creates or restores the expected Solana account on the selected non-production cluster without requiring the desktop extension.
- [ ] AC3: Embedded and external sessions remain visibly distinct, recover from cancellation/expiry/account changes and never merge application identities automatically.
- [ ] AC4: Existing external Phantom, public browsing, separate club authority and application-authentication boundaries continue to pass their regressions.
- [ ] AC5: Responsive/keyboard checks, focused tests, lint, typecheck, build and real desktop/mobile provider rehearsals pass with no private key, OAuth token or provider secret in the app.

## Validation plan

Use provider doubles for initialization, callback, cancellation, expiry, reconnect, account change and outage states. Run existing external-wallet and public-route regressions. Rehearse the real provider on supported desktop and mobile browsers, then prove the embedded signer through the application-auth contract without treating provider social data as authorization. Inspect source, build output, logs and storage for provider secrets or signing material.

## Implementation record

No source implementation exists. The embedded-first planning text was moved out of DEV0027 on 2026-09-20 after Phantom Portal paused new developer sign-ups. This ticket preserves the desired user experience without making unavailable provider access an MVP dependency.

## Validation results

- **Start condition — blocked:** Phantom Portal displayed `New sign ups are paused`; the user has no existing developer account/App ID for this project.
- **Implementation checks — not run:** no SDK, Portal configuration, callback route, embedded wallet or provider test was added.

| Criterion | Evidence                                              | Result  |
| --------- | ----------------------------------------------------- | ------- |
| AC1       | New Portal developer sign-up unavailable              | Blocked |
| AC2–AC5   | Depend on Portal access and subsequent implementation | Not run |

## Risks, limitations, and follow-ups

Provider availability, identity methods and SDK contracts may differ when sign-ups reopen. Revalidate rather than assuming the 20 September 2026 documentation still applies. The same person may receive a different embedded address from their prepared extension account, so any later link/migration flow needs explicit proof from both accounts and its own security review.

There is no active next action. If embedded onboarding becomes a priority after the MVP, create a new development ticket only after Phantom Portal access, the current SDK contract and account-migration behavior have been revalidated.

## Completion and review references

- Completed: Cancelled and archived on 2026-09-25 — optional embedded onboarding is outside the focused MVP and had no implementation.
- Commit: Not created.
- Review: Cancellation reviewed under DEV0071; no independent implementation review.
- Deployment or release: None.
