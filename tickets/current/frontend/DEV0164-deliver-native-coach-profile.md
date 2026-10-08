# Ticket DEV0164: Deliver the native coach profile

- Status: Draft
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Native iOS coach onboarding and profile
- Coordination: [COR0013 — Native iOS application](../organisatory/COR0013-native-ios-application.md)
- Related records: depends on [DEV0160 — Expose the mobile scheduling API](../backend/DEV0160-expose-mobile-scheduling-api.md) and [DEV0161 — Establish the Expo iOS foundation](DEV0161-establish-expo-ios-foundation.md); preserves the application/approval boundary from [DEV0147](../../archive/backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md)

## Objective and context

Deliver native coach application status and coach-profile management without weakening platform review. One email-backed account retains client capability, may submit a coach application and prepare a private draft, but only current approval can publish the coach profile, location, portrait and availability.

## Scope and non-goals

- In scope: coach-application/profile/location/portrait mobile API routes needed by this slice; native entry from Profile; pending/rejected/approved/suspended states; private draft editing; display name, bio, disciplines, timezone, visibility and one confirmed public location; optional public portrait display/upload/removal if supported by DEV0159; approval-aware publication; accessibility and device tests.
- Out of scope: staff review/approval UI, identity-document storage, multiple venues/service areas, background checks, licensing claims, social profiles, reviews, arbitrary remote image URLs or the schedule editor owned by DEV0163.

## Expected behavior and edge cases

- A signed-in client may submit one bounded coach application and view its status; submission never grants coach authority.
- Pending/rejected applicants may edit only the contract-defined private draft. Approved coaches may publish; suspended coaches are removed from discovery and cannot republish.
- Public coach presentation uses only approved/demo trust labels with the existing bounded explanation. A portrait never establishes authority.
- Location selection stores a confirmed provider-neutral snapshot. Map/geocoding failure retains a usable manual/list fallback if the current contract allows it.
- Image selection requests only necessary device permission, normalizes the supported input and preserves the existing private-avatar/public-portrait distinction.
- Stale approval, profile, image or location state fails without silently exposing a draft or overwriting a newer server value.

## Assumptions, decisions, and dependencies

- Platform review remains web/operator-only and the current DEV0148 admin panel is not a mobile dependency.
- DEV0160 supplies the shared bearer-session boundary; this ticket may add coach-application/profile/location/media routes over existing services.
- DEV0161 supplies authenticated navigation, image/device primitives only after their current official APIs are reviewed.
- A native Mapbox map is optional; confirmed manual/provider-neutral location behavior must remain usable without it.
- Exact image-editing parity is determined by DEV0159. If upload is deferred, existing public portraits must still display and the UI must not imply they are immutable forever.

## Implementation plan

1. Add exact, bounded coach application/profile/location/portrait API contracts over existing authority services.
2. Add native coach-application entry and explicit pending/rejected/approved/suspended status presentation.
3. Implement private draft and approved publication forms with validation, conflict and unavailable states.
4. Implement confirmed location selection/fallback and optional portrait lifecycle according to DEV0159.
5. Add application/approval, hidden-draft, suspension, image/location and cross-account tests.
6. Rehearse local application, private draft, operator approval outside the app, publication and suspension visibility across native/web surfaces.

The scope is one coach onboarding/profile vertical slice. Staff review and schedule management remain separate records.

## Acceptance criteria

- [ ] AC1: Native application submission and status use one existing email-backed account and never grant or imply self-approval.
- [ ] AC2: Pending/rejected applicants can manage only a private draft; only current approved authority can publish profile, confirmed location and portrait.
- [ ] AC3: Approved/demo/suspended presentation preserves the existing trust-label and discovery rules without leaking private account/application data.
- [ ] AC4: Stale approval/profile state, invalid location/media, cross-account identifiers and unavailable providers fail without partial or unintended publication.
- [ ] AC5: Relevant API/native tests, local cross-surface rehearsal, accessibility/device checks and existing web/backend regressions pass.

## Validation plan

Test ordinary, pending, rejected, approved, suspended, demo and unrelated accounts at API and native component levels. Exercise private draft/public visibility, stale status, invalid/missing location, image fallback/upload if in scope and provider failure. Rehearse approval through the existing operator command rather than the app. Run mobile/backend/web tests, lint, typecheck/build and supported iPhone accessibility checks.

## Implementation record

Pending implementation.

### Changes and rationale

Pending implementation.

### Affected files

| File or component                    | Change and purpose                                                     |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Coach application/profile mobile API | Planned bounded authority and mutation boundary.                       |
| Native Profile/coach routes          | Planned application status, private draft and approved publication UI. |

### Decisions and deviations

None yet.

### Contracts, configuration, and operations

Consumes existing Supabase Auth, coach-review state, profile/location services and Storage image boundaries. Any native image-picker or map dependency must be pinned and its permission/configuration impact recorded.

## Validation results

Pending validation.

| Criterion | Evidence                                 | Result  |
| --------- | ---------------------------------------- | ------- |
| AC1       | Application/authority tests              | Not run |
| AC2       | Draft/publication tests                  | Not run |
| AC3       | Trust/discovery tests                    | Not run |
| AC4       | Negative and provider-failure tests      | Not run |
| AC5       | Command, cross-surface and device matrix | Not run |

## Risks, limitations, and follow-ups

Native geocoding and photo libraries can introduce permission/privacy declarations. Request no device permission until the user invokes the relevant action, and retain non-map/non-photo fallbacks. Staff operations remain deliberately absent from the consumer app.

## Completion and review references

- Completed: Not completed.
- Commit: Not created.
- Review: No review created.
- Deployment or release: Not distributed.
