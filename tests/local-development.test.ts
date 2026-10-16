import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  LOCAL_RUNTIME_DATABASE_URL,
  assertLocalDevelopmentNodeVersion,
  localDevelopmentEnvironment,
  localDevelopmentProcessEnvironment,
} from "../scripts/lib/local-development";
import { assertLocalSupabaseConfiguration } from "../scripts/lib/local-supabase-project.mjs";

const LOCAL_STATUS = Object.freeze({
  apiUrl: "http://127.0.0.1:55321",
  databaseUrl: "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
  publishableKey: "local-public-key",
  serviceRoleKey: "local-service-key",
});

test("local development injects only bounded runtime application values", () => {
  assert.deepEqual(localDevelopmentEnvironment(LOCAL_STATUS), {
    DATABASE_URL: LOCAL_RUNTIME_DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_STATUS.apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LOCAL_STATUS.publishableKey,
    NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
  });
});

test("local development rejects hosted and unexpected-port targets", () => {
  assert.throws(
    () =>
      localDevelopmentEnvironment({
        ...LOCAL_STATUS,
        apiUrl: "https://project.supabase.co",
      }),
    /only against loopback/,
  );
  assert.throws(
    () =>
      localDevelopmentEnvironment({
        ...LOCAL_STATUS,
        databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
      }),
    /repository ports 55321 and 55322/,
  );
});

test("local development requires the repository Node release line", () => {
  assert.doesNotThrow(() => assertLocalDevelopmentNodeVersion("24.21.0"));
  assert.doesNotThrow(() => assertLocalDevelopmentNodeVersion("24.22.1"));
  assert.throws(
    () => assertLocalDevelopmentNodeVersion("24.20.0"),
    /Node.js 24.21.x or newer/,
  );
  assert.throws(
    () => assertLocalDevelopmentNodeVersion("25.0.0"),
    /Node.js 24.21.x or newer/,
  );
});

test("local child settings override hosted values and exclude operator credentials", () => {
  const environment = localDevelopmentProcessEnvironment(LOCAL_STATUS, {
    NODE_ENV: "development",
    DATABASE_URL: "hosted-database",
    NEXT_PUBLIC_SUPABASE_URL: "https://hosted.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "hosted-public-key",
    NEXT_PUBLIC_SITE_URL: "https://test.movx.club",
    SUPABASE_ACCESS_TOKEN: "synthetic-operator",
    SUPABASE_DB_PASSWORD: "synthetic-password",
    SUPABASE_SECRET_KEY: "synthetic-secret",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-role",
    COACH_REVIEW_DATABASE_URL: "synthetic-owner",
    SMTP_PASSWORD: "synthetic-mail",
    PATH: "preserved-path",
  });
  assert.equal(environment.DATABASE_URL, LOCAL_RUNTIME_DATABASE_URL);
  assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL, LOCAL_STATUS.apiUrl);
  assert.equal(
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    LOCAL_STATUS.publishableKey,
  );
  assert.equal(environment.NEXT_PUBLIC_SITE_URL, "http://localhost:3100");
  assert.equal(environment.PATH, "preserved-path");
  assert.ok(!JSON.stringify(environment).includes("synthetic-"));
});

test("local configuration refuses retained projects and wrong or missing ports", () => {
  const config = readFileSync("supabase/config.toml", "utf8");
  assert.doesNotThrow(() => assertLocalSupabaseConfiguration(config));
  for (const changed of [
    config.replace(
      'project_id = "movx-club-local"',
      'project_id = "fitness-booking-social-app"',
    ),
    config.replace("port = 55322", "port = 54322"),
    config.replace("port = 55321", "port = 54321"),
    config.replace("port = 55324", "port = 54324"),
    config.replace("port = 55322", "# port omitted"),
  ])
    assert.throws(() => assertLocalSupabaseConfiguration(changed));
});

test("local preflight and invalid flags perform no Docker or hosted setup", () => {
  for (const [args, expectedStatus] of [
    [["--check"], 0],
    [["--unknown"], 1],
    [["--check", "--setup-only"], 1],
  ] as const) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/start-local-development.ts", ...args],
      {
        env: { NODE_ENV: "test", PATH: "", DATABASE_URL: "synthetic-hosted" },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, expectedStatus, result.stderr);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /synthetic-hosted|Starting the local|Applying pending/,
    );
  }
});
