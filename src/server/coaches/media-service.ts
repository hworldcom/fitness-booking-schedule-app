import "server-only";
import { createHash } from "node:crypto";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { isCoachPublicSlug } from "@/domain/coaches";
import { isWebsiteRevision } from "@/domain/coach-website";
import {
  coachMediaPhotoUrl,
  coachMediaVideoUrl,
  validMediaCommand,
  validMediaDescription,
  parseOwnedCoachMedia,
  parsePublicCoachMedia,
  type CoachMediaFailure,
  type CoachMediaResult,
  type CoachMediaVariant,
  type PublicCoachMedia,
} from "@/domain/coach-media";
import { isOwnedProfileImageStoragePath } from "@/profile-images/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  ownedCoachMediaRecord,
  mutateCoachMediaRecord,
  publicCoachMediaRecord,
  applyCoachMediaVideo,
  workerCoachMediaAsset,
  CoachMediaDatabaseError,
  type MediaAsset,
  type MediaRecord,
} from "@/server/db/coaches/media-repository";
import { profileImageStorage } from "@/server/storage/profile-images";
import {
  InvalidCoachMediaPhoto,
  normalizeCoachMediaPhoto,
} from "./media-normalization";
import {
  muxPlaybackToken,
  muxVideoConfigured,
  muxVideoProvider,
} from "./mux-video";
import { reconcileCoachMediaWebhook } from "./media-webhook";

