import type { EventBannerResult } from "@/domain/event-banners";
export function eventBannerResponse(result: EventBannerResult) {
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
  return Response.json(result, {
    status: codes[result.status],
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}
