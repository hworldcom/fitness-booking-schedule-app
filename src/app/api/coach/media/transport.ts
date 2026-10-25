import type { CoachMediaFailure } from "@/domain/coach-media";
export const mediaHeaders = {
  "cache-control": "private, no-store",
  vary: "Cookie",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};
export function mediaResponse(result: { status: string }) {
  const status =
    (
      {
        ready: 200,
        saved: 200,
        invalid: 400,
        conflict: 409,
        forbidden: 403,
        "signed-out": 401,
        "not-found": 404,
        unavailable: 503,
      } as Record<string, number>
    )[result.status] ?? 503;
  return Response.json(result, { status, headers: mediaHeaders });
}
export function mediaBytesResponse(
  result:
    { status: "ready"; bytes: Uint8Array<ArrayBuffer> } | CoachMediaFailure,
) {
  return result.status === "ready"
    ? new Response(result.bytes, {
        headers: { ...mediaHeaders, "content-type": "image/webp" },
      })
    : mediaResponse(result);
}
