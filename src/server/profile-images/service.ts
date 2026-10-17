import "server-only";

import { randomUUID } from "node:crypto";
import {
  privateAccountAvatarUrl,
  profileImageStoragePath,
  type ProfileImageMutationSnapshot,
} from "@/profile-images/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import {
  ProfileImageReferenceConflictError,
  bookingRequestClientAvatarReference,
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

import { profileImageStorage } from "@/server/storage/profile-images";
import { storeAndAttachProfileImage } from "./store-and-attach";

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
  const attached = await storeAndAttachProfileImage<string | null>(
    profileImageStorage,
    { scope: "account-avatar", path },
    canonical.bytes,
    async () => {
      const result = await withAuthorizedActor(async (transaction) => {
        try {
          return {
            outcome: "saved" as const,
            reference: await setCurrentAccountAvatarReference(
              transaction,
              path,
              current.value.reference.path,
            ),
          };
        } catch (error) {
          if (error instanceof ProfileImageReferenceConflictError)
            return { outcome: "conflict" as const };
          throw error;
        }
      });
      if (result.status !== "authorized")
        return {
          status: result.status === "preview" ? "forbidden" : result.status,
        };
      if (result.value.outcome === "conflict") return { status: "conflict" };
      return {
        status: "attached",
        value: result.value.reference.updatedAt,
        previousPath: result.value.reference.previousPath,
      };
    },
  );
  if (attached.status !== "attached") return mutationResult(attached.status);
  return mutationResult("saved", privateAccountAvatarUrl(attached.value));
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

  await profileImageStorage.remove({
    scope: "account-avatar",
    path: current.value.path,
  });
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

  const image = await profileImageStorage.download({
    scope: "account-avatar",
    path: current.value.path,
  });
  if (image.status !== "ready") return image;
  return Object.freeze({
    status: "ready" as const,
    bytes: image.bytes,
    updatedAt: current.value.updatedAt,
  });
}

export async function confirmedBookingClientAvatarBytes(bookingId: string) {
  const current = await withAuthorizedActor(async (transaction) =>
    confirmedBookingClientAvatarReference(transaction, bookingId),
  );
  if (current.status !== "authorized") return current;
  if (!current.value?.path) {
    return Object.freeze({ status: "not-found" as const });
  }

  const image = await profileImageStorage.download({
    scope: "account-avatar",
    path: current.value.path,
  });
  if (image.status !== "ready") return image;
  return Object.freeze({
    status: "ready" as const,
    bytes: image.bytes,
    updatedAt: current.value.updatedAt,
  });
}

export async function bookingRequestClientAvatarBytes(requestId: string) {
  const current = await withAuthorizedActor(async (transaction) =>
    bookingRequestClientAvatarReference(transaction, requestId),
  );
  if (current.status !== "authorized") return current;
  if (!current.value?.path) {
    return Object.freeze({ status: "not-found" as const });
  }

  const image = await profileImageStorage.download({
    scope: "account-avatar",
    path: current.value.path,
  });
  if (image.status !== "ready") return image;
  return Object.freeze({
    status: "ready" as const,
    bytes: image.bytes,
    updatedAt: current.value.updatedAt,
  });
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
  const attached = await storeAndAttachProfileImage<string | null>(
    profileImageStorage,
    { scope: "coach-portrait", path },
    canonical.bytes,
    async () => {
      const result = await withAuthorizedActor(async (transaction) => {
        try {
          return {
            outcome: "saved" as const,
            reference: await setCurrentCoachPortraitReference(
              transaction,
              path,
              currentValue.reference.source,
              currentValue.reference.path,
            ),
          };
        } catch (error) {
          if (error instanceof ProfileImageReferenceConflictError)
            return { outcome: "conflict" as const };
          throw error;
        }
      });
      if (result.status !== "authorized")
        return {
          status: result.status === "preview" ? "forbidden" : result.status,
        };
      if (result.value.outcome === "conflict") return { status: "conflict" };
      return {
        status: "attached",
        value: result.value.reference.updatedAt,
        previousPath:
          result.value.reference.previousSource === "storage"
            ? result.value.reference.previousPath
            : null,
      };
    },
  );
  if (attached.status !== "attached") return mutationResult(attached.status);
  return mutationResult(
    "saved",
    attached.value
      ? profileImageStorage.publicPortraitUrl({
          source: "storage",
          path,
          updatedAt: attached.value,
        })
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
    await profileImageStorage.remove({
      scope: "coach-portrait",
      path: currentValue.reference.path,
    });
  }
  return mutationResult("removed");
}
