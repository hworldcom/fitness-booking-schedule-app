import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DEMO_COACH_FIXTURES,
  FOUNDATION_RUN_ID,
  assertDemoCoachStates,
  demoCoachDefaultsSql,
  sqlLiteral,
  type DemoCoachState,
} from "../scripts/lib/demo-coach-fixtures";
import {
  assertDemoLocalTarget,
  demoEnvironmentArgument,
  demoHostedTarget,
} from "../scripts/lib/demo-coach-target";
import {
  generateDemoPassword,
  privateDemoCredentialStore,
} from "../scripts/lib/demo-coach-credentials";
import { parseCoachWebsiteContent } from "../src/domain/coach-website";
import { assertDemoAuthUser } from "../scripts/lib/provision-demo-coaches";
import type { User } from "@supabase/supabase-js";

test("only confirmed exact demo identities with matching environment metadata can be reused", () => {
  const coach = DEMO_COACH_FIXTURES[0];
  const user = {
    id: coach.authUserId,
    email: coach.email,
    email_confirmed_at: "2026-10-18",
    app_metadata: {
      movx_local_demo: true,
      movx_coach_profile_id: coach.profileId,
      movx_coach_slug: coach.slug,
    },
  } as unknown as User;
  assert.doesNotThrow(() => assertDemoAuthUser(coach, user, "local"));
  assert.throws(() => assertDemoAuthUser(coach, user, "dev"));
  assert.doesNotThrow(() =>
    assertDemoAuthUser(
      coach,
      {
        ...user,
        app_metadata: {
          ...user.app_metadata,
          movx_demo_environment: "dev",
          movx_local_demo: false,
        },
      },
      "dev",
    ),
  );
  for (const bad of [
    { id: "other-user" },
    { email: "other@coaches.movx.test" },
    { email_confirmed_at: undefined },
    { app_metadata: { ...user.app_metadata, movx_demo_environment: "prod" } },
    {
      app_metadata: {
        ...user.app_metadata,
        movx_coach_profile_id: "other-profile",
      },
    },
  ])
    assert.throws(() =>
      assertDemoAuthUser(coach, { ...user, ...bad }, "local"),
    );
});

test("demo target selection refuses production, mixed URLs and unintended local databases", () => {
  assert.equal(demoEnvironmentArgument(["--environment", "local"]), "local");
  assert.equal(
    demoEnvironmentArgument(["--environment", "dev", "--check"]),
    "dev",
  );
  for (const args of [
    [],
    ["--environment", "prod"],
    ["--environment", "staging"],
    ["--environment", "local", "--reset-passwords"],
    ["--environment", "dev", "--reset-passwords"],
    ["--environment", "dev", "--reset-passwords", "--check"],
  ])
    assert.throws(() => demoEnvironmentArgument(args));
  const status = {
    apiUrl: "http://127.0.0.1:55321",
    databaseUrl: "postgresql://postgres:postgres@localhost:55322/postgres",
    publishableKey: "synthetic-public",
    serviceRoleKey: "synthetic-admin",
  };
  assert.doesNotThrow(() => assertDemoLocalTarget(status));
  for (const changed of [
    { apiUrl: "https://mdzidiqosxbghmfyxphb.supabase.co" },
    { apiUrl: "http://127.0.0.1:54321" },
    { databaseUrl: "postgres://postgres:p@localhost:55322/other" },
    {
      databaseUrl:
        "postgres://postgres:p@db.yltijwebedkraypgkqmc.supabase.co:55322/postgres",
    },
  ])
    assert.throws(() => assertDemoLocalTarget({ ...status, ...changed }));
  const dev = {
    DATABASE_URL:
      "postgresql://movx_dev_runtime_login.mdzidiqosxbghmfyxphb:synthetic@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
    NEXT_PUBLIC_SUPABASE_URL: "https://mdzidiqosxbghmfyxphb.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
  };
  assert.equal(demoHostedTarget(dev).projectRef, "mdzidiqosxbghmfyxphb");
  assert.throws(() =>
    demoHostedTarget({
      ...dev,
      NEXT_PUBLIC_SUPABASE_URL: "https://yltijwebedkraypgkqmc.supabase.co",
    }),
  );
  assert.throws(() =>
    demoHostedTarget({
      ...dev,
      DATABASE_URL: dev.DATABASE_URL.replaceAll(
        "mdzidiqosxbghmfyxphb",
        "yltijwebedkraypgkqmc",
      ),
    }),
  );
});

