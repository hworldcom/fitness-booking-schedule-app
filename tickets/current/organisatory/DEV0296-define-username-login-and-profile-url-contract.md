# Ticket DEV0296: Define username login and profile URL contract

- Status: Draft
- Created: 2026-10-17
- Last updated: 2026-10-17
- Milestone: M3/M4 — Account follow-up
- Coordination: None — independent development ticket
- Related records: [DEV0295](../frontend/DEV0295-refine-account-names-and-section-navigation.md) persists optional usernames now; [COR0027](COR0027-login-registration-and-social-authentication.md) owns independent multi-method authentication delivery.

## Objective and context

Current boundary after the later 17 October 2026 user review: saved canonical unique usernames are implemented under DEV0295/DEV0325. The user now selected public coach username URLs as an M10 outcome; [DEV0331](../../archive/backend/DEV0331-enable-username-based-public-coach-urls.md) under COR0028 owns those routes, legacy compatibility and published-handle rename/alias safety. Username login and public/private destinations for non-coach accounts remain separate future work here.

Historical planning originally deferred both login and profile URLs when optional handles were introduced; DEV0325 later required a handle for new registration without implementing either use. DEV0330 records the subsequent scope amendment rather than rewriting that enrollment history. Preferred chat/public coach names and private legal names remain separate.

## Scope and non-goals

- Define future username sign-in with managed Auth, generic failures/abuse recovery and identity continuity.
- Define any future non-coach/general profile URL audience/privacy only if selected; no public athlete page is adopted now.
- Coordinate with DEV0331's actual public coach alias/reservation contracts rather than implementing or deciding coach routing twice.
- No runtime Auth/routing/deployment under this documentary record. Public coach URLs are owned by DEV0331; username login remains deferred.

## Expected behavior and edge cases

Stable account/coach IDs, private data and original booking/message/pair-review identity survive handle changes. Public coach routing follows section 19.6/DEV0331, including legacy no-handle coaches, old slugs and safe alias ownership. This ticket must not impose a blanket deferral of those selected coach URLs. Future username login/non-coach URL behavior still requires its own exact contract and privacy/recovery decisions.

## Assumptions, decisions, and dependencies

Confirmed: username is separate from chat identity; it is saved/unique, and the later user selected it for public coach URLs. Username authentication and non-coach URL audience remain deferred. Depend on actual DEV0295/DEV0325 storage and the narrowly adopted DEV0331 public-handle policy; no duplicate canonical username or public account directory.

## Implementation plan

1. Inspect current Account/registration and the selected DEV0331 public coach URL boundary.
2. Resolve only remaining username-authentication/non-coach policy questions and update the specification without contradicting M10 routing.
3. Allocate bounded future implementation ownership if those independent capabilities are selected; do not implement DEV0331 scope here.

## Acceptance criteria

- [ ] AC1: Future username sign-in/recovery and any selected non-coach URL audience have an exact privacy/continuity contract, separate from chat identity and M10 public coach URLs.
- [ ] AC2: Runtime ownership/testable cases are recorded with DEV0331's selected public routing boundary preserved; saved handles are not misreported as delivered login/routes.

## Validation plan

Documentation/link and consistency review against current Auth, Account and coach route contracts. Application tests are not applicable until separately ticketed runtime work starts.

## Implementation record

2026-10-17 DEV0330 planning amendment: moved the now-selected public coach URL outcome to direct COR0028 peer DEV0331; retained username login/non-coach policy here. Current scope replaces the earlier blanket URL deferral. No runtime edits, migrations, configuration or dependency changes.

## Validation results

Product-contract acceptance remains unverified — draft. During the 2026-10-17 account checkpoint, links and consistency with deferred username use were checked; no runtime implementation or application tests belong to this planning record.

## Risks, limitations, and follow-ups

Saved unique usernames are delivered. Public coach username routes are selected but undelivered DEV0331 work; username login and non-coach URLs remain deferred here. Resolve only those remaining independent product questions before their implementation. DEV0330's current amendment does not reopen archived enrollment evidence.

## Completion and review references

- Completed: Not completed.
- Commit: Draft included in the user-authorized 2026-10-17 checkpoint `[DEV0294][DEV0295][DEV0296][DEV0299] Refine account settings and workspace controls`; no username sign-in or profile-URL implementation is claimed.
- Review: Draft scope/link consistency reviewed for the checkpoint; product questions and acceptance criteria remain unresolved.
- Deployment or release: Not applicable — planning only.
