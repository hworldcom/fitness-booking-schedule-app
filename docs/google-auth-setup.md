# Google sign-in setup

Implementation and remaining live evidence belong to [DEV0287](https://linear.app/movx/issue/MOV-16/dev0287-integrate-google-authentication). The current product contract is [MVP specification section 4.1](mvp-spec.md#41-register-as-an-athlete-or-apply-to-coach). Apple remains deferred.

## Check existing access first

The owner has not confirmed whether a Google client exists. In the owned Google Cloud account, open **Google Auth Platform → Clients** and look for a **Web application** client for MovX. Check the target Supabase project's **Authentication → Sign In / Providers → Google** for the matching client ID. Client IDs are public identifiers; the client secret must stay in managed Auth settings or an ignored local secret environment file. Do not paste secrets in chat, tickets, screenshots or command output. No Google/Supabase administration has been performed by this implementation.

Use separate non-production and production OAuth clients and managed Auth projects/settings. Do not add local callbacks to a production client. Do not create another project until existing ownership and configuration have been checked.

## Non-production configuration

1. In Google Auth Platform, configure MovX branding/support details, audience and Data Access. Use only `openid`, email and profile scopes. Do not request Drive, Calendar, offline access or provider refresh tokens. If the audience is in Testing, add each controlled Google test account. Record the observed branding/audience/verification status; a public settings response cannot verify these details.
2. Configure a Web application client. Authorized JavaScript origins are the exact application origins being tested: normally `http://localhost:3100` locally and `https://test.movx.club` for UAT, after confirming the target environment. These are origins, without a path.
3. Google's **Authorized redirect URI** points to managed Auth, not the Next.js app: use the callback displayed by that exact Supabase project's Google provider panel, normally `https://<project-ref>.supabase.co/auth/v1/callback`. For this repository's local stack it is `http://127.0.0.1:55321/auth/v1/callback`; verify the actual running stack's API URL. Do not substitute the documentation's default port 54321.
4. Save the client ID and secret in that target's Google provider settings and enable Google. Keep other unapproved social providers disabled. Retain managed same-verified-email linking; do not enable manual linking, write identity rows, or create replacement accounts to simulate the flow.
5. Set Supabase Site URL to the exact target app origin and allow the application's `/auth/callback` path. The application appends a random `flow` query value. Where a separate allow-list entry is required, scope its pattern to that exact origin/path and flow value, e.g. `https://test.movx.club/auth/callback?flow=*`; never use an arbitrary hosted domain/path wildcard. Retain existing email confirmation/recovery callbacks. Verify the actual resulting redirect, since a rejected redirect can silently fall back to Site URL.
6. Set application `NEXT_PUBLIC_SITE_URL` to that same origin, with the matching project's public URL/key. Set server-only `MOVX_GOOGLE_AUTH_ENABLED=true` only in the test deployment under evaluation. The button also checks Supabase's public `/auth/v1/settings` response for `external.google=true`; neither check proves consent/client-secret/redirect correctness. Readiness is intentionally false when the gate is absent/false, Google is disabled, or the settings request fails.
7. Verify hosting, reverse-proxy, analytics and error reporting omit/redact the `/auth/callback` query. The navigation POST requires the canonical Origin, or a null Origin accompanied by browser-controlled `Sec-Fetch-Site: same-origin`; it rejects foreign, same-site or ambiguous null-origin starts. The app does not log codes/provider errors, suppresses Next development incoming logs for this route and immediately redirects with no-store/no-referrer headers and an explicit empty fragment. Infrastructure logging is an external activation prerequisite; the Next development option does not configure hosted access logs.

For local provider activation, add an `[auth.external.google]` block to the private/local configuration using the official Supabase instructions, with the secret referenced through `env(...)`. Never enable it or restart the shared local stack during concurrent work without coordinating the operation. The checked-in local stack remains unchanged and Google remains disabled. This implementation does not provision, seed, delete or modify retained users/coaches.

## Rehearse before sign-off

Use controlled accounts and record exact subjects/profile IDs and private-data checks, without storing proof values or personal credentials:

- New Google user → confirmed managed session → required unique username/private full name/display name → optional private picture or Do this later → Home or sanitized return. No redundant confirmation email, automatic coach approval, invitation acceptance or provider-photo import.
- Returning Google user and repeated callback → original identity/profile/data. Start another flow after expiry or browser mismatch; only the newest pending flow in a browser is supported. PKCE codes are short-lived, single-use and require the starting browser's verifier; the application continuation expires after ten minutes.
- Password-first verified email → same-email Google → original subject/profile/private names/settings/media/roles/bookings/messages. Distinct Google email → independent registration. Unconfirmed/conflicting identities never acquire the other account's data.
- Google-first → verified Set a password/recovery → original identity; old sessions are revoked and the existing recovery restrictions remain effective. Starting or returning to Google during recovery cannot upgrade that session.
- Cancel/deny, missing/expired proof, bad callback, unavailable provider, changed browser session, safe/hostile returns and explicit coach intent. Supabase may return denial details in a browser fragment that the server cannot read; this receives the bounded retry message rather than displaying provider text.
- Mobile/desktop, keyboard, errors and provider-branded control, then the combined [DEV0289](https://linear.app/movx/issue/MOV-17/dev0289-rehearse-multi-method-authentication-for-uat) rehearsal. Deterministic SDK/callback fixtures are supplementary evidence, not real Google sign-in proof.

## Disable or rotate

Set `MOVX_GOOGLE_AUTH_ENABLED=false` (or remove it) and apply the target application configuration. New starts and pending callbacks fail closed; email/password and existing authorized sessions retain their normal behavior. Disable Google in that Supabase project's provider settings if a provider rollback is required. Do not delete Auth identities, profiles or history as a rollback. Rotate the client secret through Google and the matching managed Auth setting, then repeat the live tests before enabling the app gate. Record environment and timing in DEV0287; production rollout is separate.

Official references: [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google), [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls), [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).
