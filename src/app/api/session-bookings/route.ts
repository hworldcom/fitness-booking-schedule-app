import { revalidatePath } from "next/cache";
import {
  typedSessionCommand,
  sessionBookingDetail,
  coachSessionBookingOptions,
} from "@/server/coaches/typed-session-service";
import { boundedRequestBody } from "@/server/http/bounded-body";
import { sameWebsiteOrigin } from "@/app/api/coach/website/_http";
export const dynamic = "force-dynamic";
function response(result: { status: string }) {
  const codes: Record<string, number> = {
    ready: 200,
    saved: 200,
    invalid: 400,
    conflict: 409,
    forbidden: 403,
    "signed-out": 401,
    unavailable: 503,
  };
  return Response.json(result, {
    status: codes[result.status] ?? 503,
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  if (q.has("options")) {
    let options;
    try {
      options = q.has("cursor")
        ? { cursor: JSON.parse(q.get("cursor") ?? "null") }
        : {};
    } catch {
      return response({ status: "invalid" });
    }
    return response(await coachSessionBookingOptions(options));
  }
  return response(
    await sessionBookingDetail(
      new URL(request.url).searchParams.get("bookingId") ?? "",
      q.has("beforeRevision") ? Number(q.get("beforeRevision")) : null,
    ),
  );
}
export async function POST(request: Request) {
  if (
    !sameWebsiteOrigin(request) ||
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  )
    return response({ status: "invalid" });
  const bytes = await boundedRequestBody(request, 4096);
  if (!bytes) return response({ status: "invalid" });
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return response({ status: "invalid" });
  }
  const result = await typedSessionCommand(
    value,
    new URL(request.url).searchParams.get("coach") === "true",
  );
  if (result.status === "saved") {
    for (const path of ["/coach", "/sessions", "/messages", "/coach/athletes"])
      revalidatePath(path);
    revalidatePath("/coaches/[slug]", "page");
    revalidatePath("/[handle]", "page");
  }
  return response(result);
}
