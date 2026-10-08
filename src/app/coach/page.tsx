import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { saveCoachAvailabilityRulesAction } from "./actions";
import { CoachAvailabilityPanel } from "@/features/coaches/coach-availability-panel";
import { CoachActivationGate } from "@/features/coaches/coach-activation-gate";
import { CoachClientCards } from "@/features/coaches/coach-client-cards";
import { currentPrivateBookingWorkspace } from "@/server/coaches/booking-service";
import { currentCoachAvailabilityWorkspace } from "@/server/coaches/service";

export const metadata: Metadata = { title: "Coach workspace" };

export default async function Page() {
  const [state, bookingState] = await Promise.all([
    currentCoachAvailabilityWorkspace(),
    currentPrivateBookingWorkspace(),
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

  if (!state.coachingActivated) return <CoachActivationGate />;

  const coachBookings =
    bookingState.status === "authorized" ? bookingState.coachBookings : null;

  return (
    <CoachAvailabilityPanel
      coach={state.coach}
      rules={state.rules}
      slots={state.slots}
      bookings={coachBookings}
      clientCards={
        <CoachClientCards
          key="client-bookings"
          bookings={coachBookings}
          referenceTime={new Date().toISOString()}
        />
      }
      ownerDisplayName={state.ownerDisplayName}
      saveRuleSetAction={saveCoachAvailabilityRulesAction}
    />
  );
}
