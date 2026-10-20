# Ticket DEV0398: Record the admin subdomain target

- Status: Completed
- Created: 2026-10-20
- Last updated: 2026-10-20
- Milestone: Planned internal administration
- Coordination: None — independent development ticket
- Related records: Downstream coach-review interface [DEV0148](../../current/frontend/DEV0148-add-coach-review-admin-panel.md); independent hosted environments [COR0026](../../current/organisatory/COR0026-separate-hosted-dev-and-production.md); historical DNS migration [DEV0373](DEV0373-move-domain-dns-to-vercel.md).

## Objective and context

Record the user's selected `https://admin.movx.club` deployment target for the future admin panel in the [confirmed decisions](../../../docs/mvp-spec.md#2-confirmed-target-and-decisions) and [platform-reviewer contract](../../../docs/mvp-spec.md#platform-reviewer). The panel is currently a Draft plan under DEV0148; selecting its hostname does not establish a working deployment.

## Scope and non-goals

- In scope: update the specification, current coach-review plan and ticket index with the confirmed hostname and accurate delivery boundaries.
- Out of scope: panel implementation, DNS/hosting/Auth configuration, deployment, account/data changes, adopting dashboard metrics or notification/invitation defaults, and choosing a separate hosting project or application architecture.

## Expected behavior and edge cases

The planned staff interface targets `admin.movx.club`. Its hostname does not grant staff access or select a database environment. The delivered owner-only review command remains the current review path. UAT/production data separation and the required staff authorization remain intact. Future implementation must account for sign-in return URLs, session scope and authorization on the chosen origin before rollout.

## Assumptions, decisions, and dependencies

- Confirmed on 2026-10-20: deploy the future admin panel at `admin.movx.club`.
- Existing DEV0148 requirements retain owner-assigned staff capability and server/database checks. Its draft scope needs review before implementation.
- Separate hosting versus host-based routing, exact admin routes, UAT hostname and target-environment mapping remain implementation/planning choices. This hostname decision does not resolve them.
- One bounded documentation amendment; no coordination record or implementation split is needed.

## Implementation plan

1. Inspect current product, admin-plan and environment records; allocate an unused DEV identifier while preserving unrelated work.
2. Add the hostname to confirmed decisions and the reviewer section; align DEV0148 without claiming delivery or promoting proposed product defaults to user decisions.
3. Check changed links/anchors, identifier/index consistency and whitespace; complete and archive this documentation record.

## Acceptance criteria

- [x] AC1: Specification and DEV0148 consistently record `https://admin.movx.club` as a confirmed future deployment target.
- [x] AC2: Current manual review, staff-authorization requirements and unresolved hosting/environment details remain explicit; no implementation/deployment is claimed.
- [x] AC3: Affected links/anchors, identifier/index consistency and whitespace checks pass, with unrelated edits preserved.

## Validation plan

Inspect the focused diff, validate relative links and referenced headings in the changed documents, check DEV uniqueness and index/status/path agreement, and run `git diff --check`. Application, browser, build, database and live DNS/Auth checks are not applicable to this documentation-only amendment; no runtime configuration changes.

## Implementation record

Completed the documentation amendment on 2026-10-20. Runtime implementation has not started under this ticket.

### Changes and rationale

Previously the future admin interface had a draft route proposal without a confirmed hostname. The specification now records `https://admin.movx.club` in C52 and the platform-reviewer section; DEV0148 carries the same dated constraint. Existing manual review and required staff checks are unchanged. Hosting topology, admin UAT origin and environment mapping remain explicit open choices rather than inferred user decisions.

### Affected files

| File | Change and role |
| --- | --- |
| [docs/mvp-spec.md](../../../docs/mvp-spec.md#platform-reviewer) | Adds confirmed decision C52 and the future admin hostname/delivery boundary to the authoritative contract. |
| [DEV0148](../../current/frontend/DEV0148-add-coach-review-admin-panel.md) | Adds the dated hostname amendment and rollout questions to the Draft interface plan while retaining earlier decisions. |
| [tickets/README.md](../../README.md) | Allocates DEV0398, advances the next ID to DEV0399 and archives the completed documentation record. The pre-existing DEV0397 entry remains intact. |

### Decisions and deviations

2026-10-20: Limit this amendment to the selected hostname. Earlier dashboard, invitation and notification suggestions remain proposals requiring their own scope/contract review. No deviation from the implementation plan.

### Contracts, configuration, and operations

Documentation contract: future admin hostname. No runtime interfaces, dependencies, secrets, environment variables, migrations, DNS records or external services changed. Rollback is a documentation correction; no operational rollback applies.

## Validation results

2026-10-20, repository-only checks:

- `python3 /private/tmp/dev0398-doc-check.py`: passed before and after archival. Checks local Markdown link targets/heading anchors in this record and added document lines, unique DEV/COR filenames across current/archive records, C52/domain agreement, DEV0148 Draft status, index/next-ID/archive agreement and preservation of the existing DEV0397 file/index entry.
- `git diff --check`: passed. Focused diff review confirms the amendment affects the specification, DEV0148, this record and index; existing DEV0397 work is retained.
- Application tests, lint/type/build, browser, database and live DNS/Auth checks: not run; no runtime/configuration or external-service changes require them.

| Criterion | Evidence | Result |
| --- | --- | --- |
| AC1 | C52/reviewer text and DEV0148 consistently use the selected HTTPS hostname; checker and diff review. | Passed |
| AC2 | Manual-review paragraph retained; dated draft amendment leaves hosting/environment choices open and records staff/origin checks without claiming rollout. | Passed |
| AC3 | Affected link/anchor, unique-ID, archive/index and whitespace checks; DEV0397 file/index retained. | Passed |

## Risks, limitations, and follow-ups

DEV0148 remains Draft. Hosting layout, environment mapping, origin-specific authentication and release evidence need explicit ownership before implementation/deployment. This ticket creates no admin endpoint or live service.

## Completion and review references

- Completed: 2026-10-20; selected admin hostname recorded and documentation validated.
- Commit: `[DEV0398] Record the admin subdomain target`, authorized with the pending-changes commit request on 2026-10-20.
- Review: Documentation self-review complete; no independent review.
- Deployment or release: None.
