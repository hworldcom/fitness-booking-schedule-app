import { readFileSync } from "node:fs";
import {
  assertLoopbackSupabaseTargets,
  type LocalSupabaseStatus,
} from "./local-coach-accounts";
import { hostedDevelopmentConfiguration } from "./hosted-environment.mjs";

export function demoEnvironmentArgument(args: readonly string[]) {
  if (
    args.length < 2 ||
    args[0] !== "--environment" ||
    args[1] !== "local" ||
    args.slice(2).some((v) => !["--check", "--publish-urls"].includes(v)) ||
    new Set(args).size !== args.length
  )
    throw new Error(
      "Fictional coaches are local-only. Usage: provision-demo-coaches.ts --environment local [--check] [--publish-urls]. Hosted UAT uses real coaches; no target or credentials were accessed.",
    );
  return "local" as const;
}

export function assertDemoLocalTarget(status: LocalSupabaseStatus) {
  assertLoopbackSupabaseTargets(status);
  const api = new URL(status.apiUrl),
    database = new URL(status.databaseUrl);
  if (
    api.port !== "55321" ||
    database.port !== "55322" ||
    database.pathname !== "/postgres" ||
    api.pathname !== "/" ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    database.search ||
    database.hash
  )
    throw new Error(
      "Demo setup requires this repository's exact local Auth/database ports and postgres database.",
    );
}

export function demoHostedTarget(values: Record<string, string | undefined>) {
  // Operator inspection/retirement only. Provisioning rejects every hosted flag
  // before this validator or any CLI/Auth/credential access can be reached.
  const configuration = hostedDevelopmentConfiguration(values);
  // Also reject accidental editing of the environment manifest to point dev at prod.
  const targets = JSON.parse(
    readFileSync(
      new URL("../../config/supabase-environments.json", import.meta.url),
      "utf8",
    ),
  );
  if (
    configuration.projectRef === targets.prod.projectRef ||
    configuration.projectRef !== "mdzidiqosxbghmfyxphb"
  )
    throw new Error(
      "Hosted demo retirement refuses production or an unknown development project.",
    );
  return configuration;
}
