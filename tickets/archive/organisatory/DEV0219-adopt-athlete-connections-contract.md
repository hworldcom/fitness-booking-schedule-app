# Ticket DEV0219: Adopt athlete terminology and connection contract

- Status: Completed
- Created: 2026-10-14
- Last updated: 2026-10-14
- Milestone: M6 — Athlete terminology and coach–athlete connections
- Coordination: [COR0020 — Athlete terminology and coach–athlete connections](COR0020-athlete-terminology-and-connections.md)
- Related records: completed booking dependency [COR0016 — Coach-confirmed booking requests](COR0016-coach-confirmed-booking-requests.md); independent session collaboration [COR0015 — Session notes and training plans](../../current/organisatory/COR0015-session-notes-and-training-plans.md)

> Documentary pruning — 2026-10-14, [DEV0225](DEV0225-remove-blockchain-historical-evidence.md): superseded feature evidence and deleted-reference details were removed at the user’s request. Retained text records the independent outcome at its original date. Code/data fragments are historical excerpts, not complete current contracts; aggregate test totals remain totals of the original runs, not new retained-only validation. Original completion dates remain unchanged. Earlier revisions remain in Git history.

## Objective and context

Record the user's agreed website vocabulary and mutual coach–athlete connection behavior in the [current specification](../../../docs/mvp-spec.md). An athlete is an account acting as the training participant, currently called a client; a coach retains this capability. A connection is a private, accepted relationship between one coach and one athlete that lasts across sessions.

## Scope and non-goals

- In scope: specification vocabulary, confirmed decisions, connection eligibility/consent/lifecycle/privacy, milestone and acceptance updates, flat peer implementation tickets, index reservations, session-collaboration alignment and a downstream native-release boundary note.
- Out of scope: website code/copy, schema, APIs, media endpoints, native implementation, session-note contract adoption and deployment.

## Expected behavior and edge cases

- Either participant requests a connection after a shared confirmed session; the recipient accepts or declines. At least one shared confirmed or completed booking must still exist at both sending and acceptance. Cancelled-only history and pending booking requests do not qualify.
- Accepted connections populate My coaches and My athletes, remain after cancellation/completion and may be removed by either participant without changing session history or session-content access.
- An accepted connection permits bounded athlete name/photo and pair-owned session-history access only to that coach. Removal revokes connection-derived access while independent request/booking permissions remain authoritative.
- Duplicate, crossed, stale, self and cross-dataset operations need explicit runtime validation owned by DEV0221, not browser-only checks.

## Assumptions, decisions, and dependencies

- Confirmed on 2026-10-14: athlete website terminology, mutual acceptance, either participant initiating/removing, one relationship per pair, accepted connections surviving cancellation/completion, bounded name/photo/shared-session visibility and qualifying-session checks at sending and acceptance.
- Adopted planning interpretation: a completed session qualifies because it passed through confirmation; a cancelled session alone does not qualify for a new connection.
- Proposed implementation defaults remain labelled in the specification: pending-request withdrawal, terminal request attempts, explicit acceptance for crossed requests, approved/demo coach eligibility for new connection actions, existing capability-aware list placement and application-only status delivery.
- DEV0210–DEV0218 and COR0019 are already allocated on the local hackathon branch; reserve them without importing their product scope. New records start at DEV0219/COR0020.

## Implementation plan

1. Adopt vocabulary and the agreed connection contract in the specification while preserving historical ticket paths and technical identifiers.
2. Create COR0020 with direct peer ownership for this contract, website terminology, persistence/authorization and the two participant interfaces.
3. Align current session-collaboration planning with athlete vocabulary and independent connection/session authorization; retain archived evidence.
4. Record reserved IDs, update the index and validate links, unique IDs, reciprocal membership, contract consistency, formatting and the diff.

## Acceptance criteria

- [x] AC1: The specification defines athlete terminology, qualifying confirmed/completed sessions at sending/acceptance, mutual acceptance, pair uniqueness and accepted-connection survival/removal.
- [x] AC2: Name/photo/history access is pair-scoped and connection-derived access is revocable; session-content access remains independently participant-scoped.
- [x] AC3: COR0020 assigns every delivery part to one direct DEV, separates runtime from documentation completion and links session collaboration as independent work.
- [x] AC4: Reserved IDs, next IDs, index entries, membership, local links, formatting and diff checks pass; no runtime or archived-history edits occur.

## Validation plan

- Run the installed Prettier against affected Markdown and `git diff --check`.
- Resolve affected local Markdown links, validate unique prefixed IDs and reciprocal COR0020 membership, and check reservations/next-ID allocation.
- Check specification decisions, state model, privacy, permissions and acceptance language against the confirmed discussion.
- Application, database, browser and build checks are not applicable to documentation-only planning.

## Implementation record

Documentation implementation started and completed on 2026-10-14 after the user confirmed the privacy and qualifying-session choices. Completing this contract delivers requirements and work records; website and connection runtime remain separate planned work.

### Changes and rationale

