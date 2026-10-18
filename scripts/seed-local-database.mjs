import { readFile } from "node:fs/promises";
import postgres from "postgres";

const localDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const seedPath = new URL("../supabase/seed.sql", import.meta.url);
const connection = postgres(localDatabaseUrl, {
  max: 1,
  prepare: false,
  ssl: false,
});

try {
  const seedSql = await readFile(seedPath, "utf8");
  await connection.unsafe(seedSql);
  console.log(
    "Seed bootstrap complete. Existing foundation datasets are preserved.",
  );
} catch (error) {
  const message =
    error instanceof Error
      ? error.message.replaceAll(localDatabaseUrl, "[redacted]")
      : "Unknown database error";
  console.error(`Local database seed failed: ${message}`);
  process.exitCode = 1;
} finally {
  await connection.end({ timeout: 5 });
}
