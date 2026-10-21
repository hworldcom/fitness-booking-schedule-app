# MovX work records

Live development work is in [Linear workspace movx](https://linear.app/movx), [team MOV](https://linear.app/movx/team/MOV/all). Use the connected Linear tools to search, read, create and update issues. Development issues own implementation and validation evidence; coordination projects group peer issues. [AGENTS.md](../AGENTS.md) defines the workflow. The [MVP specification](mvp-spec.md) remains the product contract.

## Finding existing records

- Search Linear for a legacy ID such as `DEV0287` or `COR0027`. Imported issue/project titles retain those IDs. The initial import contains 49 open development tickets and 9 coordination records, plus this migration's active records.
- Completed Markdown history and all original supporting files are in the private [hworldcom/movx-work-records repository](https://github.com/hworldcom/movx-work-records). Its [ID index](https://github.com/hworldcom/movx-work-records/blob/main/INDEX.md) resolves all 323 original records. GitHub access requires an authorized account.
- [linear-map.json](https://github.com/hworldcom/movx-work-records/blob/main/linear-map.json) maps imported legacy IDs/source paths to native MOV identifiers and URLs. [Migration records](https://github.com/hworldcom/movx-work-records/tree/main/migration-records) contain backup, import and cutover evidence (DEV0406–DEV0408/COR0035).
- The original [ticket index](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/README.md) preserves retired, pruned and reserved ID registers. Previously pruned content remains governed by its recorded exceptions and Git history.

## Identifiers and new work

New development issues receive native `MOV-<number>` identifiers automatically. Create one before implementation and write its plan/acceptance criteria; use a Linear project for coordination. The preserved [development template](https://github.com/hworldcom/movx-work-records/blob/main/originals/tickets/TEMPLATE.md) and [coordination template](https://github.com/hworldcom/movx-work-records/blob/main/originals/tickets/COORDINATION_TEMPLATE.md) provide record fields, with their old path/numbering examples adapted to Linear.

DEV and COR allocation is frozen after DEV0408 and COR0035. All legacy identifiers, including retired/pruned/reserved numbers and gaps, are unavailable for new allocation. Existing imported work retains its legacy identity and `[DEVNNNN]` commit subject until finished; new work uses `[MOV-<number>]`. Coordination identifiers never belong in commit subjects. Include the live issue URL in pull requests and finish its evidence before committing.

## Preservation and recovery

The immutable original snapshot contains 334 Markdown files (5,288,713 bytes), with original paths, full content and SHA-256 hashes. It was downloaded from the private remote and fully verified after publication. The backup repository's `manifest.json`, `scripts/verify_snapshot.py` and README document verification and restore. A sibling checkout is available locally at `/Users/hoangdeveloper/movx-work-records`; the remote repository is the durable backup.

To recover the original ticket tree, clone the private archive, run `python3 scripts/verify_snapshot.py`, then `python3 scripts/verify_snapshot.py --restore /new/empty/directory`. The target must not exist, preventing accidental overwrites. Restoring the old contributor workflow requires reviewing the application changes from this cutover as well.

The backup is a verified migration snapshot, not a scheduled export of future Linear changes. No recurring backup has been configured. Do not delete old Linear issues to manage quota; decide archival or plan changes in separate work when needed. Removing the directory reduces the current checkout; existing application Git history remains intact.
