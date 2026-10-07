import "server-only";

import { parseDatabaseUrl } from "./config";

export function databaseRuntimeConfig() {
  return parseDatabaseUrl(process.env.DATABASE_URL);
}
