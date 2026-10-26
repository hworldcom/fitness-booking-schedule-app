import "server-only";
import { profileImageStorage } from "@/server/storage/profile-images";
import type { ProfileImageStorage } from "@/server/storage/contracts";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { memberAvatarUrl } from "@/domain/member-profile";
import { connectionAthleteAvatarUrl } from "@/domain/coach-athlete-connections";
import {
  isOwnedProfileImageStoragePath,
  isPublicCoachPortraitUrl,
  privateBookingRequestClientAvatarUrl,
} from "@/profile-images/contracts";

// The database returns a bounded independent grant, never a private object path.
// Convert it before the shared DTO parser rebuilds the browser response.
export function materializeMessageMedia(
  value: unknown,
  storage: Pick<ProfileImageStorage, "publicPortraitUrl"> = profileImageStorage,
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items))
    return {
      ...record,
      items: record.items.map((item) => materializeMessageMedia(item, storage)),
    };
  if (record.conversation)
    return {
      ...record,
      conversation: materializeMessageMedia(record.conversation, storage),
    };
  if (typeof record.counterpartName !== "string") return value;
  const raw = record.counterpartMedia;
  let imageUrl: string | null = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const media = raw as Record<string, unknown>;
    if (
      typeof media.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(media.updatedAt))
    )
      throw Error("Invalid message media reference.");
    if (media.kind === "member-avatar") {
      const counterpartId =
        record.role === "coach"
          ? record.athleteProfileId
          : record.coachProfileId;
      if (typeof media.id !== "string" || media.id !== counterpartId)
        throw Error("Invalid message media reference.");
      imageUrl = memberAvatarUrl(media.id, media.updatedAt);
    } else if (record.role === "athlete" && media.kind === "coach-portrait") {
      if (
        (media.source !== "fixture" &&
          media.source !== "storage" &&
          media.source !== "account") ||
        typeof media.path !== "string" ||
        typeof record.coachProfileId !== "string" ||
        (media.source === "account" && media.path !== record.coachProfileId) ||
        (media.source === "storage" &&
          !isOwnedProfileImageStoragePath(media.path, record.coachProfileId))
      )
        throw Error("Invalid message media reference.");
      imageUrl = storage.publicPortraitUrl({
        source: media.source,
        path: media.path,
        updatedAt: media.updatedAt,
      });
      if (imageUrl && !isPublicCoachPortraitUrl(imageUrl))
        throw Error("Invalid message media reference.");
    } else if (
      record.role === "coach" &&
      typeof media.id === "string" &&
      isCanonicalUuid(media.id)
    ) {
      if (media.kind === "connection-avatar")
        imageUrl = connectionAthleteAvatarUrl(media.id, media.updatedAt);
      else if (media.kind === "request-avatar")
        imageUrl = privateBookingRequestClientAvatarUrl(
          media.id,
          media.updatedAt,
        );
      else throw Error("Invalid message media reference.");
    } else throw Error("Invalid message media reference.");
  }
  return { ...record, counterpartImageUrl: imageUrl };
}
