import "server-only";
import type { CoachWebsiteFailure } from "@/domain/coach-website";
import type { ProfileImageStorage } from "@/server/storage/contracts";
import type { StorageReadResult } from "@/server/storage/contracts";

type BannerReadReference =
  | Readonly<{ status: "ready"; path: string | null; revision: number }>
  | CoachWebsiteFailure;

export async function readCurrentCoachBanner(
  revision: number,
  reference: () => Promise<BannerReadReference>,
  storage: Pick<ProfileImageStorage, "download">,
): Promise<StorageReadResult | CoachWebsiteFailure> {
  try {
    const before = await reference();
    if (before.status !== "ready") return before;
    if (!before.path || before.revision !== revision)
      return { status: "not-found" };
    const image = await storage.download({
      scope: "coach-banner",
      path: before.path,
    });
    if (image.status !== "ready") return image;
    const after = await reference();
    if (after.status !== "ready") return after;
    if (after.revision !== revision || after.path !== before.path)
      return { status: "not-found" };
    return image;
  } catch {
    return { status: "unavailable" };
  }
}

export async function cleanupCoachBanner(
  storage: ProfileImageStorage,
  paths: readonly string[],
) {
  let pending = false;
  for (const path of paths) {
    const result = await storage.remove({ scope: "coach-banner", path });
    if (result.status !== "ready") pending = true;
  }
  return pending;
}

// SQL and Storage both prevent deletion of the current reference. Cleanup may
// safely be attempted even when an attachment response/commit outcome is unknown.
export async function storeAndAttachCoachBanner<T>(
  storage: ProfileImageStorage,
  variants: readonly Readonly<{ path: string; bytes: Uint8Array }>[],
  attach: () => Promise<
    | Readonly<{ status: "saved"; value: T; previousPaths: readonly string[] }>
    | CoachWebsiteFailure
  >,
) {
  const paths = variants.map((variant) => variant.path);
  for (const variant of variants) {
    const uploaded = await storage.upload(
      { scope: "coach-banner", path: variant.path },
      variant.bytes,
    );
    if (uploaded.status !== "ready") {
      await cleanupCoachBanner(storage, paths);
      return { status: "unavailable" as const };
    }
  }
  let result: Awaited<ReturnType<typeof attach>>;
  try {
    result = await attach();
  } catch {
    result = { status: "unavailable" };
  }
  if (result.status !== "saved") {
    await cleanupCoachBanner(storage, paths);
    return result;
  }
  const cleanupPending = await cleanupCoachBanner(
    storage,
    result.previousPaths,
  );
  return { status: "saved" as const, value: result.value, cleanupPending };
}
