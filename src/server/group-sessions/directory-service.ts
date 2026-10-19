import "server-only";
import { parseGroupSessionResult } from "@/domain/group-sessions";
import {
  eventListQuery,
  type EventFilters,
} from "@/features/events/event-contract";
import {
  eventQueryKey,
  type EventDirectoryPage,
} from "@/features/events/directory-contract";
import { publicGroupSessions } from "./service";
import { publicEventPresentations } from "./banner-service";

export async function publicEventDirectory(
  filters: EventFilters,
): Promise<EventDirectoryPage | { status: "unavailable" }> {
  try {
    const result = await publicGroupSessions(eventListQuery(filters));
    if (result.status !== "ready") return { status: "unavailable" };
    const page = parseGroupSessionResult("public-list", result.value);
    const media = await publicEventPresentations(
      page.items.map((item) => item.id),
    );
    if (media.status !== "ready") return { status: "unavailable" };
    // A session can cease being public between the two authoritative reads.
    // Fail this batch so a missing item cannot corrupt the fixed-size cursor contract.
    if (page.items.some((item) => !media.presentations.has(item.id)))
      return { status: "unavailable" };
    return {
      status: "ready",
      queryKey: eventQueryKey(filters),
      page,
      presentations: Object.fromEntries(media.presentations),
    };
  } catch {
    return { status: "unavailable" };
  }
}
