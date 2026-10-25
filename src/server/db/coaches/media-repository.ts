import "server-only";
import { sql } from "drizzle-orm";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import {
  withDatabaseConnection,
  createDatabaseConnection,
} from "@/server/db/client";
import { parseDatabaseUrl } from "@/server/db/config";

export type MediaAsset = Readonly<{
  id: string;
  run_id: string;
  profile_id: string;
  kind: "photo" | "video";
  status:
    | "reserved"
    | "creating"
    | "uploading"
    | "processing"
    | "ready"
    | "failed"
    | "retired"
    | "deleted";
  fingerprint: string;
  description: string;
  thumbnail_path: string | null;
  full_path: string | null;
  width: number | null;
  height: number | null;
  mux_upload_id: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  upload_url: string | null;
  duration: number | string | null;
  error: string | null;
  external_claimed: boolean;
}>;
export type MediaRecord = Readonly<{
  revision: number;
  photos: MediaAsset[];
  publishedPhotos: MediaAsset[];
  video: MediaAsset | null;
  publishedVideo: MediaAsset | null;
  uploads: MediaAsset[];
  cleanup: MediaAsset[];
  canPublish: boolean;
  claimed?: boolean;
}>;
export class CoachMediaDatabaseError extends Error {
  constructor(readonly status: "invalid" | "conflict" | "forbidden") {
    super("Coach media operation failed.");
  }
}
export function mediaDatabaseError(error: unknown): never {
  let value = error;
  for (let i = 0; i < 8 && value && typeof value === "object"; i++) {
    const e = value as { code?: string; cause?: unknown };
    if (e.code === "42501") throw new CoachMediaDatabaseError("forbidden");
    if (["23514", "22023", "22P02", "23502"].includes(e.code ?? ""))
      throw new CoachMediaDatabaseError("invalid");
    if (["P0001", "23505"].includes(e.code ?? ""))
      throw new CoachMediaDatabaseError("conflict");
    value = e.cause;
  }
  throw error;
}
export async function ownedCoachMediaRecord(
  tx: ActorDatabaseTransaction,
): Promise<MediaRecord> {
  try {
    const rows = await tx.execute<{ value: MediaRecord }>(
      sql`select app.owned_coach_media() value`,
    );
    if (!rows[0]?.value) throw Error("Missing coach media response.");
    return rows[0].value;
  } catch (error) {
    return mediaDatabaseError(error);
  }
}
export async function mutateCoachMediaRecord(
  tx: ActorDatabaseTransaction,
  revision: number,
  action: string,
  input: Record<string, unknown>,
): Promise<MediaRecord> {
  try {
    const rows = await tx.execute<{ value: MediaRecord }>(
      sql`select app.mutate_owned_coach_media(${revision}::integer,${action}::text,${JSON.stringify(input)}::jsonb) value`,
    );
    if (!rows[0]?.value) throw Error("Missing coach media response.");
    return rows[0].value;
  } catch (error) {
    return mediaDatabaseError(error);
  }
}
export async function publicCoachMediaRecord(slug: string) {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<{
      value: {
        profileId: string;
        photos: MediaAsset[];
        video: MediaAsset | null;
      } | null;
    }>(sql`select app.public_coach_media(${slug}::text) value`);
    return rows[0]?.value ?? null;
  });
}
async function workerWork<T>(
  work: Parameters<typeof withDatabaseConnection<T>>[0],
) {
  const config = parseDatabaseUrl(process.env.COACH_MEDIA_DATABASE_URL);
  return withDatabaseConnection(async (connection) => {
    const rows = await connection.db.execute<{ allowed: boolean }>(
      sql`select exists(select from pg_roles where rolname=current_user and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and pg_has_role(current_user,'app_media_worker','member') and not pg_has_role(current_user,'app_runtime','member') and not pg_has_role(current_user,'app_owner','member')) allowed`,
    );
    if (rows[0]?.allowed !== true)
      throw Error("A dedicated media worker connection is required.");
    return work(connection);
  }, createDatabaseConnection(config));
}
export async function applyCoachMediaVideo(
  id: string,
  uploadId: string,
  assetId: string,
  playbackId: string | null,
  status: string,
  duration: number | null,
) {
  return workerWork(async ({ db }) => {
    const rows = await db.execute<{ accepted: boolean }>(
      sql`select app.apply_coach_media_video(${id}::uuid,${uploadId},${assetId},${playbackId},${status},${duration}::numeric) accepted`,
    );
    return rows[0]?.accepted === true;
  });
}
export async function workerCoachMediaAsset(
  id: string,
): Promise<MediaAsset | null> {
  return workerWork(async ({ db }) => {
    const rows = await db.execute<{ value: MediaAsset | null }>(
      sql`select app.coach_media_worker_asset(${id}::uuid) value`,
    );
    return rows[0]?.value ?? null;
  });
}
