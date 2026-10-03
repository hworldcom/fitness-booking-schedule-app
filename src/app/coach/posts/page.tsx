import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { signInHref } from "@/auth/return-to";
import { CoachPostManager } from "@/features/coaches/coach-social";
import { currentCoachPostEditor } from "@/server/coaches/social-service";

export const metadata: Metadata = { title: "Coach posts" };

export default async function Page() {
  await connection();
  const state = await currentCoachPostEditor();
  if (state.status === "signed-out") redirect(signInHref("/coach/posts"));
  if (state.status === "forbidden") {
    redirect(`${signInHref("/coach/posts")}&reason=forbidden`);
  }
  if (state.status === "preview") {
    return (
      <section className="protected-access-state">
        <span className="eyebrow">COACH POSTS</span>
        <h1>Sign in to publish coach notes.</h1>
        <p>
          Publishing requires a verified identity and a visible coach profile.
        </p>
        <Link className="button dark" href={signInHref("/coach/posts")}>
          Go to sign-in
        </Link>
      </section>
    );
  }
  if (state.status !== "authorized") {
    return (
      <section className="coach-directory-state" role="alert">
        <h1>Your coach posts are temporarily unavailable.</h1>
        <p>No post mutation was attempted.</p>
        <Link className="button secondary" href="/coach/posts">
          Try again
        </Link>
      </section>
    );
  }
  if (!state.coach) {
    return (
      <section className="coach-directory-state">
        <h1>Create a coach profile before publishing.</h1>
        <p>Posts always belong to one verified coach identity.</p>
        <Link className="button lime" href="/profile/coach">
          Create coach profile
        </Link>
      </section>
    );
  }
  if (!state.coach.visible) {
    return (
      <section className="coach-directory-state">
        <h1>Make your coach profile visible first.</h1>
        <p>
          Hidden coaches cannot publish posts into public or follower feeds.
        </p>
        <Link className="button lime" href="/profile/coach">
          Edit coach profile
        </Link>
      </section>
    );
  }
  return <CoachPostManager posts={state.posts} coachSlug={state.coach.slug} />;
}
