import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInHref } from "@/auth/return-to";
import { parseCoachPostCursor } from "@/domain/coach-social";
import { FollowingFeed } from "@/features/coaches/coach-social";
import { currentFollowingFeed } from "@/server/coaches/social-service";

export const metadata: Metadata = {
  title: "Following",
  description: "Chronological training notes from coaches you follow.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const rawCursor = (await searchParams).cursor;
  const cursor = parseCoachPostCursor(
    Array.isArray(rawCursor) ? rawCursor[0] : rawCursor,
  );
  const state = await currentFollowingFeed(cursor);
  if (state.status === "signed-out") redirect(signInHref("/following"));
  if (state.status === "forbidden") {
    redirect(`${signInHref("/following")}&reason=forbidden`);
  }
  if (state.status === "preview") {
    return (
      <section className="protected-access-state">
        <span className="eyebrow">FOLLOWING</span>
        <h1>Sign in to build your coach feed.</h1>
        <p>
          Choose coaches yourself; MovX never follows a coach automatically.
        </p>
        <div className="protected-access-actions">
          <Link className="button dark" href={signInHref("/following")}>
            Go to sign-in
          </Link>
          <Link className="button secondary" href="/explore">
            Browse coaches
          </Link>
        </div>
      </section>
    );
  }
  if (state.status !== "authorized") {
    return (
      <section className="coach-directory-state" role="alert">
        <h1>Your following feed is temporarily unavailable.</h1>
        <p>No fixture or cached posts were substituted.</p>
        <Link className="button secondary" href="/following">
          Try again
        </Link>
      </section>
    );
  }
  return <FollowingFeed page={state.page} />;
}
