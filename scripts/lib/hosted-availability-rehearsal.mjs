// DEV0253: explicit hosted-dev test infrastructure; never imported by the app.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "@playwright/test";
import { hostedDevelopmentConfiguration } from "./hosted-environment.mjs";

export async function availabilityRehearsal(args) {
  assert.deepEqual(
    args.slice(0, 2),
    ["--environment", "dev"],
    "Select hosted dev explicitly.",
  );
  assert.ok(
    args.length === 3 && ["--check", "--run"].includes(args[2]),
    "Use --environment dev --check|--run.",
  );
  const target = hostedDevelopmentConfiguration(process.env);
  assert.equal(target.projectRef, "mdzidiqosxbghmfyxphb");
  const root = process.cwd(),
    base = "http://localhost:3146",
    runId = randomUUID();
  const source = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const work = await mkdtemp(path.join(tmpdir(), "movx-availability-live-"));
  await mkdir(path.join(work, "supabase"));
  await writeFile(
    path.join(work, "supabase/config.toml"),
    'project_id = "dev0253_live"\n',
    { mode: 0o600 },
  );
  const output = path.join(root, "test-results/dev0253-hosted", runId);
  await mkdir(output, { recursive: true });
  const people = [],
    pages = [],
    checks = [],
    secrets = new Set([
      target.connectionString,
      new URL(target.connectionString).password,
    ]);
  let admin,
    browser,
    server,
    baseline,
    cleanupFailed = false;
  const runtime = postgres(target.connectionString, {
    max: 4,
    prepare: false,
    ssl: "require",
    connect_timeout: 15,
    idle_timeout: 5,
    onnotice: () => {},
  });
  const literal = (v) => "'" + String(v).replaceAll("'", "''") + "'";
  const uuid = (v) => {
    assert.match(
      v,
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
    return literal(v) + "::uuid";
  };
  const cli = (argv) =>
    execFileSync(path.join(root, "node_modules/.bin/supabase"), argv, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
    });
  const redact = (value) => {
    let text = String(value);
    for (const secret of secrets)
      if (secret) text = text.replaceAll(secret, "[redacted]");
    return text
      .replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        "[redacted JWT]",
      )
      .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted key]");
  };
  async function ownerQuery(body) {
    const file = path.join(work, randomUUID() + ".sql");
    await writeFile(file, body, { mode: 0o600 });
    try {
      const result = JSON.parse(
        cli([
          "db",
          "query",
          "--linked",
          "--project-ref",
          target.projectRef,
          "--workdir",
          work,
          "--file",
          file,
          "--output",
          "json",
        ]),
      );
      assert.ok(Array.isArray(result.rows));
      return result.rows;
    } catch {
      throw new Error(
        "Explicit-dev fixture SQL failed; the private recovery manifest is retained if cleanup fails.",
      );
    } finally {
      await rm(file, { force: true });
    }
  }
  const manifest = path.join(work, "recovery-ids.json");
  const journal = () =>
    writeFile(
      manifest,
      JSON.stringify(
        {
          ticket: "DEV0253",
          project: target.projectRef,
          runId,
          people: people.map(({ id, profileId }) => ({ id, profileId })),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  async function fingerprint() {
    return (
      await ownerQuery(
        `begin;set local statement_timeout='60s';create temporary table digests(name text,value text) on commit drop;do $$ declare t record; value text;begin for t in select tablename from pg_tables where schemaname='app' order by tablename loop execute format('select count(*)::text||'':''||md5(coalesce(string_agg(to_jsonb(r)::text,chr(10) order by to_jsonb(r)::text),'''')) from app.%I r',t.tablename) into value;insert into digests values(t.tablename,value);end loop;end $$;select jsonb_build_object('app',(select jsonb_object_agg(name,value) from digests),'authCount',(select count(*) from auth.users),'authDigest',(select md5(coalesce(string_agg(to_jsonb(u)::text,chr(10) order by id),'')) from auth.users u),'storageCount',(select count(*) from storage.objects)) value;commit;`,
      )
    )[0].value;
  }
  async function asActor(p, fn) {
    assert.ok(people.includes(p) && p.profileId && p.dataset);
    return runtime.begin(async (tx) => {
      await tx`select set_config('app.current_auth_user_id',${p.id},true),set_config('app.current_profile_id',${p.profileId},true),set_config('app.current_run_id',${p.dataset},true),set_config('app.current_run_role','member',true)`;
      return fn(tx);
    });
  }
  async function person(label, coach = false) {
    assert.ok(people.length < 5);
    const p = {
      id: randomUUID(),
      label,
      email: `dev0253-${runId}-${label.toLowerCase()}@users.movx.test`,
      cookies: [],
    };
    people.push(p);
    await journal();
    const made = await admin.auth.admin.createUser({
      id: p.id,
      email: p.email,
      email_confirm: true,
      app_metadata: {
        movx_test_ticket: "DEV0253",
        movx_test_run: runId,
        temporary: true,
      },
    });
    if (made.data.user && made.data.user.id !== p.id) {
      // Keep the actual newly returned identity recoverable before failing.
      p.id = made.data.user.id;
      await journal();
      throw new Error("Auth returned a different fixture ID; run stopped.");
    }
    assert.ok(
      !made.error && made.data.user?.id === p.id,
      "Create exact tagged Auth identity.",
    );
    const [row] =
      await runtime`select * from app.enroll_application_identity(${p.id}::uuid,${"DEV0253 " + runId.slice(0, 8) + " " + label})`;
    Object.assign(p, {
      profileId: row.identity_profile_id,
      dataset: row.identity_run_id,
    });
    await journal();
    if (coach) {
      await asActor(p, async (tx) => {
        await tx`select app.submit_owned_coach_application()`;
        await tx`select app.upsert_owned_coach_profile(${"DEV0253 " + runId.slice(0, 8) + " " + label},'Temporary explicitly tagged availability rehearsal, removed after validation.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
      });
      if (label !== "Applicant")
        await ownerQuery(
          `begin;set local lock_timeout='5s';select app.review_coach_application(${uuid(p.profileId)},'pending','approved','New tagged rehearsal account only.','dev0253-live','movx-identity-application-v1');update app.coach_profiles set visibility='visible' where profile_id=${uuid(p.profileId)};commit;select true prepared;`,
        );
      const [venue] = await ownerQuery(
        `select l.id,l.updated_at::text stamp,c.public_slug slug from app.coach_training_locations l join app.coach_profiles c using(run_id,profile_id) where l.profile_id=${uuid(p.profileId)} and l.is_primary;`,
      );
      Object.assign(p, {
        venue: venue.id,
        venueStamp: venue.stamp,
        slug: venue.slug,
      });
    }
    const generated = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: p.email,
    });
    assert.ok(
      !generated.error &&
        generated.data.user?.id === p.id &&
        generated.data.properties?.email_otp,
      "Generate in-memory code without delivery.",
    );
    secrets.add(generated.data.properties.email_otp);
    secrets.add(generated.data.properties.hashed_token);
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: { autoRefreshToken: false },
        cookies: {
          getAll: () => p.cookies,
          setAll: (values) => {
            p.cookies = values.map(({ name, value }) => ({ name, value }));
            for (const c of p.cookies) secrets.add(c.value);
          },
        },
      },
    );
    const verified = await client.auth.verifyOtp({
      email: p.email,
      token: generated.data.properties.email_otp,
      type: "email",
    });
    assert.ok(
      !verified.error &&
        verified.data.user?.id === p.id &&
        verified.data.session,
      "Verify real OTP session.",
    );
    secrets.add(verified.data.session.access_token);
    secrets.add(verified.data.session.refresh_token);
    p.client = client;
    return p;
  }
  async function start() {
    const checkout = path.join(work, "app");
    await mkdir(checkout);
    execFileSync("tar", ["-xf", "-", "-C", checkout], {
      input: execFileSync("git", ["archive", source], {
        cwd: root,
        maxBuffer: 100 * 1024 * 1024,
      }),
    });
    await symlink(
      path.join(root, "node_modules"),
      path.join(checkout, "node_modules"),
      "dir",
    );
    execFileSync(process.execPath, ["scripts/prepare-maplibre-worker.mjs"], {
      cwd: checkout,
      stdio: "ignore",
    });
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([k]) => !/SUPABASE|DATABASE|MOVX|AUTH|NEXT_PUBLIC|FIXTURE/.test(k),
      ),
    );
    Object.assign(env, {
      DATABASE_URL: target.connectionString,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SITE_URL: base,
      NEXT_TELEMETRY_DISABLED: "1",
    });
    server = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/next/dist/bin/next"),
        "dev",
        "--webpack",
        "--hostname",
        "localhost",
        "--port",
        "3146",
      ],
      { cwd: checkout, env, stdio: "ignore" },
    );
    for (let n = 0; n < 120; n++) {
      assert.equal(server.exitCode, null, "Owned app exited.");
      try {
        if ((await fetch(base + "/api/auth/session")).status === 200) break;
      } catch {}
      if (n === 119) throw new Error("Owned app startup failed.");
      await new Promise((r) => setTimeout(r, 500));
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }
  async function open(p, javaScriptEnabled = true) {
    const context = await browser.newContext({
      javaScriptEnabled,
      viewport: { width: 1440, height: 1000 },
    });
    if (p)
      await context.addCookies(p.cookies.map((c) => ({ ...c, url: base })));
    const page = await context.newPage();
    pages.push(page);
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(45000);
    return { context, page };
  }
  async function cleanup() {
    const verified = [];
    for (const p of people) {
      const got = await admin.auth.admin.getUserById(p.id);
      if (got.error?.status === 404) continue;
      assert.ok(
        !got.error &&
          got.data.user?.email === p.email &&
          got.data.user.app_metadata.movx_test_ticket === "DEV0253" &&
          got.data.user.app_metadata.movx_test_run === runId &&
          got.data.user.app_metadata.temporary === true,
        "Cleanup ownership changed.",
      );
      verified.push(p);
    }
    if (!verified.length) return;
    const ids = verified.map((p) => uuid(p.id)).join(",");
    await ownerQuery(`begin;set local lock_timeout='5s';set local statement_timeout='60s';
   create temporary table owned as select p.id from app.profiles p join auth.users u on u.id=p.auth_user_id where u.id in(${ids}) and u.raw_app_meta_data->>'movx_test_run'=${literal(runId)} and u.raw_app_meta_data->>'movx_test_ticket'='DEV0253';
   do $$ begin if exists(select 1 from app.coach_booking_requests where (coach_profile_id in(select id from owned) or client_profile_id in(select id from owned)) and not(coach_profile_id in(select id from owned) and client_profile_id in(select id from owned))) or exists(select 1 from app.coach_private_bookings where (coach_profile_id in(select id from owned) or client_profile_id in(select id from owned)) and not(coach_profile_id in(select id from owned) and client_profile_id in(select id from owned))) or exists(select 1 from app.message_conversations where (coach_profile_id in(select id from owned) or athlete_profile_id in(select id from owned)) and not(coach_profile_id in(select id from owned) and athlete_profile_id in(select id from owned))) or exists(select 1 from app.coach_group_registrations r join app.coach_group_sessions s on s.id=r.session_id where (s.coach_profile_id in(select id from owned) or r.athlete_profile_id in(select id from owned)) and not(s.coach_profile_id in(select id from owned) and r.athlete_profile_id in(select id from owned))) or exists(select 1 from app.coach_athlete_connection_pairs where (coach_profile_id in(select id from owned) or athlete_profile_id in(select id from owned)) and not(coach_profile_id in(select id from owned) and athlete_profile_id in(select id from owned))) then raise exception 'External fixture activity requires review';end if;end $$;
   delete from app.message_conversations where coach_profile_id in(select id from owned) and athlete_profile_id in(select id from owned);
   delete from app.coach_athlete_connection_attempts where pair_id in(select id from app.coach_athlete_connection_pairs where coach_profile_id in(select id from owned) and athlete_profile_id in(select id from owned));
   delete from app.coach_athlete_connection_pairs where coach_profile_id in(select id from owned) and athlete_profile_id in(select id from owned);
   delete from app.coach_group_registrations where athlete_profile_id in(select id from owned) and session_id in(select id from app.coach_group_sessions where coach_profile_id in(select id from owned));
   delete from app.coach_group_sessions where coach_profile_id in(select id from owned);
   delete from app.coach_booking_requests where coach_profile_id in(select id from owned) and client_profile_id in(select id from owned);
   delete from app.coach_private_bookings where coach_profile_id in(select id from owned) and client_profile_id in(select id from owned);
   delete from app.coach_availability_slots where profile_id in(select id from owned);
   delete from app.coach_availability_rules where profile_id in(select id from owned);
   update app.coach_profiles set visibility='hidden' where profile_id in(select id from owned);
   delete from app.coach_training_locations where profile_id in(select id from owned);
   delete from app.coach_profile_disciplines where profile_id in(select id from owned);
   delete from app.coach_profiles where profile_id in(select id from owned);
   delete from app.coach_application_review_events where profile_id in(select id from owned);
   delete from app.coach_applications where profile_id in(select id from owned);
   delete from app.demo_run_participants where profile_id in(select id from owned);
   delete from app.profiles where id in(select id from owned);commit;select true removed;`);
    for (const p of verified) {
      assert.ok(
        !(await admin.auth.admin.deleteUser(p.id)).error,
        "Exact Auth fixture deletion failed.",
      );
    }
    assert.equal(
      (
        await ownerQuery(
          `select count(*)::int n from auth.users where id in(${ids});`,
        )
      )[0].n,
      0,
    );
    await rm(manifest, { force: true });
  }
  const record = (text) => {
    checks.push(text);
    console.log("PASS " + text);
  };
  async function preflight() {
    const [catalog] = await ownerQuery(
      "select current_user executor,(select json_agg(version order by version) from supabase_migrations.schema_migrations) versions,(select count(*)::int from auth.users where raw_app_meta_data->>'temporary'='true') other_fixtures;",
    );
    assert.equal(catalog.executor, "postgres");
    assert.deepEqual(catalog.versions, [
      "20261016000100",
      "20261016000200",
      "20261016000300",
    ]);
    assert.equal(
      catalog.other_fixtures,
      0,
      "Another temporary hosted rehearsal is active or requires cleanup.",
    );
    const [role] =
      await runtime`select current_user name,has_function_privilege(current_user,'app.save_owned_effective_coach_availability(jsonb)','execute') can_save,has_table_privilege(current_user,'app.coach_group_sessions','select') direct_groups`;
    assert.equal(role.name, target.runtimeUser);
    assert.ok(role.can_save && !role.direct_groups);
    record(
      "exact dev ledger, no foreign rehearsal accounts and restricted runtime verified",
    );
    if (args[2] === "--run") {
      baseline = await fingerprint();
      const keys = JSON.parse(
        cli([
          "projects",
          "api-keys",
          "--project-ref",
          target.projectRef,
          "--output",
          "json",
          "--reveal",
        ]),
      );
      const key =
        keys.find((k) => k.type === "secret")?.api_key ??
        keys.find((k) => k.name === "service_role")?.api_key;
      assert.ok(typeof key === "string" && key.length > 40);
      secrets.add(key);
      admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }
  async function finish(success) {
    if (!success && browser)
      for (const [index, page] of pages.entries())
        if (!page.isClosed())
          await page
            .screenshot({
              path: path.join(output, `failure-${index}.png`),
              fullPage: true,
            })
            .catch(() => {});
    await browser?.close();
    if (server?.exitCode === null) {
      server.kill("SIGTERM");
      await Promise.race([
        new Promise((r) => server.once("exit", r)),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
      if (server.exitCode === null) server.kill("SIGKILL");
    }
    try {
      if (admin) await cleanup();
      if (baseline)
        assert.deepEqual(
          await fingerprint(),
          baseline,
          "Existing app/Auth/Storage records changed; no automatic restoration is attempted.",
        );
      if (people.length)
        record(
          "exact tagged fixtures removed and existing app/Auth/Storage fingerprints preserved",
        );
    } catch (error) {
      cleanupFailed = true;
      process.exitCode = 1;
      console.error(
        "Cleanup/preservation requires review. Recovery IDs: " +
          manifest +
          "; " +
          redact(error.message),
      );
    }
    await runtime.end({ timeout: 5 });
    await writeFile(
      path.join(output, "results.json"),
      JSON.stringify(
        {
          runId,
          project: target.projectRef,
          source,
          checks,
          success: success && !cleanupFailed,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    if (!cleanupFailed) await rm(work, { recursive: true, force: true });
  }
  return {
    args,
    target,
    root,
    base,
    runId,
    output,
    people,
    checks,
    runtime,
    literal,
    uuid,
    ownerQuery,
    asActor,
    person,
    start,
    open,
    record,
    preflight,
    finish,
    redact,
  };
}
