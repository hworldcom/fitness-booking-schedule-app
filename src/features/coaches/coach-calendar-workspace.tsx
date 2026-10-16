"use client";
import Link from "next/link";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { CoachCalendar } from "./coach-calendar";
import { calendarActorAccess } from "./coach-calendar-model";
import type { ComponentProps } from "react";
export function CoachCalendarWorkspace(
  props: ComponentProps<typeof CoachCalendar>,
) {
  const { session } = useAuthSession();
  const { actor } = useActor();
  const access = calendarActorAccess(session, actor, props.initial);
  return (
    <>
      {access !== "allowed" && (
        <section className="coach-calendar-unavailable" role="alert">
          <p>
            {access === "pending"
              ? "Verifying calendar access. Private data is hidden until access is checked."
              : "Your account or coach access changed. Reload before viewing this calendar."}
          </p>
          <Link href="/coach" className="button secondary">
            Reload workspace
          </Link>
        </section>
      )}
      {access !== "denied" && (
        <div hidden={access !== "allowed"}>
          <CoachCalendar {...props} />
        </div>
      )}
    </>
  );
}
