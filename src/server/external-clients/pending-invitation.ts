import "server-only";

import { cookies } from "next/headers";
import type { PendingCoachInvitation } from "@/domain/external-clients";
import { reviewInvitation } from "./service";

export const PENDING_INVITATION_COOKIE = "movx-pending-invitation";

export async function pendingInvitationHash() {
  const value = (await cookies()).get(PENDING_INVITATION_COOKIE)?.value;
  return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
}

export async function currentPendingCoachInvitation(): Promise<PendingCoachInvitation> {
  const hash = await pendingInvitationHash();
  if (!hash) return null;
  const review = await reviewInvitation(hash);
  if (review.status !== "ready") return { status: "unavailable" };
  return review.state === "pending" && review.coachName
    ? { status: "pending", coachName: review.coachName }
    : null;
}
