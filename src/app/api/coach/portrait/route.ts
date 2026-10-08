import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import {
  PROFILE_IMAGE_MAX_CANONICAL_BYTES,
  PROFILE_IMAGE_MIME_TYPE,
  type ProfileImageMutationSnapshot,
} from "@/profile-images/contracts";
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
  const config = supabasePublicConfig();
  const contentLengthValue = request.headers.get("content-length");
  const contentLength = contentLengthValue ? Number(contentLengthValue) : null;
  if (
    !config ||
    request.headers.get("origin") !== config.siteUrl ||
    request.headers.get("content-type")?.split(";", 1)[0] !==
      PROFILE_IMAGE_MIME_TYPE ||
    (contentLength !== null &&
      (Number.isNaN(contentLength) ||
        contentLength <= 0 ||
        contentLength > PROFILE_IMAGE_MAX_CANONICAL_BYTES))
  ) {
    return mutationResponse({ status: "invalid", imageUrl: null });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > PROFILE_IMAGE_MAX_CANONICAL_BYTES
  ) {
    return mutationResponse({ status: "invalid", imageUrl: null });
  }
  return mutationResponse(await uploadCurrentCoachPortrait(bytes));
}

export async function DELETE(request: Request) {
  const config = supabasePublicConfig();
  if (!config || request.headers.get("origin") !== config.siteUrl) {
    return mutationResponse({ status: "unavailable", imageUrl: null });
  }
  return mutationResponse(await removeCurrentCoachPortrait());
}
