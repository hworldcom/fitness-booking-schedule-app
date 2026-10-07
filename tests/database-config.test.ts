import test from "node:test";
import assert from "node:assert/strict";
import {
  DatabaseConfigurationError,
  parseDatabaseUrl,
} from "@/server/db/config";

test("database configuration is lazy, explicit and redacts invalid values", () => {
  assert.throws(
    () => parseDatabaseUrl(undefined),
    (error: unknown) =>
      error instanceof DatabaseConfigurationError &&
      error.message ===
        "DATABASE_URL is required when a server database module is initialized.",
  );

  const secret = "do-not-print-this";
  assert.throws(
    () => parseDatabaseUrl(`not-a-url-${secret}`),
    (error: unknown) =>
      error instanceof DatabaseConfigurationError &&
      !error.message.includes(secret),
  );
});

test("local database URLs disable TLS while hosted URLs require it", () => {
  const local = parseDatabaseUrl(
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  );
  assert.equal(local.ssl, false);

  const hosted = parseDatabaseUrl(
    "postgresql://runtime:secret@aws-0-eu.pooler.supabase.com:6543/postgres",
  );
  assert.equal(hosted.ssl, "require");
});

test("Docker-local Supabase hostnames do not require TLS", () => {
  const config = parseDatabaseUrl(
    "postgresql://postgres:postgres@supabase_db_project:5432/postgres",
  );
  assert.equal(config.ssl, false);
});
