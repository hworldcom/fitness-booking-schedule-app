import { COACH_BANNER_MAX_SOURCE_BYTES } from "@/domain/coach-website";
import {
  isEventBannerResult,
  isEventId,
  type EventBannerResult,
} from "@/domain/event-banners";

export async function requestEventBanner(
  id: string,
  operation:
    | { method: "GET" }
    | { method: "DELETE"; revision: number }
    | { method: "POST"; revision: number; file: File },
  fetcher: typeof fetch = fetch,
): Promise<EventBannerResult> {
  if (!isEventId(id)) return { status: "invalid" };
  if (
    operation.method === "POST" &&
    (!operation.file.size ||
      operation.file.size > COACH_BANNER_MAX_SOURCE_BYTES ||
      !["image/jpeg", "image/png", "image/webp"].includes(operation.file.type))
  )
    return { status: "invalid" };
  try {
    const response = await fetcher(`/api/coach/events/${id}/banner`, {
      method: operation.method,
      cache: "no-store",
      headers:
        operation.method === "GET"
          ? {}
          : {
              "if-match": `"${operation.revision}"`,
              ...(operation.method === "POST"
                ? { "content-type": operation.file.type }
                : {}),
            },
      ...(operation.method === "POST" ? { body: operation.file } : {}),
    });
    const result: unknown = await response.json();
    if (!isEventBannerResult(result)) return { status: "unavailable" };
    const codes = {
      ready: 200,
      saved: 200,
      invalid: 400,
      conflict: 409,
      "signed-out": 401,
      forbidden: 403,
      "not-found": 404,
      unavailable: 503,
    };
    if (response.status !== codes[result.status])
      return { status: "unavailable" };
    if (result.status === "ready" || result.status === "saved") {
      if (
        result.eventBanner.eventId !== id ||
        result.status !== (operation.method === "GET" ? "ready" : "saved")
      )
        return { status: "unavailable" };
    }
    return result;
  } catch {
    return { status: "unavailable" };
  }
}
