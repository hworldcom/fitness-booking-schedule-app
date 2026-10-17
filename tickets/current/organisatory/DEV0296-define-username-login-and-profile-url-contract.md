# Ticket DEV0296: Define username login and profile URL contract

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3/M4 — Account follow-up
- Coordination: None — independent development ticket
- Related records: [DEV0295](../frontend/DEV0295-refine-account-names-and-section-navigation.md) persists optional usernames now; [COR0027](COR0027-login-registration-and-social-authentication.md) owns independent multi-method authentication delivery.

## Objective and context

The user selected a unique username in Login & security for future sign-in and profile URLs, explicitly deferring both flows while the setting is saved now. Define their product contract against [identity requirements](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity) before runtime implementation. Preferred chat first name and private legal name remain separate.

## Scope and non-goals

- Define username sign-in with managed Auth, recovery, generic failure/abuse behavior and continuity across existing email/password/social identities.
- Define the exact public/private profile URL destination, audience, rename/alias/reuse rules, privacy and compatibility with existing coach slugs.
- Map implementable follow-ups to bounded development records and identify their relationship to COR0027.
- No authentication, URL routing or deployment implementation under this planning record. No claim that saving a username activates those capabilities.

## Expected behavior and edge cases

Opaque identity, coach authority, sessions/history and original coach slugs survive username edits. Decide whether released handles may be reused, how aliases work, who can view a profile URL and how email-code/password/social recovery behaves without exposing private account data. Account UI must stay honest about delivered versus planned behavior.

## Assumptions, decisions, and dependencies

Confirmed: username is for login/URL, not chat identity, and those uses are deferred. URL audience/destination, alias retention and exact auth semantics remain unresolved. Depends on DEV0295's actual persisted model and coordination with COR0027; neither is rewritten silently.

## Implementation plan

1. Review delivered username/Auth/profile boundaries and settle the open product questions.
2. Update the single product specification with adopted decisions and privacy/recovery scenarios.
3. Create bounded runtime tickets/coordination mapping where needed; do not implement a multi-part auth/routing delivery under this record.

## Acceptance criteria

- [ ] AC1: Current spec defines exact username sign-in/recovery and URL audience/rename behavior, separate from chat identity.
- [ ] AC2: Runtime ownership/dependencies and testable privacy/continuity scenarios are recorded without claiming delivery.

## Validation plan

Documentation/link and consistency review against current Auth, Account and coach route contracts. Application tests are not applicable until separately ticketed runtime work starts.

## Implementation record

Pending planning. No runtime edits, migrations, configuration or dependency changes.

## Validation results

Product-contract acceptance remains unverified — draft. During the 2026-10-17 account checkpoint, links and consistency with deferred username use were checked; no runtime implementation or application tests belong to this planning record.

## Risks, limitations, and follow-ups

Saving an optional username does not create username sign-in or a shareable profile URL. Resolve the product questions above before implementing those uses.

## Completion and review references

- Completed: Not completed.
- Commit: Draft included in the user-authorized 2026-10-17 checkpoint `[DEV0294][DEV0295][DEV0296][DEV0299] Refine account settings and workspace controls`; no username sign-in or profile-URL implementation is claimed.
- Review: Draft scope/link consistency reviewed for the checkpoint; product questions and acceptance criteria remain unresolved.
- Deployment or release: Not applicable — planning only.
