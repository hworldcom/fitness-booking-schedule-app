import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CoachProfileEditor } from "@/features/coaches/coach-profile-editor";
import { CoachApplicationGate } from "@/features/coaches/coach-application-gate";
import { signInHref } from "@/auth/return-to";
import { resolveLocationSearchConfiguration } from "@/location";
import { currentCoachEditor } from "@/server/coaches/service";
import { currentCoachPublicHandle } from "@/server/coaches/public-url-service";
import { CoachProfileCanvas } from "@/features/coaches/website/coach-profile-canvas";
import { loadCoachPagePresentation } from "@/app/_coaches/public-coach-page";
import { calendarDate, calendarHref } from "@/domain/coach-calendar";
import { availabilityHref } from "@/features/coaches/availability-editor-model";
import { isAvailabilityDate } from "@/domain/effective-availability";

export const metadata: Metadata = { title: "Your coach profile" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = await currentCoachEditor();
  if (state.status !== "authorized") {
    if (state.status === "signed-out") {
      redirect(signInHref("/profile/coach"));
    }
    if (state.status === "forbidden") {
      redirect(`${signInHref("/profile/coach")}&reason=forbidden`);
    }
    if (state.status === "preview") {
      return (
        <section className="protected-access-state">
          <span className="eyebrow">COACH PROFILE</span>
          <h1>Sign in to create your coach profile.</h1>
          <p>
            Public coach browsing works without an account. Publishing or
            editing a profile requires a verified email-backed MovX identity.
          </p>
          <div className="protected-access-actions">
            <Link
              className="button dark"
              href="/sign-in?returnTo=%2Fprofile%2Fcoach"
            >
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
        <span className="eyebrow">COACH PROFILE UNAVAILABLE</span>
        <h1>We couldn’t verify your coach profile right now.</h1>
        <p>No profile data was shown and no mutation was attempted.</p>
        <Link className="button secondary" href="/profile/coach">
          Try again
        </Link>
      </section>
    );
  }
  if (
    state.coachAccess.status === "not-applied" ||
    state.coachAccess.status === "suspended"
  ) {
    return <CoachApplicationGate access={state.coachAccess} />;
  }
  if (state.coach && ["approved", "demo"].includes(state.coachAccess.status)) {
    const [presentation, publicUrl, query] = await Promise.all([
      state.coach.visibility === "visible"
        ? searchParams.then((query) =>
            loadCoachPagePresentation(
              state.coach!.slug,
              query,
              "/profile/coach",
            ),
          )
        : Promise.resolve(null),
      currentCoachPublicHandle(),
      searchParams,
    ]);
    // Public data is supplemental, and must belong to this exact owner.
    const publicProps =
      presentation?.status === "ready" &&
      presentation.props?.state.coach.profileId === state.coach.profileId
        ? presentation.props
        : null;
    const date =
      typeof query.date === "string" && isAvailabilityDate(query.date)
        ? query.date
        : calendarDate(new Date());
    return (
      <CoachProfileCanvas
        coach={state.coach}
        gyms={state.gyms}
        ownerDisplayName={state.ownerDisplayName}
        publicUrl={publicUrl}
        presentation={publicProps}
        locationSearchConfiguration={resolveLocationSearchConfiguration(
          process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY,
        )}
        scheduleLinks={{
          availability: availabilityHref(date),
          calendar: calendarHref({
            date,
            view: "week",
            type: "all",
            venueId: null,
            history: false,
          }),
        }}
      />
    );
  }
  return (
    <CoachProfileEditor
      coach={state.coach}
      gyms={state.gyms}
      ownerDisplayName={state.ownerDisplayName}
      coachAccess={state.coachAccess}
      publicUrl={await currentCoachPublicHandle()}
      locationSearchConfiguration={resolveLocationSearchConfiguration(
        process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY,
      )}
    />
  );
}
