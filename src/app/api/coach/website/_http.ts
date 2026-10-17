import { supabasePublicConfig } from "@/auth/config";
import type {
  CoachWebsiteResult,
  CoachWebsiteFailure,
} from "@/domain/coach-website";
import type { StorageReadResult } from "@/server/storage/contracts";

export function sameWebsiteOrigin(request: Request) {
  const config = supabasePublicConfig();
  return config !== null && request.headers.get("origin") === config.siteUrl;
}
export function websiteResponse(result: CoachWebsiteResult) {
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
export function bannerExpectedRevision(request: Request) {
  const match = /^"(0|[1-9]\d*)"$/.exec(request.headers.get("if-match") ?? "");
  return match ? Number(match[1]) : -1;
}
export function bannerBytesResponse(
  result: StorageReadResult | CoachWebsiteFailure,
) {
  const code =
    result.status === "ready"
      ? 200
      : result.status === "signed-out"
        ? 401
        : result.status === "forbidden"
          ? 403
          : result.status === "not-found"
            ? 404
            : 503;
  return new Response(result.status === "ready" ? result.bytes : null, {
    status: code,
    headers: {
      "content-type": "image/webp",
      "cache-control": "private, no-store",
      vary: "Cookie",
      "x-content-type-options": "nosniff",
    },
  });
}
