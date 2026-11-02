// DEV0369: isolated current-source public browser validation; no retained seed or reset.
import assert from "node:assert/strict";
import { verifiedDatabaseFingerprints } from "./lib/database-fingerprints.mjs";
import { execFileSync, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { readFileSync, readdirSync, openSync, closeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
const unavailable = process.argv.includes("--unavailable");
assert.ok(process.argv.slice(2).every((x) => x === "--unavailable"));
const tag = randomUUID().replaceAll("-", ""),
  root = process.cwd(),
  scratch = await mkdtemp(path.join(tmpdir(), "mov-public-")),
  name = "movpublic_" + tag,
  output = path.join(root, "test-results/public-browser", tag);
await mkdir(output, { recursive: true, mode: 0o700 });
let created = false;
const docker = (args, input) =>
  execFileSync(
    "docker",
    [
      "exec",
      ...(input === undefined ? [] : ["-i"]),
      "supabase_db_movx-club-local",
      ...args,
    ],
    {
      input,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
const q = (db, input) =>
  docker(
    [
      "psql",
      "-X",
      "-qAt",
      "-U",
      "supabase_admin",
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
    ],
    input,
  );
const hashes = `select jsonb_object_agg(name,hash)from(select schemaname||'.'||tablename name,(xpath('/table/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)::text,''[]''))hash from %I.%I x',schemaname,tablename),false,false,'')))[1]::text hash from pg_tables where schemaname='app'or(schemaname='auth'and tablename='users')or(schemaname='storage'and tablename in('buckets','objects')))s;`;
const before = verifiedDatabaseFingerprints(q("postgres", hashes));
const roles = q(
  "postgres",
  "select md5(jsonb_agg(to_jsonb(r) order by oid)::text) from pg_authid r;",
);
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter((n) => n && (!n.startsWith(".env") || n.endsWith(".example")));
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k]) =>
      !/MUX|SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|RESEND|NOTIFICATION|CRON_SECRET|SMTP|GEOAPIFY|OPENAI_API_KEY/.test(
        k,
      ),
  ),
);
env.NEXT_TELEMETRY_DISABLED = "1";
if (!unavailable) {
  const status = Object.fromEntries(
    execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split(/\r?\n/)
      .flatMap((line) => {
        const m = /^([A-Z_]+)="(.*)"$/.exec(line);
        return m ? [[m[1], m[2]]] : [];
      }),
  );
  Object.assign(env, {
    NEXT_PUBLIC_SITE_URL: "http://localhost:3101",
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  });
  assert.ok(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
try {
  await writeFile(
    path.join(output, "recovery.json"),
    JSON.stringify({ name: unavailable ? null : name, scratch, owned: true }),
    { mode: 0o600 },
  );
  if (!unavailable) {
    docker(["createdb", "-U", "supabase_admin", "-O", "postgres", name]);
    created = true;
    const infrastructure = docker([
      "pg_dump",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "--schema-only",
    ]);
    q(name, infrastructure + "\nDROP SCHEMA app CASCADE;");
    for (const file of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      q(name, readFileSync("supabase/migrations/" + file, "utf8"));
    q(name, readFileSync("supabase/seed.sql", "utf8"));
    const fixture = JSON.parse(
      readFileSync("tests/fixtures/public-browser-directory.json", "utf8"),
    );
    assert.deepEqual(
      JSON.parse(
        q(
          name,
          "select json_agg(display_name order by display_name)from app.coach_profiles where visibility='visible';",
        ).trim(),
      ),
      fixture.coaches,
    );
    const loc = fixture.additionalLocation;
    assert.match(fixture.withoutPortrait, /^[a-z0-9-]+$/);
    q(
      name,
      "update app.coach_profiles set portrait_source=null,portrait_path=null,portrait_updated_at=null where public_slug='" +
        fixture.withoutPortrait +
        "'; update app.profiles set avatar_storage_path=null,avatar_updated_at=null where id in(select profile_id from app.coach_profiles where public_slug='" +
        fixture.withoutPortrait +
        "');",
    );
    assert.match(loc.coachSlug, /^[a-z0-9-]+$/);
    assert.ok(Number.isFinite(loc.latitude) && Math.abs(loc.latitude) <= 90);
    assert.ok(Number.isFinite(loc.longitude) && Math.abs(loc.longitude) <= 180);
    q(
      name,
      "insert into app.coach_training_locations(run_id,profile_id,public_name,timezone,location_kind,public_location_label,latitude,longitude,location_source,location_confirmed_at,status,is_primary,sort_order,record_source)select run_id,profile_id,'Chimosa',timezone,'independent','Temporary second public-browser fixture venue'," +
        loc.latitude +
        "," +
        loc.longitude +
        ",'fixture',now(),'active',false,2,'fixture'from app.coach_profiles where public_slug='" +
        loc.coachSlug +
        "';",
    );
    console.log(
      "PASS isolated current-chain canonical public fixture; retained data not seeded",
    );
  }
  for (const file of files) {
    await mkdir(path.dirname(path.join(scratch, file)), { recursive: true });
    await cp(path.join(root, file), path.join(scratch, file));
  }
  execFileSync("/bin/cp", [
    "-cR",
    path.join(root, "node_modules"),
    path.join(scratch, "node_modules"),
  ]);
  for (const script of unavailable
    ? ["build", "test:e2e"]
    : ["lint", "typecheck", "format:check", "build", "test:e2e"]) {
    try {
      const fd = openSync(
        path.join(output, script.replace(":", "-") + ".log"),
        "w",
        0o600,
      );
      const child = spawn(
        "npm",
        [
          "run",
          script,
          ...(script === "test:e2e" && unavailable
            ? [
                "--",
                "tests/browser/explore-unavailable.spec.ts",
                "tests/browser/public-story.spec.ts",
              ]
            : []),
        ],
        {
          cwd: scratch,
          env:
            script === "build" || unavailable
              ? env
              : {
                  ...env,
                  DATABASE_URL:
                    "postgresql://repx_runtime_login:postgres@127.0.0.1:55322/" +
                    name,
                },
          stdio: ["ignore", fd, fd],
        },
      );
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
      closeSync(fd);
      assert.equal(code, 0, script);
      console.log("PASS seeded public " + script);
    } catch {
      await cp(
        path.join(scratch, "test-results"),
        path.join(output, "test-results"),
        { recursive: true },
      ).catch(() => {});
      throw Error("Failed seeded public " + script + "; inspect evidence");
    }
  }
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify({
      passed: true,
      database: created ? name : null,
      seededFixture: !unavailable,
      configurationFree: unavailable,
    }),
    { mode: 0o600 },
  );
} finally {
  if (created) docker(["dropdb", "-U", "supabase_admin", name]);
  assert.equal(verifiedDatabaseFingerprints(q("postgres", hashes)), before);
  assert.equal(
    q(
      "postgres",
      "select md5(jsonb_agg(to_jsonb(r) order by oid)::text) from pg_authid r;",
    ),
    roles,
  );
  console.log(
    "PASS exact public-suite scratch database removed; retained hashes unchanged",
  );
  await rm(scratch, { recursive: true, force: true });
  console.log("Evidence: " + output);
}
