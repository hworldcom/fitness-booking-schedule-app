# Ticket DEV0159: Adopt the native iOS contract

- Status: Ready
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Native iOS application contract
- Coordination: [COR0013 — Native iOS application](COR0013-native-ios-application.md)
- Related records: supplies [DEV0160 — Expose the mobile scheduling API](../backend/DEV0160-expose-mobile-scheduling-api.md), [DEV0161 — Establish the Expo iOS foundation](../frontend/DEV0161-establish-expo-ios-foundation.md) and the remaining COR0013 peers; extends the scheduling-only contract adopted by [DEV0140](../../archive/organisatory/DEV0140-adopt-scheduling-only-contract.md)

## Objective and context

The current product contract names native Next.js on Vercel as the hosted target and defines browser behavior only. Adopt one native iOS client for the same MovX scheduling product before adding runtime code. Record the user's requirement that the app have its own native presentation rather than look like or embed the website, while preserving the same email-backed identity, scheduling authority, data and backend services.

This ticket must also decide which capabilities belong in the first TestFlight/App Store candidate, what remains web-only, and how account deletion treats profile data, historical bookings and immutable coach-review evidence. Those choices materially affect every other COR0013 ticket and must not be left as silent implementation defaults.

## Scope and non-goals

- In scope: update the MVP specification's confirmed decisions, actors, architecture, security/failure invariants, definition of done, milestones and acceptance matrix for one Expo/React Native iOS application; define shared-backend and API boundaries; define client-first sequencing and final coach capability; define supported native authentication and account deletion outcomes; identify App Store/TestFlight and physical-device evidence; update relevant repository navigation/area descriptions for native frontend work.
- Out of scope: installing Expo, moving the existing Next.js tree, adding API routes, changing authentication/runtime behavior, implementing deletion, creating assets, registering Apple identifiers, building or submitting an iOS binary, or changing the existing scheduling rules.

## Expected behavior and edge cases

- The website and iOS app remain two frontends for one product and one account/data authority; a booking made on either surface appears on the other after refresh.
- The iOS interface uses native navigation and controls and does not load the production website as its primary application surface.
- Guest discovery remains available without sign-in. Mutations require the same verified account and capability checks as the website.
- Client and coach capabilities coexist in one binary. Staff coach review remains web/operator-only unless a later contract explicitly adds it.
- The contract distinguishes required first-release features from deferred native enhancements such as push notifications, external calendar integration, offline mutation queues or a native Mapbox map.
- Account deletion defines what is deleted, anonymized or retained and how in-flight/future bookings are handled. The specification must label any unresolved legal retention requirement rather than invent one.
- The contract does not claim TestFlight, App Store approval, Apple credentials or hosted mobile APIs already exist.

## Assumptions, decisions, and dependencies

- Confirmed user constraint, 2026-10-08: the iOS app must not look exactly like the website.
- Adopted planning direction, 2026-10-08: use Expo/React Native as a repository-local native frontend over the existing Vercel/Supabase system, with client and coach capabilities in one binary.
- Proposed default requiring explicit adoption in the specification: ship client scheduling first, then complete the coach schedule/profile before the coordinated native initiative closes.
- Proposed default requiring explicit adoption: iPhone-first layouts, with exact minimum iOS and iPad support chosen from the pinned Expo/React Native toolchain during DEV0161.
- Unresolved before DEV0165: retained booking/audit data versus deletion/anonymization behavior, including future confirmed bookings and coach-review evidence.
- Existing scheduling decisions C01-C15, including no payment, messaging, notification delivery or external-calendar behavior, remain authoritative unless this ticket changes them explicitly.

## Implementation plan

1. Add a native-platform section and confirmed decisions without duplicating the existing scheduling state model.
2. Define the mobile client/server trust boundary, shared data behavior and web/native compatibility expectations.
3. Define the first client slice, final coach capability, web-only staff operations and deferred native features.
4. Define account deletion behavior or record the exact unresolved decision that blocks DEV0165.
5. Extend the definition of done, milestones and acceptance matrix with simulator, physical-device, TestFlight and cross-surface scenarios.
6. Update README/ticket-area navigation only where the existing browser-only wording would misclassify native client work.

