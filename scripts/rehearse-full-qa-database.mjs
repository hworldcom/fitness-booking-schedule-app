/** Full database QA in disposable databases; the retained local database is read only. */
import assert from "node:assert/strict";
import {
  assertLocalSupabaseConfiguration,
  LOCAL_SUPABASE_DATABASE_CONTAINER,
} from "./lib/local-supabase-project.mjs";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const container = LOCAL_SUPABASE_DATABASE_CONTAINER;
const tag = randomUUID().replaceAll("-", "").slice(0, 8);
const docker = (args, input) =>
  execFileSync(
    "docker",
    ["exec", ...(input ? ["-i"] : []), container, ...args],
    {
      input,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
const sql = (db, input, owner = "supabase_admin") =>
  docker(
    [
      "psql",
      "-X",
      "-qAt",
      "-U",
      owner,
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
    ],
    input,
  );
const infra = docker([
  "pg_dump",
  "-U",
  "supabase_admin",
  "-d",
  "postgres",
  "--schema-only",
]);
const groups = {
  dev0336: [],
  dev0331: ["coach-public-urls"],
  dev0321: ["coach-website"],
  dev0314: ["coach-reviews"],
  dev0313: ["coach-starting-rates"],
  dev0342: [
    "session-types",
    "typed-sessions",
    "legacy-session-type-compatibility",
    "group-calendar-session-types",
  ],
  dev0347: ["demo-coach-urls"],
  dev0349: ["demo-coach-retirement"],
  dev0356: ["event-banners"],
};
const special = new Set(Object.values(groups).flat());
if (process.env.QA_GROUP)
  assert.ok(Object.hasOwn(groups, process.env.QA_GROUP), "Unknown QA group");
groups.dev0336 = readdirSync("tests/database")
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => f.replace(".test.ts", ""))
  .filter((f) => !special.has(f));
let failed = false;
for (const [prefix, tests] of Object.entries(groups).filter(
  ([p]) => !process.env.QA_GROUP || p === process.env.QA_GROUP,
)) {
  if (process.env.QA_TESTS)
    tests.splice(0, tests.length, ...process.env.QA_TESTS.split(","));
  const db = `${prefix}_qa0367_${tag}`;
  assert.match(db, /^dev[0-9]{4}_qa0367_[a-f0-9]{8}$/);
  assert.ok(
    tests.every(
      (t) =>
        /^[a-z-]+$/.test(t) &&
        readdirSync("tests/database").includes(t + ".test.ts"),
    ),
    "Unknown database test",
  );
  let created = false;
  try {
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", db]);
    created = true;
    sql(db, infra + "\nDROP SCHEMA app CASCADE;\n");
    for (const file of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      sql(db, readFileSync(`supabase/migrations/${file}`, "utf8"), "postgres");
    sql(db, readFileSync("supabase/seed.sql", "utf8"), "postgres");
    console.log(`DATABASE GROUP ${prefix}: ${tests.join(", ")}`);
    const r = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        ...tests.map((f) => `tests/database/${f}.test.ts`),
      ],
      {
        env: {
          ...process.env,
          DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${db}`,
        },
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        timeout: 600_000,
      },
    );
    process.stdout.write(r.stdout ?? "");
    process.stderr.write(r.stderr ?? "");
    if (r.status !== 0) failed = true;
    console.log(`DATABASE GROUP ${prefix}: exit ${r.status}`);
  } catch (e) {
    failed = true;
    console.error(e.stderr?.toString().slice(-3000) || e.message);
  } finally {
    if (created) docker(["dropdb", "-U", "supabase_admin", "--force", db]);
  }
}
process.exitCode = failed ? 1 : 0;
