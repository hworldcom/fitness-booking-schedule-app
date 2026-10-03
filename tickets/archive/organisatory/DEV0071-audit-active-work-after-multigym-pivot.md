# Ticket DEV0071: Audit active work after multi-gym pivot

- Status: Completed
- Created: 2026-09-25
- Last updated: 2026-09-25
- Milestone: M0 work-record and project-state reconciliation
- Coordination: None — independent development ticket
- Related records: current product contract [DEV0069](DEV0069-adopt-core-multigym-membership-mvp.md) amended by [DEV0070](DEV0070-revise-multigym-plan-pricing.md); delivery coordination [COR0006](./COR0006-persistent-access-catalogue.md) and [COR0007](./COR0007-core-multigym-membership-mvp.md)

## Objective and context

Audit the current source, database documentation and every open work record after the product narrowed to one multi-gym membership. Keep active only the tickets that still support the current MVP, cancel/archive an optional post-MVP wallet idea that no longer belongs in the active queue, and leave a durable summary of implemented legacy state versus required next work.

Repository policy preserves completed and cancelled tickets as history, so “delete irrelevant tickets” means remove them from `tickets/current/` by cancelling and archiving them rather than erasing their record.

## Scope and non-goals

- In scope: inventory current tickets and runtime/product surfaces; classify each open record against the current specification; cancel/archive DEV0037; update all active references to its archived/cancelled status; correct the operational database README so obsolete transfer-oriented membership tables are not described as the current MVP; update the ticket index; summarize remaining relevant work and runtime gaps.
- Out of scope: deleting archived history; removing legacy application routes/code; changing database migrations or Drizzle schemas; creating the six missing COR0007 implementation tickets; changing wallet, Auth, deployment or product behavior; committing or deploying.

## Expected behavior and edge cases

After the audit, every development ticket under `tickets/current/` contributes directly to the multi-gym MVP or its required identity, wallet and staging infrastructure. DEV0037 is preserved as Cancelled history because embedded-wallet onboarding is optional post-MVP work, blocked on an external provider and unnecessary for the selected extension-based demo.

Coordination records may remain current when their direct implementation is still relevant or missing; they are not deleted merely because some peers completed. Existing transfer/pass/event code and migrations remain present until separately ticketed forward changes remove or replace them. Documentation must call those surfaces legacy rather than implying that this audit changed runtime behavior.

## Assumptions, decisions, and dependencies

- DEV0023 remains relevant because the user explicitly retained minimal social.
- DEV0041 and DEV0047 remain relevant prerequisites for distinct gym/member wallet actions.
- DEV0055 and DEV0056 remain relevant for persistent hosted staging and release rehearsal.
- COR0001–COR0004 remain relevant infrastructure coordination; COR0006/COR0007 are the active product delivery coordination.
- DEV0037 has no implementation or commit to preserve and can be cancelled cleanly. A future embedded-wallet decision would require a new ticket with current provider evidence.
- Legacy source/schema deletion requires dedicated implementation tickets and validation, not a documentation audit.

## Implementation plan

1. Inventory current DEV/COR status, scope and dependencies; scan source/routes/domain/schema/docs for removed product concepts.
2. Cancel/archive DEV0037 and retarget every repository link that pointed to its current path.
3. Update the ticket index/current summaries and the database operations guide's legacy membership-schema description.
4. Record the audit classification, material runtime gaps and next implementation sequence.
5. Validate current-ticket relevance, repository-local links/anchors, formatting and whitespace.

## Acceptance criteria

- [x] AC1: Every remaining current DEV ticket has a concrete relationship to the focused multi-gym membership MVP or its identity/wallet/staging prerequisites.
- [x] AC2: DEV0037 is Cancelled and archived with a clear reason, and all affected links/status references are updated.
- [x] AC3: Current documentation distinguishes obsolete transfer-oriented database/application state from the target contract without claiming source/schema cleanup occurred.
- [x] AC4: The audit records the remaining legacy source surfaces and a practical next-ticket sequence.
- [x] AC5: Current-ticket, Markdown link/anchor, formatting and whitespace checks pass.

## Validation plan

List every current DEV/COR record and manually map it to the specification. Search current tickets, source, tests and Supabase artifacts for transfer, pass, event, sponsorship and challenge concepts. Verify DEV0037 is absent from `tickets/current/`, present once in the archive and linked accurately. Run repository-local Markdown path/fragment checks, `git diff --check` and `npm run format:check`. Runtime tests are not applicable because this ticket changes records and explanatory documentation only.

## Implementation record

Completed the active-work and repository-state audit. One irrelevant open ticket was removed from the current queue by cancellation/archive; all other open records remain relevant.

### Active record classification

| Current record | Why it remains active                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| `DEV0023`      | Implements the explicitly retained minimal social feed from verified membership check-ins.              |
| `DEV0041`      | Supplies distinct gym-wallet authority required by direct gym payments and future financial operations. |
| `DEV0047`      | Supplies optional member-wallet ownership needed before member-approved Devnet payments.                |
| `DEV0055`      | Completes hosted database/Auth isolation evidence for persistent staging.                               |
| `DEV0056`      | Completes the public staging integration and hosted Auth/wallet rehearsal.                              |
| `COR0001`      | Still coordinates the missing trusted server-Solana and Anchor/program-client structural boundaries.    |
| `COR0002`      | Remains open for DEV0041 gym-wallet authority.                                                          |
| `COR0003`      | Remains open for DEV0047's real-wallet completion evidence.                                             |
| `COR0004`      | Remains open for DEV0055/DEV0056 staging acceptance.                                                    |
| `COR0006`      | Owns the required Basic/Classic plan and participating-gym catalogue replacement.                       |
| `COR0007`      | Owns the focused membership implementation and DEV0023 social integration.                              |

