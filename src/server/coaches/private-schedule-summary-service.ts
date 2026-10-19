import "server-only";
import type { PublicCoachAvailabilitySlot } from "@/domain/coaches";
import type { SessionCatalog } from "@/domain/typed-sessions";
import {
  legacyPrivateScheduleSummary,
  type PrivateScheduleSummary,
} from "@/domain/private-schedule-summary";
import { typedPrivateScheduleSummaryRecord } from "@/server/db/coaches/private-schedule-summary-repository";

export async function publicPrivateScheduleSummary(
  slug: string,
  catalog: SessionCatalog | null,
  slots: readonly PublicCoachAvailabilitySlot[],
  databaseTime: string,
): Promise<PrivateScheduleSummary> {
  if (!catalog) return { status: "unavailable" };
  try {
    return catalog.enabled
      ? await typedPrivateScheduleSummaryRecord(slug)
      : legacyPrivateScheduleSummary(slots, databaseTime);
  } catch {
    return { status: "unavailable" };
  }
}
