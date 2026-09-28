import "server-only";

import {
  isCloudflareWorkerRuntime,
  parseDatabaseUrl,
  parseHyperdriveDatabaseUrl,
} from "./config";

export function databaseRuntimeConfig() {
  return parseDatabaseUrl(process.env.DATABASE_URL);
}

export async function requestDatabaseRuntimeConfig() {
  if (!isCloudflareWorkerRuntime()) return databaseRuntimeConfig();

  const { cloudflareDatabaseConnectionString } =
    await import("./cloudflare-env");
  return parseHyperdriveDatabaseUrl(cloudflareDatabaseConnectionString());
}
