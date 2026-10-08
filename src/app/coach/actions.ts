"use server";

import { revalidatePath } from "next/cache";
import {
  isCoachAvailabilitySlotId,
  validateCoachAvailabilityInput,
  validateCoachAvailabilityRuleSetInput,
} from "@/domain/coaches";
import {
  createOwnedCoachAvailability,
  replaceOwnedCoachAvailabilityRules,
  updateOwnedCoachAvailability,
  withdrawOwnedCoachAvailability,
} from "@/server/coaches/service";

export type CoachAvailabilityActionState = Readonly<{
  status: "idle" | "saved" | "invalid" | "conflict" | "unavailable";
  message: string;
  errors: readonly string[];
}>;

function unavailableMessage(status: string) {
  if (status === "signed-out") {
    return "Your sign-in expired. Sign in again before changing availability.";
  }
  if (status === "forbidden") {
    return "This account is not authorized to change that availability.";
  }
  return "MovX could not verify and save availability right now.";
}

export async function mutateCoachAvailabilityAction(
  _previousState: CoachAvailabilityActionState,
  formData: FormData,
): Promise<CoachAvailabilityActionState> {
  const intent = formData.get("intent");
  const slotId = String(formData.get("slotId") ?? "");

  if (intent !== "create" && intent !== "update" && intent !== "withdraw") {
    return Object.freeze({
      status: "invalid",
      message: "Choose a valid availability action.",
      errors: Object.freeze([]),
    });
  }
  if (
    (intent === "update" || intent === "withdraw") &&
    !isCoachAvailabilitySlotId(slotId)
  ) {
    return Object.freeze({
      status: "invalid",
      message: "That availability slot is invalid.",
      errors: Object.freeze([]),
    });
  }

  let result;
  if (intent === "withdraw") {
    result = await withdrawOwnedCoachAvailability(slotId);
  } else {
    const validation = validateCoachAvailabilityInput({
      localStart: formData.get("localStart"),
      durationMinutes: formData.get("durationMinutes"),
      refreshLocation: formData.get("refreshLocation") === "on",
    });
    if (!validation.valid) {
      return Object.freeze({
        status: "invalid",
        message: "Review the slot details.",
        errors: validation.errors,
      });
    }
    result =
      intent === "create"
        ? await createOwnedCoachAvailability(validation.value)
        : await updateOwnedCoachAvailability(slotId, validation.value);
  }

  if (result.status !== "authorized") {
    return Object.freeze({
      status: "unavailable",
      message: unavailableMessage(result.status),
      errors: Object.freeze([]),
    });
  }
  if (result.outcome === "conflict") {
    return Object.freeze({
      status: "conflict",
      message:
        "That slot overlaps existing availability, is no longer open, or falls outside the next seven days.",
      errors: Object.freeze([]),
    });
  }

  revalidatePath("/coach");
  if (result.slug) revalidatePath(`/coaches/${result.slug}`);
  return Object.freeze({
    status: "saved",
    message:
      intent === "create"
        ? "Availability published."
        : intent === "update"
          ? "Availability updated."
          : "Availability withdrawn.",
    errors: Object.freeze([]),
  });
}

export async function saveCoachAvailabilityRulesAction(
  _previousState: CoachAvailabilityActionState,
  formData: FormData,
): Promise<CoachAvailabilityActionState> {
  const selectedRules = validateCoachAvailabilityRuleSetInput(
    formData.get("selectedRules"),
  );
  const expectedRules = validateCoachAvailabilityRuleSetInput(
    formData.get("expectedRules"),
  );
  if (!selectedRules.valid || !expectedRules.valid) {
    return Object.freeze({
      status: "invalid",
      message: "Review the working-week selection.",
      errors: Object.freeze([
        ...(selectedRules.valid ? [] : selectedRules.errors),
        ...(expectedRules.valid ? [] : expectedRules.errors),
      ]),
    });
  }

  const result = await replaceOwnedCoachAvailabilityRules(
    selectedRules.value.rules,
    expectedRules.value.rules,
  );

  if (result.status !== "authorized") {
    return Object.freeze({
      status: "unavailable",
      message: unavailableMessage(result.status),
      errors: Object.freeze([]),
    });
  }
  if (result.outcome === "conflict") {
    return Object.freeze({
      status: "conflict",
      message:
        "Your working week changed elsewhere or conflicts with existing availability. Refresh before trying again; your draft was not partially saved.",
      errors: Object.freeze([]),
    });
  }

  revalidatePath("/coach");
  if (result.slug) revalidatePath(`/coaches/${result.slug}`);
  return Object.freeze({
    status: "saved",
    message:
      "Schedule saved. Future open times were updated; held or booked classes were preserved.",
    errors: Object.freeze([]),
  });
}
