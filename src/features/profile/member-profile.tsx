"use client";
import Link from "next/link";
import { useActor } from "@/auth/client/actor-provider";
import { profileInitials } from "@/auth/profile-presentation";
import { Avatar } from "@/components/ui";
import type { MemberProfile } from "@/domain/member-profile";

export function MemberProfileCard({
  profile,
  actorKey,
}: {
  profile: MemberProfile;
  actorKey: string;
}) {
  const { actor } = useActor();
  if (
    actor.status !== "authorized" ||
    `${actor.demoRun.slug}:${actor.profile.slug}` !== actorKey
  )
    return <p role="status">Sign in to view this profile.</p>;
  return (
    <section className="member-profile-card">
      <Link className="text-link" href="/messages">
        Back to Messages
      </Link>
      <header>
        <Avatar
          initials={profileInitials(profile.displayName)}
          imageUrl={profile.imageUrl}
          alt={`${profile.displayName} profile photo`}
          color="blue"
        />
        <div>
          <span className="eyebrow">MEMBER PROFILE</span>
          <h1>{profile.displayName}</h1>
        </div>
      </header>
      <p>Profile visible to signed-in MovX members.</p>
    </section>
  );
}
