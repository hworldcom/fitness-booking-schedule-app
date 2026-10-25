import { isCanonicalUuid } from "./coach-bookings";
import { isWebsiteRevision } from "./coach-website";

export const COACH_MEDIA_PHOTO_LIMIT = 6;
export const COACH_MEDIA_PHOTO_BYTES = 4 * 1024 * 1024;
export const COACH_MEDIA_VIDEO_SECONDS = 60;
export const COACH_MEDIA_VIDEO_PREFLIGHT_BYTES = 250 * 1024 * 1024;
// Mux uses both legacy GCS and regional direct-upload hosts. Keep the SQL
// set-upload boundary equivalent; capabilities must never target arbitrary hosts.
export function isCoachMediaVideoUploadUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 8192 &&
    value === value.trim() &&
    /^https:\/\/(?:storage\.googleapis\.com|direct-uploads-[a-z0-9-]+\.mux\.com)\/[A-Za-z0-9._~!$&'()*+,;=:@%/?-]+$/.test(
      value,
    )
  );
}
export const COACH_MEDIA_VARIANTS = {
  thumbnail: { edge: 640, maxBytes: 256 * 1024 },
  full: { edge: 1600, maxBytes: 1024 * 1024 },
} as const;
export type CoachMediaVariant = keyof typeof COACH_MEDIA_VARIANTS;
export type CoachMediaPhoto = Readonly<{
  id: string;
  alt: string;
  width: number;
  height: number;
  thumbnailUrl: string;
  fullUrl: string;
}>;
export type CoachMediaVideo = Readonly<{
  id: string;
  description: string;
  duration: number;
  posterUrl: string;
}>;
export type CoachMediaUpload = Readonly<{
  id: string;
  kind: "photo" | "video";
  status: "reserved" | "creating" | "uploading" | "processing" | "failed";
  description: string;
  error: string | null;
  uploadUrl: string | null;
}>;
export type PublicCoachMedia = Readonly<{
  photos: readonly CoachMediaPhoto[];
  video: CoachMediaVideo | null;
}>;
export type OwnedCoachMedia = PublicCoachMedia &
  Readonly<{
    revision: number;
    published: PublicCoachMedia;
    uploads: readonly CoachMediaUpload[];
    videoAvailable: boolean;
    canPublish: boolean;
    cleanupPending: boolean;
  }>;
export type CoachMediaFailure = Readonly<{
  status:
    | "invalid"
    | "conflict"
    | "forbidden"
    | "signed-out"
    | "not-found"
    | "unavailable";
}>;
export type CoachMediaResult<T = OwnedCoachMedia> =
  Readonly<{ status: "ready" | "saved"; media: T }> | CoachMediaFailure;
export type CoachMediaCommand = Readonly<{
  action:
    | "remove-photo"
    | "reorder"
    | "remove-video"
    | "publish"
    | "discard"
    | "cancel"
    | "finish-photo"
    | "refresh-video"
    | "video";
  revision: number;
  id?: string;
  ids?: readonly string[];
  description?: string;
}>;
export function validMediaDescription(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    [...value].length <= 160 &&
    !/[<>\p{Cc}\p{Cf}]/u.test(value)
  );
}
export function validMediaCommand(value: unknown): value is CoachMediaCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (
    !isWebsiteRevision(v.revision) ||
    Object.keys(v).some(
      (k) => !["action", "revision", "id", "ids", "description"].includes(k),
    )
  )
    return false;
  const hasId = typeof v.id === "string" && isCanonicalUuid(v.id);
  switch (v.action) {
    case "publish":
    case "discard":
    case "remove-video":
      return (
        v.id === undefined && v.ids === undefined && v.description === undefined
      );
    case "remove-photo":
    case "cancel":
    case "finish-photo":
    case "refresh-video":
      return hasId && v.ids === undefined && v.description === undefined;
    case "video":
      return (
        hasId && validMediaDescription(v.description) && v.ids === undefined
      );
    case "reorder":
      return (
        Array.isArray(v.ids) &&
        v.ids.length <= 6 &&
        new Set(v.ids).size === v.ids.length &&
        v.ids.every((id) => typeof id === "string" && isCanonicalUuid(id)) &&
        v.id === undefined &&
        v.description === undefined
      );
    default:
      return false;
  }
}
export function coachMediaPhotoUrl(
  slug: string | null,
  id: string,
  variant: CoachMediaVariant,
) {
  return slug === null
    ? `/api/coach/media/photos/${id}/${variant}`
    : `/api/coaches/${encodeURIComponent(slug)}/media/photos/${id}/${variant}`;
}
export function coachMediaVideoUrl(
  slug: string | null,
  id: string,
  kind: "poster" | "playback",
) {
  return slug === null
    ? `/api/coach/media/videos/${id}/${kind}`
    : `/api/coaches/${encodeURIComponent(slug)}/media/videos/${id}/${kind}`;
}

