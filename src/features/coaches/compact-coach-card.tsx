import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin } from "lucide-react";
import { profileInitials } from "@/auth/profile-presentation";
import { Avatar, Pill } from "@/components/ui";
import type { CoachDirectoryEntry } from "@/domain/coaches";
import { CoachTodayAvailability } from "./coach-today-availability";

export function CompactCoachCard({ entry }: { entry: CoachDirectoryEntry }) {
  const { coach, primaryLocation } = entry;
  const profileHref = `/coaches/${coach.slug}`;
  const trustLabel =
    coach.trustKind === "verified"
      ? "Verified coach"
      : coach.trustKind === "demo"
        ? "Demo coach"
        : "Trust status unavailable";

  return (
    <article className="compact-coach-card">
      <header>
        <Link
          className="compact-coach-identity"
          href={profileHref}
          aria-label={`View ${coach.displayName}'s coach profile`}
        >
          <Avatar
            initials={profileInitials(coach.displayName)}
            imageUrl={coach.portraitUrl}
            alt=""
          />
          <span>
            <small>PRIVATE COACHING</small>
            <h3>{coach.displayName}</h3>
          </span>
        </Link>
        <Pill tone="lime">
          {coach.trustKind === "verified" && (
            <BadgeCheck size={13} aria-hidden="true" />
          )}
          {trustLabel}
        </Pill>
      </header>

      <div className="compact-coach-disciplines" aria-label="Disciplines">
        {coach.disciplines.map((discipline) => (
          <span key={discipline}>{discipline}</span>
        ))}
      </div>

      <div className="compact-coach-location">
        <MapPin size={17} aria-hidden="true" />
        <span>
          <small>PRIMARY TRAINING LOCATION</small>
          <strong>{primaryLocation.publicName}</strong>
          <em>{primaryLocation.location.label}</em>
        </span>
      </div>

      <CoachTodayAvailability entry={entry} limit={1} />

      <Link className="compact-coach-link" href={profileHref}>
        View profile and schedule <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}