function states(): DemoCoachState[] {
  return DEMO_COACH_FIXTURES.map((coach) => ({
    profile_id: coach.profileId,
    auth_user_id: coach.authUserId,
    record_source: "user",
    claimed_at: "2026-10-18",
    run_id: FOUNDATION_RUN_ID,
    run_slug: "local-foundation-2030",
    run_status: "active",
    participant_status: "active",
    participant_role: "member",
    public_slug: coach.slug,
    coach_record_source: "user",
    is_demo: true,
  }));
}
test("demo ownership validation accepts existing identities but rejects partial or unrelated ownership", () => {
  assert.doesNotThrow(() => assertDemoCoachStates(states()));
  const seeded = states().map((row, i) => ({
    ...row,
    auth_user_id: null,
    record_source: "fixture",
    claimed_at: null,
    coach_record_source: "fixture",
    participant_role: DEMO_COACH_FIXTURES[i].seedParticipantRole,
  }));
  assert.doesNotThrow(() => assertDemoCoachStates(seeded));
  for (const change of [
    { is_demo: false },
    { auth_user_id: "another-user" },
    { run_id: "another-run" },
    { participant_role: "operator" },
    { claimed_at: null },
  ]) {
    const rows = states();
    rows[0] = { ...rows[0], ...change };
    assert.throws(() => assertDemoCoachStates(rows));
  }
  assert.throws(() => assertDemoCoachStates(states().slice(0, 4)));
});

test("fixture content is valid, illustrated, explicitly fictional and collision free", () => {
  assert.equal(
    new Set(DEMO_COACH_FIXTURES.map((coach) => coach.email)).size,
    6,
  );
  for (const coach of DEMO_COACH_FIXTURES) {
    assert.match(coach.email, /@coaches\.movx\.test$/);
    assert.ok(coach.bio.length >= 40 && coach.bio.length <= 1200);
    assert.ok(parseCoachWebsiteContent(coach.website));
    assert.match(coach.website.experience, /Fictional development/);
    assert.ok(readFileSync(`public${coach.portraitPath}`).length > 10000);
    assert.ok(
      readFileSync("supabase/seed.sql", "utf8").includes(coach.portraitPath),
    );
  }
  assert.equal(sqlLiteral("Coach's goals"), "'Coach''s goals'");
  assert.throws(() => demoCoachDefaultsSql(["unrelated-profile"], [], []));
});

test("private credentials persist across setup, enforce target binding and exclude symlinks", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "movx-demo-credentials-test-"),
  );
  try {
    let store = await privateDemoCredentialStore(
      root,
      "local",
      "movx-club-local",
    );
    const coach = DEMO_COACH_FIXTURES[0],
      password = generateDemoPassword();
    assert.notEqual(password, generateDemoPassword());
    assert.ok(password.length <= 72);
    store.credentials.coaches[coach.slug] = {
      email: coach.email,
      authUserId: coach.authUserId,
      password,
      initializedAt: "2026-10-18",
    };
    await store.save();
    assert.equal((await lstat(store.file)).mode & 0o777, 0o600);
    await assert.rejects(
      privateDemoCredentialStore(root, "local", "movx-club-local"),
      /already running/,
    );
    await store.close();
    await chmod(store.file, 0o644);
    store = await privateDemoCredentialStore(root, "local", "movx-club-local");
    assert.equal(store.credentials.coaches[coach.slug].password, password);
    assert.equal((await lstat(store.file)).mode & 0o777, 0o600);
    await store.close();
    await assert.rejects(
      privateDemoCredentialStore(root, "local", "other-target"),
      /another target/,
    );
    await rm(store.file);
    const outside = path.join(root, "do-not-touch.json");
    await writeFile(outside, "untouched", { mode: 0o644 });
    await symlink(outside, store.file);
    await assert.rejects(
      privateDemoCredentialStore(root, "local", "movx-club-local"),
      /Invalid private/,
    );
    assert.equal(await readFile(outside, "utf8"), "untouched");
    await rm(path.join(root, "work", "demo-coaches"), { recursive: true });
    await mkdir(path.join(root, "elsewhere"));
    await symlink(
      path.join(root, "elsewhere"),
      path.join(root, "work", "demo-coaches"),
    );
    await assert.rejects(
      privateDemoCredentialStore(root, "local", "movx-club-local"),
      /symlink/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
