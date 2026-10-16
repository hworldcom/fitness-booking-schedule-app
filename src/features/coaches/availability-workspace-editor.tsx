"use client";
import Link from "next/link";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { AvailabilityEditor } from "./availability-editor";
import { availabilityActorAccess } from "./availability-editor-model";
import type { ComponentProps } from "react";

/** Unmount private drafts on identity/access changes, including another browser tab signing out. */
export function AvailabilityWorkspaceEditor(
  props: ComponentProps<typeof AvailabilityEditor>,
) {
  const { session } = useAuthSession();
  const { actor } = useActor();
  const access = availabilityActorAccess(session, actor, props.initial);
  return (
    <>
      {access !== "allowed" && (
        <section className="availability-notice" role="alert">
          <p>
            {access === "pending"
              ? "Verifying coach access. Your draft is hidden until access can be checked."
              : "Your account or coach access changed. Reload before editing availability."}
          </p>
          <Link className="button secondary" href="/coach">
            Reload workspace
          </Link>
        </section>
      )}
      {access !== "denied" && (
        <div hidden={access !== "allowed"}>
          <AvailabilityEditor {...props} />
        </div>
      )}
    </>
  );
}
