"use client";
import type { ReactNode } from "react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
export function CoachEventsAccess({
  identity,
  scope,
  children,
}: {
  identity: string;
  scope: string;
  children: ReactNode;
}) {
  const { actor } = useActor();
  const { session } = useAuthSession();
  const allowed =
    session.status === "signed-in" &&
    session.subject === scope.split(":")[2] &&
    actor.status === "authorized" &&
    [actor.profile.slug, actor.demoRun.slug, actor.role].join(":") ===
      identity &&
    ["approved", "demo", "suspended"].includes(actor.coachAccessStatus);
  if (!allowed)
    return (
      <section className="coach-event-notice" role="alert">
        <p>
          Your coach access is being checked or has changed. Private event
          details are hidden until verified.
        </p>
        <button
          className="button secondary"
          onClick={() => window.location.reload()}
        >
          Reload Events
        </button>
      </section>
    );
  return children;
}
