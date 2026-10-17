import "server-only";

import type {
  ProfileImageObject,
  ProfileImageStorage,
} from "@/server/storage/contracts";

export type ImageAttachment<T> =
  | Readonly<{ status: "attached"; value: T; previousPath: string | null }>
  | Readonly<{
      status: "conflict" | "signed-out" | "forbidden" | "unavailable";
    }>;

// The caller normalizes bytes and owns both authorization checks and the atomic
// reference mutation. Cleanup is best effort and never reverses a saved reference.
export async function storeAndAttachProfileImage<T>(
  storage: ProfileImageStorage,
  object: ProfileImageObject,
  bytes: Uint8Array,
  attach: () => Promise<ImageAttachment<T>>,
): Promise<ImageAttachment<T>> {
  const uploaded = await storage.upload(object, bytes);
  if (uploaded.status !== "ready") return { status: "unavailable" };

  const attachment = await attach();
  if (attachment.status !== "attached") {
    await storage.remove(object);
    return attachment;
  }
  if (attachment.previousPath) {
    await storage.remove({ ...object, path: attachment.previousPath });
  }
  return attachment;
}
