import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import type { MediaAsset } from "@/server/db/coaches/media-repository";
import type { MuxAsset } from "./mux-video";

type Dependencies = {
  assetById: (id: string) => Promise<MediaAsset | null>;
  readAsset: (id: string) => Promise<MuxAsset>;
  apply: (asset: MuxAsset) => Promise<unknown>;
  remove: (assetId: string, uploadId: string) => Promise<void>;
};

// Signature verification happens at the HTTP boundary. Provider reads establish
// identity; event bodies alone never authorize attachment or deletion.
export async function reconcileCoachMediaWebhook(
  event: unknown,
  deps: Dependencies,
) {
  if (!event || typeof event !== "object") return;
  const e = event as {
    type?: unknown;
    data?: { id?: unknown; passthrough?: unknown };
  };
  if (
    ![
      "video.asset.created",
      "video.asset.ready",
      "video.asset.errored",
    ].includes(String(e.type))
  )
    return;
  const id = e.data?.passthrough;
  if (
    typeof id !== "string" ||
    !isCanonicalUuid(id) ||
    typeof e.data?.id !== "string"
  )
    return;
  const current = await deps.assetById(id);
  if (!current || current.status === "deleted") return;
  if (!current.mux_upload_id)
    throw Error("Upload identity not yet reconciled.");
  if (
    (current.status === "failed" || current.status === "retired") &&
    current.mux_asset_id === e.data.id
  ) {
    // This exact identity was verified previously. DELETE treats 404 as success;
    // a repeated callback must not GET an already deleted asset forever.
    await deps.remove(current.mux_asset_id, current.mux_upload_id);
    return;
  }
  const asset = await deps.readAsset(e.data.id);
  if (
    asset.id !== e.data.id ||
    asset.passthrough !== id ||
    asset.uploadId !== current.mux_upload_id
  )
    throw Error("Provider identity mismatch.");
  await deps.apply(asset);
  const after = await deps.assetById(id);
  if (
    after?.status === "failed" ||
    after?.status === "retired" ||
    after?.status === "deleted"
  )
    await deps.remove(asset.id, asset.uploadId);
}