/** Rebuild transport objects rather than retaining private extra fields. */
export function parsePublicCoachMedia(value: unknown): PublicCoachMedia {
  const object = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw Error("Invalid coach media response.");
    return v as Record<string, unknown>;
  };
  const uuid = (v: unknown) => {
    if (typeof v !== "string" || !isCanonicalUuid(v))
      throw Error("Invalid media ID.");
    return v;
  };
  const url = (v: unknown, id: string, suffix: string) => {
    if (
      typeof v !== "string" ||
      !v.startsWith("/api/") ||
      !v.endsWith(`/${id}/${suffix}`) ||
      !/^\/api\/(?:coach\/media|coaches\/[a-zA-Z0-9_-]+\/media)\//.test(v) ||
      /[?#\\]/.test(v)
    )
      throw Error("Invalid media URL.");
    return v;
  };
  const v = object(value);
  if (!Array.isArray(v.photos) || v.photos.length > 6)
    throw Error("Invalid gallery size.");
  const photos = v.photos.map((raw) => {
    const p = object(raw),
      id = uuid(p.id);
    if (
      !validMediaDescription(p.alt) ||
      !Number.isSafeInteger(p.width) ||
      !Number.isSafeInteger(p.height) ||
      Number(p.width) < 1 ||
      Number(p.height) < 1 ||
      Number(p.width) > 1600 ||
      Number(p.height) > 1600
    )
      throw Error("Invalid photo metadata.");
    return {
      id,
      alt: p.alt,
      width: Number(p.width),
      height: Number(p.height),
      thumbnailUrl: url(p.thumbnailUrl, id, "thumbnail"),
      fullUrl: url(p.fullUrl, id, "full"),
    };
  });
  if (new Set(photos.map((p) => p.id)).size !== photos.length)
    throw Error("Duplicate photo.");
  let video: CoachMediaVideo | null = null;
  if (v.video !== null) {
    const item = object(v.video),
      id = uuid(item.id);
    if (
      !validMediaDescription(item.description) ||
      typeof item.duration !== "number" ||
      !Number.isFinite(item.duration) ||
      item.duration <= 0 ||
      item.duration > 60
    )
      throw Error("Invalid video metadata.");
    video = {
      id,
      description: item.description,
      duration: item.duration,
      posterUrl: url(item.posterUrl, id, "poster"),
    };
  }
  return { photos, video };
}
export function parseOwnedCoachMedia(value: unknown): OwnedCoachMedia {
  const publicMedia = parsePublicCoachMedia(value);
  const v = value as Record<string, unknown>;
  if (
    !isWebsiteRevision(v.revision) ||
    typeof v.videoAvailable !== "boolean" ||
    typeof v.canPublish !== "boolean" ||
    typeof v.cleanupPending !== "boolean" ||
    !Array.isArray(v.uploads) ||
    v.uploads.length > 20
  )
    throw Error("Invalid owner media response.");
  const uploads = v.uploads.map((raw) => {
    if (!raw || typeof raw !== "object") throw Error("Invalid media upload.");
    const u = raw as Record<string, unknown>;
    if (
      typeof u.id !== "string" ||
      !isCanonicalUuid(u.id) ||
      !["photo", "video"].includes(String(u.kind)) ||
      !["reserved", "creating", "uploading", "processing", "failed"].includes(
        String(u.status),
      ) ||
      !validMediaDescription(u.description)
    )
      throw Error("Invalid media upload.");
    if (u.uploadUrl !== null && !isCoachMediaVideoUploadUrl(u.uploadUrl))
      throw Error("Invalid video upload URL.");
    if (
      u.error !== null &&
      (typeof u.error !== "string" || u.error.length > 240)
    )
      throw Error("Invalid upload error.");
    return {
      id: u.id,
      kind: u.kind,
      status: u.status,
      description: u.description,
      error: u.error,
      uploadUrl: u.uploadUrl,
    } as CoachMediaUpload;
  });
  return {
    ...publicMedia,
    revision: v.revision,
    published: parsePublicCoachMedia(v.published),
    uploads,
    videoAvailable: v.videoAvailable,
    canPublish: v.canPublish,
    cleanupPending: v.cleanupPending,
  };
}
