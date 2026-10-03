"use server";

import { revalidatePath } from "next/cache";
import {
  isCoachPostVisibility,
  isCoachSocialId,
  validateCoachPostBody,
} from "@/domain/coach-social";
import {
  changeCoachPostVisibility,
  publishCoachPost,
} from "@/server/coaches/social-service";

export type CoachPostActionState = Readonly<{
  status: "idle" | "saved" | "invalid" | "signed-out" | "unavailable";
  message: string;
}>;

export async function createCoachPostAction(
  _previousState: CoachPostActionState,
  formData: FormData,
): Promise<CoachPostActionState> {
  const validation = validateCoachPostBody(formData.get("body"));
  if (!validation.valid) {
    return Object.freeze({ status: "invalid", message: validation.message });
  }
  const result = await publishCoachPost(validation.body);
  if (result.status !== "authorized") {
    return Object.freeze({
      status: result.status === "signed-out" ? "signed-out" : "unavailable",
      message:
        result.status === "signed-out"
          ? "Your sign-in expired. Sign in again before publishing."
          : "MovX could not publish this post. Confirm that your coach profile is visible.",
    });
  }
  revalidatePath("/coach/posts");
  revalidatePath("/following");
  revalidatePath("/coaches/[slug]", "page");
  return Object.freeze({ status: "saved", message: "Post published." });
}

export async function updateCoachPostVisibilityAction(
  _previousState: CoachPostActionState,
  formData: FormData,
): Promise<CoachPostActionState> {
  const postId = formData.get("postId");
  const visibility = formData.get("visibility");
  if (!isCoachSocialId(postId) || !isCoachPostVisibility(visibility)) {
    return Object.freeze({
      status: "invalid",
      message: "The post visibility request is invalid.",
    });
  }
  const result = await changeCoachPostVisibility(postId, visibility);
  if (result.status !== "authorized") {
    return Object.freeze({
      status: result.status === "signed-out" ? "signed-out" : "unavailable",
      message:
        result.status === "signed-out"
          ? "Your sign-in expired. Sign in again before changing this post."
          : "MovX could not change that post.",
    });
  }
  revalidatePath("/coach/posts");
  revalidatePath("/following");
  revalidatePath("/coaches/[slug]", "page");
  return Object.freeze({
    status: "saved",
    message: visibility === "hidden" ? "Post hidden." : "Post restored.",
  });
}
