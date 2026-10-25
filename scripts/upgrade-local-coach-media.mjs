// MOV-97: explicit retained-local upgrade, with private backup and preservation proof.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import path from "node:path";
import postgres from "postgres";
import {
  assertLocalSupabaseConfiguration,
  LOCAL_SUPABASE_DATABASE_CONTAINER as container,
} from "./lib/local-supabase-project.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 1 && ["--check", "--apply"].includes(args[0]),
  "Choose --check or --apply.",
);
const root = process.cwd();
assertLocalSupabaseConfiguration(
  await readFile("supabase/config.toml", "utf8"),
);
const adminUrl =
  "postgresql://supabase_admin:postgres@127.0.0.1:55322/postgres";
const database = postgres(adminUrl, {
  max: 1,
  prepare: false,
  ssl: false,
  onnotice: () => {},
});
const workerName = "repx_media_worker_login";
const files = (await readdir("supabase/migrations"))
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort();
assert.equal(
  files.at(-1),
  "20261025000100_coach_training_media.sql",
  "Review new migrations before reusing this bounded upgrade.",
);
const output = path.join(
  root,
  "test-results/local-coach-media-upgrade",
  randomUUID(),
);
let phase = "read-only preflight",
  restoreDatabase;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function docker(args, input) {
  return execFileSync(
    "docker",
    ["exec", ...(input === undefined ? [] : ["-i"]), container, ...args],
    { input, maxBuffer: 128 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] },
  );
}
async function privateFile(name, value) {
  await writeFile(path.join(output, name), value, { mode: 0o600 });
}
const quoted = (name) => '"' + name.replaceAll('"', '""') + '"';
async function snapshot(sql, columns) {
  const result = [];
  for (const table of columns) {
    const projection = table.columns.map(quoted).join(",");
    const filter =
      table.schema === "storage" && table.table === "buckets"
        ? " where id<>'coach-gallery'"
        : "";
    const [row] = await sql.unsafe(
      `select count(*)::integer count,md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,'[]')) hash from (select ${projection} from ${quoted(table.schema)}.${quoted(table.table)}${filter}) r`,
    );
    result.push({ ...table, ...row });
  }
  return result;
}
function storageHashes() {
  return execFileSync(
    "docker",
    [
      "exec",
      "--workdir",
      "/mnt",
      "supabase_storage_movx-club-local",
      "find",
      ".",
      "-type",
      "f",
      "-exec",
      "sha256sum",
      "{}",
      "+",
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort();
}
async function verifyWorker(url) {
  const target = new URL(url);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "55322");
  assert.equal(target.pathname, "/postgres");
  assert.equal(target.username, workerName);
  const worker = postgres(url, {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  });
  try {
    const [role] =
      await worker`select rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole and not rolbypassrls and rolinherit and pg_has_role(current_user,'app_media_worker','member') and not pg_has_role(current_user,'app_runtime','member') and not pg_has_role(current_user,'app_owner','member') allowed from pg_roles where rolname=current_user`;
    assert.equal(
      role?.allowed,
      true,
      "Worker must have only dedicated media authority.",
    );
    await worker`select app.coach_media_worker_asset('00000000-0000-4000-8000-000000000000'::uuid)`;
    await assert.rejects(
      worker`select * from app.coach_media_assets`,
      (error) => error.code === "42501",
    );
  } finally {
    await worker.end({ timeout: 1 });
  }
}
try {
  const ledger =
    await database`select version from supabase_migrations.schema_migrations order by version`;
  const versions = ledger.map((r) => r.version);
  assert.deepEqual(
    versions,
    files.slice(0, versions.length).map((f) => f.slice(0, 14)),
    "Refuse unknown or gapped local history; never repair it here.",
  );
  const pending = files.slice(versions.length);
  const sources = new Map(
    await Promise.all(
      pending.map(async (file) => [
        file,
        await readFile(path.join("supabase/migrations", file), "utf8"),
      ]),
    ),
  );
  const [inventory] =
    await database`select (select count(*)::integer from app.coach_group_sessions where status<>'draft') events,(select count(*)::integer from app.coach_group_registrations) registrations`;
  if (pending.some((f) => f.startsWith("20261024000100")))
    assert.equal(
      inventory.registrations,
      0,
      "Historical group registrations need a separate reviewed transition.",
    );
  const envSource = await readFile(".env.local", "utf8");
  const env = parseEnv(envSource);
  if (env.COACH_MEDIA_DATABASE_URL)
    await verifyWorker(env.COACH_MEDIA_DATABASE_URL);
  console.log(
    JSON.stringify({
      pending: pending.map((f) => f.slice(0, 14)),
      preservedEvents: inventory.events,
      historicalRegistrations: inventory.registrations,
      workerConfigured: !!env.COACH_MEDIA_DATABASE_URL,
    }),
  );
  if (args[0] === "--check") process.exitCode = 0;
  else {
    const sockets = spawnSync(
      "lsof",
      ["-nP", "-iTCP:3100", "-sTCP:LISTEN", "-Fp"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    assert.ok(
      [0, 1].includes(sockets.status),
      "Cannot verify the local app is stopped.",
    );
    assert.equal(
      sockets.stdout.trim(),
      "",
      "Stop only the local app before applying this upgrade.",
    );
  }
  if (args[0] === "--apply") {
    await mkdir(output, { recursive: true, mode: 0o700 });
    phase = "private backup";
    const columns =
      await database`select c.table_schema schema,c.table_name "table",array_agg(c.column_name::text order by c.ordinal_position) columns from information_schema.columns c where (c.table_schema='app' or (c.table_schema='auth' and c.table_name='users') or (c.table_schema='storage' and c.table_name in ('buckets','objects'))) and exists(select 1 from pg_tables t where t.schemaname=c.table_schema and t.tablename=c.table_name) group by c.table_schema,c.table_name order by c.table_schema,c.table_name`;
    const before = await snapshot(database, columns);
    const roleHashes =
      await database`select rolname,md5(to_jsonb(r)::text) hash from pg_authid r order by rolname`;
    const bytesBefore = storageHashes();
    await privateFile(
      "database.dump",
      docker([
        "pg_dump",
        "-U",
        "supabase_admin",
        "-d",
        "postgres",
        "--format=custom",
      ]),
    );
    await privateFile(
      "roles.sql",
      docker(["pg_dumpall", "-U", "supabase_admin", "--globals-only"]),
    );
    await privateFile(
      "storage.tar",
      execFileSync(
        "docker",
        [
          "exec",
          "--workdir",
          "/mnt",
          "supabase_storage_movx-club-local",
          "tar",
          "-cf",
          "-",
          ".",
        ],
        { maxBuffer: 128 * 1024 * 1024 },
      ),
    );
    await privateFile("env.local.before", envSource);
    await privateFile(
      "before.json",
      JSON.stringify(
        { rows: before, roles: roleHashes, storage: bytesBefore, versions },
        null,
        2,
      ),
    );
    await privateFile(
      "recovery.json",
      JSON.stringify(
        {
          container,
          target: "127.0.0.1:55322/postgres",
          pending,
          hashes: Object.fromEntries(
            await Promise.all(
              pending.map(async (f) => [f, sha(sources.get(f))]),
            ),
          ),
        },
        null,
        2,
      ),
    );
    console.log(
      "Private database, role, environment and Storage backups saved.",
    );

    phase = "backup restore proof";
    restoreDatabase = "mov97_restore_" + randomUUID().replaceAll("-", "");
    await privateFile(
      "restore-target.json",
      JSON.stringify(
        {
          container,
          database: restoreDatabase,
          purpose:
            "Owned backup restoration proof; remove only this exact scratch database after an interruption.",
        },
        null,
        2,
      ),
    );
    docker([
      "createdb",
      "-U",
      "supabase_admin",
      "-O",
      "postgres",
      restoreDatabase,
    ]);
    docker(
      [
        "pg_restore",
        "-U",
        "supabase_admin",
        "-d",
        restoreDatabase,
        "--clean",
        "--if-exists",
        "--exit-on-error",
      ],
      await readFile(path.join(output, "database.dump")),
    );
    const restoreUrl = new URL(adminUrl);
    restoreUrl.pathname = "/" + restoreDatabase;
    const restored = postgres(restoreUrl.href, {
      max: 1,
      prepare: false,
      ssl: false,
      onnotice: () => {},
    });
    try {
      assert.deepEqual(await snapshot(restored, columns), before);
    } finally {
      await restored.end({ timeout: 1 });
    }
    for (const entry of bytesBefore) {
      const match = /^([0-9a-f]{64})\s+(.+)$/.exec(entry);
      assert.ok(match);
      assert.equal(
        sha(
          execFileSync(
            "tar",
            ["-xOf", path.join(output, "storage.tar"), "--", match[2]],
            { maxBuffer: 32 * 1024 * 1024 },
          ),
        ),
        match[1],
      );
    }
    docker(["dropdb", "-U", "supabase_admin", restoreDatabase]);
    restoreDatabase = undefined;
    console.log(
      "Backup restored in an owned scratch database; old fields and archived file bytes match.",
    );

    phase = "rollback-only actual-data rehearsal";
    const rolledBack = new Error("Intentional reviewed rehearsal rollback");
    try {
      await database.begin(async (tx) => {
        await tx.unsafe(
          "set local lock_timeout='5s';set local statement_timeout='90s'",
        );
        for (const file of pending) await tx.unsafe(sources.get(file));
        assert.deepEqual(
          await snapshot(tx, columns),
          before,
          "Pending migrations changed an old retained field.",
        );
        throw rolledBack;
      });
    } catch (error) {
      if (error !== rolledBack) throw error;
    }
    assert.deepEqual(await snapshot(database, columns), before);
    console.log(
      "All pending migrations passed a rollback-only rehearsal against actual retained data.",
    );

    phase = "ordered local migration application";
    await database.begin(async (tx) => {
      await tx.unsafe(
        "set local lock_timeout='5s';set local statement_timeout='90s';lock table supabase_migrations.schema_migrations in access exclusive mode",
      );
      assert.deepEqual(
        (
          await tx`select version from supabase_migrations.schema_migrations order by version`
        ).map((r) => r.version),
        versions,
        "Migration history changed after preflight.",
      );
      assert.deepEqual(
        await snapshot(tx, columns),
        before,
        "Retained data changed after backup.",
      );
      for (const file of pending) {
        const source = sources.get(file);
        assert.equal(
          await readFile(path.join("supabase/migrations", file), "utf8"),
          source,
          "Migration source changed after preflight.",
        );
        await tx.unsafe(source);
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${file.slice(0, 14)},${file.slice(15, -4)},${[source]}::text[])`;
      }
      assert.deepEqual(
        await snapshot(tx, columns),
        before,
        "An old retained field changed before commit.",
      );
    });
    await privateFile(
      "migration.log",
      pending.join("\n") +
        "\nExecuted SQL and verbatim source ledger entries committed in one transaction.\n",
    );
    assert.deepEqual(
      (
        await database`select version from supabase_migrations.schema_migrations order by version`
      ).map((r) => r.version),
      files.map((f) => f.slice(0, 14)),
    );
    assert.deepEqual(await snapshot(database, columns), before);
    console.log(
      "Pending local migrations installed in order; all old retained fields match.",
    );

    phase = "dedicated worker provisioning";
    if (!env.COACH_MEDIA_DATABASE_URL) {
      assert.equal(
        (
          await database`select count(*)::integer n from pg_roles where rolname=${workerName}`
        )[0].n,
        0,
        "An existing unknown worker login must be reconciled, never rotated.",
      );
      const password = randomBytes(32).toString("hex");
      const workerUrl = new URL(adminUrl);
      workerUrl.username = workerName;
      workerUrl.password = password;
      const nextEnv =
        envSource +
        (envSource.endsWith("\n") ? "" : "\n") +
        "\nCOACH_MEDIA_DATABASE_URL=" +
        workerUrl.href +
        "\n";
      await privateFile("env.local.planned", nextEnv);
      await database.unsafe(
        `create role ${quoted(workerName)} login password '${password}' nosuperuser nocreatedb nocreaterole nobypassrls inherit in role app_media_worker`,
      );
      await verifyWorker(workerUrl.href);
      const temporary = path.join(root, ".env.local.mov97.tmp");
      await writeFile(temporary, nextEnv, { mode: 0o600 });
      await rename(temporary, path.join(root, ".env.local"));
    }
    const nextEnv = parseEnv(await readFile(".env.local", "utf8"));
    for (const [key, value] of Object.entries(env))
      assert.equal(
        nextEnv[key],
        value,
        "An existing environment value changed.",
      );
    await verifyWorker(nextEnv.COACH_MEDIA_DATABASE_URL);
    const oldRoleNames = roleHashes.map((r) => r.rolname);
    assert.deepEqual(
      await database`select rolname,md5(to_jsonb(r)::text) hash from pg_authid r where rolname=any(${oldRoleNames}::text[]) order by rolname`,
      roleHashes,
    );
    assert.deepEqual(await snapshot(database, columns), before);
    assert.deepEqual(storageHashes(), bytesBefore);
    await privateFile(
      "result.json",
      JSON.stringify(
        {
          success: true,
          applied: pending,
          restoredBackupVerified: true,
          oldFieldsPreserved: true,
          oldRoleAttributesPreserved: true,
          storageBytesPreserved: true,
          workerVerified: true,
        },
        null,
        2,
      ),
    );
    console.log(
      "Restricted worker configured; existing credentials, records and file bytes preserved.",
    );
    console.log("Private recovery evidence: " + output);
  }
} catch (error) {
  if (args[0] === "--apply") {
    await mkdir(output, { recursive: true, mode: 0o700 });
    await privateFile("failure.txt", String(error.stack ?? error));
  }
  console.error(
    `Local upgrade failed during ${phase}. ${args[0] === "--apply" ? "Inspect private evidence: " + output : "No upgrade applied."}`,
  );
  process.exitCode = 1;
} finally {
  if (restoreDatabase)
    docker(["dropdb", "-U", "supabase_admin", restoreDatabase]);
  await database.end({ timeout: 1 });
}
