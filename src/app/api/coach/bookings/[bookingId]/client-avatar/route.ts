import { PROFILE_IMAGE_MIME_TYPE } from "@/profile-images/contracts";
import { confirmedBookingClientAvatarBytes } from "@/server/profile-images/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await context.params;
  const avatar = await confirmedBookingClientAvatarBytes(bookingId);
  if (avatar.status === "ready") {
    return new Response(avatar.bytes, {
      status: 200,
      headers: {
        "cache-control": "private, no-store",
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
