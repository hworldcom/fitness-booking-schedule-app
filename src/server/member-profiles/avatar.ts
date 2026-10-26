import "server-only";
import { createHash } from "node:crypto";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { withAuthorizedActor } from "@/server/authorization/service";
import { memberProfileRecord } from "@/server/db/member-profiles/repository";
import { profileImageStorage } from "@/server/storage/profile-images";

type Reference = { path: string; updatedAt: string; viewer: string };
type ReferenceResult =
  | { status: "ready"; value: Reference }
  | {
      status:
        "not-found" | "signed-out" | "forbidden" | "preview" | "unavailable";
    };
type Dependencies = {
  reference: (id: string) => Promise<ReferenceResult>;
  download: (path: string) => Promise<Uint8Array | null>;
};
async function reference(id: string): Promise<ReferenceResult> {
  const result = await withAuthorizedActor((tx) => memberProfileRecord(tx, id));
  if (result.status !== "authorized") return result;
  if (!result.value?.path || !result.value.updatedAt)
    return { status: "not-found" };
  return {
    status: "ready",
    value: {
      path: result.value.path,
      updatedAt: result.value.updatedAt,
      viewer: `${result.actor.runId}:${result.actor.profileId}`,
    },
  };
}
async function download(path: string) {
  const result = await profileImageStorage.download({
    scope: "account-avatar",
    path,
  });
  return result.status === "ready" ? result.bytes : null;
}

export async function memberAvatarBytes(
  id: string,
  version: string | null,
  ifNoneMatch: string | null,
  dependencies: Dependencies = { reference, download },
) {
  if (!isCanonicalUuid(id) || !version || !Number.isFinite(Date.parse(version)))
    return { status: "not-found" as const };
  try {
    const before = await dependencies.reference(id);
    if (before.status !== "ready") return before;
    if (Date.parse(before.value.updatedAt) !== Date.parse(version))
      return { status: "not-found" as const };
    // Viewer-specific, opaque validator. Authorization always precedes cache use.
    const etag =
      '"' +
      createHash("sha256").update(JSON.stringify(before.value)).digest("hex") +
      '"';
    if (
      ifNoneMatch
        ?.split(",")
        .some((item) => item.trim().replace(/^W\//, "") === etag)
    )
      return { status: "not-modified" as const, etag };
    const bytes = await dependencies.download(before.value.path);
    if (!bytes) return { status: "unavailable" as const };
    const after = await dependencies.reference(id);
    if (after.status !== "ready") return after;
    if (
      after.value.path !== before.value.path ||
      after.value.updatedAt !== before.value.updatedAt ||
      after.value.viewer !== before.value.viewer
    )
      return { status: "not-found" as const };
    return { status: "ready" as const, bytes, etag };
  } catch {
    return { status: "unavailable" as const };
  }
}
