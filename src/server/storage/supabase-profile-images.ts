import "server-only";

import { supabasePublicConfig } from "@/auth/config";
import { isOwnedProfileImageStoragePath } from "@/profile-images/contracts";
import { serverAuthClient } from "@/server/auth/client";
import type {
  ProfileImageObject,
  ProfileImageStorage,
  StorageMutationResult,
} from "./contracts";

const buckets = {
  "account-avatar": "account-avatars",
  "coach-portrait": "coach-portraits",
  "coach-banner": "coach-banners",
  "event-banner": "event-banners",
} as const;
const unavailable = Object.freeze({ status: "unavailable" as const });
const ready = Object.freeze({ status: "ready" as const });

type Dependencies = Readonly<{
  client: typeof serverAuthClient;
  publicOrigin: () => string | null;
}>;

function validObject(object: ProfileImageObject) {
  return (
    Object.hasOwn(buckets, object.scope) &&
    isOwnedProfileImageStoragePath(object.path, object.path.split("/")[0])
  );
}

export function createSupabaseProfileImageStorage(
  dependencies: Dependencies = {
    client: serverAuthClient,
    publicOrigin: () => supabasePublicConfig()?.url ?? null,
  },
): ProfileImageStorage {
  return Object.freeze({
    async upload(object, bytes): Promise<StorageMutationResult> {
      if (!validObject(object)) return unavailable;
      try {
        const client = await dependencies.client();
        if (!client) return unavailable;
        const { error } = await client.storage
          .from(buckets[object.scope])
          .upload(object.path, bytes, {
            cacheControl: object.scope.endsWith("banner") ? "0" : "31536000",
            contentType: "image/webp",
            upsert: false,
          });
        return error ? unavailable : ready;
      } catch {
        return unavailable;
      }
    },
    async download(object) {
      if (!validObject(object)) return unavailable;
      try {
        const client = await dependencies.client();
        if (!client) return unavailable;
        const { data, error } = await client.storage
          .from(buckets[object.scope])
          .download(object.path);
        if (error || !data) return unavailable;
        return Object.freeze({
          status: "ready" as const,
          bytes: new Uint8Array(await data.arrayBuffer()),
        });
      } catch {
        return unavailable;
      }
    },
    async remove(object): Promise<StorageMutationResult> {
      if (!validObject(object)) return unavailable;
      try {
        const client = await dependencies.client();
        if (!client) return unavailable;
        const { error } = await client.storage
          .from(buckets[object.scope])
          .remove([object.path]);
        return error ? unavailable : ready;
      } catch {
        return unavailable;
      }
    },
    publicPortraitUrl(reference) {
      if (!reference) return null;
      if (reference.source === "fixture") return reference.path;
      const object = { scope: "coach-portrait" as const, path: reference.path };
      if (!validObject(object)) return null;
      const origin = dependencies.publicOrigin();
      if (!origin) return null;
      const encodedPath = reference.path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      // Preserve the existing immutable public URL contract. Domain validation
      // explicitly retains this legacy shape; private scopes have no URL API.
      return `${origin.replace(/\/$/, "")}/storage/v1/object/public/${buckets["coach-portrait"]}/${encodedPath}?v=${encodeURIComponent(reference.updatedAt)}`;
    },
  });
}
