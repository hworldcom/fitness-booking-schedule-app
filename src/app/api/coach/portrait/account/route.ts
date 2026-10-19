import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { selectCurrentCoachAccountPicture } from "@/server/profile-images/shared-coach-picture";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { boundedRequestBody } from "@/server/http/bounded-body";

export const dynamic = "force-dynamic";
async function select(request: Request, enabled: boolean) {
  const config = supabasePublicConfig();
  if (!config || request.headers.get("origin") !== config.siteUrl)
    return NextResponse.json(
      { status: "forbidden", imageUrl: null },
      { status: 403, headers: { "cache-control": "private, no-store" } },
    );
  const bytes =
    request.headers.get("content-type")?.split(";", 1)[0] === "application/json"
      ? await boundedRequestBody(request, 256)
      : null;
  let value: unknown = null;
  try {
    value = bytes ? JSON.parse(new TextDecoder().decode(bytes)) : null;
  } catch {}
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("profileId" in value) ||
    typeof value.profileId !== "string" ||
    !isCanonicalUuid(value.profileId)
  ) {
    return NextResponse.json(
      { status: "invalid", imageUrl: null },
      { status: 400, headers: { "cache-control": "private, no-store" } },
    );
  }
  const result = await selectCurrentCoachAccountPicture(
    enabled,
    value.profileId,
  );
  const status = {
    saved: 200,
    removed: 200,
    invalid: 400,
    conflict: 409,
    "signed-out": 401,
    forbidden: 403,
    unavailable: 503,
  }[result.status];
  return NextResponse.json(result, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}
export async function POST(request: Request) {
  return select(request, true);
}
export async function DELETE(request: Request) {
  return select(request, false);
}
