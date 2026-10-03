import "server-only";

import {
  isCoachPostVisibility,
  isCoachSocialId,
  type CoachFollowState,
  type CoachPostCursor,
  type CoachPostEditorState,
  type FollowingFeedState,
  type PublicCoachPostsState,
} from "@/domain/coach-social";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  createOwnedCoachPostRecord,
  currentCoachFollowRecord,
  followingCoachPostRecords,
  ownedCoachPostRecords,
  publicCoachPostRecords,
  setOwnedCoachFollowRecord,
  setOwnedCoachPostVisibilityRecord,
} from "@/server/db/coaches/social-repository";

export async function publicCoachPosts(
  coachProfileId: string,
): Promise<PublicCoachPostsState> {
  if (!isCoachSocialId(coachProfileId)) {
    return Object.freeze({ status: "unavailable" });
  }
  try {
    return Object.freeze({
      status: "ready",
      posts: await publicCoachPostRecords(coachProfileId),
    });
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}

export async function currentCoachFollowState(
  coachProfileId: string,
): Promise<CoachFollowState> {
  if (!isCoachSocialId(coachProfileId)) {
    return Object.freeze({ status: "unavailable" });
  }
  const result = await withAuthorizedActor(async (transaction, actor) => ({
    following: await currentCoachFollowRecord(
      transaction,
      actor,
      coachProfileId,
    ),
    isOwnProfile: actor.profileId === coachProfileId,
  }));
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized", ...result.value });
}

export async function currentFollowingFeed(
  cursor: CoachPostCursor | null,
): Promise<FollowingFeedState> {
  const result = await withAuthorizedActor((transaction, actor) =>
    followingCoachPostRecords(transaction, actor, cursor),
  );
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized", page: result.value });
}

export async function currentCoachPostEditor(): Promise<CoachPostEditorState> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const coach = await currentOwnedCoachProfileRecord(transaction, actor);
    const posts = await ownedCoachPostRecords(transaction, actor);
    return Object.freeze({
      coach: coach
        ? Object.freeze({
            slug: coach.slug,
            visible: coach.visibility === "visible",
          })
        : null,
      posts,
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized", ...result.value });
}

export async function changeCoachFollow(
  coachProfileId: string,
  following: boolean,
) {
  if (!isCoachSocialId(coachProfileId)) {
    return Object.freeze({ status: "unavailable" as const });
  }
  const result = await withAuthorizedActor((transaction) =>
    setOwnedCoachFollowRecord(transaction, coachProfileId, following),
  );
  if (result.status !== "authorized") return result;
  return Object.freeze({
    status: "authorized" as const,
    following: result.value,
  });
}

export async function publishCoachPost(body: string) {
  const result = await withAuthorizedActor((transaction) =>
    createOwnedCoachPostRecord(transaction, body),
  );
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, postId: result.value });
}

export async function changeCoachPostVisibility(
  postId: string,
  visibility: unknown,
) {
  if (!isCoachSocialId(postId) || !isCoachPostVisibility(visibility)) {
    return Object.freeze({ status: "unavailable" as const });
  }
  const result = await withAuthorizedActor((transaction) =>
    setOwnedCoachPostVisibilityRecord(transaction, postId, visibility),
  );
  if (result.status !== "authorized") return result;
  return Object.freeze({
    status: "authorized" as const,
    visibility: result.value,
  });
}
