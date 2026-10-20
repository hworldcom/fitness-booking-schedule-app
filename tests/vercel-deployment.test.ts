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
    "postgresql://movx_dev_runtime_login.mdzidiqosxbghmfyxphb:test-only@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://mdzidiqosxbghmfyxphb.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-only",
  NEXT_PUBLIC_SITE_URL: "https://movx-preview.example",
  NEXT_PUBLIC_GEOAPIFY_API_KEY: "geoapify_test_key_1234567890",
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
  assert.match(output, /OpenFreeMap enabled; Geoapify search disabled/);
});

test("Vercel validation prevents unconfigured Production and explicitly hosted deployments", () => {
  for (const environment of [
    { ...baseEnvironment, VERCEL_ENV: "production" },
    { ...baseEnvironment, MOVX_HOSTED_ENVIRONMENT: "dev" },
  ]) {
    const result = run(environment);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /configuration is required for Production or explicitly hosted builds/,
    );
  }
});

test("Vercel Production can serve UAT only with an explicit dev target and matching runtime", () => {
  const uat = {
    ...validEnvironment,
    VERCEL_ENV: "production",
    MOVX_HOSTED_ENVIRONMENT: "dev",
    NEXT_PUBLIC_SITE_URL: "https://uat.movx.club",
  };
  const result = run(uat);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /production Vercel build in hosted-runtime mode/);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /test-only|geoapify_test_key/,
  );
  for (const changes of [
    { MOVX_HOSTED_ENVIRONMENT: undefined },
    { MOVX_HOSTED_ENVIRONMENT: "prod" },
    { MOVX_HOSTED_ENVIRONMENT: "staging" },
    { DATABASE_URL: undefined },
    { NEXT_PUBLIC_SITE_URL: "https://movx.club" },
  ]) {
    assert.notEqual(run({ ...uat, ...changes }).status, 0);
  }
});

test("Vercel validation rejects a production database in Preview or on the UAT domain", () => {
  const production = {
    ...validEnvironment,
    VERCEL_ENV: "production",
    MOVX_HOSTED_ENVIRONMENT: "prod",
    DATABASE_URL: validEnvironment
      .DATABASE_URL!.replaceAll("mdzidiqosxbghmfyxphb", "yltijwebedkraypgkqmc")
      .replace("movx_dev_runtime_login", "movx_prod_runtime_login"),
    NEXT_PUBLIC_SUPABASE_URL: "https://yltijwebedkraypgkqmc.supabase.co",
    NEXT_PUBLIC_SITE_URL: "https://movx.club",
  };
  assert.equal(run(production).status, 0);
  assert.notEqual(run({ ...production, VERCEL_ENV: "preview" }).status, 0);
  assert.notEqual(
    run({ ...production, NEXT_PUBLIC_SITE_URL: "https://uat.movx.club" })
      .status,
    0,
  );
  assert.notEqual(
    run({ ...production, MOVX_HOSTED_ENVIRONMENT: "dev" }).status,
    0,
  );
});

test("Vercel validation accepts complete scheduling configuration without leaking values", () => {
  const output = execFileSync(process.execPath, [script], {
    cwd: root,
    env: validEnvironment,
    encoding: "utf8",
  });
  assert.match(output, /preview Vercel build in hosted-runtime mode/);
  assert.match(output, /OpenFreeMap enabled; Geoapify search configured/);
  assert.doesNotMatch(
    output,
    /test-only|projectref|movx-preview|geoapify_test_key/,
  );
});

test("Vercel validation rejects partial core configuration without leaking values", () => {
  const result = run({
    ...baseEnvironment,
    DATABASE_URL:
      "postgresql://movx_dev_runtime_login.mdzidiqosxbghmfyxphb:do-not-print@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
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
      "postgresql://movx_dev_runtime_login.mdzidiqosxbghmfyxphb:do-not-print@127.0.0.1:5432/postgres",
  });
  const directResult = run({
    ...validEnvironment,
    DATABASE_URL:
      "postgresql://movx_dev_runtime_login.mdzidiqosxbghmfyxphb:do-not-print@db.projectref.supabase.co:5432/postgres",
  });
  assert.notEqual(loopbackResult.status, 0);
  assert.match(loopbackResult.stderr, /cannot target a loopback host/);
  assert.notEqual(directResult.status, 0);
  assert.match(directResult.stderr, /transaction pooler on port 6543/);
});

test("Vercel validation rejects insecure origins and malformed Geoapify keys", () => {
  const insecureResult = run({
    ...validEnvironment,
    NEXT_PUBLIC_SITE_URL: "http://movx-preview.example",
  });
  const geoapifyResult = run({
    ...validEnvironment,
    NEXT_PUBLIC_GEOAPIFY_API_KEY: "do-not-print!",
  });
  assert.notEqual(insecureResult.status, 0);
  assert.match(insecureResult.stderr, /exact root HTTPS origin/);
  assert.notEqual(geoapifyResult.status, 0);
  assert.match(geoapifyResult.stderr, /valid public Geoapify API key/);
  assert.doesNotMatch(geoapifyResult.stderr, /do-not-print/);
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
