import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { saveCoachAvailabilityRulesAction } from "./actions";
import { CoachAvailabilityPanel } from "@/features/coaches/coach-availability-panel";
import { CoachApplicationGate } from "@/features/coaches/coach-application-gate";
import { CoachClientCards } from "@/features/coaches/coach-client-cards";
import { CoachBookingRequestQueue } from "@/features/coaches/coach-booking-request-queue";
import { resolveCoachWorkspaceView } from "@/features/coaches/coach-workspace-view";
import { currentOwnedCoachBookingRequestPage } from "@/server/coaches/booking-request-service";
import { currentPrivateBookingWorkspace } from "@/server/coaches/booking-service";
import { currentCoachAvailabilityWorkspace } from "@/server/coaches/service";

export const metadata: Metadata = { title: "Coach workspace" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] | undefined }>;
}) {
  const view = resolveCoachWorkspaceView((await searchParams).view);
  const [state, bookingState, requestState] = await Promise.all([
    currentCoachAvailabilityWorkspace(),
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
  const bookingContent = (
    <div className="coach-bookings-workspace">
      <CoachBookingRequestQueue initialPage={coachRequestPage} />
      <CoachClientCards
        bookings={coachBookings}
        referenceTime={new Date().toISOString()}
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

  return (
    <CoachAvailabilityPanel
      coach={state.coach}
      rules={state.rules}
      slots={state.slots}
      view={view}
      bookingContent={view === "bookings" ? bookingContent : undefined}
      ownerDisplayName={state.ownerDisplayName}
      saveRuleSetAction={saveCoachAvailabilityRulesAction}
    />
  );
}
