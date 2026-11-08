import { CoachBookingsNavigation } from "@/features/coaches/coach-bookings-navigation";
import { currentOwnedCoachPendingRequestCount } from "@/server/coaches/booking-request-service";
import "server-only";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { berlinAvailabilityDate } from "@/domain/effective-availability";
import { currentCoachAvailabilityWorkspace } from "@/server/coaches/service";
import { CoachApplicationGate } from "@/features/coaches/coach-application-gate";
import { CoachWorkspaceFrame } from "@/features/coaches/coach-workspace-frame";
import { CoachScheduleNavigation } from "@/features/coaches/coach-schedule-navigation";
import { CoachWorkspaceOwnerBoundary } from "@/features/coaches/coach-workspace-owner-boundary";

export async function CoachWorkspacePage({
  active,
  area,
  returnHref,
  children,
}: {
  returnHref: string;
  children: ReactNode;
} & (
  | { area: "calendar"; active: "session-types" }
  | { area: "bookings"; active: "new-booking" }
)) {
  const state = await currentCoachAvailabilityWorkspace(false);
  if (state.status !== "authorized") {
    if (state.status === "signed-out") redirect(signInHref(returnHref));
    if (state.status === "forbidden")
      redirect(`${signInHref(returnHref)}&reason=forbidden`);
    return (
      <section className="protected-access-state" role="alert">
        <span className="eyebrow">COACH WORKSPACE</span>
        <h1>
          {state.status === "preview"
            ? "Sign in to manage your coach workspace."
            : "We couldn’t verify your coach workspace right now."}
        </h1>
        <p>No coach or scheduling data was shown.</p>
        <Link
          className="button secondary"
          href={
            state.status === "preview" ? signInHref(returnHref) : returnHref
          }
        >
          {state.status === "preview" ? "Go to sign-in" : "Try again"}
        </Link>
      </section>
    );
  }
  if (!["approved", "demo"].includes(state.coachAccess.status))
    return <CoachApplicationGate access={state.coachAccess} />;
  const pendingCount =
    area === "bookings"
      ? await currentOwnedCoachPendingRequestCount(state.actorScope)
      : null;
  return (
    <CoachWorkspaceOwnerBoundary
      scope={state.actorScope}
      actorIdentity={state.actorIdentity}
      returnHref={returnHref}
    >
      <CoachWorkspaceFrame
        coach={state.coach}
        ownerDisplayName={state.ownerDisplayName}
      >
        {area === "bookings" ? (
          <CoachBookingsNavigation
            active={active}
            pendingCount={pendingCount}
            newBookingHref={returnHref}
          />
        ) : (
          <CoachScheduleNavigation
            active={active}
            date={berlinAvailabilityDate(new Date())}
          />
        )}
        {children}
      </CoachWorkspaceFrame>
    </CoachWorkspaceOwnerBoundary>
  );
}
