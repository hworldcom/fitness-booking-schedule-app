import "server-only";

import { safeReturnTo } from "@/auth/return-to";
import type { AuthContinuation } from "@/server/db/auth/repository";
import { currentApplicationIdentity } from "@/server/identity/service";
import { currentActorSnapshot } from "@/server/authorization/service";
import { verifiedAuthSession } from "./session";

export function authContinuation(
  command: { returnTo?: string; intent?: "client" | "coach" },
  site: string,
): AuthContinuation {
  return {
    returnTo: safeReturnTo(command.returnTo, site),
    intent: command.intent ?? null,
  };
}

export function withAuthContinuation(path: string, context: AuthContinuation) {
  const params = new URLSearchParams({ returnTo: context.returnTo });
  if (context.intent) params.set("intent", context.intent);
  return path + "?" + params;
}

export async function authenticationDestination(context: AuthContinuation) {
  const identity = await currentApplicationIdentity(
    await verifiedAuthSession(),
  );
  if (identity.status !== "enrolled")
    return withAuthContinuation("/complete-profile", context);
  if (context.intent === "coach") {
    const actor = await currentActorSnapshot();
    if (
      actor.status === "authorized" &&
      ["approved", "demo", "suspended"].includes(actor.coachAccessStatus)
    )
      return "/profile/coach";
    return withAuthContinuation("/complete-profile", context);
  }
  return context.returnTo;
}
