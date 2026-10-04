"use server";

import { revalidatePath } from "next/cache";
import {
  isCoachAvailabilityRuleId,
  isCoachAvailabilitySlotId,
  validateCoachAvailabilityInput,
  validateCoachAvailabilityRuleInput,
} from "@/domain/coaches";
import {
  createOwnedCoachAvailabilityRule,
  createOwnedCoachAvailability,
  removeOwnedCoachAvailabilityRule,
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

export async function mutateCoachAvailabilityRuleAction(
  _previousState: CoachAvailabilityActionState,
  formData: FormData,
): Promise<CoachAvailabilityActionState> {
  const scheduleCell = formData.get("scheduleCell");
  const scheduleCellParts =
    typeof scheduleCell === "string" && scheduleCell.length <= 100
      ? scheduleCell.split("|")
      : [];
  const [intent, isoWeekday, localStartTime, ruleId = ""] =
    scheduleCellParts.length === 4 ? scheduleCellParts : [];
  if (intent !== "create-rule" && intent !== "remove-rule") {
    return Object.freeze({
      status: "invalid",
      message: "Choose a valid working-week action.",
      errors: Object.freeze([]),
    });
  }

  let result;
  if (intent === "remove-rule") {
    if (!isCoachAvailabilityRuleId(ruleId)) {
      return Object.freeze({
        status: "invalid",
        message: "That working-week slot is invalid.",
        errors: Object.freeze([]),
      });
    }
    result = await removeOwnedCoachAvailabilityRule(ruleId);
  } else {
    const validation = validateCoachAvailabilityRuleInput({
      isoWeekday,
      localStartTime,
    });
    if (!validation.valid) {
      return Object.freeze({
        status: "invalid",
        message: "Review the working-week slot.",
        errors: validation.errors,
      });
    }
    result = await createOwnedCoachAvailabilityRule(validation.value);
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
        "That weekly time conflicts with existing availability or changed in another session. Refresh and try again.",
      errors: Object.freeze([]),
    });
  }

  revalidatePath("/coach");
  if (result.slug) revalidatePath(`/coaches/${result.slug}`);
  return Object.freeze({
    status: "saved",
    message:
      intent === "create-rule"
        ? "Added to your working week."
        : "Removed from your working week. Future open times were updated; held or booked classes were preserved.",
    errors: Object.freeze([]),
  });
}
