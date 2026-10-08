# Coordination COR0013: Native iOS application

- Status: Ready
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Native iOS application
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: [DEV0159 — Adopt the native iOS contract](DEV0159-adopt-native-ios-contract.md), [DEV0160 — Expose the mobile scheduling API](../backend/DEV0160-expose-mobile-scheduling-api.md), [DEV0161 — Establish the Expo iOS foundation](../frontend/DEV0161-establish-expo-ios-foundation.md), [DEV0162 — Deliver native client scheduling](../frontend/DEV0162-deliver-native-client-scheduling.md), [DEV0163 — Deliver the native coach schedule](../frontend/DEV0163-deliver-native-coach-schedule.md), [DEV0164 — Deliver the native coach profile](../frontend/DEV0164-deliver-native-coach-profile.md), [DEV0165 — Implement the account-deletion lifecycle](../backend/DEV0165-implement-account-deletion-lifecycle.md), [DEV0166 — Prepare iOS distribution](../frontend/DEV0166-prepare-ios-distribution.md)
- Related records: hosted runtime dependency [DEV0055 — Hosted Supabase staging environment](../backend/DEV0055-hosted-supabase-staging-environment.md); web discovery dependency [DEV0108 — Add the Mapbox coach Explore map](../frontend/DEV0108-add-mapbox-coach-explore-map.md); identity baseline [DEV0147 — Separate client onboarding and verified coach access](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md); client/coach navigation baselines [DEV0149 — Replace the user Coach tab with My sessions](../../archive/frontend/DEV0149-replace-user-coach-tab-with-my-sessions.md) and [DEV0150 — Hide My sessions from signed-out navigation](../../archive/frontend/DEV0150-hide-my-sessions-from-signed-out-navigation.md)

## Objective and boundaries

Coordinate one native iOS application for MovX that uses a deliberately app-specific interface rather than reproducing or embedding the website. The iOS application shares the existing email-backed accounts, scheduling authority, PostgreSQL data and Vercel/Supabase backend with the Next.js website. It is a second frontend for the same product, not a separate product, Supabase project, database or pair of client/coach binaries.

The working delivery model is an Expo/React Native application inside this repository, an authenticated JSON mobile boundary over the existing server services, a client-first scheduling release and a later coach-capability phase in the same binary. Staff coach review remains web/operator-only. Existing exclusions for payments, wallets, messaging, social features, group events, external calendars and notification delivery remain in force unless a later product-contract ticket changes them.

This coordination record owns sequencing, cross-ticket boundaries and integration evidence only. It does not authorize implementation or duplicate the evidence maintained by its direct development tickets.

## Direct development work

| Implementation part                  | Development ticket                                                                                               | Owned deliverable                                                                                                                          | Start condition or dependency                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Product and architecture contract    | [DEV0159 — Adopt the native iOS contract](DEV0159-adopt-native-ios-contract.md)                                  | Add the supported-platform, shared-backend, first-release, account-lifecycle and acceptance contract before runtime work.                  | Ready to start from the user's native-app direction.                                                       |
| Mobile server boundary               | [DEV0160 — Expose the mobile scheduling API](../backend/DEV0160-expose-mobile-scheduling-api.md)                 | Add versioned JSON contracts, bearer-session verification and bounded public/client scheduling endpoints over existing services.           | After DEV0159 fixes the mobile contract; hosted rehearsal also depends on DEV0055.                         |
| Native application foundation        | [DEV0161 — Establish the Expo iOS foundation](../frontend/DEV0161-establish-expo-ios-foundation.md)              | Add the repository-local Expo application, native navigation, configuration, email-code authentication and test/build commands.            | After DEV0159; may proceed in parallel with DEV0160.                                                       |
| Client scheduling experience         | [DEV0162 — Deliver native client scheduling](../frontend/DEV0162-deliver-native-client-scheduling.md)            | Deliver app-specific coach discovery, coach detail, direct booking, My sessions, cancellation and account presentation.                    | After DEV0160 and DEV0161 provide stable contracts and authenticated navigation.                           |
| Coach schedule experience            | [DEV0163 — Deliver the native coach schedule](../frontend/DEV0163-deliver-native-coach-schedule.md)              | Deliver capability-aware coach navigation, recurring availability, owned booking visibility, cancellation and completion.                  | After DEV0160 and DEV0161; may proceed independently of final client polish.                               |
| Coach application/profile experience | [DEV0164 — Deliver the native coach profile](../frontend/DEV0164-deliver-native-coach-profile.md)                | Deliver coach application status, private draft, public profile/location and contract-approved media editing.                              | After DEV0160 and DEV0161; uses DEV0147's authority contract.                                              |
| Account lifecycle                    | [DEV0165 — Implement the account-deletion lifecycle](../backend/DEV0165-implement-account-deletion-lifecycle.md) | Define and implement authenticated deletion initiation, retained-record treatment, Auth/data cleanup and native confirmation/status UI.    | After DEV0159 resolves the retention contract and DEV0160/DEV0161 establish mobile identity transport.     |
| Distribution and release proof       | [DEV0166 — Prepare iOS distribution](../frontend/DEV0166-prepare-ios-distribution.md)                            | Add signed-build configuration, native metadata/assets/privacy declarations, TestFlight delivery and physical-device hosted-flow evidence. | Can start after DEV0161; completion waits for DEV0160-DEV0165, DEV0055 and operator-provided Apple access. |

