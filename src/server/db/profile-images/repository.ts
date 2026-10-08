import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { isOwnedProfileImageStoragePath } from "@/profile-images/contracts";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { coachProfiles, profiles } from "@/server/db/schema";

export type AccountAvatarReference = Readonly<{
  path: string | null;
  updatedAt: string | null;
}>;

export type OwnedCoachPortraitReference = Readonly<{
  source: "fixture" | "storage" | null;
  path: string | null;
  updatedAt: string | null;
}>;

export class ProfileImageReferenceConflictError extends Error {
  constructor(
    message = "The profile image reference conflicts with current state.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProfileImageReferenceConflictError";
  }
}

export async function confirmedBookingClientAvatarReference(
  transaction: ActorDatabaseTransaction,
  bookingId: string,
): Promise<AccountAvatarReference | null> {
  if (!isCanonicalUuid(bookingId)) return null;
  const rows = await transaction.execute<{
    booking_id: string;
    client_profile_id: string;
    avatar_storage_path: string;
    avatar_updated_at: string | Date;
  }>(sql`
    select *
    from app.current_confirmed_booking_client_avatar_references(
      ${bookingId}::uuid
    )
  `);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row ||
    row.booking_id !== bookingId ||
    !isOwnedProfileImageStoragePath(
      row.avatar_storage_path,
      row.client_profile_id,
    )
  ) {
    throw new ProfileImageReferenceConflictError();
  }
  return Object.freeze({
    path: row.avatar_storage_path,
    updatedAt: isoTimestamp(row.avatar_updated_at),
  });
}

function isoTimestamp(value: string | Date | null) {
  return value ? new Date(value).toISOString() : null;
}

function isReferenceConflict(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      current.code === "P0001" &&
      "message" in current &&
      typeof current.message === "string" &&
      (current.message.includes("avatar reference") ||
        current.message.includes("portrait reference"))
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

export async function currentAccountAvatarReference(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
): Promise<AccountAvatarReference> {
  const rows = await transaction
    .select({
      path: profiles.avatarStoragePath,
      updatedAt: profiles.avatarUpdatedAt,
    })
    .from(profiles)
    .where(eq(profiles.id, actor.profileId));
  if (rows.length !== 1 || !rows[0]) {
    throw new ProfileImageReferenceConflictError();
  }
  return Object.freeze({
    path: rows[0].path,
    updatedAt: isoTimestamp(rows[0].updatedAt),
  });
}

export async function currentCoachPortraitReference(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
): Promise<OwnedCoachPortraitReference | null> {
  const rows = await transaction
    .select({
      source: coachProfiles.portraitSource,
      path: coachProfiles.portraitPath,
      updatedAt: coachProfiles.portraitUpdatedAt,
    })
    .from(coachProfiles)
    .where(
      and(
        eq(coachProfiles.runId, actor.runId),
        eq(coachProfiles.profileId, actor.profileId),
      ),
    );
  if (rows.length > 1) throw new ProfileImageReferenceConflictError();
  const row = rows[0];
  if (!row) return null;
  if (
    row.source !== null &&
    row.source !== "fixture" &&
    row.source !== "storage"
  ) {
    throw new ProfileImageReferenceConflictError();
  }
  return Object.freeze({
    source: row.source,
    path: row.path,
    updatedAt: isoTimestamp(row.updatedAt),
  });
}

export async function setCurrentAccountAvatarReference(
  transaction: ActorDatabaseTransaction,
  requestedPath: string | null,
  expectedPath: string | null,
) {
  try {
    const rows = await transaction.execute<{
      previous_path: string | null;
      media_updated_at: string | Date | null;
    }>(sql`
      select *
      from app.set_current_account_avatar_reference(
        ${requestedPath}::text,
        ${expectedPath}::text
      )
    `);
    if (rows.length !== 1 || !rows[0]) {
      throw new ProfileImageReferenceConflictError();
    }
    return Object.freeze({
      previousPath: rows[0].previous_path,
      updatedAt: isoTimestamp(rows[0].media_updated_at),
    });
  } catch (error) {
    if (error instanceof ProfileImageReferenceConflictError) throw error;
    if (isReferenceConflict(error)) {
      throw new ProfileImageReferenceConflictError(undefined, { cause: error });
    }
    throw error;
  }
}

export async function setCurrentCoachPortraitReference(
  transaction: ActorDatabaseTransaction,
  requestedPath: string | null,
  expectedSource: string | null,
  expectedPath: string | null,
) {
  try {
    const rows = await transaction.execute<{
      previous_source: string | null;
      previous_path: string | null;
      media_updated_at: string | Date | null;
    }>(sql`
      select *
      from app.set_current_coach_portrait_reference(
        ${requestedPath}::text,
        ${expectedSource}::text,
        ${expectedPath}::text
      )
    `);
    if (rows.length !== 1 || !rows[0]) {
      throw new ProfileImageReferenceConflictError();
    }
    return Object.freeze({
      previousSource: rows[0].previous_source,
      previousPath: rows[0].previous_path,
      updatedAt: isoTimestamp(rows[0].media_updated_at),
    });
  } catch (error) {
    if (error instanceof ProfileImageReferenceConflictError) throw error;
    if (isReferenceConflict(error)) {
      throw new ProfileImageReferenceConflictError(undefined, { cause: error });
    }
    throw error;
  }
}
