"use server";

import { revalidatePath } from "next/cache";
import { isCoachSocialId } from "@/domain/coach-social";
import { changeCoachFollow } from "@/server/coaches/social-service";

export type CoachFollowActionState = Readonly<{
  status: "idle" | "saved" | "invalid" | "signed-out" | "unavailable";
  message: string;
  following: boolean;
}>;

export async function updateCoachFollowAction(
  _previousState: CoachFollowActionState,
  formData: FormData,
): Promise<CoachFollowActionState> {
  const coachProfileId = formData.get("coachProfileId");
  const coachSlug = formData.get("coachSlug");
  const following = formData.get("following") === "true";
  if (
    !isCoachSocialId(coachProfileId) ||
    typeof coachSlug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(coachSlug)
  ) {
    return Object.freeze({
      status: "invalid",
      message: "The follow request is invalid.",
      following: !following,
    });
  }

  const result = await changeCoachFollow(coachProfileId, following);
  if (result.status !== "authorized") {
    return Object.freeze({
      status: result.status === "signed-out" ? "signed-out" : "unavailable",
      message:
        result.status === "signed-out"
          ? "Sign in before following a coach."
          : "MovX could not update this follow right now.",
      following: !following,
    });
  }

  revalidatePath(`/coaches/${coachSlug}`);
  revalidatePath("/following");
  return Object.freeze({
    status: "saved",
    message: following ? "Coach followed." : "Coach unfollowed.",
    following,
  });
}
