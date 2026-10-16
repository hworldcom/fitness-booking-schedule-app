import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  hostedDevelopmentConfiguration,
  hostedRuntimeConfiguration,
  redactHostedError,
} from "../scripts/lib/hosted-environment.mjs";

const dev = "mdzidiqosxbghmfyxphb";
const prod = "yltijwebedkraypgkqmc";
const password = "synthetic-secret%40value";
const devValues = {
  DATABASE_URL: `postgresql://movx_dev_runtime_login.${dev}:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  NEXT_PUBLIC_SUPABASE_URL: `https://${dev}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic-public-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
};

test("hosted targets bind the project, runtime role and environment together", () => {
  assert.equal(
    hostedRuntimeConfiguration(devValues, "dev").runtimeUser,
    "movx_dev_runtime_login",
  );
  assert.throws(() => hostedRuntimeConfiguration(devValues, "prod"));
  assert.equal(
    hostedRuntimeConfiguration(
      {
        ...devValues,
        DATABASE_URL: devValues.DATABASE_URL.replaceAll(dev, prod).replace(
          "movx_dev_runtime_login",
          "movx_prod_runtime_login",
        ),
        NEXT_PUBLIC_SUPABASE_URL: `https://${prod}.supabase.co`,
      },
      "prod",
    ).projectRef,
    prod,
  );
  for (const values of [
    {},
    { ...devValues, DATABASE_URL: undefined },
    {
      ...devValues,
      DATABASE_URL: devValues.DATABASE_URL.replace(
        "movx_dev_runtime_login",
        "postgres",
      ),
    },
    {
      ...devValues,
      DATABASE_URL: devValues.DATABASE_URL.replace(":6543", ":5432"),
    },
    { ...devValues, DATABASE_URL: devValues.DATABASE_URL + "?sslmode=disable" },
    { ...devValues, NEXT_PUBLIC_SUPABASE_URL: `https://${prod}.supabase.co` },
    {
      ...devValues,
      NEXT_PUBLIC_SUPABASE_URL: `https://${dev}.supabase.co/private`,
    },
    { ...devValues, DATABASE_URL: devValues.DATABASE_URL.replace(dev, prod) },
  ])
    assert.throws(() => hostedRuntimeConfiguration(values, "dev"));
});

test("hosted development accepts only dev with a public key and exact localhost origin", () => {
  assert.equal(hostedDevelopmentConfiguration(devValues).port, "3100");
  for (const values of [
    { ...devValues, NEXT_PUBLIC_SITE_URL: "https://production.example" },
    { ...devValues, NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100" },
    { ...devValues, NEXT_PUBLIC_SITE_URL: "http://localhost:3100/redirect" },
    { ...devValues, NEXT_PUBLIC_SITE_URL: "http://localhost:80" },
    {
      ...devValues,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_do-not-print",
    },
    {
      ...devValues,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_<placeholder>",
    },
  ])
    assert.throws(() => hostedDevelopmentConfiguration(values));
});

test("hosted failures redact the connection and both encoded and decoded passwords", () => {
  const message = redactHostedError(
    new Error(
      `Failed ${devValues.DATABASE_URL}, ${password}, synthetic-secret@value`,
    ),
    devValues.DATABASE_URL,
  );
  assert.doesNotMatch(message, /synthetic-secret|postgresql:/);
  assert.match(message, /redacted/);
  assert.doesNotThrow(() =>
    redactHostedError(
      new Error("bad malformed%ZZpass"),
      devValues.DATABASE_URL.replace(password, "malformed%ZZpass"),
    ),
  );
});

test("hosted CLI preflight refuses missing targets and owner credentials without network or secret output", () => {
  for (const [script, args, values] of [
    ["scripts/verify-hosted-runtime-database.mjs", [], devValues],
    [
      "scripts/verify-hosted-runtime-database.mjs",
      ["--environment", "dev"],
      {},
    ],
    [
      "scripts/verify-hosted-runtime-database.mjs",
      ["--environment", "dev"],
      {
        ...devValues,
        DATABASE_URL: devValues.DATABASE_URL.replace(
          "movx_dev_runtime_login",
          "postgres",
        ),
      },
    ],
    [
      "scripts/start-hosted-development.mjs",
      ["--check"],
      { ...devValues, NEXT_PUBLIC_SUPABASE_URL: `https://${prod}.supabase.co` },
    ],
  ] as const) {
    const result = spawnSync(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      env: { NODE_ENV: "test", PATH: process.env.PATH, ...values },
      encoding: "utf8",
      timeout: 3000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /synthetic-secret|sb_secret_|sb_publishable_synthetic/,
    );
  }
  const valid = spawnSync(
    process.execPath,
    ["scripts/start-hosted-development.mjs", "--check"],
    {
      env: { NODE_ENV: "test", PATH: process.env.PATH, ...devValues },
      encoding: "utf8",
      timeout: 3000,
    },
  );
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /Validated hosted dev configuration/);
  assert.doesNotMatch(
    valid.stdout,
    /synthetic-secret|sb_publishable_synthetic/,
  );
});

test("Vercel refuses swapped dev/prod projects and accepts each correct deployment target", () => {
  const run = (values: Partial<NodeJS.ProcessEnv>) =>
    spawnSync(process.execPath, ["scripts/validate-vercel-environment.mjs"], {
      env: {
        NODE_ENV: "test",
        PATH: process.env.PATH,
        ...devValues,
        NEXT_PUBLIC_SITE_URL: "https://uat.example",
        ...values,
      },
      encoding: "utf8",
      timeout: 3000,
    });
  assert.equal(run({ VERCEL_ENV: "preview" }).status, 0);
  assert.equal(run({ VERCEL_ENV: "production" }).status, 1);
  const production = {
    DATABASE_URL: devValues.DATABASE_URL.replaceAll(dev, prod).replace(
      "movx_dev_runtime_login",
      "movx_prod_runtime_login",
    ),
    NEXT_PUBLIC_SUPABASE_URL: `https://${prod}.supabase.co`,
  };
  assert.equal(run({ ...production, VERCEL_ENV: "production" }).status, 0);
  assert.equal(run({ ...production, VERCEL_ENV: "preview" }).status, 1);
});
