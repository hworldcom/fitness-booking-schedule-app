import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { profileImageStorage } from "@/server/storage/profile-images";
import { withAuthorizedActor } from "@/server/authorization/service";
import { connectionAvatarReference } from "@/server/db/connections/repository";

type ReferenceResult =
  | Readonly<{ status: "ready"; value: { path: string; updatedAt: string } }>
  | Readonly<{
      status:
        "not-found" | "preview" | "signed-out" | "forbidden" | "unavailable";
    }>;
type AvatarDependencies = Readonly<{
  reference: (id: string) => Promise<ReferenceResult>;
  download: (path: string) => Promise<Uint8Array | null>;
}>;
async function reference(id: string): Promise<ReferenceResult> {
  const result = await withAuthorizedActor((tx) =>
    connectionAvatarReference(tx, id),
  );
  if (result.status !== "authorized") return result;
  return result.value
    ? { status: "ready", value: result.value }
    : { status: "not-found" };
}
async function download(path: string) {
  const image = await profileImageStorage.download({
    scope: "account-avatar",
    path,
  });
  return image.status === "ready" ? image.bytes : null;
}

export async function connectionAthleteAvatarBytes(
  id: string,
  dependencies: AvatarDependencies = { reference, download },
) {
  if (!isCanonicalUuid(id)) return { status: "not-found" as const };
  try {
    const before = await dependencies.reference(id);
    if (before.status !== "ready") return before;
    const bytes = await dependencies.download(before.value.path);
    if (!bytes) return { status: "unavailable" as const };
    // Storage may independently allow booking/request access. The connection
    // route still requires this exact accepted attempt after provider work.
    const after = await dependencies.reference(id);
    if (after.status !== "ready") return after;
    if (
      after.value.path !== before.value.path ||
      after.value.updatedAt !== before.value.updatedAt
    )
      return { status: "not-found" as const };
    return { status: "ready" as const, bytes };
  } catch {
    return { status: "unavailable" as const };
  }
}
