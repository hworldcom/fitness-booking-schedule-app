import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_SUPABASE_DATABASE_CONTAINER } from "./lib/local-supabase-project.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const container =
  process.env.BASELINE_DATABASE_CONTAINER ?? LOCAL_SUPABASE_DATABASE_CONTAINER;
if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(container))
  throw new Error("Invalid local database container name.");
const history = resolve(root, "supabase/migration-history/20261016000100");
const manifest = JSON.parse(
  readFileSync(resolve(history, "manifest.json"), "utf8"),
);
const baseline = readFileSync(
  resolve(root, "supabase/migrations/20261016000100_baseline.sql"),
  "utf8",
);
const seed = readFileSync(resolve(root, "supabase/seed.sql"), "utf8");
const created = [];
const options = { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };
function docker(args, input) {
  return execFileSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    {
      ...options,
      input,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}
function psql(database, input, atomic = false, owner = "postgres") {
  return docker(
    [
      "psql",
      "-X",
      "-qAt",
      "-U",
      owner,
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      ...(atomic ? ["--single-transaction"] : []),
    ],
    input,
  );
}
function compare() {
  return execFileSync(
    process.execPath,
    [
      "scripts/database-baseline.mjs",
      "compare",
      "dev0265_replay",
      "dev0265_fresh",
    ],
    {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}
function expectedDifference(label, sql, restore, message) {
  psql("dev0265_fresh", sql, true);
  try {
    assert.throws(compare, (error) => error.stderr?.includes(message), label);
    console.log(`Detected injected ${label}.`);
  } finally {
    psql("dev0265_fresh", restore, true);
  }
}

try {
  console.log(
    execFileSync(
      process.execPath,
      ["scripts/database-baseline.mjs", "verify"],
      options,
    ).trim(),
  );
  // Schema only: never copy local users, tokens, file objects or application rows.
  const infrastructure = docker([
    "pg_dump",
    "-U",
    "supabase_admin",
    "-d",
    "postgres",
    "--schema-only",
  ]);
  const policyNames = [
    ...infrastructure.matchAll(/^CREATE POLICY (\S+) ON storage\.objects/gm),
  ]
    .map((match) => match[1])
    .filter((name) =>
      /^(?:account_avatars_|coach_portraits_)[a-z_]+$/.test(name),
    );
  const emptyInfrastructure =
    infrastructure +
    "\nSET row_security=on;\nDROP SCHEMA IF EXISTS app CASCADE;\n" +
    policyNames
      .map((name) => `DROP POLICY IF EXISTS ${name} ON storage.objects;`)
      .join("\n");
  for (const database of ["dev0265_replay", "dev0265_fresh"]) {
    // Refuse pre-existing names. Cleanup below only owns successful creations.
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    psql(database, emptyInfrastructure, false, "supabase_admin");
  }
  const replay = manifest.migrations
    .map(
      ({ file }) =>
        "BEGIN;\n" +
        readFileSync(resolve(history, file), "utf8") +
        "\nCOMMIT;\n",
    )
    .join("\n");
  psql("dev0265_replay", replay);
  psql("dev0265_fresh", baseline, true);
  for (const database of created) psql(database, seed, true);
  console.log(compare().trim());
  const before = psql(
    "dev0265_replay",
    "select md5(jsonb_agg(to_jsonb(t) order by id)::text) from app.profiles t;",
  );
  assert.throws(
    () => psql("dev0265_replay", baseline, true),
    (error) => error.stderr?.includes("Baseline requires an empty app schema"),
  );
  assert.equal(
    psql(
      "dev0265_replay",
      "select md5(jsonb_agg(to_jsonb(t) order by id)::text) from app.profiles t;",
    ),
    before,
  );
  console.log("Existing-schema baseline refusal preserved fixture rows.");
  expectedDifference(
    "CHECK constraint drift",
    "alter table app.profiles drop constraint profiles_display_name_length_check, add constraint profiles_display_name_length_check check(char_length(display_name) between 2 and 79);",
    "alter table app.profiles drop constraint profiles_display_name_length_check, add constraint profiles_display_name_length_check check(char_length(display_name) between 2 and 80);",
    "Baseline differs in parsed CHECK constraints",
  );
  expectedDifference(
    "function permission drift",
    "grant execute on function app.publish_group_session(uuid,integer) to authenticated;",
    "revoke execute on function app.publish_group_session(uuid,integer) from authenticated;",
    "Baseline schema/owner/ACL/default-privilege definitions differ",
  );
  console.log(compare().trim());
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--conditions=react-server",
      "--test",
      "tests/database/seed.test.ts",
    ],
    {
      ...options,
      env: {
        ...process.env,
        DATABASE_TEST_URL:
          "postgresql://postgres:postgres@127.0.0.1:55322/dev0265_fresh",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  console.log(
    "Complete seed and repeated-seed claimed/ordinary account preservation passed.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Baseline rehearsal failed.",
  );
  if (error?.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  if (process.env.BASELINE_KEEP_DATABASES === "1")
    console.log("Retained owned disposable databases:", created.join(", "));
  else
    for (const database of created.reverse()) {
      try {
        docker(["dropdb", "-U", "supabase_admin", database]);
      } catch {
        console.error(
          `Could not remove owned disposable database ${database}.`,
        );
        process.exitCode = 1;
      }
    }
}
