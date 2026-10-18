"use client";
import { useState, type ReactNode } from "react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
/** Retain a hidden draft during verification; clear it on a real account change. */
export function SessionActorBoundary({
  children,
  publicWhenSignedOut = false,
}: {
  children: (identity: string) => ReactNode;
  publicWhenSignedOut?: boolean;
}) {
  const { actor } = useActor();
  const { session } = useAuthSession();
  const verified =
    actor.status === "authorized" && session.status === "signed-in"
      ? [
          session.subject,
          actor.profile.slug,
          actor.demoRun.slug,
          actor.role,
        ].join(":")
      : "";
  const pending =
    actor.status === "unavailable" || session.status === "unavailable";
  const [remembered, setRemembered] = useState(verified);
  if (verified && verified !== remembered) setRemembered(verified);
  const identity =
    verified ||
    (pending ? remembered : publicWhenSignedOut ? "signed-out" : "");
  return (
    <>
      {pending && <p role="status">Checking your account…</p>}
      <div hidden={pending}>
        {identity
          ? children(identity)
          : !pending && (
              <p role="status">
                Sign in with the appropriate account to continue.
              </p>
            )}
      </div>
    </>
  );
}
