import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  parseLocalSupabaseStatus,
  type LocalSupabaseStatus,
} from "./lib/local-coach-accounts";
import {
  LOCAL_APP_URL,
  LOCAL_MAILPIT_URL,
  assertLocalDevelopmentNodeVersion,
  localDevelopmentEnvironment,
} from "./lib/local-development";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const executable = (name: string) =>
  process.platform === "win32" ? `${name}.cmd` : name;

function runStep(
  message: string,
  command: string,
  args: readonly string[],
  hideStdout = false,
) {
  console.log(message);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: hideStdout ? ["inherit", "ignore", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${message.replace(/\.$/, "")} failed.`);
  }
}

function readLocalStatus(): LocalSupabaseStatus {
  const result = spawnSync(executable("supabase"), ["status", "-o", "env"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      "Could not read the local Supabase status after startup. Check Docker and run `npm run auth:start` for diagnostics.",
    );
  }
  return parseLocalSupabaseStatus(result.stdout);
}

async function runApplication(environment: NodeJS.ProcessEnv) {
  console.log(`Local services are ready:`);
  console.log(`- App: ${LOCAL_APP_URL}`);
  console.log(`- Captured email: ${LOCAL_MAILPIT_URL}`);
  console.log(
    "Press Ctrl-C to stop Next.js; run `npm run db:stop` to stop Supabase.",
  );

  const child = spawn(
    executable("next"),
    ["dev", "--hostname", "localhost", "--port", "3100"],
    {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit",
    },
  );
  const signals = ["SIGINT", "SIGTERM"] as const;
  const handlers = signals.map((signal) => {
    const handler = () => {
      if (!child.killed) child.kill(signal);
    };
    process.on(signal, handler);
    return [signal, handler] as const;
  });

  const [code, signal] = (await once(child, "exit")) as [
    number | null,
    NodeJS.Signals | null,
  ];
  for (const [name, handler] of handlers) process.off(name, handler);
  if (signal === "SIGINT") process.exitCode = 130;
  else if (signal === "SIGTERM") process.exitCode = 143;
  else process.exitCode = code ?? 1;
}

async function main() {
  assertLocalDevelopmentNodeVersion(process.versions.node);
  runStep(
    "Starting the local Supabase Auth, PostgreSQL and Mailpit services.",
    npmCommand,
    ["run", "--silent", "auth:start"],
    true,
  );
  runStep(
    "Applying pending local migrations without resetting data.",
    executable("supabase"),
    ["migration", "up", "--local"],
  );
  runStep(
    "Preparing the restricted local application database login.",
    npmCommand,
    ["run", "--silent", "db:runtime"],
  );
  runStep("Provisioning the persistent local ordinary test user.", npmCommand, [
    "run",
    "--silent",
    "auth:provision:test-user",
  ]);

  const localEnvironment = localDevelopmentEnvironment(readLocalStatus());
  const applicationEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    ...localEnvironment,
  };
  delete applicationEnvironment.COACH_REVIEW_DATABASE_URL;
  delete applicationEnvironment.SUPABASE_SERVICE_ROLE_KEY;
  delete applicationEnvironment.SUPABASE_SECRET_KEY;
  await runApplication(applicationEnvironment);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Local development startup failed: ${message}`);
  process.exitCode = 1;
});
