import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import {
  LOCAL_SUPABASE_DATABASE_CONTAINER,
  assertLocalSupabaseConfiguration,
} from "./lib/local-supabase-project.mjs";

assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const created = [];
const target = "20261018000600_public_coach_usernames.sql";
const migrations = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f <= target)
  .sort();
assert.equal(migrations.at(-1), target);
function docker(args, input) {
  return execFileSync(
    "docker",
    [
      "exec",
      ...(input === undefined ? [] : ["-i"]),
      LOCAL_SUPABASE_DATABASE_CONTAINER,
      ...args,
    ],
    {
      input,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}
function psql(database, input) {
  assert.match(database, /^dev0349_[a-z0-9_]+$/);
  return docker(
    [
      "psql",
      "-X",
      "-qAt",
      "-U",
      "supabase_admin",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
    ],
    input,
  );
}
const infrastructure = docker([
  "pg_dump",
  "-U",
  "supabase_admin",
  "-d",
  "postgres",
  "--schema-only",
]);
try {
  // Two independent clean installations prove that recreation reproduces the
  // same defaults without a retained database reset or private tester journal.
  for (const mode of ["retirement", "empty"]) {
    const database = `dev0349_${suffix}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    console.log(`Preparing owned disposable database ${database}.`);
    psql(database, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    psql(
      database,
      migrations
        .map((file) => readFileSync(`supabase/migrations/${file}`, "utf8"))
        .join("\n"),
    );
    if (mode !== "empty")
      psql(database, readFileSync("supabase/seed.sql", "utf8"));
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        "tests/database/demo-coach-retirement.test.ts",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DEMO_RETIREMENT_EMPTY: mode === "empty" ? "1" : "0",
          DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${database}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    process.stdout.write(output);
    console.log(`Passed DEV0349 ${mode} fictional coach retirement checks.`);
  }
} catch (error) {
  console.error("Demo retirement disposable database rehearsal failed.");
  if (error?.stdout) console.error(String(error.stdout));
  if (error?.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  for (const database of created.reverse()) {
    try {
      docker(["dropdb", "-U", "supabase_admin", database]);
      console.log(`Removed ${database}.`);
    } catch {
      console.error(
        `Cleanup failed for owned disposable database ${database}.`,
      );
      process.exitCode = 1;
    }
  }
}
