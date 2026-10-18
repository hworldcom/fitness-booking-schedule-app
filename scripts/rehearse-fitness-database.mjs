import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  assertLocalSupabaseConfiguration,
  LOCAL_SUPABASE_DATABASE_CONTAINER,
} from "./lib/local-supabase-project.mjs";
import { seedBeforeFitness } from "./lib/seed-compatibility.mjs";
import { fitnessDemoCoachSeedSql } from "./lib/demo-coach-seed.mjs";
assertLocalSupabaseConfiguration(readFileSync("supabase/config.toml", "utf8"));
const target = "20261018000500_fitness_discipline.sql";
const migrations = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql") && file <= target)
  .sort();
assert.equal(migrations.at(-1), target);
const docker = (args, input) =>
  execFileSync(
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
function psql(database, input) {
  assert.match(database, /^dev0336_[a-z0-9_]+$/);
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
const seed = readFileSync("supabase/seed.sql", "utf8");
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const created = [];
try {
  for (const mode of ["fresh", "upgrade"]) {
    const database = `dev0336_${suffix}_${mode}`;
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", database]);
    created.push(database);
    psql(database, infrastructure + "\nDROP SCHEMA app CASCADE;\n");
    for (const file of migrations.filter((file) => file !== target))
      psql(database, readFileSync("supabase/migrations/" + file, "utf8"));
    if (mode === "upgrade") psql(database, seedBeforeFitness(seed));
    const previous =
      mode === "upgrade"
        ? psql(
            database,
            "select md5(jsonb_agg(to_jsonb(c) order by profile_id)::text) from app.coach_profiles c;",
          )
        : null;
    psql(database, readFileSync("supabase/migrations/" + target, "utf8"));
    if (previous)
      assert.equal(
        psql(
          database,
          "select md5(jsonb_agg(to_jsonb(c) order by profile_id)::text) from app.coach_profiles c;",
        ),
        previous,
      );
    if (mode === "fresh") {
      psql(
        database,
        `insert into app.profiles(id,slug,display_name,initials,bio,avatar_color,record_source)
        values('10000000-0000-4000-8000-000000000002','daniel-park','Preserved partial fixture','PF','Retained content','blue','fixture');`,
      );
      assert.throws(
        () => psql(database, seed),
        /Partial demo foundation requires explicit repair/,
      );
      assert.equal(
        psql(database, "select count(*) from app.demo_runs;"),
        "0\n",
      );
      assert.equal(
        psql(
          database,
          "select display_name from app.profiles where id='10000000-0000-4000-8000-000000000002';",
        ),
        "Preserved partial fixture\n",
      );
      psql(
        database,
        "delete from app.profiles where id='10000000-0000-4000-8000-000000000002';",
      );
    }
    // Retained datasets are never reseeded; this is the explicitly scoped new fixture.
    psql(database, mode === "upgrade" ? fitnessDemoCoachSeedSql(seed) : seed);
    assert.equal(
      psql(
        database,
        "select count(*) from app.coach_profiles where profile_id='10000000-0000-4000-8000-000000000013' and is_demo and visibility='visible';",
      ),
      "1\n",
    );
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--conditions=react-server",
        "--test",
        "--test-concurrency=1",
        "tests/database/fitness.test.ts",
        "tests/database/demo-coaches.test.ts",
        "tests/database/demo-preservation.test.ts",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_TEST_URL: `postgresql://postgres:postgres@127.0.0.1:55322/${database}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    process.stdout.write(output);
    console.log(
      `Passed ${mode} Fitness migration, seed and demo preservation; disposable database removed on exit.`,
    );
  }
} finally {
  for (const database of created.reverse())
    docker(["dropdb", "-U", "supabase_admin", "--force", database]);
}
