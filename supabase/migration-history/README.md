# Preserved migration history

[20261016000100/manifest.json](20261016000100/manifest.json) records the ordered 53 original migration files, their SHA-256 checksums and committed source revision. Those SQL files are preserved byte-for-byte. They are outside Supabase's active `migrations/` scan and are historical upgrade/reference material, not a second migration stream for new databases.

[The active baseline](../migrations/20261016000100_baseline.sql) represents the final schema at that cutoff, with explicit role/extension and Storage bootstrap. Later migrations continue in `supabase/migrations/`; the independently developed calendar migration remains later than the cutoff. Baseline generation preserves existing historical tables and authority rather than pruning products or changing user data.

Run `node scripts/database-baseline.mjs verify` from the repository root to check the archive and generated-baseline checksums. Do not edit archived SQL. See [database operations](../README.md#migration-baseline-and-history) for reproducible comparison, new setup and existing-environment boundaries. [DEV0265](https://github.com/hworldcom/movx-work-records/blob/b49f60b2454b3de9345c395acbc08f324bcdabb3/originals/tickets/archive/backend/DEV0265-baseline-completed-database-migrations.md) owns the implementation and evidence.
