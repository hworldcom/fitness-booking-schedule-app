import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const commands = ["dev:hosted"] as const;
const localCommands = ["dev", "dev:local", "dev:docker"] as const;
const dev = "mdzidiqosxbghmfyxphb";
const prod = "yltijwebedkraypgkqmc";
const values = {
  DATABASE_URL: `postgresql://movx_dev_runtime_login.${dev}:synthetic-secret@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`,
  NEXT_PUBLIC_SUPABASE_URL: `https://${dev}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic-public-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
};

function startupFixture(local = false) {
  const directory = mkdtempSync(join(tmpdir(), "movx-dev0269-"));
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      scripts: {
        ...packageJson.scripts,
        ...(local
          ? {
              "db:runtime": "supabase fixture-runtime",
              "auth:provision:test-user": "supabase fixture-user",
            }
          : {}),
      },
    }),
  );
  for (const path of [
    "scripts/start-hosted-development.mjs",
    "scripts/lib/hosted-environment.mjs",
    "config/supabase-environments.json",
    ...(local
      ? [
          "scripts/start-local-development.ts",
          "scripts/lib/local-development.ts",
          "scripts/lib/local-coach-accounts.ts",
          "scripts/lib/local-supabase-project.mjs",
          "supabase/config.toml",
        ]
      : []),
  ]) {
    const target = join(directory, path);
    mkdirSync(join(target, ".."), { recursive: true });
    copyFileSync(new URL(`../${path}`, import.meta.url), target);
  }
  const bin = join(directory, "node_modules/.bin");
  mkdirSync(bin, { recursive: true });
  for (const command of ["docker", "supabase", "tsx"]) {
    if (local && command === "tsx") {
      symlinkSync(
        new URL("../node_modules/.bin/tsx", import.meta.url),
        join(bin, command),
      );
      continue;
    }
    const source =
      local && command === "supabase"
        ? `#!/usr/bin/env node
import {appendFileSync} from 'node:fs';
appendFileSync(process.env.DEV0269_FORBIDDEN_CALLS, process.argv.slice(2).join(' ')+'\\n');
if(process.argv[2]==='status')console.log('API_URL="http://127.0.0.1:55321"\\nDB_URL="postgresql://postgres:postgres@127.0.0.1:55322/postgres"\\nPUBLISHABLE_KEY="local-public"\\nSERVICE_ROLE_KEY="local-service"');
`
        : '#!/usr/bin/env node\nrequire("node:fs").writeFileSync(process.env.DEV0269_FORBIDDEN_CALLS, "Unexpected database setup command"); process.exit(91);\n';
    writeFileSync(join(bin, command), source, { mode: 0o700 });
  }
  const next = join(directory, "node_modules/next/dist/bin");
  mkdirSync(next, { recursive: true });
  writeFileSync(
    join(next, "next"),
    `console.log("NEXT_RECORD:" + JSON.stringify({
      args: process.argv.slice(2),
      authUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      runtimeUser: new URL(process.env.DATABASE_URL).username,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL
    }));\n`,
  );
  if (local) {
    writeFileSync(
      join(bin, "next"),
      "#!/usr/bin/env node\n" + readFileSync(join(next, "next"), "utf8"),
      { mode: 0o700 },
    );
  }
  const marker = join(directory, "unexpected-database-command");
  return {
    writeEnvironment(configuration: Record<string, string>) {
      writeFileSync(
        join(directory, ".env.development.local"),
        Object.entries(configuration)
          .map(([name, value]) => `${name}=${value}`)
          .join("\n"),
        { mode: 0o600 },
      );
    },
    run(command: (typeof commands)[number] | (typeof localCommands)[number]) {
      // Map-worker hooks have their own existing regression coverage. Skip
      // lifecycle hooks so this fixture exercises just the real app entrypoint.
      return spawnSync(
        "npm",
        ["--ignore-scripts", "run", "--silent", command],
        {
          cwd: directory,
          env: {
            NODE_ENV: "test",
            PATH: `${bin}:${process.env.PATH}`,
            DEV0269_FORBIDDEN_CALLS: marker,
            ...(local ? values : {}),
          },
          encoding: "utf8",
          timeout: 10000,
        },
      );
    },
    assertNoDatabaseSetup() {
      assert.equal(existsSync(marker), false, "Database setup was invoked");
    },
    databaseCalls() {
      return readFileSync(marker, "utf8").split("\n").filter(Boolean);
    },
    cleanup() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("explicit hosted development launches without local database setup", () => {
  const fixture = startupFixture();
  try {
    fixture.writeEnvironment(values);
    for (const command of commands) {
      const result = fixture.run(command);
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stderr);
      const recorded = result.stdout
        .split("\n")
        .find((line) => line.startsWith("NEXT_RECORD:"));
      assert.ok(
        recorded,
        `${command} did not launch the guarded Next.js child`,
      );
      assert.deepEqual(JSON.parse(recorded.slice("NEXT_RECORD:".length)), {
        args: ["dev", "--hostname", "localhost", "--port", "3100"],
        authUrl: values.NEXT_PUBLIC_SUPABASE_URL,
        runtimeUser: `movx_dev_runtime_login.${dev}`,
        siteUrl: values.NEXT_PUBLIC_SITE_URL,
      });
      assert.doesNotMatch(result.stdout + result.stderr, /synthetic-secret/);
      fixture.assertNoDatabaseSetup();
    }
  } finally {
    fixture.cleanup();
  }
});

test("explicit hosted development refuses missing, loopback and prod settings without fallback", () => {
  for (const configuration of [
    null,
    {
      ...values,
      DATABASE_URL:
        "postgresql://postgres:synthetic-secret@127.0.0.1:55322/postgres",
    },
    {
      ...values,
      DATABASE_URL: values.DATABASE_URL.replaceAll(dev, prod).replace(
        "movx_dev_runtime_login",
        "movx_prod_runtime_login",
      ),
      NEXT_PUBLIC_SUPABASE_URL: `https://${prod}.supabase.co`,
    },
  ]) {
    const fixture = startupFixture();
    try {
      if (configuration) fixture.writeEnvironment(configuration);
      for (const command of commands) {
        const result = fixture.run(command);
        assert.equal(result.error, undefined);
        assert.notEqual(
          result.status,
          0,
          `${command} accepted unsafe settings`,
        );
        assert.doesNotMatch(
          result.stdout + result.stderr,
          /NEXT_RECORD:|synthetic-secret/,
        );
        fixture.assertNoDatabaseSetup();
      }
    } finally {
      fixture.cleanup();
    }
  }
});

test("ordinary development prepares local services and overrides inherited hosted settings", () => {
  for (const command of localCommands) {
    const fixture = startupFixture(true);
    try {
      fixture.writeEnvironment(values);
      const result = fixture.run(command);
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stderr);
      const recorded = result.stdout
        .split("\n")
        .find((line) => line.startsWith("NEXT_RECORD:"));
      assert.ok(recorded, result.stdout);
      assert.deepEqual(JSON.parse(recorded.slice("NEXT_RECORD:".length)), {
        args: ["dev", "--hostname", "localhost", "--port", "3100"],
        authUrl: "http://127.0.0.1:55321",
        runtimeUser: "repx_runtime_login",
        siteUrl: "http://localhost:3100",
      });
      const calls = fixture.databaseCalls();
      assert.match(calls[0], /^start --exclude /);
      assert.deepEqual(calls.slice(1), [
        "migration up --local",
        "fixture-runtime",
        "fixture-user",
        "status -o env",
      ]);
      assert.doesNotMatch(calls.join("\n"), /reset|--linked|db push/);
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /synthetic-secret|local-service/,
      );
    } finally {
      fixture.cleanup();
    }
  }
});
