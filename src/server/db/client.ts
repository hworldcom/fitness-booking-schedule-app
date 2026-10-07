import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseRuntimeConfig } from "./env";
import * as schema from "./schema";

export function createDatabaseConnection(config = databaseRuntimeConfig()) {
  const queryClient = postgres(config.connectionString, {
    max: 1,
    prepare: false,
    ssl: config.ssl,
  });

  return {
    db: drizzle(queryClient, { schema }),
    queryClient,
  };
}

export type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

export async function withDatabaseConnection<T>(
  work: (connection: DatabaseConnection) => Promise<T>,
  connection?: DatabaseConnection,
) {
  const ownedConnection = connection ?? createDatabaseConnection();
  try {
    return await work(ownedConnection);
  } finally {
    await ownedConnection.queryClient.end({ timeout: 1 });
  }
}
