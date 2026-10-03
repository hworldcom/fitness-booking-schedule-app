# Ticket DEV0023: Minimal shared activity feed

- Status: Cancelled
- Created: 2026-09-20
- Last updated: 2026-10-03
- Milestone: M4 minimal community loop
- Coordination: [COR0007 — Core multi-gym membership MVP](../organisatory/COR0007-core-multigym-membership-mvp.md)
- Related records: planned by completed [DEV0022 — Social contract and delivery plan](../../archive/backend/DEV0022-social-contract-and-delivery-plan.md); narrowed by completed [DEV0069 — Adopt core multi-gym membership MVP](../../archive/organisatory/DEV0069-adopt-core-multigym-membership-mvp.md); depends on completed identity/protected-context work, the participating-gym catalogue in [COR0006](../organisatory/COR0006-persistent-access-catalogue.md), and COR0007's not-yet-created verified membership check-in ticket; the former pass source [DEV0018](../../archive/backend/DEV0018-class-pass-reservations-and-confirmed-visits.md) is cancelled history

## Objective and context

Replace the fixture-based For you/Following feed with a small chronological activity surface tied only to real verified gym participation. A second authenticated user can follow a person, see an explicitly shared staff-confirmed included or member-priced check-in, and open the participating gym's public page without receiving access automatically.

The 24 September 2026 product pivot removed Cheer reactions and challenge activity. The 25 September multi-gym pivot also removed passes, resale and ordinary/sponsored events. This ticket preserves the useful discovery/retention loop without becoming a general-purpose social network. Follow [section 10](../../../docs/mvp-spec.md#10-social-behavior-and-permissions), M4 and acceptance A17–A19.

## Scope and non-goals

- In scope: one-way follows; capability-owned feed/profile projection repositories and services; Community/Following chronological queries; stable cursor pagination; owner share/hide controls; safe public gym links; empty/loading/error states; and two-user privacy/idempotency integration for verified membership check-ins.
- Out of scope: reactions/counts, `activity_reactions`, comments, messages, notifications, free-form posts, friend requests, ranking, challenges, transfers, passes/resale, events/sponsorship, business announcements, new financial/attendance authority or automatic sharing. Consume verified included and member-priced check-ins from their owning COR0007 peer.

## Expected behavior and edge cases

Community contains visible same-dataset activity permitted to the viewer; Following contains visible activity by followed authors. The owner's permitted items may appear on their profile. Items are newest-first with deterministic tie-breaking; hiding or source-state correction updates/removes the item without promoting it.

Publication requires a persisted visible sharing choice and a verified staff-confirmed check-in. A plan draft, gym selection, wallet prompt, pending/failed activation or payment, reservation, rejected check-in or unconfirmed attendance creates no participation item. Retried or out-of-order delivery cannot duplicate or restore hidden items.

Guest, cross-dataset, revoked and hidden access reveal no personal activity or private receipt, wallet, membership allowance or allocation detail. Sign-out clears personalized caches while public catalogue routes remain usable. Opening a gym source link does not grant membership, reservation or attendance.

## Assumptions, decisions, and dependencies

The current browser preview has no secure shared feed. Existing identity/protected-context work supplies the actor boundary, COR0006 supplies public gym sources, and COR0007's membership check-in peer must expose durable verified source IDs plus sharing choices before this ticket can consume them. No Supabase Realtime dependency is required; ordinary revalidation is sufficient for the MVP.

The pivot deliberately removes reactions rather than merely hiding their controls. Do not create a reaction table/API or return placeholder counts.

## Implementation plan

1. Review delivered actor/run/source contracts and freeze the safe activity projection plus source visibility rules.
2. Add the activity/delivery schema, same-dataset constraints, stable chronological indexes and parent-aware row-level security; do not add reaction storage.
3. Implement authenticated Community/Following/profile projections and idempotent source publication/hide behavior using verified actor context.
4. Integrate accessible feed/profile states and public source links, preserving an explicit preview/database boundary and no fabricated shared activity on backend failure.
5. Validate two-user follows, ordering ties, retries/out-of-order work, hide/revoke/sign-out privacy, source independence and mobile/desktop keyboard flows.

## Acceptance criteria

- [ ] AC1: Community and Following implement same-dataset author/visibility scope and stable newest-first pagination, including empty feeds and timestamp ties; A17.
- [ ] AC2: Only explicitly shared verified source facts publish, exactly once across retry/out-of-order delivery; draft/pending/failed/unaccepted states do not publish; A18.
- [ ] AC3: Anonymous, cross-dataset, revoked, hidden and restricted feed/profile/source access fails without leaking activity, receipts or wallet data; sign-out clears personalized state; A19.
- [ ] AC4: A user follows another member, sees a genuine shared verified check-in and opens the public gym source to explore it. No link grants membership, reservation or attendance.
- [ ] AC5: No reaction schema/API/control/count or challenge activity exists. Database-mode errors remain honest, and relevant database/domain/browser/lint/type/build checks pass.

## Validation plan

Run migrated PostgreSQL constraints/authorization/idempotency tests with two authenticated users, an anonymous context and another dataset. Cover follow/unfollow, pagination ties, publication retry/lost response, delayed visibility changes, hide/remove/sign-out and source correction. Exercise keyboard controls and error/empty states at mobile/desktop widths. Run applicable database checks plus `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` and affected `npm run test:e2e` cases. No Devnet transaction is required for the feed itself; the membership/check-in owners retain their own financial and participation evidence.

## Implementation record

Not started. The 24 September 2026 planning revision removed the former Cheer table/services/UI, challenge-source dependency and reaction concurrency acceptance. No runtime/schema change was made by that revision.

### Changes and rationale

Pending implementation.

### Affected files

Planned: capability-owned activity migration/schema/repository/services, existing Feed/profile presentation and focused database/browser tests. Record actual paths during implementation.

### Decisions and deviations

- 2026-09-24: User removed reactions and challenge mode. The ticket was narrowed before implementation; its ID and planning history remain, while its filename/title now reflect the current deliverable.
- 2026-09-25: User retained the minimal social network but removed transfer, standalone passes/resale and ordinary/sponsored events. The only current source is an explicitly shared verified multi-gym membership check-in.

### Contracts, configuration, and operations

Planned activity projection/feed query contracts only. No reaction record, provider or environment variable is planned.

## Validation results

Not run — no implementation. Planning/link checks do not satisfy AC1–AC5.

## Risks, limitations, and follow-ups

This ticket cannot invent source truth. It stays Draft until the COR0007 membership check-in source exists and the actor/follow boundary is ready. Completing it does not implement memberships, payments, reservations, check-in authority or gym allocation.

## Completion and review references

- Completed: Cancelled on 2026-10-03. The coach-first contract does not publish gym-check-in activity; [DEV0100](../../current/backend/DEV0100-coach-follows-and-chronological-posts.md) replaces this unimplemented plan with coach follows and coach-authored posts.
- Commit: Not created.
- Review: Planning self-review only; no independent review.
- Deployment or release: None.
