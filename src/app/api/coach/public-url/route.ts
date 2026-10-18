import { revalidatePath } from "next/cache";
import type { CoachPublicHandleResult } from "@/domain/coach-public-url";
import {
  currentCoachPublicHandle,
  confirmCoachPublicHandle,
} from "@/server/coaches/public-url-service";
import { boundedRequestBody } from "@/server/http/bounded-body";
import { sameWebsiteOrigin } from "@/app/api/coach/website/_http";

export const dynamic = "force-dynamic";
function response(result: CoachPublicHandleResult) {
  const codes = {
    ready: 200,
    invalid: 400,
    conflict: 409,
    forbidden: 403,
    "signed-out": 401,
    unavailable: 503,
  };
  return Response.json(result, {
    status: codes[result.status],
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}
export async function GET() {
  return response(await currentCoachPublicHandle());
}
export async function POST(request: Request) {
  if (
    !sameWebsiteOrigin(request) ||
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  )
    return response({ status: "invalid" });
  const bytes = await boundedRequestBody(request, 1024);
  if (!bytes) return response({ status: "invalid" });
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return response({ status: "invalid" });
  }
  const result = await confirmCoachPublicHandle(input);
  if (result.status === "ready") {
    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/profile/coach");
    revalidatePath("/coaches/[slug]", "page");
    revalidatePath("/[handle]", "page");
  }
  return response(result);
}
