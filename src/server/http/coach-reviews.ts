import "server-only";
import { isSameApplicationOrigin } from "@/server/auth/request-origin";
import type {
  ReviewCommandResult,
  ReviewPageResult,
} from "@/domain/coach-reviews";
import { boundedRequestBody } from "./bounded-body";

export function coachReviewResponse(
  result: ReviewCommandResult | ReviewPageResult,
) {
  const code = {
    ready: 200,
    saved: 200,
    invalid: 400,
    conflict: 409,
    "not-eligible": 403,
    "not-found": 404,
    "signed-out": 401,
    forbidden: 403,
    unavailable: 503,
  };
  return Response.json(result, {
    status: code[result.status],
    headers: {
      "cache-control": "private, no-store",
      vary: "Cookie",
      "x-content-type-options": "nosniff",
    },
  });
}
export async function coachReviewRequest(request: Request): Promise<unknown> {
  if (
    !isSameApplicationOrigin(request) ||
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  )
    return null;
  const bytes = await boundedRequestBody(request, 16 * 1024);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}
