"use server";

import { revalidatePath } from "next/cache";
import {
  isCoachTrainingLocationId,
  validateCoachProfileInput,
  validateCoachTrainingLocationInput,
} from "@/domain/coaches";
import {
  createOwnedCoachTrainingLocation,
  deactivateOwnedCoachTrainingLocation,
  saveOwnedCoachProfile,
  setOwnedCoachPrimaryLocation,
  updateOwnedCoachTrainingLocation,
} from "@/server/coaches/service";

export type CoachProfileActionState = Readonly<{
  status: "idle" | "saved" | "invalid" | "unavailable";
  message: string;
  errors: readonly string[];
  slug?: string;
}>;

export type CoachTrainingLocationActionState = Readonly<{
  status: "idle" | "saved" | "invalid" | "conflict" | "unavailable";
  message: string;
  errors: readonly string[];
}>;

type CoachTrainingLocationMutationResult = Awaited<
  ReturnType<typeof createOwnedCoachTrainingLocation>
>;

function isTimestamp(value: FormDataEntryValue | null): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function trainingLocationInput(formData: FormData) {
  return validateCoachTrainingLocationInput({
    kind: formData.get("kind"),
    selectedGymId: formData.get("selectedGymId"),
    publicName: formData.get("publicName"),
    locationLabel: formData.get("locationLabel"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    locationSource: formData.get("locationSource"),
    locationProvider: formData.get("locationProvider"),
    locationConfirmation: formData.get("locationConfirmation"),
  });
}

function revalidateCoachLocationPaths(slug?: string) {
  revalidatePath("/[handle]", "page");
  revalidatePath("/profile/coach");
  revalidatePath("/explore");
  if (slug) revalidatePath(`/coaches/${slug}`);
}

function mutationResult(
  result: CoachTrainingLocationMutationResult,
  savedMessage: string,
): CoachTrainingLocationActionState {
  if (result.status !== "authorized") {
    return Object.freeze({
      status: "unavailable",
      message:
        result.status === "signed-out"
          ? "Your sign-in expired. Sign in again before changing locations."
          : result.status === "forbidden"
            ? "This account is not authorized to change coach locations."
            : "MovX could not verify and save the location right now.",
      errors: Object.freeze([]),
    });
  }
  if (result.outcome === "conflict") {
    return Object.freeze({
      status: "conflict",
      message:
        "This profile changed after the page loaded. Your input is still here; reload the current locations before trying again.",
      errors: Object.freeze([]),
    });
  }

  revalidateCoachLocationPaths(result.slug);
  return Object.freeze({
    status: "saved",
    message: savedMessage,
    errors: Object.freeze([]),
  });
}

export async function createCoachTrainingLocationAction(
  _previousState: CoachTrainingLocationActionState,
  formData: FormData,
): Promise<CoachTrainingLocationActionState> {
  const validation = trainingLocationInput(formData);
  if (!validation.valid) {
    return Object.freeze({
      status: "invalid",
      message: "Review the location details before saving.",
      errors: validation.errors,
    });
  }
  return mutationResult(
    await createOwnedCoachTrainingLocation(validation.value),
    "Training location added.",
  );
}

export async function updateCoachTrainingLocationAction(
  _previousState: CoachTrainingLocationActionState,
  formData: FormData,
): Promise<CoachTrainingLocationActionState> {
  const locationId = formData.get("locationId");
  const expectedUpdatedAt = formData.get("expectedUpdatedAt");
  const validation = trainingLocationInput(formData);
  if (
    typeof locationId !== "string" ||
    !isCoachTrainingLocationId(locationId) ||
    !isTimestamp(expectedUpdatedAt)
  ) {
    return Object.freeze({
      status: "conflict",
      message: "Reload the profile before editing this location.",
      errors: Object.freeze([]),
    });
  }
  if (!validation.valid) {
    return Object.freeze({
      status: "invalid",
      message: "Review the location details before saving.",
      errors: validation.errors,
    });
  }
  return mutationResult(
    await updateOwnedCoachTrainingLocation(
      locationId,
      expectedUpdatedAt,
      validation.value,
    ),
    "Training location updated.",
  );
}

export async function setCoachPrimaryLocationAction(
  _previousState: CoachTrainingLocationActionState,
  formData: FormData,
): Promise<CoachTrainingLocationActionState> {
  const locationId = formData.get("locationId");
  const expectedUpdatedAt = formData.get("expectedUpdatedAt");
  const primaryLocationId = formData.get("primaryLocationId");
  const primaryUpdatedAt = formData.get("primaryUpdatedAt");
  if (
    typeof locationId !== "string" ||
    !isCoachTrainingLocationId(locationId) ||
    !isTimestamp(expectedUpdatedAt) ||
    typeof primaryLocationId !== "string" ||
    !isCoachTrainingLocationId(primaryLocationId) ||
    !isTimestamp(primaryUpdatedAt)
  ) {
    return Object.freeze({
      status: "conflict",
      message: "Reload the profile before changing the primary location.",
      errors: Object.freeze([]),
    });
  }
  return mutationResult(
    await setOwnedCoachPrimaryLocation(
      locationId,
      expectedUpdatedAt,
      primaryLocationId,
      primaryUpdatedAt,
    ),
    "Primary training location changed.",
  );
}

export async function deactivateCoachTrainingLocationAction(
  _previousState: CoachTrainingLocationActionState,
  formData: FormData,
): Promise<CoachTrainingLocationActionState> {
  const locationId = formData.get("locationId");
  const expectedUpdatedAt = formData.get("expectedUpdatedAt");
  const replacementId = formData.get("replacementId");
  const replacementUpdatedAt = formData.get("replacementUpdatedAt");
  if (
    typeof locationId !== "string" ||
    !isCoachTrainingLocationId(locationId) ||
    !isTimestamp(expectedUpdatedAt)
  ) {
    return Object.freeze({
      status: "conflict",
      message: "Reload the profile before deactivating this location.",
      errors: Object.freeze([]),
    });
  }

  let replacement: Readonly<{ id: string; expectedUpdatedAt: string }> | null =
    null;
  if (replacementId || replacementUpdatedAt) {
    if (
      typeof replacementId !== "string" ||
      !isCoachTrainingLocationId(replacementId) ||
      !isTimestamp(replacementUpdatedAt)
    ) {
      return Object.freeze({
        status: "invalid",
        message: "Choose a current active replacement location.",
        errors: Object.freeze([]),
      });
    }
    replacement = Object.freeze({
      id: replacementId,
      expectedUpdatedAt: replacementUpdatedAt,
    });
  }

  return mutationResult(
    await deactivateOwnedCoachTrainingLocation(
      locationId,
      expectedUpdatedAt,
      replacement,
    ),
    "Training location deactivated. Future open availability there was withdrawn; booking history was retained.",
  );
}

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
    locationConfirmation: formData.get("locationConfirmation"),
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

  if (result.outcome === "application-required") {
    return Object.freeze({
      status: "unavailable",
      message: "Submit a coach application before creating a coach profile.",
      errors: Object.freeze([]),
    });
  }

  if (result.outcome === "approval-required") {
    return Object.freeze({
      status: "unavailable",
      message:
        "This coach application is not approved for public visibility. The draft was not saved as public.",
      errors: Object.freeze([]),
    });
  }

  revalidatePath("/explore");
  revalidatePath(`/coaches/${result.slug}`);
  revalidatePath("/[handle]", "page");
  revalidatePath("/profile/coach");
  return Object.freeze({
    status: "saved",
    message: "Coach profile saved.",
    errors: Object.freeze([]),
    slug: result.slug,
  });
}
