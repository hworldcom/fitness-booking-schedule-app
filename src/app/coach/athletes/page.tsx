import {
  coachAthletesHref,
  coachAthletesSection,
} from "@/domain/coach-athletes-navigation";
import { CoachAthletesWorkspace } from "@/features/coaches/coach-athletes-workspace";
import { CoachWorkspaceOwnerBoundary } from "@/features/coaches/coach-workspace-owner-boundary";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { loadConnectionPagesAction } from "@/app/connections/actions";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { CoachApplicationGate } from "@/features/coaches/coach-application-gate";
import { ConnectionWorkspace } from "@/features/connections/connection-workspace";
import { currentPrivateBookingWorkspace } from "@/server/coaches/booking-service";
import { currentCoachAvailabilityWorkspace } from "@/server/coaches/service";
import { connectionWorkspaceVersion } from "@/server/connections/workspace-version";
import "@/features/connections/connections.css";

export const metadata: Metadata = { title: "My athletes" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const section = coachAthletesSection(params.section);
  const returnHref = coachAthletesHref(section);
  const state = await currentCoachAvailabilityWorkspace(false);
  if (state.status === "signed-out") redirect(signInHref(returnHref));
  if (state.status === "forbidden")
    redirect(`${signInHref(returnHref)}&reason=forbidden`);
  if (state.status === "preview") {
    return (
      <section className="protected-access-state">
        <span className="eyebrow">MY ATHLETES</span>
        <h1>Sign in to see your athletes.</h1>
        <p>
          Your connections and connection requests are private to your account.
        </p>
        <Link href={signInHref(returnHref)} className="button dark">
          Go to sign-in
        </Link>
      </section>
    );
  }
  if (state.status !== "authorized") return <ProtectedAccessUnavailable />;

  const mayInitiate =
    state.coachAccess.status === "approved" ||
    state.coachAccess.status === "demo";
  if (!mayInitiate && state.coachAccess.status !== "suspended")
    return <CoachApplicationGate access={state.coachAccess} />;

  const [bookingState, pages] = await Promise.all([
    section === "connected" ? currentPrivateBookingWorkspace() : null,
    loadConnectionPagesAction("coach", section),
  ]);
  const bookings =
    bookingState?.status === "authorized" ? bookingState.coachBookings : null;
  const content = (
    <div className="coach-bookings-workspace">
      <ConnectionWorkspace
        key={`${state.actorScope}:${section}`}
        role="coach"
        view="connections"
        mayInitiate={mayInitiate}
        connectionView={section}
        connectionHeadingLevel={2}
        initialPages={pages}
        sourceVersion={connectionWorkspaceVersion(state.actorScope, "coach", [
          section,
          pages,
          bookings,
          state.coachAccess.status,
        ])}
        bookings={bookings}
        referenceTime={new Date().toISOString()}
      />
    </div>
  );
  return (
    <CoachWorkspaceOwnerBoundary
      scope={state.actorScope}
      actorIdentity={state.actorIdentity}
      returnHref={returnHref}
      allowSuspended
    >
      <CoachAthletesWorkspace active={section}>
        {state.coachAccess.status === "suspended" ? (
          <CoachApplicationGate
            access={state.coachAccess}
            headingLevel={2}
            existingBookings={content}
          />
        ) : (
          content
        )}
      </CoachAthletesWorkspace>
    </CoachWorkspaceOwnerBoundary>
  );
}