The proposed work is one documentation contract. Runtime implementation is deliberately owned by the peer DEV tickets under COR0013.

## Acceptance criteria

- [ ] AC1: The specification defines one native iOS application as a distinct interface over the existing MovX identity, service and data authority, not a wrapped website or separate product.
- [ ] AC2: Required client, coach, web-only and deferred capabilities are explicit, including first-release and coordination-completion boundaries.
- [ ] AC3: Mobile authentication, API trust, cross-surface consistency, account deletion and failure behavior are defined without weakening current authorization or capacity-one invariants.
- [ ] AC4: Native definition-of-done and acceptance scenarios cover device sizes, accessibility, session expiry, network failure, booking races and hosted physical-device evidence.
- [ ] AC5: Documentation distinguishes adopted decisions from proposals and does not claim runtime, Apple or deployment work is complete.

## Validation plan

Run Markdown formatting, relative-link checks and `git diff --check`. Review every new native requirement against the current confirmed decision register, scheduling state model, permissions, definition of done and acceptance matrix. Application tests are not applicable because this ticket changes documentation and planning only.

## Implementation record

Product-contract implementation is pending. The planning baseline now exists under COR0013, but this record does not yet modify the product specification or satisfy the acceptance criteria below.

### Changes and rationale

- Created COR0013 and its flat set of peer development tickets so every native implementation boundary has an owner before code begins.
- Kept DEV0159 as the first Ready ticket because the product, account-lifecycle and release contract must be adopted before dependency-bound runtime tickets start.
- Left the current specification and runtime unchanged; planning records do not silently become confirmed product behavior.

### Affected files

| File or component                                                | Change and purpose                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `tickets/current/organisatory/COR0013-native-ios-application.md` | Coordinates the native work map, sequence and integration conditions.                          |
| `tickets/current/**/DEV0159-DEV0166-*.md`                        | Defines the eight direct implementation records and their dependencies.                        |
| `tickets/README.md`                                              | Indexes the new coordination and development records.                                          |
| `docs/mvp-spec.md`                                               | Planned native platform, lifecycle, milestone and acceptance contract.                         |
| `README.md` and ticket-area guidance                             | Planned navigation updates where needed; no setup command will be documented before it exists. |

### Decisions and deviations

None yet beyond the user-confirmed and proposed planning choices recorded above.

### Contracts, configuration, and operations

This ticket is planned to change documentation only. It will add no dependencies, environment variables, schema, routes, credentials or deployed resources.

## Validation results

Planning-record validation completed on 2026-10-08:

- Prettier passed for the coordination record and eight direct DEV records; the staged index rows were reviewed separately to avoid including unrelated worktree formatting changes.
- A repository-relative link/record checker validated 174 file links, reciprocal COR membership, required ticket sections and unique identifiers.
- `git diff --check` passed.
- Application, database and browser tests were not run because no runtime or product-contract implementation changed.

DEV0159's product-contract acceptance criteria remain not run until the specification work begins.

| Criterion | Evidence                        | Result  |
| --------- | ------------------------------- | ------- |
| AC1       | Specification review            | Not run |
| AC2       | Scope and milestone review      | Not run |
| AC3       | Security/lifecycle review       | Not run |
| AC4       | Acceptance-matrix review        | Not run |
| AC5       | Status-language and diff review | Not run |

## Risks, limitations, and follow-ups

Account deletion retention is the only known product decision that can block a downstream ticket. If legal advice is required, record the bounded decision and keep DEV0165 Draft rather than inventing a policy. Exact SDK and deployment versions belong to DEV0161/DEV0166 after current documentation is inspected.

## Completion and review references

- Completed: Not completed.
- Commit: Planning records prepared for `[DEV0159] Plan native iOS application delivery`; product-contract implementation has not been committed.
- Review: No review created.
- Deployment or release: Not applicable — documentation contract only.
