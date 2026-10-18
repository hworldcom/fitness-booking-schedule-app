import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { registrationProfileInput } from "@/auth/registration-profile";
import type { ProfileCompletionResult } from "@/auth/identity-contracts";
import { verifiedAuthSession } from "@/server/auth/session";
import {
  currentApplicationIdentity,
  enrollApplicationIdentity,
} from "@/server/identity/service";

export const dynamic = "force-dynamic";

const responseStatus: Record<ProfileCompletionResult["status"], number> = {
  enrolled: 200,
  "profile-required": 200,
  "signed-out": 401,
  unavailable: 503,
  invalid: 400,
  "username-taken": 409,
};

function identityResponse(
  identity: ProfileCompletionResult,
  status = responseStatus[identity.status],
) {
  return NextResponse.json(identity, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function GET() {
  return identityResponse(
    await currentApplicationIdentity(await verifiedAuthSession()),
  );
}

export async function POST(request: Request) {
  const config = supabasePublicConfig();
  if (!config || request.headers.get("origin") !== config.siteUrl) {
    return identityResponse({ status: "unavailable" });
  }

  const body = await request.text();
  if (
    body.length === 0 ||
    body.length > 2048 ||
    !request.headers.get("content-type")?.startsWith("application/json")
  ) {
    return identityResponse({ status: "invalid" });
  }

  let input: ReturnType<typeof registrationProfileInput> = null;
  try {
    input = registrationProfileInput(JSON.parse(body));
  } catch {
    // Invalid JSON receives the same bounded invalid-input response.
  }
  if (!input) {
    return identityResponse({ status: "invalid" });
  }

  return identityResponse(
    await enrollApplicationIdentity(await verifiedAuthSession(), input),
  );
}
