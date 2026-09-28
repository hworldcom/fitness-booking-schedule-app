import "server-only";

import { env } from "cloudflare:workers";
import { DatabaseConfigurationError } from "./config";

export function cloudflareDatabaseConnectionString() {
  const value = env.MOVX_DATABASE?.connectionString;
  if (typeof value !== "string" || !value.trim()) {
    throw new DatabaseConfigurationError(
      "The MOVX_DATABASE Hyperdrive binding is required in Cloudflare.",
    );
  }
  return value;
}
