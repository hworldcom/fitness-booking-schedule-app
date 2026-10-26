import { PROFILE_IMAGE_MIME_TYPE } from "@/profile-images/contracts";
import { memberAvatarBytes } from "@/server/member-profiles/avatar";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await context.params;
  const result = await memberAvatarBytes(
    profileId,
    new URL(request.url).searchParams.get("v"),
    request.headers.get("if-none-match"),
  );
  const headers = { "cache-control": "private, no-cache", vary: "Cookie" };
  if (result.status === "not-modified")
    return new Response(null, {
      status: 304,
      headers: { ...headers, etag: result.etag },
    });
  if (result.status === "ready")
    return new Response(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        ...headers,
        etag: result.etag,
        "content-type": PROFILE_IMAGE_MIME_TYPE,
      },
    });
  const status =
    result.status === "not-found"
      ? 404
      : result.status === "signed-out"
        ? 401
        : result.status === "forbidden" || result.status === "preview"
          ? 403
          : 503;
  return new Response(null, {
    status,
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}
