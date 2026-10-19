import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import {
  sharedCoachPictureUrl,
  type ProfileImageMutationSnapshot,
} from "@/profile-images/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import {
  ProfileImageReferenceConflictError,
  currentAccountAvatarReference,
  currentCoachPortraitReference,
  setCurrentCoachAccountPicture,
  publicSharedCoachPictureReference,
} from "@/server/db/profile-images/repository";
import { profileImageStorage } from "@/server/storage/profile-images";
import { readCurrentSharedPicture } from "./shared-picture-workflow";

export async function selectCurrentCoachAccountPicture(
  enabled: boolean,
  expectedProfileId: string,
): Promise<ProfileImageMutationSnapshot> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    if (actor.profileId !== expectedProfileId)
      return { status: "conflict" as const };
    const owner = await currentActorProjection(transaction, actor);
    if (
      !["pending", "rejected", "approved", "demo"].includes(
        owner.coachAccess.status,
      )
    )
      return { status: "forbidden" as const };
    const current = await currentCoachPortraitReference(transaction, actor);
    if (!current) return { status: "forbidden" as const };
    try {
      const saved = await setCurrentCoachAccountPicture(
        transaction,
        enabled,
        current,
      );
      return { status: "saved" as const, saved, profileId: actor.profileId };
    } catch (error) {
      if (error instanceof ProfileImageReferenceConflictError)
        return { status: "conflict" as const };
      throw error;
    }
  });
  if (result.status !== "authorized")
    return {
      status: result.status === "preview" ? "forbidden" : result.status,
      imageUrl: null,
    };
  if (result.value.status !== "saved")
    return { status: result.value.status, imageUrl: null };
  const { saved, profileId } = result.value;
  if (saved.previousSource === "storage" && saved.previousPath) {
    await profileImageStorage.remove({
      scope: "coach-portrait",
      path: saved.previousPath,
    });
  }
  return {
    status: enabled ? "saved" : "removed",
    imageUrl:
      enabled && saved.updatedAt
        ? sharedCoachPictureUrl(profileId, saved.updatedAt)
        : null,
  };
}

async function sharedReference(profileId: string, version: string) {
  const publicReference = await publicSharedCoachPictureReference(
    profileId,
    version,
  );
  if (publicReference) return publicReference;
  const owner = await withAuthorizedActor(async (transaction, actor) => {
    if (actor.profileId !== profileId) return null;
    const portrait = await currentCoachPortraitReference(transaction, actor);
    if (
      portrait?.source !== "account" ||
      portrait.path !== profileId ||
      portrait.updatedAt !== version
    )
      return null;
    const avatar = await currentAccountAvatarReference(transaction, actor);
    return avatar.path && avatar.updatedAt
      ? { path: avatar.path, version, avatarVersion: avatar.updatedAt }
      : null;
  });
  if (owner.status === "unavailable")
    throw new Error("Shared picture access unavailable.");
  return owner.status === "authorized" ? owner.value : null;
}

export async function currentOrPublicSharedCoachPicture(
  profileId: string,
  version: string,
) {
  if (
    !isCanonicalUuid(profileId) ||
    !Number.isFinite(Date.parse(version)) ||
    new Date(version).toISOString() !== version
  )
    return { status: "not-found" as const };
  profileId = profileId.toLowerCase();
  return readCurrentSharedPicture(
    () => sharedReference(profileId, version),
    (path) => profileImageStorage.download({ scope: "account-avatar", path }),
  );
}
