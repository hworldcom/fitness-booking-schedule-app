import "server-only";
import { sql } from "drizzle-orm";
import { isCoachPublicHandleResult } from "@/domain/coach-public-url";
import { isCoachPublicSlug } from "@/domain/coaches";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { withDatabaseConnection } from "@/server/db/client";

function ownerResult(value: unknown) {
  if (!isCoachPublicHandleResult(value))
    throw new Error("Invalid coach URL capability.");
  return value;
}
export async function ownedCoachPublicHandleRecord(
  tx: ActorDatabaseTransaction,
) {
  const rows = await tx.execute<{ result: unknown }>(
    sql`select app.owned_coach_public_handle() as result`,
  );
  return ownerResult(rows[0]?.result);
}
export async function confirmCoachPublicHandleRecord(
  tx: ActorDatabaseTransaction,
  username: string,
  revision: number,
) {
  const rows = await tx.execute<{ result: unknown }>(
    sql`select app.confirm_owned_coach_public_handle(${username}::text,${revision}::integer) as result`,
  );
  return ownerResult(rows[0]?.result);
}
function publicResult(row: { public_slug: string; username: string }) {
  if (
    !isCoachPublicSlug(row.public_slug) ||
    !/^[a-z][a-z0-9_]{2,29}$/.test(row.username)
  )
    throw new Error("Invalid public coach URL.");
  return { slug: row.public_slug, publicPath: `/@${row.username}` };
}
export async function publicCoachHandleRecord(value: string, bySlug = false) {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<{ public_slug: string; username: string }>(
      sql`select * from app.public_coach_handle(${value}::text,${bySlug}::boolean)`,
    );
    if (rows.length > 1) throw new Error("Ambiguous public coach URL.");
    return rows[0] ? publicResult(rows[0]) : null;
  });
}
export async function publicCoachPathsRecord(slugs: readonly string[]) {
  if (!slugs.length) return new Map<string, string>();
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<{
      public_slug: string;
      username: string;
    }>(sql`
      select h.* from unnest(array[${sql.join(
        slugs.map((slug) => sql`${slug}::text`),
        sql`, `,
      )}]::text[]) s(slug)
        cross join lateral app.public_coach_handle(s.slug,true) h
    `);
    return new Map(
      rows.map((row) => {
        const value = publicResult(row);
        return [value.slug, value.publicPath];
      }),
    );
  });
}
