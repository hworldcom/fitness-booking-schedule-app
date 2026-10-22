import {
  parsePublicGroupQuery,
  type GroupCursor,
  type PublicGroupQuery,
} from "@/domain/group-sessions";
import type { EventFilters, EventSearch } from "./contracts";

export function parseEventFilters(search: EventSearch): EventFilters | null {
  if (
    Object.keys(search).some(
      (key) =>
        ![
          "discipline",
          "location",
          "afterAt",
          "afterId",
          "sessionType",
        ].includes(key),
    ) ||
    Object.values(search).some((value) => Array.isArray(value))
  )
    return null;
  const hasCursor =
    search.afterAt !== undefined || search.afterId !== undefined;
  const query = parsePublicGroupQuery({
    action: "list",
    args: {
      ...(search.sessionType ? { sessionTypeId: search.sessionType } : {}),
      discipline: search.discipline || null,
      location: search.location ?? "",
      after: hasCursor ? { at: search.afterAt, id: search.afterId } : null,
    },
  });
  return query?.action === "list"
    ? {
        ...(query.args.sessionTypeId
          ? { sessionTypeId: query.args.sessionTypeId }
          : {}),
        discipline: query.args.discipline ?? null,
        location: query.args.location ?? "",
        after: query.args.after ?? null,
      }
    : null;
}

export function eventListQuery(filters: EventFilters): PublicGroupQuery {
  return { action: "list", args: filters };
}

export function eventPageHref(
  filters: EventFilters,
  after: GroupCursor | null,
) {
  const params = new URLSearchParams();
  if (filters.sessionTypeId) params.set("sessionType", filters.sessionTypeId);
  if (filters.discipline) params.set("discipline", filters.discipline);
  if (filters.location) params.set("location", filters.location);
  if (after) {
    params.set("afterAt", after.at);
    params.set("afterId", after.id);
  }
  return `/events${params.size ? `?${params}` : ""}`;
}

export const eventQueryKey = (filters: EventFilters) =>
  eventPageHref(filters, null);
