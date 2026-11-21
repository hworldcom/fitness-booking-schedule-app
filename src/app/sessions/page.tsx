import { connectionWorkspaceVersion } from "@/server/connections/workspace-version";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { signInHref } from "@/auth/return-to";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import { ClientBookingRequests } from "@/features/profile/client-booking-requests";
import { BookingPageFrame } from "@/features/profile/booking-page-frame";
import { ConnectionWorkspace } from "@/features/connections/connection-workspace";
import { UNAVAILABLE_CONNECTION_PAGES } from "@/features/connections/connection-model";
import "@/features/connections/connections.css";
import { currentClientSessionWorkspace } from "@/server/coaches/booking-request-service";
import { currentCoachAccess } from "@/server/coaches/service";
import { BookingPageLoading } from "@/features/profile/booking-page-loading";

export const metadata: Metadata = { title: "Bookings" };

export default function Page() {
  return (
    <BookingPageFrame active="private">
      <Suspense fallback={<BookingPageLoading active="private" />}>
        <PrivateSessionsContent />
      </Suspense>
    </BookingPageFrame>
  );
}

async function PrivateSessionsContent() {
  // Both services verify the current actor before querying owned records.
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
  if (bookingState.status === "preview") {
    return (
      <div className="my-session-recovery">
        <section className="protected-access-state">
          <span className="eyebrow">BOOKINGS</span>
          <h2 className="protected-access-title">
            Sign in to see your future sessions.
          </h2>
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
      </div>
    );
  }
  if (bookingState.status !== "authorized") {
    return (
      <div className="my-session-recovery">
        <ProtectedAccessUnavailable headingLevel={2} />
      </div>
    );
  }

  const coachCanOpenWorkspace =
    coachState.status === "authorized" &&
    ["approved", "demo", "suspended"].includes(coachState.coachAccess.status);

  return (
    <div className="client-session-workspace">
      <div>
        <nav
          className="client-session-section-links"
          aria-label="Private booking sections"
        >
          <a href="#booking-requests">Booking requests</a>
          <a href="#my-sessions">Confirmed sessions</a>
        </nav>
      </div>
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
      <ConnectionWorkspace
        view="sessions"
        role="athlete"
        mayInitiate={true}
        initialPages={UNAVAILABLE_CONNECTION_PAGES}
        key={bookingState.actorScope}
        sourceVersion={connectionWorkspaceVersion(
          bookingState.actorScope,
          "athlete",
          [bookingState.bookings, bookingState.requests],
        )}
        bookings={bookingState.bookings}
        referenceTime={new Date().toISOString()}
      />
    </div>
  );
}
