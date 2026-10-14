import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { signInHref } from "@/auth/return-to";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { ClientBookingRequests } from "@/features/profile/client-booking-requests";
import { ClientSessions } from "@/features/profile/client-sessions";
import { protectedPageAccess } from "@/server/authorization/page-access";
import { currentClientSessionWorkspace } from "@/server/coaches/booking-request-service";
import { currentCoachAccess } from "@/server/coaches/service";

export const metadata: Metadata = { title: "My sessions" };

export default async function Page() {
  const access = await protectedPageAccess("/sessions");
  if (access.status === "unavailable") {
    return <ProtectedAccessUnavailable />;
  }
  if (access.status === "preview") {
    return (
      <section className="protected-access-state">
        <span className="eyebrow">MY SESSIONS</span>
        <h1>Sign in to see your future sessions.</h1>
        <p>
          MovX shows only bookings owned by the verified account. Public coach
          discovery remains available without signing in.
        </p>
        <div className="protected-access-actions">
          <Link className="button dark" href={signInHref("/sessions")}>
            Go to sign-in
          </Link>
          <Link className="button secondary" href="/explore">
            Find a coach
          </Link>
        </div>
      </section>
    );
  }

  const [bookingState, coachState] = await Promise.all([
    currentClientSessionWorkspace({ pageSize: 20 }),
    currentCoachAccess(),
  ]);
  if (bookingState.status === "signed-out") {
    redirect(signInHref("/sessions"));
  }
  if (bookingState.status === "forbidden") {
    redirect(`${signInHref("/sessions")}&reason=forbidden`);
  }
  if (bookingState.status !== "authorized") {
    return <ProtectedAccessUnavailable />;
  }

  const coachCanOpenWorkspace =
    coachState.status === "authorized" &&
    ["approved", "demo", "suspended"].includes(coachState.coachAccess.status);

  return (
    <div className="client-session-workspace">
      <header className="client-session-page-heading">
        <span className="eyebrow">YOUR TRAINING</span>
        <h1>My sessions</h1>
        <p>
          Track requests awaiting a decision, upcoming confirmed training and
          your retained session history.
        </p>
        <nav aria-label="My sessions sections">
          <a href="#booking-requests">Booking requests</a>
          <a href="#my-sessions">Confirmed sessions</a>
        </nav>
      </header>
      {coachCanOpenWorkspace && (
        <aside className="client-session-coach-context">
          <BriefcaseBusiness size={20} aria-hidden="true" />
          <div>
            <strong>These are sessions you requested as an athlete.</strong>
            <span>
              Sessions you teach and incoming requests stay in Coach workspace.
            </span>
          </div>
          <Link href="/coach">Open coach workspace</Link>
        </aside>
      )}
      <ClientBookingRequests initialPage={bookingState.requests} />
      <ClientSessions
        bookings={bookingState.bookings}
        referenceTime={new Date().toISOString()}
      />
    </div>
  );
}
