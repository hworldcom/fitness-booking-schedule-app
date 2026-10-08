import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_RUNTIME_DATABASE_URL,
  assertLocalDevelopmentNodeVersion,
  localDevelopmentEnvironment,
} from "../scripts/lib/local-development";

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
