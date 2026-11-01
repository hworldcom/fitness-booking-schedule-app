import { boundedRequestBody } from "@/server/http/bounded-body";
import { sameWebsiteOrigin } from "@/app/api/coach/website/_http";
export function externalResponse<T extends { status: string }>(result: T) {
  const codes: Record<string, number> = {
    ready: 200,
    invalid: 400,
    conflict: 409,
    forbidden: 403,
    "signed-out": 401,
    unavailable: 503,
  };
  return Response.json(result, {
    status: codes[result.status] ?? 503,
    headers: {
      "cache-control": "private, no-store",
      vary: "Cookie",
      "referrer-policy": "no-referrer",
    },
  });
}
export async function externalBody(request: Request): Promise<unknown> {
  if (
    !sameWebsiteOrigin(request) ||
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  )
    return null;
  const bytes = await boundedRequestBody(request, 4096);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}
