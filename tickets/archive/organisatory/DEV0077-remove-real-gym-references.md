# Ticket DEV0077: Remove real-gym references

- Status: Completed
- Created: 2026-09-26
- Last updated: 2026-09-26
- Milestone: Repository privacy and fixture hygiene
- Coordination: None — independent development ticket
- Related records: corrective follow-up to completed [DEV0074](../frontend/DEV0074-preview-multigym-discovery.md)

## Objective and context

Remove the real fitness-business names, URLs and identifying street addresses that were retained as design-research notes or negative test literals during DEV0074. The user does not want those references published in the GitHub repository. Fictional gym identities and non-gym public map anchors remain unchanged.

## Scope and non-goals

- In scope: remove the identified real-gym references from the DEV0074 record and tests; retain a general automated guard against source-site or venue leakage; scan the tracked repository; update work records; commit the completed DEV0074 and DEV0077 changes.
- Out of scope: changing the seven fictional gyms, public cultural map anchors, product terms, UI behavior, database state, deployment or pushing commits.

## Expected behavior and edge cases

No tracked repository file contains the researched fitness-business names, domains or addresses. The fixture test still proves that fictional venue data carries no source attribution or external venue URL, without embedding the prohibited identifiers itself.

## Assumptions, decisions, and dependencies

- The request applies repository-wide to the identified fitness-business references, not only the one sentence in DEV0074, because the same names and addresses also appeared as test literals.
- Public museum, library and cultural-institution map anchors are intentionally retained because they are not gym identities and are explicitly labelled as non-venue references.
- No product-specification change is required.

## Implementation plan

1. Remove named source-site links and names from the archived DEV0074 record.
2. Replace named negative test literals with a generic fixture-provenance assertion.
3. Scan tracked content for the removed names, domains and addresses.
4. Run focused and standard validation, finish/archive this record and commit DEV0074 plus DEV0077.

## Acceptance criteria

- [x] AC1: The tracked repository contains none of the identified real fitness-business names, URLs or addresses.
- [x] AC2: Tests continue to enforce fictional fixture provenance without storing those identifiers.
- [x] AC3: Applicable tests, lint, typecheck, formatting and diff checks pass.

## Validation plan

Run a case-insensitive repository scan for the identified names, domains and addresses, then run `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check` and `git diff --check`. A new build and browser run are not required because this corrective change removes documentation/test literals without changing the already validated application implementation.

## Implementation record

Implementation started after the repository scan found one DEV0074 planning note and five negative test literals.

### Changes and rationale

Removed the named research references and replaced the named negative-test blacklist with structural fixture-provenance checks.

### Affected files

- [`tickets/archive/frontend/DEV0074-preview-multigym-discovery.md`](../frontend/DEV0074-preview-multigym-discovery.md) now describes only the fictional category mix and contains no external fitness-business attribution.
- `tests/explore.test.ts` (historical path `tests/explore.test.ts`) rejects external URLs and provenance/partner fields in gym fixtures without storing real-business identifiers.
- [`tickets/README.md`](../../README.md) tracks this corrective record and the next available DEV identifier.

### Decisions and deviations

- 2026-09-26: Expanded the cleanup from the ticket sentence to the matching test literals so the repository contains no hint of the researched gyms.

### Contracts, configuration, and operations

No runtime contract, dependency, configuration, environment variable, schema, migration or deployment change.

## Validation results

- Repository-wide case-insensitive scan for the user-identified fitness-business names, domains and addresses — passed with zero matches. The literal command is intentionally not stored because reproducing those identifiers would violate this ticket's objective.
- `npm test` — passed all 49 tests, including the generic fixture-provenance guard.
- `npm run lint` — passed.
- `npm run typecheck` — passed after Next.js route type generation.
- `npm run format:check` — passed.
- `git diff --check` — passed during final staged review.
- Build/browser checks — not rerun for DEV0077 because this correction changes only documentation and test literals; DEV0074's application build and desktop/mobile evidence remain current.

## Risks, limitations, and follow-ups

Generic words such as `gym`, `kickboxing`, `MMA` and `boutique` remain because they describe the fictional product categories, not a real business.

## Completion and review references

- Completed: 2026-09-26; the tracked repository no longer contains the removed real-gym references.
- Commit: This record is included with DEV0074 under subject `[DEV0074] [DEV0077] Add seven-gym discovery preview`.
- Review: Self-reviewed through a repository-wide identifier scan and the standard automated suite; no independent review.
- Deployment or release: Not applicable.
