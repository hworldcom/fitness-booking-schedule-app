import { revalidatePath } from "next/cache";
import { coachSessionTypes } from "@/server/coaches/session-type-service";
import { boundedRequestBody } from "@/server/http/bounded-body";
import { sameWebsiteOrigin } from "@/app/api/coach/website/_http";
import type { SessionTypeResult } from "@/domain/session-types";
export const dynamic = "force-dynamic";
function response(result: SessionTypeResult) {
  const codes = {
    ready: 200,
    saved: 200,
    invalid: 400,
    conflict: 409,
    forbidden: 403,
    "signed-out": 401,
    unavailable: 503,
    "not-found": 404,
  };
  return Response.json(result, {
    status: codes[result.status],
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}
export async function GET() {
  return response(await coachSessionTypes());
}
export async function POST(request: Request) {
  if (
    !sameWebsiteOrigin(request) ||
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  )
    return response({ status: "invalid" });
  const bytes = await boundedRequestBody(request, 8192);
  if (!bytes) return response({ status: "invalid" });
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return response({ status: "invalid" });
  }
  const result = await coachSessionTypes(input);
  if (result.status === "saved") {
    revalidatePath("/coach/session-types");
    revalidatePath("/coach");
    revalidatePath("/coaches/[slug]", "page");
    revalidatePath("/[handle]", "page");
  }
  return response(result);
}
