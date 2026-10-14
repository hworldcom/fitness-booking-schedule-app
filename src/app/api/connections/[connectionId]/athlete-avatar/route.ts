import { PROFILE_IMAGE_MIME_TYPE } from "@/profile-images/contracts";
import { connectionAthleteAvatarBytes } from "@/server/connections/avatar";

export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await context.params;
  const result = await connectionAthleteAvatarBytes(connectionId);
  const headers = { "cache-control": "private, no-store", vary: "Cookie" };
  if (result.status === "ready")
    return new Response(new Uint8Array(result.bytes), {
      status: 200,
      headers: { ...headers, "content-type": PROFILE_IMAGE_MIME_TYPE },
    });
  const status =
    result.status === "not-found"
      ? 404
      : result.status === "signed-out"
        ? 401
        : result.status === "forbidden" || result.status === "preview"
          ? 403
          : 503;
  return new Response(null, { status, headers });
}
