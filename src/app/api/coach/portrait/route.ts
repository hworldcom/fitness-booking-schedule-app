import { readPreparedProfileImage } from "@/server/profile-images/upload-request";
import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import { type ProfileImageMutationSnapshot } from "@/profile-images/contracts";
import {
  removeCurrentCoachPortrait,
  uploadCurrentCoachPortrait,
} from "@/server/profile-images/service";

export const dynamic = "force-dynamic";

const responseStatus: Record<ProfileImageMutationSnapshot["status"], number> = {
  saved: 200,
  removed: 200,
  invalid: 400,
  conflict: 409,
  "signed-out": 401,
  forbidden: 403,
  unavailable: 503,
};

function mutationResponse(snapshot: ProfileImageMutationSnapshot) {
  return NextResponse.json(snapshot, {
    status: responseStatus[snapshot.status],
    headers: { "cache-control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const bytes = await readPreparedProfileImage(
    request,
    supabasePublicConfig()?.siteUrl,
  );
  if (!bytes) return mutationResponse({ status: "invalid", imageUrl: null });
  return mutationResponse(await uploadCurrentCoachPortrait(bytes));
}

export async function DELETE(request: Request) {
  const config = supabasePublicConfig();
  if (!config || request.headers.get("origin") !== config.siteUrl) {
    return mutationResponse({ status: "unavailable", imageUrl: null });
  }
  return mutationResponse(await removeCurrentCoachPortrait());
}
