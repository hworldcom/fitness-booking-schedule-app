# Ticket DEV0161: Establish the Expo iOS foundation

- Status: Draft
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Native iOS application foundation
- Coordination: [COR0013 — Native iOS application](../organisatory/COR0013-native-ios-application.md)
- Related records: depends on [DEV0159 — Adopt the native iOS contract](../organisatory/DEV0159-adopt-native-ios-contract.md); integrates with [DEV0160 — Expose the mobile scheduling API](../backend/DEV0160-expose-mobile-scheduling-api.md); supplies DEV0162-DEV0166

## Objective and context

Create a repository-local Expo/React Native application that builds for iOS and provides the stable native shell used by every MovX mobile feature. Establish native navigation, design tokens, safe-area/keyboard/accessibility behavior, environment handling, Supabase email-code authentication and authenticated API-client primitives without copying the Next.js component tree or CSS.

## Scope and non-goals

- In scope: pin current compatible Expo/React Native/Expo Router versions; choose the least-disruptive repository/workspace layout; add iOS bundle/application configuration; add native tabs/stacks and role-aware navigation seams; implement email-code request/verification, session persistence/refresh/sign-out and expired-session recovery; add typed API-client/loading/error primitives; establish test, lint, typecheck, simulator and build commands; document setup.
- Out of scope: public/client feature screens beyond bounded placeholders, booking behavior, coach management, account deletion, production icons/screenshots, TestFlight submission, Android release, a shared web/native component library, or embedding the live website in a WebView.

## Expected behavior and edge cases

- The app starts into a native shell with safe-area-correct navigation and works with larger text, VoiceOver labels, reduced motion and keyboard input.
- Guests can remain signed out. Email-code sign-in uses the same Supabase project and account as the website; a verified session survives an ordinary app restart and refreshes only through supported SDK behavior.
- Invalid/expired codes, offline Auth, revoked sessions, background/foreground transitions and API unavailability produce bounded retryable states without exposing tokens.
- Navigation provides stable top-level Explore, Sessions and Profile destinations. Coach capability can add the contract-defined workspace without granting authority locally.
- Public configuration is separated by local/preview/production profile. Secrets, database URLs and service-role values never enter the app bundle or logs.
- The website continues to run with its existing command paths while mobile commands are explicit and independently testable.

## Assumptions, decisions, and dependencies

- DEV0159 must adopt Expo/React Native and platform support before this ticket becomes Ready.
- Inspect current official Expo, React Native, Expo Router and Supabase React Native guidance before installing packages. Pin exact compatible versions and record the chosen minimum iOS target.
- Prefer a `mobile/` application initially unless workspace/tooling evidence justifies moving the existing Next.js app under `apps/web`; avoid a broad repository move merely for symmetry.
- Reuse brand values and serializable TypeScript contracts, not DOM components, Next.js modules or CSS.
- Use an SDK-supported persistent storage adapter and avoid printing raw access/refresh tokens in development or test evidence.

## Implementation plan

1. Inspect current framework documentation and choose/pin the Expo SDK, React Native, Router, testing and Supabase dependencies.
2. Add the mobile project/configuration with separate public API/Auth values for local, preview and production profiles.
3. Build native tab/stack navigation, theme primitives and standard loading/empty/error surfaces.
4. Implement email-code authentication, session lifecycle and a redacting typed HTTP client for DEV0160.
5. Add unit/component tests and runnable simulator/device development commands without changing existing web commands.
6. Verify iPhone widths, dynamic type, keyboard, dark/light appearance if adopted by DEV0159, background/resume and sign-out/session-expiry behavior.

The proposed scope is one reusable application foundation. Feature screens remain peer tickets.

## Acceptance criteria

- [ ] AC1: The pinned Expo application starts on an iOS simulator/device with native navigation and without rendering the production website in a WebView.
- [ ] AC2: Email-code request, verification, persisted session, refresh, expiry and sign-out work against the configured Supabase environment without exposing credentials.
- [ ] AC3: Mobile public configuration and API-client contracts are documented, environment-specific and reject missing/inconsistent production values.
- [ ] AC4: Native shell tests cover safe areas, keyboard, accessibility labels, larger text and bounded loading/offline/error states at supported iPhone sizes.
- [ ] AC5: Mobile and existing web lint/type/test/build commands coexist and pass for the affected foundation.

## Validation plan

Run the chosen Expo diagnostics, TypeScript, lint and unit/component tests; build and launch on at least one compact and one current iPhone simulator size; exercise VoiceOver labels, dynamic text, keyboard and background/resume. Rehearse real local email-code authentication against Mailpit without recording the code/token. Run the existing web checks affected by workspace/configuration changes.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                    | Change and purpose                                    |
| ------------------------------------ | ----------------------------------------------------- |
| `mobile/` or adopted workspace path  | Planned Expo application and native shell.            |
| Root package/workspace configuration | Planned coexistence commands and pinned dependencies. |
| README/environment examples          | Planned setup and public configuration guidance.      |

### Decisions and deviations

Exact Expo SDK, directory layout, storage adapter and minimum iOS version await current documentation review.

### Contracts, configuration, and operations

Expected public values include the hosted/local API base URL plus the existing Supabase URL and publishable key under Expo-safe names. Final names, build profiles and compatibility implications must be recorded; no secret is permitted in an `EXPO_PUBLIC_*` value.

## Validation results

Pending validation.

| Criterion | Evidence                               | Result  |
| --------- | -------------------------------------- | ------- |
| AC1       | Simulator/device startup               | Not run |
| AC2       | Local Auth lifecycle rehearsal         | Not run |
| AC3       | Configuration checks                   | Not run |
| AC4       | Accessibility/responsive native checks | Not run |
| AC5       | Mobile and web command matrix          | Not run |

## Risks, limitations, and follow-ups

Native framework packages must remain version-compatible; do not independently upgrade React used by Next.js merely to satisfy a mobile template. If a workspace conflict cannot be resolved narrowly, update this ticket before moving the web application.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not built or distributed.
