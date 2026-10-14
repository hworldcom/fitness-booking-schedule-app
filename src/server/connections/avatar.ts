import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { ACCOUNT_AVATAR_BUCKET } from "@/profile-images/contracts";
import { serverAuthClient } from "@/server/auth/client";
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
  const client = await serverAuthClient();
  if (!client) return null;
  const { data, error } = await client.storage
    .from(ACCOUNT_AVATAR_BUCKET)
    .download(path);
  return error || !data ? null : new Uint8Array(await data.arrayBuffer());
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
