import "server-only";
import { sql } from "drizzle-orm";
import { parseSessionTypes, sessionUuid } from "@/domain/session-types";
import type { SessionCatalog } from "@/domain/typed-sessions";
import {
  withDatabaseConnection,
  type DatabaseConnection,
} from "@/server/db/client";

export async function publicSessionCatalogRecord(
  slug: string,
  connection?: DatabaseConnection,
): Promise<SessionCatalog | null> {
  return withDatabaseConnection(async ({ db }) => {
    // A confirmed absent rollout capability is different from an installed
    // catalog that cannot be read. Do not cache absence across requests.
    const capabilities = await db.execute<{ installed: boolean }>(
      sql`select to_regprocedure('app.public_session_type_catalog(text)') is not null as installed`,
    );
    if (capabilities.length !== 1)
      throw new Error("Session catalog capability unavailable.");
    if (capabilities[0].installed === false)
      return { enabled: false, types: [], locations: [] };
    if (capabilities[0].installed !== true)
      throw new Error("Invalid session catalog capability.");

    const rows = await db.execute<{ catalog: unknown }>(
      sql`select app.public_session_type_catalog(${slug}::text) as catalog`,
    );
    if (rows.length !== 1) throw new Error("Session catalog unavailable.");
    const value = rows[0].catalog;
    if (value === null) return null;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid session catalog.");
    const catalog = value as Record<string, unknown>;
    if (
      typeof catalog.enabled !== "boolean" ||
      !Array.isArray(catalog.locations)
    )
      throw new Error("Invalid session catalog.");
    const locations = catalog.locations.map((location: unknown) => {
      if (!location || typeof location !== "object" || Array.isArray(location))
        throw new Error("Invalid session catalog location.");
      const row = location as Record<string, unknown>;
      if (
        !sessionUuid(row.id) ||
        typeof row.name !== "string" ||
        typeof row.label !== "string"
      )
        throw new Error("Invalid session catalog location.");
      return { id: row.id, name: row.name, label: row.label };
    });
    return {
      enabled: catalog.enabled,
      types: parseSessionTypes(catalog.types),
      locations,
    };
  }, connection);
}
