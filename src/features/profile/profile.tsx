"use client";

import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useActor } from "@/auth/client/actor-provider";
import { profileInitials } from "@/auth/profile-presentation";
import { signInHref } from "@/auth/return-to";
import { Avatar, Empty } from "@/components/ui";
import type { CoachAccessProjection } from "@/domain/coaches";
import { accountProfileImagePresentation } from "@/profile-images/presentation";
import { ProfileImageUploader } from "./profile-image-uploader";

export function Profile({
  coachAccess,
}: {
  coachAccess: CoachAccessProjection | null;
}) {
  const { actor } = useActor();
  const coachEntry = coachAccountEntry(coachAccess?.status ?? "not-applied");

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

  const profileImage = accountProfileImagePresentation(
    actor.profile.avatarUrl,
    actor.profile.coachPortraitUrl,
  );

  const profileImageSummary = actor.profile.avatarUrl
    ? "Member profile photo set"
    : actor.profile.coachPortraitUrl
      ? "Public coach portrait used as fallback"
      : "Initials used until you add an avatar";

  return (
    <div className="account-profile-workspace">
      <header className="account-profile-header">
        <div>
          <span className="eyebrow">ACCOUNT</span>
          <h1>
            Profile<span className="lime-text">.</span>
          </h1>
          <p>
            Manage the personal picture used on signed-in MovX surfaces and
            review this account&apos;s current access.
          </p>
        </div>
        <Link className="button secondary" href="/sessions">
          <CalendarClock size={16} aria-hidden="true" /> Open My sessions
        </Link>
      </header>

      <div className="account-profile-layout">
        <div className="account-profile-editor">
          <ProfileImageUploader
            endpoint="/api/profile/avatar"
            currentImageUrl={actor.profile.avatarUrl}
            fallbackImageUrl={actor.profile.coachPortraitUrl}
            displayName={actor.profile.displayName}
            initials={profileInitials(actor.profile.displayName)}
            kind="account"
          />
          <section className="account-profile-privacy-note">
            <ShieldCheck size={22} aria-hidden="true" />
            <div>
              <h2>Your photo is visible to signed-in members.</h2>
              <p>
                Other signed-in MovX members can see your display name and
                photo. Your account details stay private. Your coach portrait is
                used separately on your public coach page.
              </p>
            </div>
          </section>
        </div>

        <aside className="account-profile-summary">
          <span className="eyebrow">ACCOUNT SUMMARY</span>
          <Avatar
            initials={profileInitials(actor.profile.displayName)}
            imageUrl={profileImage.imageUrl}
            alt={
              profileImage.source === "account"
                ? `${actor.profile.displayName} account avatar`
                : profileImage.source === "coach"
                  ? `${actor.profile.displayName} public coach portrait`
                  : ""
            }
          />
          <h2>{actor.profile.displayName}</h2>
          <p>{accountProfileRole(coachAccess?.status ?? "not-applied")}</p>
          <ul>
            <li>
              <CheckCircle2 size={16} aria-hidden="true" />
              Email-backed MovX identity
            </li>
            <li>
              <UserRound size={16} aria-hidden="true" />
              {profileImageSummary}
            </li>
            <li>
              <CalendarClock size={16} aria-hidden="true" />
              Private sessions and request history available
            </li>
          </ul>
        </aside>
      </div>
      {coachEntry && <CoachAccountEntry entry={coachEntry} />}
    </div>
  );
}

export function accountProfileRole(status: CoachAccessProjection["status"]) {
  switch (status) {
    case "approved":
    case "demo":
      return "Athlete and coach account";
    case "suspended":
      return "Athlete account · coach access suspended";
    case "pending":
      return "Athlete account · coach application pending";
    case "rejected":
      return "Athlete account · coach application needs changes";
    case "not-applied":
      return "Athlete account";
  }
}

type CoachAccountEntryContent = Readonly<{
  title: string;
  description: string;
  href: "/coach" | "/profile/coach";
  action: string;
}>;

export function coachAccountEntry(
  status: CoachAccessProjection["status"],
): CoachAccountEntryContent | null {
  switch (status) {
    case "approved":
    case "demo":
      return Object.freeze({
        title: "Coach workspace",
        description:
          "Manage your approved coach profile, athlete sessions and published availability.",
        href: "/coach",
        action: "Open coach workspace",
      });
    case "suspended":
      return Object.freeze({
        title: "Coach access suspended",
        description:
          "Review your coach status and retain access to permitted existing-session actions.",
        href: "/coach",
        action: "Review coach access",
      });
    case "rejected":
      return Object.freeze({
        title: "Coach application needs changes",
        description:
          "Update your private coach profile and resubmit it for MovX review.",
        href: "/profile/coach",
        action: "Update coach application",
      });
    case "pending":
      return Object.freeze({
        title: "Coach application pending",
        description:
          "Your private coach profile remains editable while MovX reviews the application.",
        href: "/profile/coach",
        action: "Open coach application",
      });
    case "not-applied":
      return null;
  }
}

function CoachAccountEntry({ entry }: { entry: CoachAccountEntryContent }) {
  return (
    <div className="account-profile-empty">
      <Empty
        title={entry.title}
        description={entry.description}
        href={entry.href}
        action={entry.action}
      />
    </div>
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
