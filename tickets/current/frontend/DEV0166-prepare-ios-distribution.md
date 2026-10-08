# Ticket DEV0166: Prepare iOS distribution

- Status: Draft
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Native iOS TestFlight and App Store readiness
- Coordination: [COR0013 — Native iOS application](../organisatory/COR0013-native-ios-application.md)
- Related records: depends on [DEV0161 — Establish the Expo iOS foundation](DEV0161-establish-expo-ios-foundation.md) and completion of DEV0160-DEV0165; hosted rehearsal depends on [DEV0055 — Hosted Supabase staging environment](../backend/DEV0055-hosted-supabase-staging-environment.md)

## Objective and context

Turn the completed native application into a signed, reviewable iOS release candidate and prove it through TestFlight on a physical iPhone against the hosted MovX environment. Prepare App Store Connect metadata, privacy declarations and reviewer access/instructions without claiming public release or Apple approval before they occur.

## Scope and non-goals

- In scope: current Expo Application Services or Xcode distribution setup chosen from official documentation; bundle identifier/version/build policy; signing and App Store Connect configuration guidance; production environment validation; app icon, launch assets and required screenshots; permission strings/privacy manifest and App Privacy inventory; accessibility/performance/crash review; TestFlight internal delivery; physical-device hosted scheduling/account-deletion rehearsal; review notes and submission checklist.
- Out of scope: storing Apple credentials in source, purchasing/enrolling an Apple Developer account without the user's action, automatic public release, marketing campaigns, Android/Play Store delivery, adding product features merely for store presentation, or claiming App Store approval from a successful build upload.

## Expected behavior and edge cases

- Production builds fail closed when API/Supabase configuration is missing, loopback, mixed-environment or otherwise unsafe; values are never printed.
- The installed TestFlight build uses the production bundle identifier and hosted services, not local URLs or preview data.
- Icons, launch presentation, screenshots and metadata accurately depict the scheduling-only product and do not claim payment, licensing guarantees, notifications or unavailable coach/admin features.
- Privacy declarations match actual SDK/data/permission behavior. No permission is requested before its related user action or when a fallback avoids it.
- App Review can browse as a guest and follow bounded test-account/review instructions for authenticated flows without receiving secrets in source control.
- A physical-device rehearsal covers session persistence/expiry, poor network, booking race/cancellation, coach availability/completion and account deletion initiation.
- Upload to TestFlight and submission/public release are separately recorded operator actions. Public submission occurs only after explicit user authorization.

## Assumptions, decisions, and dependencies

- An active Apple Developer account, App Store Connect role and any Expo account/organization are external dependencies supplied by the user/operator.
- Use current official Expo/Apple requirements at implementation time; versions, screenshot sizes, privacy questions and review rules in this planning record are not treated as static facts.
- DEV0165 must complete before submission readiness because the app creates accounts.
- DEV0055 must supply a hosted least-privilege environment. A local or configuration-free preview cannot satisfy device/release evidence.
- Use disposable hosted client/coach test accounts and never record one-time codes, access tokens, signing keys or private database values.

## Implementation plan

1. Inspect current Expo/Apple distribution, privacy and review documentation; choose and pin the build/submission path.
2. Add bundle/version/build profiles and production environment validation with documented credential ownership.
3. Create accurate icons, launch assets, screenshots, metadata, privacy inventory, permission strings and reviewer notes.
4. Run automated mobile/backend/web regression checks plus simulator/device accessibility, performance and network-state review.
5. Produce a signed release candidate, upload it to TestFlight and install it on a physical iPhone.
6. Rehearse the complete hosted client/coach/deletion flow and record exact observed outcomes.
7. Prepare the App Store submission checklist; perform submission/public release only with explicit user authorization and record the actual external outcome.

The proposed scope is release preparation and integrated evidence. Product/runtime defects discovered here return to their owning DEV ticket or receive a new focused ticket; they are not silently implemented under distribution work.

## Acceptance criteria

- [ ] AC1: A versioned signed production build uses validated hosted configuration and installs through TestFlight on a physical iPhone.
- [ ] AC2: Store assets, metadata, privacy declarations, permission strings, support/privacy URLs and reviewer instructions are complete and truthful for the implemented app.
- [ ] AC3: Physical-device hosted evidence covers guest discovery, email-code sign-in, booking/retry/conflict/cancellation, client history, coach availability/cancellation/completion, profile authority and account-deletion initiation without manual database repair.
- [ ] AC4: Accessibility, supported-device layouts, background/resume, session expiry, poor/offline network and crash/performance review meet the DEV0159 contract.
- [ ] AC5: TestFlight, App Store submission and public-release states are recorded separately; no credential or unsupported deployment claim enters the repository.

## Validation plan

Run the final mobile lint/type/test/export/build checks and relevant backend/database/web regression suites. Validate the release configuration for production-only URLs and no secrets. Install the TestFlight build on a physical iPhone and execute the DEV0159 acceptance matrix with disposable hosted accounts, including VoiceOver/dynamic text and constrained-network checks. Review App Store metadata/privacy answers against actual dependencies and runtime permissions. Record App Store upload/review/publication status exactly.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                             | Change and purpose                                           |
| --------------------------------------------- | ------------------------------------------------------------ |
| Expo/EAS or adopted Xcode build configuration | Planned signing, profiles, bundle and version setup.         |
| Native/store assets and metadata source       | Planned truthful release presentation.                       |
| Release/rehearsal documentation               | Planned credential ownership, submission steps and evidence. |

### Decisions and deviations

Exact build service, account organization, bundle identifier and release mode await operator account context and current documentation review.

### Contracts, configuration, and operations

This ticket will document public runtime values, server-only values, signing/App Store ownership and rotation without values. Apple and Expo credentials stay in their managed credential stores or approved operator environment, never in tracked files.

## Validation results

Pending validation.

| Criterion | Evidence                               | Result  |
| --------- | -------------------------------------- | ------- |
| AC1       | Signed build/TestFlight installation   | Not run |
| AC2       | Metadata/privacy/reviewer checklist    | Not run |
| AC3       | Hosted physical-device matrix          | Not run |
| AC4       | Accessibility/lifecycle/network review | Not run |
| AC5       | External-state audit                   | Not run |

## Risks, limitations, and follow-ups

Apple enrollment, processing and review are external and may block distribution without indicating a code defect. Store rules and privacy forms can change; re-check them at execution time. Public App Store submission is an external state change and requires explicit user authorization even when the release candidate is ready.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: No build uploaded; no TestFlight or App Store state exists yet.
