import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin } from "lucide-react";
import type { FocusEventHandler, Ref } from "react";
import { profileInitials } from "@/auth/profile-presentation";
import { Avatar, Pill } from "@/components/ui";
import type { CoachDirectoryEntry } from "@/domain/coaches";
import { CoachTodayAvailability } from "./coach-today-availability";

type CompactCoachCardProps = Readonly<{
  entry: CoachDirectoryEntry;
  variant?: "preview" | "result";
  selected?: boolean;
  cardRef?: Ref<HTMLElement>;
  onFocusCapture?: FocusEventHandler<HTMLElement>;
  onShowOnMap?: () => void;
}>;

export function CompactCoachCard({
  entry,
  variant = "preview",
  selected = false,
  cardRef,
  onFocusCapture,
  onShowOnMap,
}: CompactCoachCardProps) {
  const { coach, primaryLocation } = entry;
  const profileHref = `/coaches/${coach.slug}`;
  const Heading = variant === "result" ? "h2" : "h3";
  const trustLabel =
    coach.trustKind === "verified"
      ? "Verified coach"
      : coach.trustKind === "demo"
        ? "Demo coach"
        : "Trust status unavailable";

  return (
    <article
      className={`compact-coach-card ${variant}${selected ? " selected" : ""}`}
      data-selected={selected ? "true" : undefined}
      ref={cardRef}
      tabIndex={variant === "result" ? -1 : undefined}
      onFocusCapture={onFocusCapture}
    >
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
            <Heading>{coach.displayName}</Heading>
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

      {variant === "result" && <p className="compact-coach-bio">{coach.bio}</p>}

      <div className="compact-coach-location">
        <MapPin size={17} aria-hidden="true" />
        <span>
          <small>Primary training location</small>
          <strong>{primaryLocation.publicName}</strong>
          <em>{primaryLocation.location.label}</em>
        </span>
      </div>

      <CoachTodayAvailability entry={entry} limit={1} />

      <div className="compact-coach-actions">
        {onShowOnMap && (
          <button
            type="button"
            className="compact-coach-map-button"
            onClick={onShowOnMap}
            aria-label={`Show ${coach.displayName} on the map`}
            aria-pressed={selected}
          >
            Show on map
          </button>
        )}
        <Link className="compact-coach-link" href={profileHref}>
          View profile and schedule <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