DEV0037 was the only unrelated open record. It proposed optional embedded Phantom onboarding after the hackathon, had no implementation, depended on unavailable Portal access and was unnecessary for the selected email-plus-external-wallet flow.

### Project-state summary

- **Delivered and reusable:** responsive Next.js preview foundations; email-code accounts and protected actor context; local/hosted Supabase foundations; browser Phantom connection; personal/gym wallet-linking code pending final real-wallet evidence; Cloudflare staging deployment foundation.
- **Legacy application surfaces:** the public metadata, Explore default/tabs, How it works, My Access, event routes, class/event features, event draft state and preview fixtures still describe classes, passes, events or transfers.
- **Legacy database surfaces:** DEV0067's private membership catalogue still has single-gym duration and transfer columns/constraints, the seed still contains Annual Unlimited/Flex 12 drafts, and the older foundation retains class/event tables. None supplies the target four-gym membership entitlement.
- **Not yet implemented:** published Basic/Classic catalogue, fictional five-gym fixtures, four-gym selection, membership period/activation payment, included check-ins, provisional allocation, direct €8 non-core visit, member/gym operational views and persistent minimal social.
- **Recommended sequence:** create the COR0007 frontend positioning/legacy-removal ticket first; create COR0006's additive plan/gym-eligibility schema ticket in parallel; then ticket membership activation, check-ins/allocation, non-core payment, gym/member views and finally DEV0023 integration.

### Changes and rationale

- Cancelled and archived DEV0037 instead of deleting history. A later embedded-wallet initiative must start from a new ticket and current provider evidence.
- Updated COR0001, COR0002, COR0003 and DEV0047 so none treats DEV0037 as active work.
- Retargeted archived DEV0027/DEV0038 links after moving DEV0037 and updated the root ticket index.
- Renamed the Supabase operations section to a legacy private catalogue foundation and stated that its transfer-oriented fields/drafts require an additive COR0006 replacement before publication.
- Audited current source, schema, migrations and tickets and recorded the reusable foundation, legacy surfaces, missing implementation and recommended delivery sequence above.

### Affected files

| File or component                                                                                                                                              | Change and purpose                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tickets/archive/blockchain/DEV0037-phantom-embedded-wallet-onboarding.md`                                                                                     | Cancels and archives optional post-MVP work with no implementation or commit.                                                              |
| `tickets/current/organisatory/COR0001-project-structure.md`, `COR0002-phantom-auth-and-demo-access.md`, `COR0003-account-first-identity-and-wallet-linking.md` | Removes DEV0037 from active dependencies/follow-ups while preserving the extension-first history.                                          |
| `tickets/current/backend/DEV0047-personal-wallet-linking-and-replacement.md`                                                                                   | Clarifies that embedded wallet creation is cancelled historical scope, not another active owner.                                           |
| `tickets/archive/blockchain/DEV0027-phantom-wallet-connection-foundation.md`, `tickets/archive/backend/DEV0038-phantom-supabase-web3-authentication.md`        | Retargets moved DEV0037 links and labels its eventual cancellation without rewriting delivered behavior.                                   |
| `tickets/README.md`                                                                                                                                            | Moves DEV0037 from current Blocked work to Cancelled history and registers this audit.                                                     |
| `supabase/README.md`                                                                                                                                           | Labels DEV0067's transfer schema/private drafts as legacy and requires an additive Basic/Classic multi-gym replacement before publication. |

### Decisions and deviations

- 2026-09-25: The user requested removal of tickets no longer relevant to the focused membership product. Repository history will be preserved through cancellation/archive rather than deletion.

### Contracts, configuration, and operations

No runtime interface, schema, dependency, environment variable, migration or deployment changed. This audit changes only work-record status/links and explanatory documentation. Existing legacy code and migrations remain replayable and require separate implementation tickets.

## Validation results

| Criterion                       | Evidence                                                                                                                                                                        | Result                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| AC1                             | Inventory of every current DEV/COR record with the classification table above; no remaining current ticket is post-MVP-only or tied solely to a removed product                 | Passed                                                               |
| AC2                             | `find tickets/current` plus repository-wide DEV0037 reference search; DEV0037 is absent from current, present once in archive and all Markdown links target its archived record | Passed                                                               |
| AC3–AC4                         | Targeted `rg` scan of `src`, `tests`, `supabase`, current tickets, README and the specification; legacy and missing surfaces recorded above and in `supabase/README.md`         | Passed                                                               |
| AC5 — whitespace                | `git diff --check`                                                                                                                                                              | Passed with no output                                                |
| AC5 — repository formatting     | `npm run format:check`                                                                                                                                                          | Passed; all configured application/source files match Prettier style |
| AC5 — Markdown paths            | Node audit over 93 Markdown files                                                                                                                                               | Passed; every repository-local target resolves                       |
| AC5 — Markdown fragments        | Node heading/explicit-anchor audit                                                                                                                                              | Passed; all local fragments resolve                                  |
| Runtime/database/browser checks | Not run — no executable, schema or migration artifact changed                                                                                                                   | Not applicable                                                       |

## Risks, limitations, and follow-ups

The source tree and database still contain legacy event, pass and transfer concepts. Leaving them in place during this ticket is intentional to avoid unreviewed destructive cleanup. COR0007 already identifies the public UI replacement; COR0006 identifies the additive catalogue schema revision. Additional concrete DEV tickets must be created before those implementation changes begin.

## Completion and review references

- Completed: 2026-09-25 — active records now contain only focused-MVP work and its required infrastructure; DEV0037 is Cancelled history.
- Commit: Not created.
- Review: Self-reviewed against AC1–AC5; no independent review.
- Deployment or release: Documentation only; none.
