# Google Calendar connection (MOV-225)

This stage connects one Google account per verified MovX profile/dataset and creates a secondary **MovX** Google calendar. It preserves ordinary Google/password sign-in. Booking export (MOV-226) and Google busy-time access (MOV-227–229) remain separate, disabled capabilities. See [MVP contract](mvp-spec.md#23-optional-google-calendar-connection) and [MOV-225](https://linear.app/movx/issue/MOV-225).

## Configure a local or controlled UAT target

1. Install `20261111000100_google_calendar_connections.sql` through the target's reviewed migration process **before** enabling the feature. Follow the [database isolation/runtime/recovery rules](../supabase/README.md#runtime-authority). It adds no account provisioning/backfill or scheduling changes. Ordinary runtime inherits `app_runtime`; it has bounded function access, never direct table access or an owner credential.
2. In a Google Cloud project you control, enable **Google Calendar API** and create a separate OAuth **Web application** client for Calendar. Keep the existing Supabase sign-in client/callback unchanged. Prefer separate dev/UAT and production projects/clients; never point a test client at production. Reusing a Cloud project can couple grants/revocation across clients: local disconnect deliberately does not revoke the project's entire grant.
3. Add exact redirect URIs for the intended target:
   - Local: `http://localhost:3100/auth/google-calendar/callback`
   - UAT: `https://uat.movx.club/auth/google-calendar/callback`
   - A later separately reviewed production release: `https://movx.club/auth/google-calendar/callback`

   These are application callbacks, **not** Supabase's `/auth/v1/callback`. The flow runs on the server; it does not need a Google browser SDK or additional authorized JavaScript origins. Configure only callbacks actually used by that client's environment.
4. Configure the consent audience/test users, branding/domain/homepage/privacy and actual requested scopes: `openid`, `email`, and `https://www.googleapis.com/auth/calendar.app.created`. Record the scope's actual classification and verification requirements in MOV-225. Do not infer Calendar approval from Google sign-in branding. External/Testing Calendar authorization and refresh tokens expire after seven days; identity-only sign-in's exception does not apply. See [Google audience rules](https://support.google.com/cloud/answer/15549945?hl=en) and [scope documentation](https://developers.google.com/workspace/calendar/api/auth).
5. Set server-only variables in the local ignored configuration or target's secret store. Never send populated values in chat, commit them, expose them with `NEXT_PUBLIC_`, or include them in evidence:

   ```dotenv
   MOVX_GOOGLE_CALENDAR_ENABLED=true
   MOVX_GOOGLE_CALENDAR_CLIENT_ID=<calendar-client>.apps.googleusercontent.com
   MOVX_GOOGLE_CALENDAR_CLIENT_SECRET=<calendar-client-secret>
   MOVX_GOOGLE_CALENDAR_TOKEN_KEY=<base64-encoded-32-random-bytes>
   ```

   Generate the encryption key once using `openssl rand -base64 32`, placing it directly in the secret store. Preserve it across deployments: replacing it without a rotation window makes existing encrypted credentials unreadable. `NEXT_PUBLIC_SITE_URL` must be the exact canonical application origin (HTTPS, or literal `http://localhost:3100` locally). Missing/invalid Calendar configuration keeps connection actions unavailable; it never enables sign-in or sync implicitly. Restart the local app after changing its environment; this does not authorize resetting retained data.
6. Publish the updated privacy disclosure before inviting real users to grant Calendar access. Source changes alone do not prove the live policy is updated. Configure application/infrastructure request logging to redact OAuth callback query values; application errors never include provider response bodies, codes, tokens, verifiers or secrets. Store only sanitized status/action evidence.

## Connection and recovery behavior

Account → Connected calendars supports Connect/Reconnect, Check connection, read-only Reload status, recovery and explicit Disconnect. OAuth uses PKCE, a ten-minute single-use database continuation, a separate HttpOnly browser-binding cookie and the initiating verified ordinary Auth session/profile/dataset. The callback redirects to the fixed Account section with an enumerated notice, no proof values and no referrer. Provider hosts are fixed in the server adapter; there is no configurable provider URL or browser token storage.

Refresh credentials use AES-256-GCM with a random nonce, key identifier and profile/dataset/purpose additional authenticated data. Private tables are app_owner-owned with forced row-level security and owner-only policies; runtime gets only actor-checked functions. A normal Google token exchange without a new refresh token preserves a valid stored same-account/same-client token. The first connection proves server refresh before Connected. Later Check connection refreshes and verifies the saved calendar; it does not create events or read personal appointments.

The server commits an uncertain bootstrap marker **before** creating the calendar. It never treats a timeout as a failed creation. A known late response may record its ID after disconnect without reactivating the connection. Reconnect reuses the same-account/client mapping. Missing calendars or uncertain creation require the user to inspect Google Calendar, then either enter the existing app-created calendar ID (Google calendar Settings → Integrate calendar) or explicitly confirm a replacement. Replacement commands retain a retry identifier; replay cannot create another calendar. Neither recovery nor disconnect deletes a Google calendar.

Disconnect fences new operations and deletes locally usable credentials/pending proofs; an already-issued Google request may finish. Minimal Google subject/email/calendar/bootstrap references remain for safe reconnection until account deletion or a verified privacy-removal request. The short-lived cookie expires after ten minutes; expired encrypted pending proofs cannot be claimed and are replaced/cleared by the next connection action or account deletion. Google-account revocation is separate and can affect other permissions granted to the Cloud project, so tell users that sign-in may require consent again after revoking there.

## Key rotation and rollback

Set a new `MOVX_GOOGLE_CALENDAR_TOKEN_KEY` and temporarily include previous keys in `MOVX_GOOGLE_CALENDAR_PREVIOUS_TOKEN_KEYS` (comma-separated base64 keys, at most three). A successful Check connection/reconnect decrypts with the appropriate old key and reseals credentials using the current key. Verify all retained connected rows have been re-encrypted before removing an old key; dormant accounts otherwise require reconnect. Keep previous keys through any pending ten-minute authorization window. Do not print keys or ciphertext in evidence.

Disable `MOVX_GOOGLE_CALENDAR_ENABLED` to stop new connect/check/recovery operations. Authenticated status and local Disconnect remain available when the schema exists, even without an encryption key. An in-flight request may finish, so account for its generation/bootstrap outcome. Keep additive SQL and mappings during source rollback; do not restore over later user activity, revoke unrelated sign-in grants or erase user Google calendars. Remove stored credentials only through the actor-bound Disconnect or the verified account-deletion/privacy process. A database rollback requires its own target-specific recovery plan; the migration's scratch transaction rollback is not authorization to drop populated hosted tables.

## Verification and evidence boundary

- `npm run test:google-calendar-db`: Docker-backed isolated fresh/upgrade/atomic rollback and real restricted-role SQL. Uses only uniquely named `mov225_*` scratch databases on local55322, removes those exact targets and verifies retained app/Auth/Storage rows and role fingerprints. No retained migrations/provisioning or Google calls.
- `node --import tsx --conditions=react-server --test tests/server/google-calendar.test.ts tests/server/google-calendar-routes.test.ts`: provider protocol, encryption, lifecycle/error orchestration and route-rejection fixtures; no actual consent or Google data.
- `npm run test:google-calendar-ui`: actual mounted Account/connection UI with explicit Auth/API fixtures at desktop/375/320, keyboard, denial, disabled/error/recovery, disconnect and late actor-data removal. Requires Node24, locked dependencies, Chrome and free localhost3206. Owns a unique temporary app and removes it; writes safe screenshots/checks under ignored `test-results/google-calendar-ui/`.
- Run normal `npm test`, lint, typecheck, format and build from [README](../README.md#checks). An isolated tracked-source copy avoids unrelated ignored `work/` snapshots included by this checkout's broad TypeScript pattern. Do not modify/delete another task's scratch data to make checks pass.
- Real-provider acceptance still requires a consenting controlled Google account: connect/deny, create/reuse, refresh, revoke/reconnect, disconnect, interrupted creation and actual account preservation. The user handles account selection/password/two-factor/consent. Record actual client/audience/scope classification, target, observed outcomes and redacted evidence in MOV-225. Unit/UI/SQL fixtures do not establish Google UAT readiness. Production activation is a separate release.
