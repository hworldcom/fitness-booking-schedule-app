import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { hostedDevelopmentConfiguration } from "./lib/hosted-environment.mjs";

async function main() {
  if (process.argv.slice(2).some((argument) => argument !== "--check"))
    throw new Error(
      "Hosted development accepts only the optional --check flag.",
    );
  const configuration = hostedDevelopmentConfiguration(process.env);
  if (process.argv.includes("--check")) {
    console.log(
      "Validated hosted dev configuration without printing credentials.",
    );
    return;
  }
  const environment = { ...process.env };
  // Development-only initialization; production build/start never import this script.
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      fileURLToPath(new URL("./provision-demo-coaches.ts", import.meta.url)),
      "--environment",
      "dev",
    ],
    { env: process.env, stdio: "inherit" },
  );
  for (const name of [
    "COACH_REVIEW_DATABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_PASSWORD",
  ])
    delete environment[name];
  console.log(
    `Starting ${configuration.siteUrl} against the confirmed hosted dev project.`,
  );
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/next/dist/bin/next", import.meta.url),
      ),
      "dev",
      "--hostname",
      "localhost",
      "--port",
      configuration.port,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: environment,
      stdio: "inherit",
    },
  );
  const signals = ["SIGINT", "SIGTERM"];
  const handlers = signals.map((signal) => {
    const handler = () => {
      if (!child.killed) child.kill(signal);
    };
    process.on(signal, handler);
    return [signal, handler];
  });
  const [code, signal] = await once(child, "exit");
  for (const [name, handler] of handlers) process.off(name, handler);
  process.exitCode =
    signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : (code ?? 1);
}
main().catch((error) => {
  console.error(
    `Hosted development startup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
  process.exitCode = 1;
});
