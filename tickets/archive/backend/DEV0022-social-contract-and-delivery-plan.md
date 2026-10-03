# Ticket DEV0022: Social contract and delivery plan

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-20
- Milestone: Product specification / M0–M4 planning
- Coordination: None — independent development ticket
- Related tickets: [COR0002](../organisatory/COR0002-phantom-auth-and-demo-access.md), converted from retired DEV0016, [COR0006](../organisatory/COR0006-persistent-access-catalogue.md), converted from retired DEV0017, later-cancelled [DEV0018](DEV0018-class-pass-reservations-and-confirmed-visits.md); later revised delivery [DEV0023](./DEV0023-minimal-shared-activity-feed.md), cancelled [DEV0024](../blockchain/DEV0024-verified-challenge-activity.md)

## Objective and context

The user accepted the proposed social loop: follow people, browse chronological Community/Following activity, Cheer, open the activity to participate, and share links with existing visibility controls. Update the [single MVP specification](../../../docs/mvp-spec.md#9-social-behavior-and-permissions) and delivery tickets. The current UI only demonstrates local follows and activity; the database and new social interactions remain unimplemented.

## Scope and non-goals

- In scope: record the accepted scope, define bounded interaction/database rules, align identity/follow/activity draft tickets, add focused delivery tickets, and update navigation/status references.
- Out of scope: application code, dependencies, migrations, hosted services, wallet transactions, comments, direct messages, notifications, general posts or new product documents.

## Expected behavior and edge cases

The specification distinguishes confirmed direction from adopted implementation details and actual delivery. The agreed Cheer feature supersedes the old blanket deferral of likes. Personal social activity stays restricted to authenticated users in the same demo run; anonymous Explore/Challenges access remains unchanged. Following and sharing do not grant participation rights. Hidden/restricted items cannot leak through reaction counts or retries. Challenge voting and financial outcomes remain distinct from social engagement.

## Assumptions, decisions, and dependencies

The user's “sounds good” accepts the preceding social recommendation and deferrals; it does not resolve P01–P05/P07 or authorize backend implementation. Supabase/PostgreSQL remains the recommended database plan. Keep existing draft ticket IDs and completed history. Final columns/indexes belong to implementation migrations; document enough invariants to make those tickets testable.

## Implementation plan

1. Add C19 and align the screen/scope/social/database/milestone/acceptance/demo sections in the specification.
2. Align draft tickets 0016–0018 with sign-in boundaries, one-way follows and source activity responsibilities.
3. Prepare separate draft tickets for the shared feed/Cheer slice and verified challenge activity; link their dependencies without claiming missing payment/program work exists.
4. Update README navigation and ticket index. Check local links/anchors, IDs, status consistency, conflicting scope language and unchanged source/completed records.

## Acceptance criteria

- [x] AC1: The specification states the accepted interaction loop, permissions, feed behavior, Cheer invariants and explicit deferrals consistently.
- [x] AC2: Database planning maps the social records to delivery tickets; new tickets have bounded scope, dependencies, testable criteria and validation plans.
- [x] AC3: Current versus planned status is accurate, references resolve, existing unresolved decisions/history remain intact, and no application or database implementation is claimed.

## Validation plan

Run a Python Markdown link/anchor and ticket-status consistency check across active documents; inspect social mentions and decision/acceptance ID sequences. Compare tracked input-file hashes to confirm no application/configuration or completed-ticket changes. Review against the acceptance criteria. Application tests, builds and browser checks are not applicable to this documentation-only change.

## Implementation record

### Changes and rationale

Added confirmed C19 for the accepted social loop and expanded section 9 with chronological Community/Following behavior, directed follows, one removable Cheer, profile/activity permissions and independent participation links. Removed the conflicting blanket deferral of likes while explicitly retaining deferred comments, messages, notifications and general posting. Added logical social data relationships/invariants and acceptance scenarios A58–A62; aligned screen scope, definition of done, M4 and the demo script.

Updated existing draft tickets at their current responsibility boundaries: 0016 guards identity/social access, 0017 owns profiles/follows, and 0018 owns class activity sources. Prepared 0023 for the shared feed/Cheer slice and 0024 for verified challenge sources so source verification dependencies remain visible. No existing completed ticket was rewritten. The specification remains the single product contract; tickets link to it and record delivery scope.

### Affected files

| File                                                                                       | Role in this change                                                                                                   |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [MVP specification](../../../docs/mvp-spec.md)                                             | Accepted C19, social behavior/data invariants, scope/deferrals, milestones, completion/demo requirements and A58–A62. |
| [COR0002 identity/access](../organisatory/COR0002-phantom-auth-and-demo-access.md)         | Signed-in same-run social access and clearing personal social state on sign-out; guest catalogue remains public.      |
| [COR0006 shared-data coordination](../organisatory/COR0006-persistent-access-catalogue.md) | Unique directed/idempotent follows and profile visibility; excludes reaction implementation.                          |
| [DEV0018 class activity](DEV0018-class-pass-reservations-and-confirmed-visits.md)          | Historical stable actor/source/time/visibility plan; later cancelled when standalone passes left the MVP.             |
| [DEV0023 feed/Cheers](./DEV0023-minimal-shared-activity-feed.md)                           | Historical name; the 24 September pivot retained the feed ticket but removed reactions.                               |
| [DEV0024 challenge sources](../blockchain/DEV0024-verified-challenge-activity.md)          | Cancelled on 24 September 2026 when product challenges left the current MVP.                                          |
| [README](../../../README.md)                                                               | Navigation to the accepted social plan, explicitly marked unimplemented.                                              |
| [Ticket index](../../README.md)                                                            | Accurate planning/delivery statuses and links.                                                                        |

### Decisions and deviations

20 September 2026: the user accepted the previously proposed interaction scope and requested documents/tickets only. Adopted engineering details include occurrence-time/ID ordering, no self-follow, own posts in Community/profile with Following limited to followed authors, desired-state writes, and count-plus-viewer reaction responses. These implement the accepted direction and are identified as implementation choices, not separate user quotations. Reused existing source delivery/follow plans rather than creating a second social database. No scope deviation; no new financial-policy decision was inferred.

### Contracts, configuration, and operations

Product and future logical data contracts now include a fixed Cheer reaction, actor/activity/run uniqueness, stable feed ordering and parent-aware visibility. Final SQL/services arrive in their delivery tickets. No applied schema, API, dependencies, configuration, setup commands or migration/rollback operation changed. No local server restart or rebuild was required.

## Validation results

20 September 2026, local workspace:

- `python3 /private/tmp/repx-0022-check-docs.py` — passed: 25 active Markdown files, 325 local links/anchors, 20 ticket/index statuses, unique ordered C01–C19/P01–P08/A01–A62, new-ticket required sections, preserved unresolved P decisions and 62 unchanged source/configuration/completed-record hashes. The temporary checker is a disposable diagnostic, not a new project dependency.
- Self-review covered section 1 scope, screen/access rules, database phases, section 9, definition of done, M4, acceptance scenarios and the demo. Confirmed that the active specification no longer defers all likes, 0023/0024 remain Draft, and no current UI/database delivery is claimed.
- Application, browser, build and database migration tests: not run, because this task changed documentation only. No UI flow, runtime dependency, schema or financial behavior was modified.
- No failed validation checks or unresolved documentation acceptance criteria.

| Criterion | Evidence                                                                                                                 | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1       | C19 and sections 1/2/9/10/11/12/13/14 reviewed together; A58–A62 cover the new scope                                     | Passed |
| AC2       | Social data table maps owners; 0016–0018 aligned; 0023/0024 have bounded scope, dependencies and validation              | Passed |
| AC3       | Automated documentation checks and unchanged-file hashes; current preview versus future backend explicitly distinguished | Passed |

## Risks, limitations, and follow-ups

Implementation remains outstanding in the database/authentication and social delivery tickets. Ticket 0024 still needs concrete M2 source/projection dependencies and actor attribution before readiness; no social label can stand in for chain evidence. P01–P05/P07 remain unresolved where previously proposed. None blocks completion of this documentation change.

## Completion and review references

- Completed: 2026-09-20; accepted social scope and data plan documented, existing draft tickets aligned, and 0023/0024 prepared with implementation still outstanding.
- Commit: Not created; not requested.
- Review: Self-reviewed against all acceptance criteria; no independent review.
- Deployment or release: None; documents only.
