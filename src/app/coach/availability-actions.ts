"use server";
import { revalidatePath } from "next/cache";
import { isAvailabilityDate } from "@/domain/effective-availability";
import { parseAvailabilityCommand } from "@/features/coaches/availability-editor-model";
import type {
  AvailabilityActionResult,
  AvailabilityLoadResult,
} from "@/availability/contracts";
import {
  changeAvailabilityEditor,
  loadAvailabilityEditor,
} from "@/server/coaches/availability-editor-service";

export async function loadAvailabilityEditorAction(
  from: string,
  through: string,
  scope: string,
): Promise<AvailabilityLoadResult> {
  if (
    typeof from !== "string" ||
    typeof through !== "string" ||
    !isAvailabilityDate(from) ||
    !isAvailabilityDate(through) ||
    through < from ||
    (Date.parse(through) - Date.parse(from)) / 86400000 > 30 ||
    typeof scope !== "string" ||
    !scope ||
    scope.length > 160
  )
    return {
      status: "unavailable",
      message: "Choose a valid date range of up to 31 dates.",
    };
  return loadAvailabilityEditor(from, through, scope);
}
export async function changeAvailabilityEditorAction(
  value: unknown,
  scope: string,
  preview: boolean,
): Promise<AvailabilityActionResult> {
  const command = parseAvailabilityCommand(value);
  if (
    !command ||
    typeof scope !== "string" ||
    !scope ||
    scope.length > 160 ||
    typeof preview !== "boolean"
  )
    return {
      status: "invalid",
      message:
        "Review the availability draft. Dates and hours must be valid and nonoverlapping.",
    };
  const result = await changeAvailabilityEditor(command, scope, preview);
  if (
    !preview &&
    result.status === "ready" &&
    result.result.outcome === "saved"
  ) {
    revalidatePath("/coach");
    revalidatePath("/coaches/[slug]", "page");
    revalidatePath("/[handle]", "page");
  }
  return result;
}
