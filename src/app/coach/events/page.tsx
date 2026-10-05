import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { CoachActivationGate } from "@/features/coaches/coach-activation-gate";
import { GroupEventManager } from "@/features/group-events/group-event-manager";
import { currentCoachAvailabilityWorkspace } from "@/server/coaches/service";
import { publicCoachPassCatalogue } from "@/server/coaches/pass-catalogue";
import { currentOwnedGroupEventWorkspace } from "@/server/group-events/service";

export const metadata: Metadata = { title: "Coach group events" };

export default async function Page() {
  const [coachState, eventState] = await Promise.all([
    currentCoachAvailabilityWorkspace(),
    currentOwnedGroupEventWorkspace(),
  ]);
  if (coachState.status !== "authorized") {
    if (coachState.status === "signed-out")
      redirect(signInHref("/coach/events"));
    if (coachState.status === "forbidden") {
      redirect(`${signInHref("/coach/events")}&reason=forbidden`);
    }
    if (coachState.status === "preview") {
      return (
        <section className="protected-access-state">
          <span className="eyebrow">COACH GROUP EVENTS</span>
          <h1>Sign in to manage group events.</h1>
          <p>Published event pools remain publicly browsable.</p>
          <div className="protected-access-actions">
            <Link className="button dark" href={signInHref("/coach/events")}>
              Go to sign-in
            </Link>
            <Link className="button secondary" href="/events">
              Browse group events
            </Link>
          </div>
        </section>
      );
    }
    return (
      <section className="protected-access-state" role="alert">
        <span className="eyebrow">COACH EVENTS UNAVAILABLE</span>
        <h1>We couldn’t verify your coach workspace.</h1>
        <p>No private event records or wallet actions were shown.</p>
        <Link className="button secondary" href="/coach/events">
          Try again
        </Link>
      </section>
    );
  }
  if (!coachState.coachingActivated) return <CoachActivationGate />;
  if (!coachState.coach || coachState.coach.visibility !== "visible") {
    return (
      <section className="protected-access-state">
        <span className="eyebrow">VISIBLE COACH PROFILE REQUIRED</span>
        <h1>Finish your public coach profile first.</h1>
        <p>
          Group events snapshot your reviewed training place, timezone and coach
          identity.
        </p>
        <Link className="button dark" href="/profile/coach">
          Review coach profile
        </Link>
      </section>
    );
  }
  if (eventState.status !== "authorized") {
    return (
      <section className="protected-access-state" role="alert">
        <span className="eyebrow">EVENT RECORDS UNAVAILABLE</span>
        <h1>We couldn’t load your group events.</h1>
        <p>No draft or transaction controls were shown.</p>
        <Link className="button secondary" href="/coach/events">
          Try again
        </Link>
      </section>
    );
  }

  const catalogue = await publicCoachPassCatalogue(coachState.coach.profileId);
  const coachAuthorityAddress =
    catalogue.status === "ready"
      ? (catalogue.offers[0]?.coachAuthorityAddress ?? null)
      : null;
  return (
    <GroupEventManager
      coach={coachState.coach}
      events={eventState.events}
      coachAuthorityAddress={coachAuthorityAddress}
    />
  );
}
