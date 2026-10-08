import "server-only";

import { randomUUID } from "node:crypto";
import { supabasePublicConfig } from "@/auth/config";
import {
  ACCOUNT_AVATAR_BUCKET,
  COACH_PORTRAIT_BUCKET,
  privateAccountAvatarUrl,
  profileImageStoragePath,
  publicCoachPortraitUrl,
  type ProfileImageMutationSnapshot,
} from "@/profile-images/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import { serverAuthClient } from "@/server/auth/client";
import { currentActorProjection } from "@/server/db/authorization/repository";
import {
  ProfileImageReferenceConflictError,
  confirmedBookingClientAvatarReference,
  currentAccountAvatarReference,
  currentCoachPortraitReference,
  setCurrentAccountAvatarReference,
  setCurrentCoachPortraitReference,
} from "@/server/db/profile-images/repository";
import {
  InvalidProfileImageError,
  normalizeCanonicalProfileImage,
} from "./image-normalization";

type StorageBucket =
  typeof ACCOUNT_AVATAR_BUCKET | typeof COACH_PORTRAIT_BUCKET;

function mutationResult(
  status: ProfileImageMutationSnapshot["status"],
  imageUrl: string | null = null,
): ProfileImageMutationSnapshot {
  return Object.freeze({ status, imageUrl });
}

function authorizationMutationResult(
  status: "preview" | "signed-out" | "forbidden" | "unavailable",
) {
  return mutationResult(status === "preview" ? "forbidden" : status);
}

async function removeStorageObject(bucket: StorageBucket, path: string) {
  try {
    const client = await serverAuthClient();
    if (!client) return;
    await client.storage.from(bucket).remove([path]);
  } catch {
    // Reference changes are authoritative. Failed best-effort cleanup leaves a
    // private or owner-scoped orphan, never a database pointer to missing data.
  }
}

async function uploadStorageObject(
  bucket: StorageBucket,
  path: string,
  bytes: Uint8Array,
) {
  const client = await serverAuthClient();
  if (!client) return false;
  const { error } = await client.storage.from(bucket).upload(path, bytes, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false,
  });
  return !error;
}

export async function uploadCurrentAccountAvatar(input: Uint8Array) {
  const current = await withAuthorizedActor(async (transaction, actor) =>
    Object.freeze({
      profileId: actor.profileId,
      reference: await currentAccountAvatarReference(transaction, actor),
    }),
  );
  if (current.status !== "authorized") {
    return authorizationMutationResult(current.status);
  }

  let canonical;
  try {
    canonical = await normalizeCanonicalProfileImage(input);
  } catch (error) {
    return error instanceof InvalidProfileImageError
      ? mutationResult("invalid")
      : mutationResult("unavailable");
  }

  const path = profileImageStoragePath(current.value.profileId, randomUUID());
  if (
    !(await uploadStorageObject(ACCOUNT_AVATAR_BUCKET, path, canonical.bytes))
  ) {
    return mutationResult("unavailable");
  }

  const attached = await withAuthorizedActor(async (transaction) => {
    try {
      return Object.freeze({
        outcome: "saved" as const,
        reference: await setCurrentAccountAvatarReference(
          transaction,
          path,
          current.value.reference.path,
        ),
      });
    } catch (error) {
      if (error instanceof ProfileImageReferenceConflictError) {
        return Object.freeze({ outcome: "conflict" as const });
      }
      throw error;
    }
  });
  if (attached.status !== "authorized") {
    await removeStorageObject(ACCOUNT_AVATAR_BUCKET, path);
    return authorizationMutationResult(attached.status);
  }
  if (attached.value.outcome === "conflict") {
    await removeStorageObject(ACCOUNT_AVATAR_BUCKET, path);
    return mutationResult("conflict");
  }

  const previousPath = attached.value.reference.previousPath;
  if (previousPath) {
    await removeStorageObject(ACCOUNT_AVATAR_BUCKET, previousPath);
  }
  return mutationResult(
    "saved",
    privateAccountAvatarUrl(attached.value.reference.updatedAt),
  );
}

export async function removeCurrentAccountAvatar() {
  const current = await withAuthorizedActor(async (transaction, actor) =>
    currentAccountAvatarReference(transaction, actor),
  );
  if (current.status !== "authorized") {
    return authorizationMutationResult(current.status);
  }
  if (!current.value.path) return mutationResult("removed");

  const removed = await withAuthorizedActor(async (transaction) => {
    try {
      await setCurrentAccountAvatarReference(
        transaction,
        null,
        current.value.path,
      );
      return "removed" as const;
    } catch (error) {
      if (error instanceof ProfileImageReferenceConflictError) {
        return "conflict" as const;
      }
      throw error;
    }
  });
  if (removed.status !== "authorized") {
    return authorizationMutationResult(removed.status);
  }
  if (removed.value === "conflict") return mutationResult("conflict");

  await removeStorageObject(ACCOUNT_AVATAR_BUCKET, current.value.path);
  return mutationResult("removed");
}

