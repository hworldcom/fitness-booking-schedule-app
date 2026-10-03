import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CoachProfileEditor } from "@/features/coaches/coach-profile-editor";
import { signInHref } from "@/auth/return-to";
import { currentCoachEditor } from "@/server/coaches/service";

export const metadata: Metadata = { title: "Your coach profile" };

export default async function Page() {
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
  return (
    <CoachProfileEditor
      coach={state.coach}
      gyms={state.gyms}
      ownerDisplayName={state.ownerDisplayName}
    />
  );
}
