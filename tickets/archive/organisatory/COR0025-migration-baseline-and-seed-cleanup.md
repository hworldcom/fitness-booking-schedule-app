# Coordination COR0025: Migration baseline and seed cleanup

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Database maintenance before new hosted dev/UAT setup
- Converted from: Not applicable — groups the existing seed repair and a new baseline peer.
- Tracked development tickets: [DEV0249 seed repair](../backend/DEV0249-repair-legacy-seed-location-compatibility.md), [DEV0265 baseline](../backend/DEV0265-baseline-completed-database-migrations.md).
- Related records: external retained-database continuity [DEV0232](../../current/organisatory/DEV0232-restore-local-migration-continuity.md); historical hosted setup [DEV0055](../../current/backend/DEV0055-hosted-supabase-staging-environment.md); independent completed calendar backend [DEV0252](../backend/DEV0252-persist-effective-coach-availability.md).

## Objective and boundaries

Coordinate the user's authorized baseline/seed cleanup before creating a new Supabase environment. This record performs no implementation. Preserve the completed SQL history, produce an equivalent fresh-database baseline and make complete repeatable seeding work without restoring excluded products or changing current scheduling behavior.

## Direct development work

| Implementation part                                  | Development ticket                                                         | Owned deliverable                                                                                                                                                                                        | Start condition or dependency                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Complete and safe fixture seed                       | [DEV0249](../backend/DEV0249-repair-legacy-seed-location-compatibility.md) | Remove the unused incompatible legacy event fixture, preserve current fixture consumers and user-owned/claimed records, prove full and repeated seeding.                                                 | Consumer/retention review before seed edits.                    |
| Completed-history baseline and compatibility handoff | [DEV0265](../backend/DEV0265-baseline-completed-database-migrations.md)    | Immutable 53-file archive/manifest, equivalent fresh baseline including roles/grants/storage setup, reproducible generation/verification, affected path/document updates and legacy-environment handoff. | Fixed cutoff through DEV0238; full seed proof consumes DEV0249. |

All required direct peers exist. Each belongs only to this COR. They remain peers; neither is a child of the other.

## Other relationships

- DEV0232 owns unresolved branch-specific migration provenance and changes to the retained shared local ledger. This cleanup does not mark history reverted/applied, reset retained data or claim normal old-stack startup has been repaired. Existing hosted environments also require an explicit validated transition before using the new active migration stream.
- DEV0252 owns the separate `20261016000200` calendar migration and completed its local validation during this cleanup. Preserve its contents and keep it outside this frozen baseline; new forward migrations continue after the baseline cutoff. Its shared/hosted rollout is separate.
- New hosted dev/UAT/prod provisioning, transferring Auth identities/data/files, authentication changes and invitations are downstream work. No provider/project/account changes or external sends belong here.

## Delivery sequence and completion conditions

1. Review seed consumers and fix DEV0249 in an isolated completed-source snapshot/disposable database.
2. DEV0265 replays the 53 completed migrations, generates the final-state baseline, archives originals byte-for-byte and verifies schema/permission/storage equivalence plus full seed/database regressions.
3. Publish the repository layout and contributor/setup guidance together after validation. Preserve active calendar edits and unrelated work; no current database is reset or reconciled automatically.
4. Complete only after both direct peers pass and archive, original SQL checksums/links agree, full fresh and repeated seed pass, the baseline has no schema/security drift and existing-environment limitations are explicit. A missing retained-database transition remains DEV0232, not an implied completed outcome here.

## Progress and integration record

- 2026-10-16: User authorized baseline/seed cleanup after the review. Fixed the baseline cutoff at the 53 committed files through `20261016000100`; preserve active calendar work separately. Seed investigation found no consumer of the obsolete legacy event fixture; its table remains historical schema.
- 2026-10-16 delivery: DEV0249 removes only the obsolete fixture insert and preserves claimed-coach discipline/portrait edits. DEV0265 preserves the 53 originals and delivers the equivalent baseline plus reproducible verification and retained-ledger handoff. Their shared complete-seed proof passes; no implementation boundary is unowned.
- 2026-10-16 integration: after independent DEV0252 completion, the frozen baseline followed by its separate forward migration and full seed passes the current database suites. Calendar, invitation and session-note edits from other workspace sessions are preserved.

## Validation results

Both direct peers' acceptance records pass; detailed commands, failures/fixes and limitations are in DEV0249/DEV0265. Combined proof includes original-byte/hash preservation, 855 equivalent schema blocks with security/Storage setup, full original-replay/baseline seed, repeated claimed/ordinary-account preservation, existing-schema refusal and deliberate CHECK/ACL drift detection. Frozen regressions pass 115 drivers and 225 pgTAP assertions; baseline plus the completed calendar forward migration passes 124 drivers and 239 assertions with clean SQL lint. Static checks pass at the isolated completed source. Final links, index, metadata, archive hashes and scoped formatting/diff review complete the documentary handoff.

The shared retained local database's ordered ledger and user/file counts match the pre-work snapshot. No hosted project or retained ledger was changed. The old-ledger transition remains external DEV0232; it is not a missing direct deliverable or an implied completed outcome here.

## Risks, limitations, and follow-ups

Schema-only generation omits essential setup rows such as Storage buckets and does not transfer Auth users/files or hosted configuration. Keep required bootstrap data explicit. Retained migration ledgers and branch-only versions need provenance-aware transition; a baseline must not be executed over a populated `app` schema.

## Completion and review references

- Completed: 2026-10-16 — acceptance criteria and required validation passed; archived with the delivery handoff.
- Direct development tickets: DEV0249 and DEV0265 Completed and archived.
- Cleanup: All four owned disposable baseline databases removed after checks; retained/shared data and ledgers preserved.
- Commit: User authorized the peer delivery commit on 2026-10-16; owned by DEV0249/DEV0265. COR IDs are never commit subjects.
- Review: Planning/source self-review; no independent review.
- Deployment or release: None.
