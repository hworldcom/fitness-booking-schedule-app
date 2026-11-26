import { coachProfileHref } from "@/domain/coach-public-url";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Heart, MapPin } from "lucide-react";
import type { FocusEventHandler, Ref } from "react";
import { profileInitials } from "@/auth/profile-presentation";
import { Pill } from "@/components/ui";
import type { CoachDirectoryEntry } from "@/domain/coaches";
import { CoachTodayAvailability } from "./coach-today-availability";
import { CoachCardMedia } from "./coach-card-media";
import { CoachCardReviews } from "./coach-card-reviews";

type CompactCoachCardProps = Readonly<{
  entry: CoachDirectoryEntry;
  variant?: "preview" | "result" | "marketplace";
  selected?: boolean;
  cardRef?: Ref<HTMLElement>;
  onFocusCapture?: FocusEventHandler<HTMLElement>;
  onShowOnMap?: () => void;
  availabilityLimit?: number;
  distanceLabel?: string;
  distanceOrigin?: string;
  saved?: boolean;
  onToggleSaved?: () => void;
  formatLabel?: string;
  profileActionLabel?: string;
  compactMapAction?: boolean;
  hideEmptyAvailability?: boolean;
  hidePrivateSessionDetails?: boolean;
  focusable?: boolean;
}>;

export function CompactCoachCard({
  entry,
  variant = "preview",
  selected = false,
  cardRef,
  onFocusCapture,
  onShowOnMap,
  availabilityLimit = 1,
  distanceLabel,
  distanceOrigin,
  saved = false,
  onToggleSaved,
  formatLabel,
  profileActionLabel = "View profile and schedule",
  compactMapAction = false,
  hideEmptyAvailability = false,
  hidePrivateSessionDetails = false,
  focusable = false,
}: CompactCoachCardProps) {
  const { coach, primaryLocation } = entry;
  const profileHref = coachProfileHref(coach);
  const isHome = variant === "marketplace";
  const Heading = "h3";
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
      tabIndex={variant === "result" || focusable ? -1 : undefined}
      onFocusCapture={onFocusCapture}
    >
      <header>
        <Link
          className="compact-coach-identity"
          href={profileHref}
          aria-label={`View ${coach.displayName}'s coach profile${isHome && entry.areaLabel ? ` — ${entry.areaLabel}` : ""}`}
        >
          <CoachCardMedia
            banner={entry.website?.banner ?? null}
            initials={profileInitials(coach.displayName)}
            portraitUrl={coach.portraitUrl}
          />
          <span>
            <Heading>{coach.displayName}</Heading>
            {isHome && entry.areaLabel && (
              <small className="coach-card-area">{entry.areaLabel}</small>
            )}
            {!isHome &&
              entry.website?.brandLabel &&
              entry.website.brandLabel !== coach.displayName && (
                <small className="coach-card-brand">
                  {entry.website.brandLabel}
                </small>
              )}
          </span>
        </Link>
        <Pill tone="lime">
          {coach.trustKind === "verified" && (
            <BadgeCheck size={13} aria-hidden="true" />
          )}
          {trustLabel}
        </Pill>
      </header>
      {onToggleSaved && (
        <button
          type="button"
          className="explore-save-coach"
          aria-label={`${saved ? "Unsave" : "Save"} ${coach.displayName}`}
          aria-pressed={saved}
          onClick={onToggleSaved}
        >
          <Heart
            size={19}
            fill={saved ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
      )}

      <CoachCardReviews summary={entry.reviewSummary} concise={isHome} />

      <div className="compact-coach-disciplines" aria-label="Disciplines">
        {coach.disciplines.map((discipline, index) => (
          <span key={discipline}>
            {discipline}
            {variant !== "preview" && index < coach.disciplines.length - 1
              ? " ·"
              : ""}
          </span>
        ))}
      </div>

      {!isHome && (
        <p className="coach-card-format">{formatLabel ?? "Private coaching"}</p>
      )}
      {(entry.website?.introduction || (distanceLabel && coach.bio)) && (
        <p className="coach-card-introduction">
          {entry.website?.introduction || coach.bio}
        </p>
      )}
      {distanceLabel && (
        <p className="explore-coach-distance">
          {distanceLabel.startsWith("under")
            ? distanceLabel
            : `About ${distanceLabel}`}{" "}
          from {distanceOrigin}
        </p>
      )}
      {!!entry.website?.focusLabels.length && (
        <p className="coach-card-focus" aria-label="Coaching focus">
          {entry.website.focusLabels.join(" · ")}
        </p>
      )}

      {!isHome && (
        <div className="compact-coach-location">
          <MapPin size={17} aria-hidden="true" />
          <span>
            <small>Primary training location</small>
            <strong>{primaryLocation.publicName}</strong>
            {primaryLocation.publicName !== primaryLocation.location.label && (
              <em>{primaryLocation.location.label}</em>
            )}
          </span>
        </div>
      )}

      {!hidePrivateSessionDetails && entry.website?.startingRate && (
        <p className="coach-card-rate">{entry.website.startingRate.label}</p>
      )}

      {variant !== "marketplace" &&
        !hidePrivateSessionDetails &&
        (!hideEmptyAvailability || entry.todaySlots.length > 0) && (
          <CoachTodayAvailability entry={entry} limit={availabilityLimit} />
        )}

      <div className="compact-coach-actions">
        {onShowOnMap && (
          <button
            type="button"
            className="compact-coach-map-button"
            onClick={onShowOnMap}
            aria-label={`Show ${coach.displayName} on the map`}
            aria-pressed={selected}
          >
            {compactMapAction ? (
              <MapPin size={18} aria-hidden="true" />
            ) : (
              "Show on map"
            )}
          </button>
        )}
        <Link className="compact-coach-link" href={profileHref}>
          {profileActionLabel} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