- Adopted athlete terminology throughout the current specification, with compatible internal `client` identifiers and a legacy `#client` anchor for historical links. One account can train and coach; no role or authority was added.
- Added confirmed decisions C30–C32, participant journeys, pair/request state, sending/acceptance qualifying-session checks, explicit recipient consent, pair uniqueness, accepted-connection survival/removal, scoped athlete identity/photo/history and revocation requirements. Added M6, definition-of-done checks, acceptance scenarios and a future-runtime demo step.
- Created the flat COR0020 map and DEV0220–DEV0223 plans. Existing website vocabulary, persistence/private media, coach My athletes and athlete My coaches have one owner each.
- Updated the current COR0015/DEV0182–DEV0185 plans to athlete vocabulary and connection-independent session permissions. Preserved archived titles, filenames and dated planning history; session-content contract adoption still belongs to DEV0182.
- Added downstream native notes requiring explicit native release membership decisions rather than silently adding web connections to TestFlight scope.
- Reserved previously allocated branch identifiers, advanced next IDs to DEV0224/COR0021 and kept actual hackathon ticket files absent from main.

### Affected files

| File or component                                                                                                                                                                                                                                                                                                                                                                                          | Change and purpose                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [docs/mvp-spec.md](../../../docs/mvp-spec.md)                                                                                                                                                                                                                                                                                                                                                              | Single target vocabulary, consent/eligibility/privacy contract, milestone and acceptance scenarios. |
| [COR0020](COR0020-athlete-terminology-and-connections.md)                                                                                                                                                                                                                                                                                                                                                  | Flat delivery work map, order, independent branches and integration conditions.                     |
| [DEV0220](../frontend/DEV0220-use-athlete-website-terminology.md)                                                                                                                                                                                                                                                                                                                                          | Existing website terminology scope and compatibility checks.                                        |
| [DEV0221](../backend/DEV0221-persist-coach-athlete-connections.md)                                                                                                                                                                                                                                                                                                                                         | Persistence, actor authority, cancellation races and revocable private-media boundary.              |
| [DEV0222](../frontend/DEV0222-add-coach-my-athletes.md) and [DEV0223](../frontend/DEV0223-add-athlete-my-coaches.md)                                                                                                                                                                                                                                                                                       | Participant request controls and accepted-list interfaces with responsive validation.               |
| [COR0015](../../current/organisatory/COR0015-session-notes-and-training-plans.md), [DEV0182](../../current/organisatory/DEV0182-adopt-session-notes-contract.md), [DEV0183](../../current/backend/DEV0183-persist-authorized-session-notes.md), [DEV0184](../../current/frontend/DEV0184-add-coach-session-workspace.md) and [DEV0185](../../current/frontend/DEV0185-add-client-session-collaboration.md) | Align active session plans and keep participant access independent of saved connections.            |
| [COR0013](../../current/organisatory/COR0013-native-ios-application.md) and [DEV0159](../../current/organisatory/DEV0159-adopt-native-ios-contract.md)                                                                                                                                                                                                                                                     | Record downstream vocabulary and a native release-scope boundary.                                   |
| [tickets/README.md](../../README.md)                                                                                                                                                                                                                                                                                                                                                                       | Index records/statuses, reserve allocated IDs and publish next IDs.                                 |

### Decisions and deviations

- Explicitly counted completed bookings as qualifying confirmation history while excluding cancelled-only history for new sends/acceptance. Accepted connections survive later cancellations.
- Kept pending withdrawal, terminal attempts, crossed-request handling, new-action coach status and list placement labelled as implementation defaults rather than additional confirmed user constraints. DEV0221 must record precise schema/retry bounds before implementation.
- Added native consumer notes to prevent a web contract from silently expanding native release scope; no native implementation changed.
  No existing backlog record was deleted or claimed complete here.

### Contracts, configuration, and operations

Changes the target product contract and work ownership only. No runtime interface, dependency, environment variable, migration, deployment or secret changes.

## Validation results

- Date/environment: 2026-10-14, local main checkout; only Markdown requirements/work records changed.
- `xargs node_modules/.bin/prettier --write < /tmp/movx-dev0219-markdown-files.txt` and the matching `--check` command passed for the fifteen affected documents.
- `python3 /tmp/movx-dev0219-check-docs.py` passed 321 local links (13 anchors), 164 unique heading/filename IDs, five reciprocal COR0020 memberships/work-map owners, one index entry per DEV, reserved IDs/next IDs and contract phrase assertions. The temporary checker resolves all local links in the fifteen affected documents and verifies the 32-row decision register.
- `git diff --check` passed. Changed-file review found no source, dependency, configuration, environment, existing archived-record edits or hackathon ticket imports.
- Application, database, browser and build checks were not run because this ticket changes only requirements/work records. Their runtime evidence belongs to DEV0220–DEV0223.

| Criterion | Evidence                                                                                                                    | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | C30–C32, journeys/state model, M6 and acceptance/definition-of-done assertions.                                             | Passed |
| AC2       | Connection-scoped private-media revocation and independent session permissions in specification and affected session plans. | Passed |
| AC3       | Five reciprocal flat DEV owners, dependency sequence and explicit independent COR0015/native consumers.                     | Passed |
| AC4       | Fifteen-document formatting, local link/anchor/ID/index/contract checks and diff/scope review.                              | Passed |

## Risks, limitations, and follow-ups

The website retains existing copy until DEV0220. Connections require DEV0221–DEV0223; session collaboration remains independently unimplemented under COR0015. Exact schema, resend limits and interface placement remain implementation planning choices, with no unresolved confirmed product question for this documentation ticket.

## Completion and review references

- Completed: 2026-10-14 — target contract and validated implementation work map adopted.
- Commit: Included in the documentation commit with subject `[DEV0219][DEV0224] Adopt athlete connections and refresh ticket backlog`, authorized by the user on 2026-10-14.
- Review: No independent review created.
- Deployment or release: Not applicable — documentation/planning only.
