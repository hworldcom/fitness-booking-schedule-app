import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { defaultCoachSlotLocalStart } from "@/domain/coaches";
import { CoachAvailabilityPanel } from "@/features/coaches/coach-availability-panel";
import { currentCoachAvailabilityWorkspace } from "@/server/coaches/service";

export const metadata: Metadata = { title: "Coach workspace" };

export default async function Page() {
  const state = await currentCoachAvailabilityWorkspace();
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

  return (
    <CoachAvailabilityPanel
      coach={state.coach}
      slots={state.slots}
      ownerDisplayName={state.ownerDisplayName}
      suggestedLocalStart={
        state.coach
          ? defaultCoachSlotLocalStart(state.coach.timezone)
          : undefined
      }
    />
  );
}
