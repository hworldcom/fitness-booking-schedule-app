import "server-only";
import { sql } from "drizzle-orm";
import { isEventId } from "@/domain/event-banners";
import { isCoachPublicSlug } from "@/domain/coaches";
import { isWebsiteRevision } from "@/domain/coach-website";
import { isOwnedProfileImageStoragePath } from "@/profile-images/contracts";
import type { ActorDatabaseTransaction } from "../authorization/repository";
import { withDatabaseConnection } from "../client";

export type EventBannerRecord = Readonly<{
  session_id: string;
  coach_profile_id: string;
  revision: number;
  card_path: string | null;
  hero_path: string | null;
  editable: boolean;
}>;
export class EventBannerError extends Error {
  constructor(public readonly status: "forbidden" | "conflict" | "invalid") {
    super("Event banner operation failed.");
  }
}
function translate(error: unknown): never {
  let current = error;
  for (
    let depth = 0;
    depth < 8 && current && typeof current === "object";
    depth++
  ) {
    const e = current as { code?: string; cause?: unknown };
    if (e.code === "42501") throw new EventBannerError("forbidden");
    if (["22023", "23514", "22P02"].includes(e.code ?? ""))
      throw new EventBannerError("invalid");
    if (["P0001", "40001", "23505", "23503"].includes(e.code ?? ""))
      throw new EventBannerError("conflict");
    current = e.cause;
  }
  throw error;
}
function record(row: EventBannerRecord | undefined) {
  if (
    !row ||
    !isEventId(row.session_id) ||
    !isEventId(row.coach_profile_id) ||
    !isWebsiteRevision(row.revision) ||
    typeof row.editable !== "boolean" ||
    (row.card_path === null) !== (row.hero_path === null) ||
    (row.card_path !== null &&
      (!isOwnedProfileImageStoragePath(row.card_path, row.coach_profile_id) ||
        !isOwnedProfileImageStoragePath(row.hero_path!, row.coach_profile_id) ||
        row.card_path === row.hero_path))
  )
    throw new Error("Invalid event banner record.");
  return row;
}
export async function ownedEventBannerRecord(
  tx: ActorDatabaseTransaction,
  id: string,
) {
  try {
    const rows = await tx.execute<EventBannerRecord>(
      sql`select * from app.owned_group_session_banner(${id}::uuid)`,
    );
    if (rows.length !== 1) throw new EventBannerError("forbidden");
    return record(rows[0]);
  } catch (error) {
    return translate(error);
  }
}
export async function mutateEventBannerRecord(
  tx: ActorDatabaseTransaction,
  id: string,
  revision: number,
  banner: { cardPath: string; heroPath: string } | null,
) {
  try {
    const rows = await tx.execute<{
      previous_card_path: string | null;
      previous_hero_path: string | null;
    }>(
      sql`select * from app.mutate_owned_group_session_banner(${id}::uuid,${revision}::integer,${banner?.cardPath ?? null}::text,${banner?.heroPath ?? null}::text)`,
    );
    if (rows.length !== 1) throw new EventBannerError("conflict");
    return {
      record: await ownedEventBannerRecord(tx, id),
      previousPaths: [
        rows[0].previous_card_path,
        rows[0].previous_hero_path,
      ].filter((p): p is string => p !== null),
    };
  } catch (error) {
    return translate(error);
  }
}
export type EventMediaRow = {
  session_id: string;
  coach_profile_id: string;
  coach_slug: string;
  portrait_source: "fixture" | "storage" | null;
  portrait_path: string | null;
  portrait_updated_at: string | Date | null;
  event_revision: number;
  event_card_path: string | null;
  event_hero_path: string | null;
  coach_revision: number;
  coach_card_path: string | null;
};
export async function publicEventMediaRecords(ids: readonly string[]) {
  if (ids.length > 100 || !ids.every(isEventId))
    throw new Error("Invalid event media batch.");
  if (!ids.length) return [];
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<EventMediaRow>(
      sql`select * from app.public_group_event_media(array[${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}]::uuid[])`,
    );
    const found = new Set<string>();
    for (const row of rows) {
      if (
        !ids.includes(row.session_id) ||
        found.has(row.session_id) ||
        !isEventId(row.coach_profile_id) ||
        !isCoachPublicSlug(row.coach_slug) ||
        !isWebsiteRevision(row.event_revision) ||
        !isWebsiteRevision(row.coach_revision) ||
        (row.event_card_path === null) !== (row.event_hero_path === null)
      )
        throw new Error("Invalid public event media.");
      found.add(row.session_id);
      for (const path of [
        row.event_card_path,
        row.event_hero_path,
        row.coach_card_path,
      ])
        if (
          path !== null &&
          !isOwnedProfileImageStoragePath(path, row.coach_profile_id)
        )
          throw new Error("Invalid public media owner.");
      if (row.portrait_source === null) {
        if (row.portrait_path !== null || row.portrait_updated_at !== null)
          throw new Error("Invalid public portrait.");
      } else if (
        !row.portrait_path ||
        !row.portrait_updated_at ||
        !Number.isFinite(Date.parse(String(row.portrait_updated_at))) ||
        (row.portrait_source === "fixture"
          ? row.portrait_path !== `/images/coaches/${row.coach_slug}.webp`
          : row.portrait_source !== "storage" ||
            !isOwnedProfileImageStoragePath(
              row.portrait_path,
              row.coach_profile_id,
            ))
      )
        throw new Error("Invalid public portrait.");
    }
    return rows;
  });
}
