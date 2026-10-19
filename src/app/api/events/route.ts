import { parseEventDirectory } from "@/features/events/directory-contract";
import type { EventSearch } from "@/features/events/event-contract";
import { publicEventDirectory } from "@/server/group-sessions/directory-service";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const search: EventSearch = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    const prior = search[key];
    search[key] =
      prior === undefined
        ? value
        : [...(Array.isArray(prior) ? prior : [prior]), value];
  }
  const directory = parseEventDirectory(search);
  const result = directory
    ? await publicEventDirectory(directory.filters)
    : { status: "invalid" };
  return Response.json(result, {
    status:
      result.status === "ready" ? 200 : result.status === "invalid" ? 400 : 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