export async function currentAccountAvatarBytes() {
  const current = await withAuthorizedActor(async (transaction, actor) =>
    currentAccountAvatarReference(transaction, actor),
  );
  if (current.status !== "authorized") return current;
  if (!current.value.path) {
    return Object.freeze({ status: "not-found" as const });
  }

  try {
    const client = await serverAuthClient();
    if (!client) return Object.freeze({ status: "unavailable" as const });
    const { data, error } = await client.storage
      .from(ACCOUNT_AVATAR_BUCKET)
      .download(current.value.path);
    if (error || !data) {
      return Object.freeze({ status: "unavailable" as const });
    }
    return Object.freeze({
      status: "ready" as const,
      bytes: new Uint8Array(await data.arrayBuffer()),
      updatedAt: current.value.updatedAt,
    });
  } catch {
    return Object.freeze({ status: "unavailable" as const });
  }
}

export async function confirmedBookingClientAvatarBytes(bookingId: string) {
  const current = await withAuthorizedActor(async (transaction) =>
    confirmedBookingClientAvatarReference(transaction, bookingId),
  );
  if (current.status !== "authorized") return current;
  if (!current.value?.path) {
    return Object.freeze({ status: "not-found" as const });
  }

  try {
    const client = await serverAuthClient();
    if (!client) return Object.freeze({ status: "unavailable" as const });
    const { data, error } = await client.storage
      .from(ACCOUNT_AVATAR_BUCKET)
      .download(current.value.path);
    if (error || !data) {
      return Object.freeze({ status: "unavailable" as const });
    }
    return Object.freeze({
      status: "ready" as const,
      bytes: new Uint8Array(await data.arrayBuffer()),
      updatedAt: current.value.updatedAt,
    });
  } catch {
    return Object.freeze({ status: "unavailable" as const });
  }
}

async function currentCoachPortraitUploadState() {
  return withAuthorizedActor(async (transaction, actor) => {
    const owner = await currentActorProjection(transaction, actor);
    if (
      owner.coachAccess.status !== "approved" &&
      owner.coachAccess.status !== "demo"
    ) {
      return Object.freeze({ outcome: "forbidden" as const });
    }
    const reference = await currentCoachPortraitReference(transaction, actor);
    if (!reference) return Object.freeze({ outcome: "forbidden" as const });
    return Object.freeze({
      outcome: "ready" as const,
      profileId: actor.profileId,
      reference,
    });
  });
}

export async function uploadCurrentCoachPortrait(input: Uint8Array) {
  const current = await currentCoachPortraitUploadState();
  if (current.status !== "authorized") {
    return authorizationMutationResult(current.status);
  }
  if (current.value.outcome === "forbidden") {
    return mutationResult("forbidden");
  }
  const currentValue = current.value;

  let canonical;
  try {
    canonical = await normalizeCanonicalProfileImage(input);
  } catch (error) {
    return error instanceof InvalidProfileImageError
      ? mutationResult("invalid")
      : mutationResult("unavailable");
  }

  const path = profileImageStoragePath(currentValue.profileId, randomUUID());
  if (
    !(await uploadStorageObject(COACH_PORTRAIT_BUCKET, path, canonical.bytes))
  ) {
    return mutationResult("unavailable");
  }

  const attached = await withAuthorizedActor(async (transaction) => {
    try {
      return Object.freeze({
        outcome: "saved" as const,
        reference: await setCurrentCoachPortraitReference(
          transaction,
          path,
          currentValue.reference.source,
          currentValue.reference.path,
        ),
      });
    } catch (error) {
      if (error instanceof ProfileImageReferenceConflictError) {
        return Object.freeze({ outcome: "conflict" as const });
      }
      throw error;
    }
  });
  if (attached.status !== "authorized") {
    await removeStorageObject(COACH_PORTRAIT_BUCKET, path);
    return authorizationMutationResult(attached.status);
  }
  if (attached.value.outcome === "conflict") {
    await removeStorageObject(COACH_PORTRAIT_BUCKET, path);
    return mutationResult("conflict");
  }

  if (
    attached.value.reference.previousSource === "storage" &&
    attached.value.reference.previousPath
  ) {
    await removeStorageObject(
      COACH_PORTRAIT_BUCKET,
      attached.value.reference.previousPath,
    );
  }
  const updatedAt = attached.value.reference.updatedAt;
  const storageUrl = supabasePublicConfig()?.url ?? null;
  return mutationResult(
    "saved",
    updatedAt
      ? publicCoachPortraitUrl(
          Object.freeze({ source: "storage", path, updatedAt }),
          storageUrl,
        )
      : null,
  );
}

export async function removeCurrentCoachPortrait() {
  const current = await currentCoachPortraitUploadState();
  if (current.status !== "authorized") {
    return authorizationMutationResult(current.status);
  }
  if (current.value.outcome === "forbidden") {
    return mutationResult("forbidden");
  }
  const currentValue = current.value;
  if (!currentValue.reference.path) return mutationResult("removed");

  const removed = await withAuthorizedActor(async (transaction) => {
    try {
      await setCurrentCoachPortraitReference(
        transaction,
        null,
        currentValue.reference.source,
        currentValue.reference.path,
      );
      return "removed" as const;
    } catch (error) {
      if (error instanceof ProfileImageReferenceConflictError) {
        return "conflict" as const;
      }
      throw error;
    }
  });
  if (removed.status !== "authorized") {
    return authorizationMutationResult(removed.status);
  }
  if (removed.value === "conflict") return mutationResult("conflict");

  if (currentValue.reference.source === "storage") {
    await removeStorageObject(
      COACH_PORTRAIT_BUCKET,
      currentValue.reference.path,
    );
  }
  return mutationResult("removed");
}