All required implementation parts currently have direct development tickets. The tickets are flat peers under this record; their dependency order does not create a child-ticket hierarchy.

## Other relationships

- DEV0055 remains an independent hosted-environment dependency. It supplies real Vercel/Supabase configuration and two-account evidence but does not directly implement the iOS application.
- DEV0108 remains independent web Mapbox work. Native discovery must consume provider-neutral coach/location projections and retain a usable list; reusing a web map or shipping a native map is not silently required.
- DEV0147 supplies the existing account, application and coach-authority lifecycle. The iOS app must not create a second identity model or let an applicant self-approve.
- DEV0149 and DEV0150 are the committed client/coach navigation baselines. Native navigation may look different while preserving My sessions for authorized accounts and coach access only for the established capability states.
- Any profile-media contract completed before native implementation becomes downstream context for DEV0159 and the applicable interface tickets; it is not silently treated as an existing committed dependency here.
- The Apple Developer account, App Store Connect access, signing credentials and final public-release approval are external operator dependencies. They are never stored in tickets or source control.

## Delivery sequence and completion conditions

1. Complete DEV0159 first so native scope, platform behavior, account deletion and release expectations become part of the product contract.
2. Implement DEV0160 and DEV0161 in parallel against that contract. Integrate a real mobile bearer session before feature screens depend on it.
3. Deliver DEV0162 as the first client scheduling slice. DEV0163 and DEV0164 then complete coach capability in the same binary; they may proceed in parallel once their server contracts are stable.
4. Complete DEV0165 before any App Store submission. Deletion behavior must cover the account created through email-code onboarding and reconcile retained scheduling evidence explicitly.
5. Complete DEV0166 after every required screen and API is stable. Use TestFlight and a physical iPhone against the hosted environment; public App Store submission remains an explicit operator action.
6. Complete this coordination record only when all eight direct DEV tickets are Completed or explicitly cancelled/replaced, every direct link and status agrees, the shared web behavior remains valid, and TestFlight evidence proves guest discovery, email-code sign-in, direct booking/conflict/cancellation, coach availability/completion, authorization failures and account-deletion initiation without database repair.

## Progress and integration record

- 2026-10-08: The user confirmed that the iOS app should not look exactly like the website and accepted a separate native frontend over the existing backend as the planning direction.
- 2026-10-08: Created the flat work map. “Client” and “coach” are capability areas in one iOS binary, not separate App Store applications.
- 2026-10-08: Adopted a client-first sequence and retained coach capability as required coordinated work after the first client slice. Final first-release membership remains owned by DEV0159's specification change.
- 2026-10-08: Allocated the final mobile range as DEV0159-DEV0166 after refreshing all current, archived, retired and concurrently changing work records; no identifier collision remains.

## Validation results

- Planning validation pending. Each direct ticket contains its own acceptance criteria and validation plan.
- Coordination completion requires link/status consistency plus the integrated TestFlight evidence owned by DEV0166; this record does not substitute for API, application, database or device tests.

## Risks, limitations, and follow-ups

- The repository currently has browser-cookie and same-origin mutation assumptions. DEV0160 must add a bearer-token boundary without weakening actor-scoped database authorization or duplicating scheduling rules in the device client.
- Expo, React Native, Supabase and Apple platform versions change independently. DEV0161 and DEV0166 must pin compatible versions from current official documentation rather than rely on this planning record.
- Account deletion requires a confirmed treatment for historical bookings and review evidence. DEV0159 must distinguish legal/operational retention from deletable profile data before DEV0165 starts.
- Hosted infrastructure, Apple enrollment and review timelines can delay TestFlight or release even after local implementation passes. Record such external state accurately rather than claiming deployment.

## Completion and review references

- Completed: Not completed.
- Direct development tickets: DEV0159-DEV0166 created; DEV0159 is Ready and the dependency-bound tickets remain Draft.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: No integration review created.
- Deployment or release: Not built, submitted or released.
