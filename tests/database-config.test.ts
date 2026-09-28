import test from "node:test";
import assert from "node:assert/strict";
import {
  DatabaseConfigurationError,
  isCloudflareWorkerRuntime,
  parseDatabaseUrl,
  parseHyperdriveDatabaseUrl,
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

test("Hyperdrive retains its generated transport configuration", () => {
  const config = parseHyperdriveDatabaseUrl(
    "postgresql://runtime:generated@hyperdrive.local:5432/postgres?sslmode=disable",
  );
  assert.equal(config.ssl, undefined);
  assert.match(config.connectionString, /sslmode=disable/);
});

test("Cloudflare runtime detection is explicit", () => {
  assert.equal(isCloudflareWorkerRuntime("Cloudflare-Workers"), true);
  assert.equal(isCloudflareWorkerRuntime("Node.js/24"), false);
  assert.equal(isCloudflareWorkerRuntime(undefined), false);
});
