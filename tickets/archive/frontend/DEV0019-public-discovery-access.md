# Ticket DEV0019: Public Explore and Challenges access

- Status: Completed
- Created: 2026-09-19
- Last updated: 2026-09-19
- Milestone: Product contract / M0 authentication and catalogue planning
- Coordination: None — independent development ticket
- Related tickets: [COR0002 — Authentication and access](../organisatory/COR0002-phantom-auth-and-demo-access.md), converted from retired DEV0016; [COR0006 — Persistent catalogue](../organisatory/COR0006-persistent-access-catalogue.md), converted from retired DEV0017; [DEV0015 — Database foundation](../backend/DEV0015-supabase-database-foundation.md)

## Objective and context

The user confirms that Explore and Challenges must be visible to everyone, including signed-out visitors. The existing frontend has no authentication guard, but the planned backend catalogue reads were described as authenticated. Make guest discovery an explicit contract in the [specification](../../../docs/mvp-spec.md#2-screens-and-actions) and align future tickets before authentication is implemented.

## Scope and non-goals

- In scope: confirmed public-browsing decision, public listing/detail versus private/action boundaries, future route/service/SQL access plans and acceptance scenarios; inspect current routes for an existing login restriction.
- Out of scope: implementing Supabase/Auth, changing frontend design, making private drafts or invitation-only challenges public, exposing personal activity or receipts, open registration or financial actions.

## Expected behavior and edge cases

Visitors can directly open, reload, filter and inspect Explore and the public Challenges catalogue without login, a wallet or demo enrollment. Class/event/studio details and public challenge details remain browsable. My Challenges, private drafts and participation/account actions require sign-in and existing permissions. After sign-in, return to the intended app destination without automatically booking, joining or signing a payment. Dismissing/rejecting login leaves public browsing usable. Private records and arbitrary demo runs remain inaccessible through direct URLs or API requests.

## Assumptions, decisions, and dependencies

Public route access is a confirmed user decision. Public detail browsing is the supporting implementation choice so listing links do not immediately hit a login wall. This concerns discovery content; existing social activity and private challenge permissions remain intact. Current frontend previews remain labelled examples. Real guest database reads and authenticated action gating will be delivered by 0016–0017, which remain Draft.

## Implementation plan

1. Inspect current route/layout guards and the existing public/private product and database contracts.
2. Record C17 and a public-browsing access contract in the existing specification, including anonymous safe catalogue reads and explicit private/action boundaries.
3. Update 0015–0017 plans and acceptance checks; add guest scenarios to the specification and maintain the ticket index. Preserve completed historical tickets.
4. Validate Markdown links/anchors and ticket consistency, check the existing public routes, and confirm that source/configuration files did not change. Complete only this contract update.

## Acceptance criteria

- [x] AC1: The specification explicitly requires signed-out Explore/Challenges listing, filters and public details, with no wallet/enrollment prerequisite.
- [x] AC2: Private content and personal/financial actions retain authentication/authorization; guest reads cannot leak records through URL, run selection or cached personalized responses.
- [x] AC3: Future authentication/catalogue tickets implement and test guest access rather than imposing a blanket sign-in gate; their delivery status remains Draft.
- [x] AC4: Existing route access is inspected, documentation links/statuses are consistent and runtime/configuration files are unchanged.

## Validation plan

Read the current pages/layout and planned access boundaries. Check current unauthenticated HTTP routes if the local preview is available. Run a read-only Markdown/anchor/status and before/after source/configuration hash check. No application test/build or mobile/desktop interface regression is required for documentation-only changes; future authenticated/anonymous browser and database tests belong to 0016–0017.

## Implementation record

The existing frontend routes already render without authentication. The gap was in the planned backend: 0017 described authenticated catalogue services and section 3 required actor checks on every read. Those statements could cause a future login wall. The confirmed contract now keeps public discovery accessible in database mode as well as preview mode.

- [Specification](../../../docs/mvp-spec.md#public-browsing-and-sign-in-boundaries): added C17, public listing/detail scope, sign-in boundaries and return behavior; aligned server/SQL access, demo-run checks and social privacy. Added definition-of-done item 15 and A54–A55 for guests and private-data protection. Public catalogue visibility does not grant challenge entry or reveal restricted content.
- [DEV0015](../backend/DEV0015-supabase-database-foundation.md): linked the future restricted guest read path while retaining private default-deny access.
- [COR0002](../organisatory/COR0002-phantom-auth-and-demo-access.md), converted from retired DEV0016: preserves route/action-scoped login, safe internal return destinations, no automatic booking/payment after login, and anonymous/expired-session tests across its direct tickets.
- [COR0006](../organisatory/COR0006-persistent-access-catalogue.md), converted from retired DEV0017: coordinates public safe projections, separate private overlays, scoped read-only SQL access and anonymous browser/database/cache checks.
- [Ticket index](../../README.md#ticket-index): records this completed contract update. Future implementation tickets remain Draft; completed historical records were preserved.

Decision: public detail links must work without login so browsing remains useful. Private drafts, My Challenges and personal/financial actions remain protected. No scope deviation. This changes the planned access contract only; no runtime interfaces, dependencies, environment variables, migrations, cloud setup or deployment changed, and no application rollback is needed.

## Validation results

- Date/environment: 2026-09-19, local repository and the existing preview at `http://127.0.0.1:3100`.
- AC1–AC3 — passed by document review: C17, section 2's access boundaries, section 3/5's public versus protected reads, section 9's personal activity scope, A54–A55 and future ticket plans agree. Both challenge modes can be discoverable; private/owner-specific data is excluded. 0015–0018 remain Draft with unchecked implementation acceptance criteria.
- AC4 — passed by source review: `src/app/explore/page.tsx`, `src/app/challenges/page.tsx`, `src/app/challenges/[id]/page.tsx`, root layout and shell render the current preview without a login guard. Existing preview-local actions are not claimed as implemented authenticated actions.
- AC4 — passed by HTTP/content check: ran the command below with no cookie/authentication options. Both responses were HTTP 200. An inline `python3 -` check found the expected page headings, “Find your next move.” and “A reason to show up.”, RepX Club content and no Next.js redirect marker. Initial sandbox attempts could not reach the listening server; the authorized retry outside the sandbox succeeded.

```sh
curl --silent --show-error --fail --max-time 15 --output /private/tmp/repx-0019-explore.html --write-out 'Explore HTTP %{http_code}\n' http://127.0.0.1:3100/explore --next --silent --show-error --fail --max-time 15 --output /private/tmp/repx-0019-challenges.html --write-out 'Challenges HTTP %{http_code}\n' http://127.0.0.1:3100/challenges
```

- AC4 — passed: ran `python3 -` with a read-only inline Markdown/status/hash validator. All 20 navigation/spec/ticket Markdown files had valid local file/anchor links; 15 unique ticket IDs matched index statuses, retired 0010–0013 IDs were not reused, and requirement IDs were C01–C17, P01–P08 and A01–A55. All 44 snapshotted runtime/test/asset/root configuration files were unchanged; no source/test/asset files were added.
- Not run: application tests, build, mobile/desktop interaction regression, real guest database access and authenticated privacy tests. This change only updates documents; the current preview has no Auth/database implementation. 0016–0017 explicitly require the future anonymous/authenticated browser and database evidence.

## Risks, limitations, and follow-ups

The current frontend has no real Auth boundary. This ticket specifies future behavior without claiming that private API authorization or guest database projections are implemented. 0016–0017 must prove both public browsing and private-data denial.

## Completion and review references

- Completed: 2026-09-19 — public discovery contract and future implementation plans aligned; current public routes verified.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC4; no independent review.
- Deployment: None.
