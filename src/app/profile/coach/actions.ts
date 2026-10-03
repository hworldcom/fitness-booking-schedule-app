"use server";

import { revalidatePath } from "next/cache";
import { validateCoachProfileInput } from "@/domain/coaches";
import { saveOwnedCoachProfile } from "@/server/coaches/service";

export type CoachProfileActionState = Readonly<{
  status: "idle" | "saved" | "invalid" | "unavailable";
  message: string;
  errors: readonly string[];
  slug?: string;
}>;

export async function updateCoachProfileAction(
  _previousState: CoachProfileActionState,
  formData: FormData,
): Promise<CoachProfileActionState> {
  const validation = validateCoachProfileInput({
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
    disciplines: formData.getAll("disciplines"),
    timezone: formData.get("timezone"),
    visibility: formData.get("visibility"),
    selectedGymId: formData.get("selectedGymId"),
    locationLabel: formData.get("locationLabel"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    locationSource: formData.get("locationSource"),
    locationProvider: formData.get("locationProvider"),
  });
  if (!validation.valid) {
    return Object.freeze({
      status: "invalid",
      message: "Review the highlighted profile details.",
      errors: validation.errors,
    });
  }

  const result = await saveOwnedCoachProfile(validation.value);
  if (result.status !== "authorized") {
    return Object.freeze({
      status: "unavailable",
      message:
        result.status === "signed-out"
          ? "Your sign-in expired. Sign in again before saving."
          : result.status === "forbidden"
            ? "This account is not authorized to change that coach profile."
            : "MovX could not verify and save the coach profile right now.",
      errors: Object.freeze([]),
    });
  }

  if (result.outcome === "activation-required") {
    return Object.freeze({
      status: "unavailable",
      message: "Activate coaching before creating a coach profile.",
      errors: Object.freeze([]),
    });
  }

  revalidatePath("/explore");
  revalidatePath(`/coaches/${result.slug}`);
  revalidatePath("/profile/coach");
  return Object.freeze({
    status: "saved",
    message: "Coach profile saved.",
    errors: Object.freeze([]),
    slug: result.slug,
  });
}
