"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { availabilityActorAccess } from "./availability-editor-model";

export function CoachWorkspaceOwnerBoundary({
  scope,
  actorIdentity,
  returnHref,
  children,
  allowSuspended = false,
}: {
  scope: string;
  actorIdentity: string;
  returnHref: string;
  children: ReactNode;
  allowSuspended?: boolean;
}) {
  const { session } = useAuthSession();
  const { actor } = useActor();
  const suspendedOwner =
    allowSuspended &&
    session.status === "signed-in" &&
    session.subject === scope.split(":")[0] &&
    actor.status === "authorized" &&
    actor.coachAccessStatus === "suspended" &&
    [actor.profile.slug, actor.demoRun.slug, actor.role].join(":") ===
      actorIdentity;
  const access = suspendedOwner
    ? "allowed"
    : availabilityActorAccess(session, actor, { scope, actorIdentity });
  return (
    <>
      {access !== "allowed" && (
        <section className="availability-notice" role="alert">
          <p>
            {access === "pending"
              ? "Verifying coach access. Your workspace is hidden until access can be checked."
              : "Your account or coach access changed. Reload the coach workspace to continue."}
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
