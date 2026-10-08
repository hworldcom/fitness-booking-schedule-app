export const PROFILE_IMAGE_DIMENSION = 512;
export const PROFILE_IMAGE_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export const PROFILE_IMAGE_MAX_CANONICAL_BYTES = 512 * 1024;
export const PROFILE_IMAGE_MIME_TYPE = "image/webp";
export const PROFILE_IMAGE_WEBP_QUALITY = 82;

export const ACCOUNT_AVATAR_BUCKET = "account-avatars";
export const COACH_PORTRAIT_BUCKET = "coach-portraits";

export type ProfileImageMutationStatus =
  | "saved"
  | "removed"
  | "invalid"
  | "conflict"
  | "signed-out"
  | "forbidden"
  | "unavailable";

export type ProfileImageMutationSnapshot = Readonly<{
  status: ProfileImageMutationStatus;
  imageUrl: string | null;
}>;

export type CoachPortraitReference = Readonly<{
  source: "fixture" | "storage";
  path: string;
  updatedAt: string;
}>;

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const STORAGE_PATH_PATTERN = new RegExp(
  `^(${UUID_PATTERN})/(${UUID_PATTERN})[.]webp$`,
  "i",
);

export function profileImageStoragePath(profileId: string, objectId: string) {
  const path = `${profileId}/${objectId}.webp`;
  if (!isOwnedProfileImageStoragePath(path, profileId)) {
    throw new Error("Profile image identifiers must be UUIDs.");
  }
  return path;
}

export function isOwnedProfileImageStoragePath(
  path: string,
  profileId: string,
) {
  const match = STORAGE_PATH_PATTERN.exec(path);
  return match?.[1]?.toLowerCase() === profileId.toLowerCase();
}

export function privateAccountAvatarUrl(updatedAt: string | null) {
  return updatedAt
    ? `/api/profile/avatar?v=${encodeURIComponent(updatedAt)}`
    : null;
}

export function privateBookingClientAvatarUrl(
  bookingId: string,
  updatedAt: string | null,
) {
  if (!updatedAt || !new RegExp(`^${UUID_PATTERN}$`, "i").test(bookingId)) {
    return null;
  }
  return `/api/coach/bookings/${bookingId}/client-avatar?v=${encodeURIComponent(updatedAt)}`;
}

export function publicCoachPortraitUrl(
  reference: CoachPortraitReference | null,
  storageUrl: string | null,
) {
  if (!reference) return null;
  if (reference.source === "fixture") return reference.path;
  if (!storageUrl) return null;

  const encodedPath = reference.path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${storageUrl.replace(/\/$/, "")}/storage/v1/object/public/${COACH_PORTRAIT_BUCKET}/${encodedPath}?v=${encodeURIComponent(reference.updatedAt)}`;
}

export function isPublicCoachPortraitUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 1024) {
    return false;
  }
  if (/^\/images\/coaches\/[a-z0-9]+(?:-[a-z0-9]+)*[.]webp$/.test(value)) {
    return true;
  }
  try {
    const url = new URL(value);
    const pathPattern = new RegExp(
      `^/storage/v1/object/public/${COACH_PORTRAIT_BUCKET}/${UUID_PATTERN}/${UUID_PATTERN}[.]webp$`,
      "i",
    );
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      !url.hash &&
      pathPattern.test(url.pathname) &&
      url.searchParams.size === 1 &&
      Boolean(url.searchParams.get("v"))
    );
  } catch {
    return false;
  }
}

export function isProfileImageMutationSnapshot(
  value: unknown,
): value is ProfileImageMutationSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 2 &&
    (record.status === "saved" ||
      record.status === "removed" ||
      record.status === "invalid" ||
      record.status === "conflict" ||
      record.status === "signed-out" ||
      record.status === "forbidden" ||
      record.status === "unavailable") &&
    (record.imageUrl === null ||
      (typeof record.imageUrl === "string" &&
        record.imageUrl.length > 0 &&
        record.imageUrl.length <= 1024))
  );
}
