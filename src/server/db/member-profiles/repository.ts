import "server-only";
import { sql } from "drizzle-orm";
import { isOwnedProfileImageStoragePath } from "@/profile-images/contracts";
import type { ActorDatabaseTransaction } from "../authorization/repository";

export async function memberProfileRecord(
  tx: ActorDatabaseTransaction,
  id: string,
) {
  const rows = await tx.execute<{
    profile_id: string;
    display_name: string;
    avatar_storage_path: string | null;
    avatar_updated_at: string | Date | null;
  }>(sql`select * from app.current_member_profile(${id}::uuid)`);
  if (!rows.length) return null;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row.profile_id !== id ||
    typeof row.display_name !== "string" ||
    !row.display_name.trim() ||
    (row.avatar_storage_path !== null &&
      !isOwnedProfileImageStoragePath(row.avatar_storage_path, id))
  )
    throw Error("Invalid member profile response.");
  return {
    id: row.profile_id,
    displayName: row.display_name,
    path: row.avatar_storage_path,
    updatedAt: row.avatar_updated_at
      ? new Date(row.avatar_updated_at).toISOString()
      : null,
  };
}
