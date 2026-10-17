import {
  SIGNED_OUT_ACTOR,
  UNAVAILABLE_ACTOR,
  type ActorSnapshot,
} from "./actor-contracts";
import type { AuthSessionSnapshot } from "./contracts";

export type ActorState = Readonly<{
  sessionKey: string;
  actor: ActorSnapshot;
}>;

export function actorSessionKey(session: AuthSessionSnapshot) {
  return session.status === "signed-in"
    ? `${session.subject}:${session.expiresAt ?? "no-expiry"}`
    : session.status;
}

export function visibleActorForSession(
  session: AuthSessionSnapshot,
  actorState: ActorState,
): ActorSnapshot {
  if (session.status === "signed-out" || session.status === "recovery-required")
    return SIGNED_OUT_ACTOR;
  if (session.status === "unavailable") return UNAVAILABLE_ACTOR;
  if (session.status === "disabled") {
    return actorState.actor.status === "preview"
      ? actorState.actor
      : UNAVAILABLE_ACTOR;
  }
  return actorState.sessionKey === actorSessionKey(session)
    ? actorState.actor
    : UNAVAILABLE_ACTOR;
}
