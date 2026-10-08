import { NextResponse } from "next/server";
import { supabasePublicConfig } from "@/auth/config";
import {
  PROFILE_IMAGE_MAX_CANONICAL_BYTES,
  PROFILE_IMAGE_MIME_TYPE,
  type ProfileImageMutationSnapshot,
} from "@/profile-images/contracts";
import {
  currentAccountAvatarBytes,
  removeCurrentAccountAvatar,
  uploadCurrentAccountAvatar,
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

function hasCanonicalRequestHeaders(request: Request) {
  const config = supabasePublicConfig();
  const contentLengthValue = request.headers.get("content-length");
  const contentLength = contentLengthValue ? Number(contentLengthValue) : null;
  return (
    config !== null &&
    request.headers.get("origin") === config.siteUrl &&
    request.headers.get("content-type")?.split(";", 1)[0] ===
      PROFILE_IMAGE_MIME_TYPE &&
    (contentLength === null ||
      (!Number.isNaN(contentLength) &&
        contentLength > 0 &&
        contentLength <= PROFILE_IMAGE_MAX_CANONICAL_BYTES))
  );
}

export async function GET() {
  const avatar = await currentAccountAvatarBytes();
  if (avatar.status === "ready") {
    return new Response(avatar.bytes, {
      status: 200,
      headers: {
        "cache-control": "private, max-age=31536000, immutable",
        "content-type": PROFILE_IMAGE_MIME_TYPE,
        vary: "Cookie",
      },
    });
  }
  const status =
    avatar.status === "not-found"
      ? 404
      : avatar.status === "signed-out"
        ? 401
        : avatar.status === "forbidden" || avatar.status === "preview"
          ? 403
          : 503;
  return new Response(null, {
    status,
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}

export async function POST(request: Request) {
  if (!hasCanonicalRequestHeaders(request)) {
    return mutationResponse({ status: "invalid", imageUrl: null });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > PROFILE_IMAGE_MAX_CANONICAL_BYTES
  ) {
    return mutationResponse({ status: "invalid", imageUrl: null });
  }
  return mutationResponse(await uploadCurrentAccountAvatar(bytes));
}

export async function DELETE(request: Request) {
  const config = supabasePublicConfig();
  if (!config || request.headers.get("origin") !== config.siteUrl) {
    return mutationResponse({ status: "unavailable", imageUrl: null });
  }
  return mutationResponse(await removeCurrentAccountAvatar());
}