async function ownerRecord(
  action?: string,
  revision = 0,
  input: Record<string, unknown> = {},
): Promise<{ status: "ready"; record: MediaRecord } | CoachMediaFailure> {
  try {
    const result = await withAuthorizedActor(
      async (tx) =>
        action
          ? mutateCoachMediaRecord(tx, revision, action, input)
          : ownedCoachMediaRecord(tx),
      { rethrow: (e) => e instanceof CoachMediaDatabaseError },
    );
    return result.status === "authorized"
      ? { status: "ready", record: result.value }
      : { status: result.status === "preview" ? "forbidden" : result.status };
  } catch (error) {
    return {
      status:
        error instanceof CoachMediaDatabaseError ? error.status : "unavailable",
    };
  }
}
export function projectCoachMediaAssets(
  photos: readonly MediaAsset[],
  video: MediaAsset | null,
  slug: string | null,
): PublicCoachMedia {
  return parsePublicCoachMedia({
    photos: photos.map((p) => ({
      id: p.id,
      alt: p.description,
      width: p.width,
      height: p.height,
      thumbnailUrl: coachMediaPhotoUrl(slug, p.id, "thumbnail"),
      fullUrl: coachMediaPhotoUrl(slug, p.id, "full"),
    })),
    video: video
      ? {
          id: video.id,
          description: video.description,
          duration: Number(video.duration),
          posterUrl: coachMediaVideoUrl(slug, video.id, "poster"),
        }
      : null,
  });
}
function projectOwner(record: MediaRecord) {
  return parseOwnedCoachMedia({
    ...projectCoachMediaAssets(record.photos, record.video, null),
    revision: record.revision,
    published: projectCoachMediaAssets(
      record.publishedPhotos,
      record.publishedVideo,
      null,
    ),
    uploads: record.uploads.map((u) => ({
      id: u.id,
      kind: u.kind,
      status: u.status,
      description: u.description,
      error: u.error,
      uploadUrl:
        u.kind === "video" && u.status === "uploading" ? u.upload_url : null,
    })),
    videoAvailable: muxVideoConfigured(),
    canPublish: record.canPublish,
    cleanupPending: record.cleanup.length > 0,
  });
}
async function response(
  record: MediaRecord,
  status: "ready" | "saved" = "saved",
): Promise<CoachMediaResult> {
  return { status, media: projectOwner(record) };
}
async function cleanup(record: MediaRecord) {
  for (const asset of record.cleanup) {
    try {
      if (asset.kind === "photo") {
        for (const path of [asset.thumbnail_path, asset.full_path]) {
          if (!path || !isOwnedProfileImageStoragePath(path, asset.profile_id))
            throw Error("Invalid cleanup reference.");
          if (
            (await profileImageStorage.remove({ scope: "coach-gallery", path }))
              .status !== "ready"
          )
            throw Error("Cleanup pending.");
        }
      } else {
        if (
          asset.external_claimed &&
          !asset.mux_upload_id &&
          !asset.mux_asset_id
        )
          throw Error("Provider creation needs reconciliation.");
        await muxVideoProvider.remove(asset.mux_asset_id, asset.mux_upload_id);
      }
      // The SQL routine rechecks ownership/state; current references cannot retire.
      await ownerRecord("deleted", record.revision, { id: asset.id });
    } catch {
      /* Retired rows remain the durable exact-reference retry queue. */
    }
  }
}
export async function currentCoachMedia(): Promise<CoachMediaResult> {
  const result = await ownerRecord();
  return result.status === "ready" ? response(result.record, "ready") : result;
}
export async function currentPublicCoachMedia(
  slug: string,
): Promise<CoachMediaResult<PublicCoachMedia>> {
  if (!isCoachPublicSlug(slug)) return { status: "not-found" };
  try {
    const value = await publicCoachMediaRecord(slug);
    return value
      ? {
          status: "ready",
          media: projectCoachMediaAssets(value.photos, value.video, slug),
        }
      : { status: "not-found" };
  } catch {
    return { status: "unavailable" };
  }
}
export async function uploadCoachMediaPhoto(
  input: Uint8Array,
  revision: number,
  id: string,
  description: string,
  replaceId: string | null,
): Promise<CoachMediaResult> {
  if (
    !isWebsiteRevision(revision) ||
    !isCanonicalUuid(id) ||
    !validMediaDescription(description) ||
    (replaceId !== null && !isCanonicalUuid(replaceId))
  )
    return { status: "invalid" };
  const initial = await ownerRecord();
  if (initial.status !== "ready") return initial;
  let normalized: Awaited<ReturnType<typeof normalizeCoachMediaPhoto>>;
  try {
    normalized = await normalizeCoachMediaPhoto(input);
  } catch (error) {
    return {
      status:
        error instanceof InvalidCoachMediaPhoto ? "invalid" : "unavailable",
    };
  }
  const fingerprint = createHash("sha256").update(input).digest("hex");
  const reserved = await ownerRecord("reserve", revision, {
    id,
    kind: "photo",
    description,
    replaceId,
    fingerprint,
    width: normalized.full.width,
    height: normalized.full.height,
  });
  if (reserved.status !== "ready") return reserved;
  if (reserved.record.photos.some((p) => p.id === id))
    return response(reserved.record);
  const claim = await ownerRecord("claim", revision, { id });
  if (claim.status !== "ready") return claim;
  if (!claim.record.claimed) {
    const recovered = await ownerRecord("finish-photo", revision, { id });
    return recovered.status === "ready"
      ? response(recovered.record)
      : recovered;
  }
  // Paths are obtained from the private record, never accepted from a browser.
  const asset = claim.record.uploads.find((a) => a.id === id);
  if (!asset || !asset.thumbnail_path || !asset.full_path)
    return { status: "unavailable" };
  for (const [path, bytes] of [
    [asset.thumbnail_path, normalized.thumbnail.bytes],
    [asset.full_path, normalized.full.bytes],
  ] as const) {
    if (!isOwnedProfileImageStoragePath(path, asset.profile_id))
      return { status: "unavailable" };
    const stored = await profileImageStorage.upload(
      { scope: "coach-gallery", path },
      bytes,
    );
    // An uncertain write is retained for explicit finish/cancel reconciliation.
    if (stored.status !== "ready") return { status: "unavailable" };
  }
  const attached = await ownerRecord("finish-photo", revision, { id });
  if (attached.status !== "ready") return attached;
  await cleanup(attached.record);
  return response(attached.record);
}
export async function refreshCoachMediaVideo(
  id: string,
): Promise<CoachMediaResult> {
  const result = await ownerRecord();
  if (result.status !== "ready") return result;
  const asset = result.record.uploads.find(
    (u) => u.id === id && u.kind === "video",
  );
  if (!asset) return response(result.record);
  if (!asset.mux_upload_id || !muxVideoConfigured())
    return response(result.record, "ready");
  try {
    const provider = await muxVideoProvider.readUpload(asset.mux_upload_id);
    if (provider) {
      if (
        provider.passthrough !== id ||
        provider.uploadId !== asset.mux_upload_id
      )
        return { status: "unavailable" };
      await applyCoachMediaVideo(
        id,
        provider.uploadId,
        provider.id,
        provider.playbackId,
        provider.status,
        provider.duration,
      );
    }
    const current = await ownerRecord();
    return current.status === "ready" ? response(current.record) : current;
  } catch {
    return { status: "unavailable" };
  }
}
export async function commandCoachMedia(
  value: unknown,
  origin?: string,
): Promise<CoachMediaResult> {
  if (!validMediaCommand(value)) return { status: "invalid" };
  if (value.action === "refresh-video")
    return refreshCoachMediaVideo(value.id!);
  if (value.action === "video") {
    if (!origin || !muxVideoConfigured()) return { status: "unavailable" };
    const reserved = await ownerRecord("reserve", value.revision, {
      id: value.id,
      kind: "video",
      fingerprint: createHash("sha256")
        .update(value.description!)
        .digest("hex"),
      description: value.description,
    });
    if (reserved.status !== "ready") return reserved;
    const existing = reserved.record.uploads.find((u) => u.id === value.id);
    if (existing?.upload_url || existing?.status !== "reserved")
      return response(reserved.record, "ready");
    const claim = await ownerRecord("claim", value.revision, { id: value.id });
    if (claim.status !== "ready") return claim;
    if (!claim.record.claimed) return response(claim.record, "ready");
    try {
      // The claim is persisted before the external POST. Unknown outcomes never
      // automatically issue another provider upload for this submission ID.
      const upload = await muxVideoProvider.createUpload(value.id!, origin);
      const saved = await ownerRecord("set-upload", value.revision, {
        id: value.id,
        uploadId: upload.id,
        uploadUrl: upload.url,
      });
      return saved.status === "ready" ? response(saved.record) : saved;
    } catch {
      return { status: "unavailable" };
    }
  }
  const result = await ownerRecord(value.action, value.revision, {
    ...(value.id ? { id: value.id } : {}),
    ...(value.ids ? { ids: value.ids } : {}),
  });
  if (result.status !== "ready") return result;
  await cleanup(result.record);
  const current = await ownerRecord();
  return current.status === "ready" ? response(current.record) : current;
}
async function visibleAsset(
  slug: string | null,
  id: string,
  kind: "photo" | "video",
) {
  if (!isCanonicalUuid(id) || (slug !== null && !isCoachPublicSlug(slug)))
    return { status: "not-found" as const };
  if (slug === null) {
    const value = await ownerRecord();
    if (value.status !== "ready") return value;
    const record = value.record;
    const candidates =
      kind === "photo"
        ? [...record.photos, ...record.publishedPhotos]
        : [record.video, record.publishedVideo];
    const asset = candidates.find(
      (a) => a?.id === id && a.kind === kind && a.status === "ready",
    );
    return asset
      ? { status: "ready" as const, asset }
      : { status: "not-found" as const };
  }
  try {
    const value = await publicCoachMediaRecord(slug);
    const asset =
      value &&
      (kind === "photo"
        ? value.photos.find((a) => a.id === id)
        : value.video?.id === id
          ? value.video
          : null);
    return asset?.status === "ready"
      ? { status: "ready" as const, asset }
      : { status: "not-found" as const };
  } catch {
    return { status: "unavailable" as const };
  }
}
export async function coachMediaPhotoBytes(
  slug: string | null,
  id: string,
  variant: CoachMediaVariant,
) {
  if (!["thumbnail", "full"].includes(variant))
    return { status: "not-found" as const };
  const before = await visibleAsset(slug, id, "photo");
  if (before.status !== "ready") return before;
  const path =
    variant === "thumbnail"
      ? before.asset.thumbnail_path
      : before.asset.full_path;
  if (!path || !isOwnedProfileImageStoragePath(path, before.asset.profile_id))
    return { status: "unavailable" as const };
  const image = await profileImageStorage.download({
    scope: "coach-gallery",
    path,
  });
  if (image.status !== "ready") return image;
  const after = await visibleAsset(slug, id, "photo");
  if (after.status !== "ready") return after;
  if (
    (variant === "thumbnail"
      ? after.asset.thumbnail_path
      : after.asset.full_path) !== path
  )
    return { status: "not-found" as const };
  return image;
}
export async function coachMediaVideoAccess(
  slug: string | null,
  id: string,
  poster = false,
) {
  const before = await visibleAsset(slug, id, "video");
  if (before.status !== "ready") return before;
  const playbackId = before.asset.mux_playback_id;
  if (!playbackId) return { status: "unavailable" as const };
  try {
    const token = muxPlaybackToken(playbackId, poster ? "t" : "v");
    const after = await visibleAsset(slug, id, "video");
    if (after.status !== "ready") return after;
    if (after.asset.mux_playback_id !== playbackId)
      return { status: "not-found" as const };
    return {
      status: "ready" as const,
      playbackId,
      token,
      ...(poster
        ? {
            url: `https://image.mux.com/${playbackId}/thumbnail.webp?token=${token}`,
          }
        : {}),
    };
  } catch {
    return { status: "unavailable" as const };
  }
}
export async function processCoachMediaWebhook(event: unknown) {
  await reconcileCoachMediaWebhook(event, {
    assetById: workerCoachMediaAsset,
    readAsset: muxVideoProvider.readAsset,
    apply: (asset) =>
      applyCoachMediaVideo(
        asset.passthrough,
        asset.uploadId,
        asset.id,
        asset.playbackId,
        asset.status,
        asset.duration,
      ),
    remove: muxVideoProvider.remove,
  });
}
