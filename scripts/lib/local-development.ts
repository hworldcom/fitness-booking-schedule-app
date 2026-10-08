import {
  assertLoopbackSupabaseTargets,
  type LocalSupabaseStatus,
} from "./local-coach-accounts";

export const LOCAL_APP_URL = "http://localhost:3100";
export const LOCAL_MAILPIT_URL = "http://127.0.0.1:55324";
export const LOCAL_RUNTIME_DATABASE_URL =
  "postgresql://repx_runtime_login:postgres@127.0.0.1:55322/postgres";

export function assertLocalDevelopmentNodeVersion(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-|$)/.exec(version);
  if (!match || Number(match[1]) !== 24 || Number(match[2]) < 21) {
    throw new Error(
      `Node.js 24.21.x or newer within major 24 is required; current version is ${version}. Run \`nvm use\` and try again.`,
    );
  }
}

export function localDevelopmentEnvironment(status: LocalSupabaseStatus) {
  assertLoopbackSupabaseTargets(status);
  const api = new URL(status.apiUrl);
  const database = new URL(status.databaseUrl);
  if (api.port !== "55321" || database.port !== "55322") {
    throw new Error(
      "The local Supabase stack must use the repository ports 55321 and 55322.",
    );
  }
  return Object.freeze({
    DATABASE_URL: LOCAL_RUNTIME_DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: status.apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.publishableKey,
    NEXT_PUBLIC_SITE_URL: LOCAL_APP_URL,
  });
}
