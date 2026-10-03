import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("local Supabase enables six-digit email OTP on the canonical route", () => {
  const config = read("supabase/config.toml");
  const template = read("supabase/templates/email-otp.html");
  assert.match(config, /site_url = "http:\/\/localhost:3100"/);
  assert.match(
    config,
    /additional_redirect_urls = \["http:\/\/localhost:3100\/sign-in"\]/,
  );
  assert.match(config, /otp_length = 6/);
  assert.match(config, /email_sent = 30/);
  assert.match(config, /\[auth\.email\.template\.magic_link\]/);
  assert.match(
    config,
    /content_path = "\.\/supabase\/templates\/email-otp\.html"/,
  );
  assert.match(template, /\{\{ \.Token \}\}/);
  assert.equal(template.match(/\{\{ \.Token \}\}/g)?.length, 1);
  assert.match(config, /Your MovX Club sign-in code/);
  assert.match(template, /Your MovX Club sign-in code/);
  assert.match(template, /hello@movx\.club/);
  assert.doesNotMatch(template, /ConfirmationURL|TokenHash/);
  assert.doesNotMatch(template, /RepX Club/);
  assert.match(config, /\[auth\.web3\.solana\]\nenabled = false/);
  assert.doesNotMatch(config, /\[auth\.captcha\]\nenabled = true/);
});

test("database-only and Auth-enabled local startup remain separate", () => {
  const packageJson = JSON.parse(read("package.json")) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
  };

  assert.match(packageJson.scripts["db:start"], /gotrue/);
  assert.doesNotMatch(packageJson.scripts["auth:start"], /gotrue/);
  assert.doesNotMatch(packageJson.scripts["auth:start"], /kong/);
  assert.doesNotMatch(packageJson.scripts["auth:start"], /mailpit/);
  assert.match(
    packageJson.scripts["auth:status"],
    /API_URL\|PUBLISHABLE_KEY\|ANON_KEY/,
  );
  assert.doesNotMatch(packageJson.scripts["auth:status"], /SERVICE_ROLE/);
  assert.equal(
    packageJson.scripts["db:runtime"],
    "node scripts/prepare-local-runtime-database.mjs",
  );
  assert.equal(
    (JSON.parse(read("package.json")) as { name: string }).name,
    "movx-club",
  );
  assert.equal(packageJson.dependencies["@supabase/supabase-js"], "2.116.0");
  assert.equal(packageJson.dependencies["@supabase/ssr"], "0.12.7");
});

test("profile enrollment accepts only a bounded display name", () => {
  const exampleEnvironment = read(".env.example");
  const route = read("src/app/api/auth/identity/route.ts");

  assert.doesNotMatch(exampleEnvironment, /PREPARED_PERSONAL_IDENTITIES_JSON/);
  assert.match(route, /verifiedAuthSession\(\)/);
  assert.match(route, /normalizeDisplayName/);
  assert.match(route, /Object\.keys\(value\)\.length === 1/);
});

test("server Auth verifies claims and never promotes editable metadata", () => {
  const session = read("src/server/auth/session.ts");
  const sessionRoute = read("src/app/api/auth/session/route.ts");
  const proxy = read("src/server/auth/proxy.ts");

  assert.match(session, /auth\.getClaims\(\)/);
  assert.match(session, /auth\.getUser\(\)/);
  assert.match(proxy, /auth\.getClaims\(\)/);
  assert.doesNotMatch(session, /getSession\(/);
  assert.doesNotMatch(proxy, /getSession\(/);
  assert.doesNotMatch(session, /user_metadata|app_metadata/);
  assert.match(session, /email_confirmed_at/);
  assert.match(session, /identity\.provider === "email"/);
  assert.match(sessionRoute, /session\.status === "unavailable" \? 503 : 200/);
});
