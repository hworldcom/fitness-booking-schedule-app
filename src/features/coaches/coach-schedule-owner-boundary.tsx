"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { availabilityActorAccess } from "./availability-editor-model";

export function CoachScheduleOwnerBoundary({
  scope,
  actorIdentity,
  returnHref,
  children,
}: {
  scope: string;
  actorIdentity: string;
  returnHref: string;
  children: ReactNode;
}) {
  const { session } = useAuthSession();
  const { actor } = useActor();
  const access = availabilityActorAccess(session, actor, {
    scope,
    actorIdentity,
  });
  return (
    <>
      {access !== "allowed" && (
        <section className="availability-notice" role="alert">
          <p>
            {access === "pending"
              ? "Verifying coach access. Your workspace is hidden until access can be checked."
              : "Your account or coach access changed. Reload the schedule workspace to continue."}
          </p>
          <Link className="button secondary" href={returnHref}>
            Reload workspace
          </Link>
        </section>
      )}
      {access !== "denied" && (
        <div hidden={access !== "allowed"}>{children}</div>
      )}
    </>
  );
}
