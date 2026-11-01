import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { externalBody, externalResponse } from "@/server/external-clients/http";
import {
  invitationTokenHash,
  invitationReviewContext,
  reviewInvitation,
  decideInvitation,
} from "@/server/external-clients/service";
export const dynamic = "force-dynamic";
const cookieName = "movx-pending-invitation";
async function context() {
  const value = (await cookies()).get(cookieName)?.value;
  return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
}
export async function GET() {
  const hash = await context();
  return externalResponse(
    hash
      ? {
          ...(await reviewInvitation(hash)),
          context: invitationReviewContext(hash),
        }
      : { status: "ready", state: "missing" },
  );
}
export async function POST(request: Request) {
  const v = (await externalBody(request)) as Record<string, unknown> | null;
  if (!v || typeof v !== "object" || Array.isArray(v))
    return externalResponse({ status: "invalid" });
  if (
    v.action === "review" &&
    Object.keys(v).every((k) => ["action", "token"].includes(k)) &&
    typeof v.token === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(v.token)
  ) {
    const hash = invitationTokenHash(v.token);
    (await cookies()).set(cookieName, hash, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 14 * 86400,
    });
    return externalResponse({
      ...(await reviewInvitation(hash)),
      context: invitationReviewContext(hash),
    });
  }
  if (
    !["accept", "decline"].includes(String(v.action)) ||
    Object.keys(v).some((k) => !["action", "context"].includes(k)) ||
    typeof v.context !== "string" ||
    !/^[0-9a-f]{64}$/.test(v.context)
  )
    return externalResponse({ status: "invalid" });
  const hash = await context();
  if (!hash) return externalResponse({ status: "invalid" });
  if (v.context !== invitationReviewContext(hash))
    return externalResponse({ status: "conflict" });
  const result = await decideInvitation(hash, String(v.action));
  if (result.status === "ready")
    for (const path of [
      "/sessions",
      "/coach",
      "/coach/athletes",
      "/connections",
    ])
      revalidatePath(path);
  return externalResponse(result);
}
