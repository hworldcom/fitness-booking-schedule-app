import { connectionWorkspaceVersion } from "@/server/connections/workspace-version";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import {
  changeAvailabilityEditorAction,
  loadAvailabilityEditorAction,
} from "./availability-actions";
import { AvailabilityWorkspaceEditor } from "@/features/coaches/availability-workspace-editor";
import {
  availabilityMonth,
  berlinAvailabilityDate,
} from "@/features/coaches/availability-editor-model";
import { isAvailabilityDate } from "@/domain/effective-availability";
import { loadAvailabilityEditor } from "@/server/coaches/availability-editor-service";
import { CoachAvailabilityPanel } from "@/features/coaches/coach-availability-panel";
import { CoachApplicationGate } from "@/features/coaches/coach-application-gate";
import { ConnectionWorkspace } from "@/features/connections/connection-workspace";
import { UNAVAILABLE_CONNECTION_PAGES } from "@/features/connections/connection-model";
import { loadConnectionPagesAction } from "@/app/connections/actions";
import "@/features/connections/connections.css";
import { CoachBookingRequestQueue } from "@/features/coaches/coach-booking-request-queue";
import { resolveCoachWorkspaceView } from "@/features/coaches/coach-workspace-view";
import { currentOwnedCoachBookingRequestPage } from "@/server/coaches/booking-request-service";
import { currentPrivateBookingWorkspace } from "@/server/coaches/booking-service";
import { currentCoachAvailabilityWorkspace } from "@/server/coaches/service";

export const metadata: Metadata = { title: "Coach workspace" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    date?: string | string[];
    section?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const view = resolveCoachWorkspaceView(params.view);
  const selectedDate =
    typeof params.date === "string" && isAvailabilityDate(params.date)
      ? params.date
      : null;
  const date = selectedDate ?? berlinAvailabilityDate(new Date());
  const [state, bookingState, requestState] = await Promise.all([
    currentCoachAvailabilityWorkspace(false),
    view === "bookings" ? currentPrivateBookingWorkspace() : null,
    view === "bookings"
      ? currentOwnedCoachBookingRequestPage({ pageSize: 20 })
      : null,
  ]);
  if (state.status !== "authorized") {
    if (state.status === "signed-out") redirect(signInHref("/coach"));
    if (state.status === "forbidden") {
      redirect(`${signInHref("/coach")}&reason=forbidden`);
    }
    if (state.status === "preview") {
      return (
        <section className="protected-access-state">
          <span className="eyebrow">COACH WORKSPACE</span>
          <h1>Sign in to manage coach availability.</h1>
          <p>
            Public profiles remain browsable without an account. Publishing
            private training times requires a verified MovX identity.
          </p>
          <div className="protected-access-actions">
            <Link className="button dark" href={signInHref("/coach")}>
              Go to sign-in
            </Link>
            <Link className="button secondary" href="/explore">
              Browse coaches
            </Link>
          </div>
        </section>
      );
    }
    return (
      <section className="protected-access-state" role="alert">
        <span className="eyebrow">COACH WORKSPACE UNAVAILABLE</span>
        <h1>We couldn’t verify your coach workspace right now.</h1>
        <p>No coach or availability data was shown.</p>
        <Link className="button secondary" href="/coach">
          Try again
        </Link>
      </section>
    );
  }

  const coachBookings =
    bookingState?.status === "authorized" ? bookingState.coachBookings : null;
  const coachRequestPage =
    requestState?.status === "authorized" ? requestState.page : null;
  const mayInitiate =
    state.coachAccess.status === "approved" ||
    state.coachAccess.status === "demo";
  const connectionPages =
    view === "bookings" &&
    (mayInitiate || state.coachAccess.status === "suspended")
      ? await loadConnectionPagesAction("coach")
      : UNAVAILABLE_CONNECTION_PAGES;
  const bookingContent = (
    <div className="coach-bookings-workspace">
      <nav
        className="coach-connections-shortcuts"
        aria-label="Bookings sections"
      >
        <a href="#booking-requests">Booking requests</a>
        <a href="#client-bookings">Booked sessions</a>
        <a href="#my-athletes">My athletes</a>
      </nav>
      <CoachBookingRequestQueue initialPage={coachRequestPage} />
      <ConnectionWorkspace
        role="coach"
        bookings={coachBookings}
        referenceTime={new Date().toISOString()}
        initialPages={connectionPages}
        key={state.actorScope}
        sourceVersion={connectionWorkspaceVersion(state.actorScope, "coach", [
          connectionPages,
          coachBookings,
          coachRequestPage,
          state.coachAccess.status,
        ])}
        mayInitiate={mayInitiate}
      />
    </div>
  );

  if (
    state.coachAccess.status !== "approved" &&
    state.coachAccess.status !== "demo"
  ) {
    return (
      <CoachApplicationGate
        access={state.coachAccess}
        existingBookings={
          state.coachAccess.status === "suspended" && view === "bookings"
            ? bookingContent
            : undefined
        }
      />
    );
  }

  const month = availabilityMonth(date);
  const availability =
    view === "schedule" && state.coach?.visibility === "visible"
      ? await loadAvailabilityEditor(
          month.from,
          month.through,
          state.actorScope,
        )
      : null;

  return (
    <CoachAvailabilityPanel
      coach={state.coach}
      view={view}
      bookingContent={view === "bookings" ? bookingContent : undefined}
      ownerDisplayName={state.ownerDisplayName}
      scheduleContent={
        availability?.status === "ready" ? (
          <AvailabilityWorkspaceEditor
            key={`${state.actorScope}:${date}`}
            initial={availability.data}
            initialDate={date}
            initialTab={selectedDate ? "dates" : "weekly"}
            actions={{
              load: loadAvailabilityEditorAction,
              change: changeAvailabilityEditorAction,
            }}
          />
        ) : (
          <section className="coach-workspace-gate" role="alert">
            <h2>Availability could not be loaded.</h2>
            <p>
              {availability?.message ?? "Reload the workspace to try again."}
            </p>
            <Link className="button secondary" href="/coach">
              Try again
            </Link>
          </section>
        )
      }
    />
  );
}
