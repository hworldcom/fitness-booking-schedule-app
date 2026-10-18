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

export default async function Page() {
  const state = await currentCoachAvailabilityWorkspace(false);
  if (state.status === "signed-out") redirect(signInHref("/coach/athletes"));
  if (state.status === "forbidden")
    redirect(`${signInHref("/coach/athletes")}&reason=forbidden`);
  if (state.status === "preview") {
    return (
      <section className="protected-access-state">
        <span className="eyebrow">MY ATHLETES</span>
        <h1>Sign in to see your athletes.</h1>
        <p>
          Your connections and connection requests are private to your account.
        </p>
        <Link href={signInHref("/coach/athletes")} className="button dark">
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
    currentPrivateBookingWorkspace(),
    loadConnectionPagesAction("coach"),
  ]);
  const bookings =
    bookingState.status === "authorized" ? bookingState.coachBookings : null;
  const content = (
    <div className="coach-bookings-workspace">
      <ConnectionWorkspace
        key={state.actorScope}
        role="coach"
        view="connections"
        mayInitiate={mayInitiate}
        initialPages={pages}
        sourceVersion={connectionWorkspaceVersion(state.actorScope, "coach", [
          pages,
          bookings,
          state.coachAccess.status,
        ])}
        bookings={bookings}
        referenceTime={new Date().toISOString()}
      />
    </div>
  );
  return state.coachAccess.status === "suspended" ? (
    <CoachApplicationGate
      access={state.coachAccess}
      existingBookings={content}
    />
  ) : (
    content
  );
}
