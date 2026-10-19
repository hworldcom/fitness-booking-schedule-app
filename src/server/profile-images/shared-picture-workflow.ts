import "server-only";
import type { StorageReadResult } from "@/server/storage/contracts";

type Reference = { path: string; version: string; avatarVersion: string };

/** Revoke bytes if either the current grant or either image reference changed during I/O. */
export async function readCurrentSharedPicture(
  reference: () => Promise<Reference | null>,
  download: (path: string) => Promise<StorageReadResult>,
) {
  try {
    const before = await reference();
    if (!before) return { status: "not-found" as const };
    const image = await download(before.path);
    if (image.status !== "ready") return image;
    const after = await reference();
    if (
      !after ||
      before.path !== after.path ||
      before.version !== after.version ||
      before.avatarVersion !== after.avatarVersion
    )
      return { status: "not-found" as const };
    return { status: "ready" as const, bytes: image.bytes };
  } catch {
    return { status: "unavailable" as const };
  }
}
