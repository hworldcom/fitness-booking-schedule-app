import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/validate-vercel-environment.mjs");
const baseEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PATH: process.env.PATH,
  VERCEL_ENV: "preview",
};
const validEnvironment: NodeJS.ProcessEnv = {
  ...baseEnvironment,
  DATABASE_URL:
    "postgresql://movx_runtime_login.projectref:test-only@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://projectref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-only",
  NEXT_PUBLIC_SITE_URL: "https://movx-preview.example",
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "pk.test-header.test-signature",
};

function run(environment: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: environment,
    encoding: "utf8",
  });
}

test("Vercel validation accepts configuration-free public preview mode", () => {
  const output = execFileSync(process.execPath, [script], {
    cwd: root,
    env: baseEnvironment,
    encoding: "utf8",
  });
  assert.match(output, /preview Vercel build in public-preview mode/);
  assert.match(output, /Mapbox disabled/);
});

test("Vercel validation accepts complete scheduling configuration without leaking values", () => {
  const output = execFileSync(process.execPath, [script], {
    cwd: root,
    env: validEnvironment,
    encoding: "utf8",
  });
  assert.match(output, /preview Vercel build in hosted-runtime mode/);
  assert.match(output, /Mapbox configured/);
  assert.doesNotMatch(
    output,
    /test-only|projectref|movx-preview|pk\.test-header/,
  );
});

test("Vercel validation rejects partial core configuration without leaking values", () => {
  const result = run({
    ...baseEnvironment,
    DATABASE_URL:
      "postgresql://movx_runtime_login.projectref:do-not-print@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Hosted database\/Auth configuration is incomplete/,
  );
  assert.match(result.stderr, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(result.stderr, /do-not-print|aws-0-eu-central-1/);
});

test("Vercel validation rejects loopback and non-pooler databases", () => {
  const loopbackResult = run({
    ...validEnvironment,
    DATABASE_URL:
      "postgresql://movx_runtime_login.projectref:do-not-print@127.0.0.1:5432/postgres",
  });
  const directResult = run({
    ...validEnvironment,
    DATABASE_URL:
      "postgresql://movx_runtime_login.projectref:do-not-print@db.projectref.supabase.co:5432/postgres",
  });
  assert.notEqual(loopbackResult.status, 0);
  assert.match(loopbackResult.stderr, /cannot target a loopback host/);
  assert.notEqual(directResult.status, 0);
  assert.match(directResult.stderr, /transaction pooler on port 6543/);
});

test("Vercel validation rejects insecure hosted origins and secret Mapbox tokens", () => {
  const insecureResult = run({
    ...validEnvironment,
    NEXT_PUBLIC_SITE_URL: "http://movx-preview.example",
  });
  const mapboxResult = run({
    ...validEnvironment,
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "sk.do-not-print.secret",
  });
  assert.notEqual(insecureResult.status, 0);
  assert.match(insecureResult.stderr, /exact root HTTPS origin/);
  assert.notEqual(mapboxResult.status, 0);
  assert.match(mapboxResult.stderr, /public Mapbox pk token/);
  assert.doesNotMatch(mapboxResult.stderr, /sk\.do-not-print/);
});

test("Vercel configuration selects the guarded native Next.js build", () => {
  const configuration = JSON.parse(
    readFileSync(path.join(root, "vercel.json"), "utf8"),
  );
  const packageJson = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8"),
  );
  assert.equal(configuration.$schema, "https://openapi.vercel.sh/vercel.json");
  assert.equal(configuration.framework, "nextjs");
  assert.equal(configuration.buildCommand, "npm run build:vercel");
  assert.equal(
    packageJson.scripts["build:vercel"],
    "node scripts/validate-vercel-environment.mjs && next build",
  );
  assert.equal(packageJson.engines.node, ">=24.21.0 <25");
});
