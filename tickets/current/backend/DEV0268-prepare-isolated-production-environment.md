# Ticket DEV0268: Prepare the isolated production environment

- Status: Draft
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Hosted environment separation
- Coordination: [COR0026 — Separate hosted dev and production](../organisatory/COR0026-separate-hosted-dev-and-production.md)
- Related records: prerequisite [DEV0266](../../archive/backend/DEV0266-guard-hosted-environment-selection.md) and dev proof [DEV0267](../../archive/backend/DEV0267-connect-new-hosted-dev-environment.md); historical staging [DEV0055](DEV0055-hosted-supabase-staging-environment.md).

## Objective and context

Prepare confirmed `movx-prod` (`yltijwebedkraypgkqmc`, Frankfurt) as the independent production target after dev verification. The user created and identified this project. Follow [infrastructure boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries) and [identity/data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity). This planning record does not authorize or claim live publication.

## Scope and non-goals

- In scope: a reviewed production-state preflight and bootstrap plan, production-only restricted runtime credential and Auth/domain setup, no demonstration seed, exact Vercel Production setting handoff and actual isolated verification.
- Out of scope: demo fixtures or dev-user/file copying, old database resets, destructive ledger repair, provider/authentication feature changes, DNS, external sends and live deployment.

## Expected behavior and edge cases

Production never receives the dev runtime connection, public key, test identities or seed. Unknown/existing schema requires its own reviewed compatible transition. Migration-owner credentials remain separate from app runtime credentials. Exact production site/redirect/SMTP settings and recovery must be known before associated operations; no wildcard origin or invented email proof substitutes for that evidence.

## Assumptions, decisions, and dependencies

Draft until DEV0267 proof passes and production bootstrap/credential/origin operations are concrete. User confirmed project mapping; the CLI sees `movx-prod`, `ACTIVE_HEALTHY`, `eu-central-1`. No production database/settings were changed. This is independent from existing historical staging acceptance.

## Implementation plan

1. Inspect target state read-only and record the exact reviewed schema/runtime/Auth/secret-storage/recovery plan before edits.
2. Apply the current accepted migration revision without demonstration seed; provision the production-only restricted login and origin-specific Auth/deployment settings.
3. Verify schema/history, independent project/roles/data, runtime permissions and configured production behavior, then provide the concrete deployment handoff. Do not publish automatically.

## Acceptance criteria

- [ ] AC1: Production has the accepted schema/history and its independent restricted runtime configuration, with no dev/demo data or other-target writes.
- [ ] AC2: Exact production origins/Auth/SMTP and deployment settings are verified with truthful evidence and documented recovery; no live publication is implied.

## Validation plan

Actual target preflight, migration/catalog/runtime checks, project-mismatch refusal and origin/Auth verification without destructive shared-suite fixtures. Final commands and allowed test identities must be settled before implementation. Documentation checks alone do not satisfy either criterion.

## Implementation record

### Changes and rationale

Not started — production is unchanged during dev setup.

### Affected files

Not selected; expected production settings and the operation/handoff record only, consuming DEV0266 tooling.

### Decisions and deviations

No production demonstration seed, account transfer or automatic deployment.

### Contracts, configuration, and operations

None changed. Requires concrete migration, credential/origin and recovery contracts before implementation.

## Validation results

Read-only CLI project listing confirms public reference/name/region/healthy status. Database/Auth/runtime checks not run.

## Risks, limitations, and follow-ups

The user selected `https://movx.club` as the planned production origin on 2026-10-16. SMTP/operator credential storage and actual deployment remain unspecified. Keep this record open until its evidence exists; no current production release is claimed.

## Completion and review references

- Completed: Not completed.
- Commit: Planning record included with `[DEV0266][DEV0267][DEV0269] Use hosted Supabase dev for local development`; no DEV0268 production implementation is committed or claimed.
- Review: Planning/discovery self-review only.
- Deployment or release: None; production unchanged.
