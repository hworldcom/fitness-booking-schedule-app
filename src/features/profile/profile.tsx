"use client";

import Link from "next/link";
import { BadgeCheck, UserRound } from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import { profileInitials } from "@/auth/profile-presentation";
import { signInHref } from "@/auth/return-to";
import { Avatar, Empty, Pill } from "@/components/ui";

export function Profile() {
  const { actor } = useActor();

  if (actor.status === "unavailable") {
    return <ProfileAccessUnavailable />;
  }

  if (actor.status !== "authorized") {
    const preview = actor.status === "preview";
    const profileRequired = actor.status === "forbidden";
    return (
      <section className="protected-access-state">
        <span className="eyebrow">YOUR PROFILE</span>
        <h1>
          {preview
            ? "Create an account to make this space yours."
            : profileRequired
              ? "Finish setting up your profile."
              : "Sign in to see your profile."}
        </h1>
        <p>
          {preview
            ? "The coach-first preview will use the display name you choose after email sign-in."
            : profileRequired
              ? "Your verified email session has no completed MovX profile yet. Choose a display name to continue."
              : "MovX shows personal identity only after the server verifies the signed-in account."}
        </p>
        <div className="protected-access-actions">
          <Link
            href={
              preview
                ? "/sign-in"
                : profileRequired
                  ? "/sign-in?returnTo=%2Fprofile&reason=forbidden"
                  : signInHref("/profile")
            }
            className="button dark"
          >
            {profileRequired ? "Complete profile" : "Go to sign-in"}
          </Link>
          <Link href="/coming-soon" className="button secondary">
            View early access
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ACCOUNT PROFILE</span>
          <h1>
            Your MovX account<span className="lime-text">.</span>
          </h1>
        </div>
      </div>
      <section className="profile-cover">
        <span className="profile-cover-word">KEEP SHOWING UP.</span>
        <span className="cover-spark">✳</span>
      </section>
      <div className="profile-heading">
        <Avatar initials={profileInitials(actor.profile.displayName)} />
        <div>
          <h2>{actor.profile.displayName}</h2>
          <p>
            <UserRound size={14} />
            Email-backed MovX profile
          </p>
          <Pill>Account profile</Pill>
        </div>
      </div>
      <section className="profile-public-note account-profile-note">
        <BadgeCheck size={24} />
        <h2>Your profile is connected to this account.</h2>
        <p>
          Coach roles, followed coaches and purchased packages will appear only
          after their owning coach-first features store verified data.
        </p>
      </section>
      <div className="account-profile-empty">
        <Empty
          title="Your account starts with a clean slate."
          description="No coach role, package, session balance, follow or post is being claimed yet."
          href="/coming-soon"
          action="View early access"
        />
      </div>
    </>
  );
}

function ProfileAccessUnavailable() {
  return (
    <section className="protected-access-state" role="alert">
      <span className="eyebrow">PROFILE UNAVAILABLE</span>
      <h1>We couldn’t verify your profile right now.</h1>
      <p>
        Your session or the local database may be unavailable. No personal
        identity or history was shown.
      </p>
      <div className="protected-access-actions">
        <Link href="/sign-in" className="button dark">
          Check sign-in
        </Link>
        <Link href="/coming-soon" className="button secondary">
          View early access
        </Link>
      </div>
    </section>
  );
}
