import { coachProfileHref } from "@/domain/coach-public-url";
import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin } from "lucide-react";
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
}>;

export function CompactCoachCard({
  entry,
  variant = "preview",
  selected = false,
  cardRef,
  onFocusCapture,
  onShowOnMap,
  availabilityLimit = 1,
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
      tabIndex={variant === "result" ? -1 : undefined}
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

      {!isHome && <p className="coach-card-format">Private coaching</p>}
      {entry.website?.introduction && (
        <p className="coach-card-introduction">{entry.website.introduction}</p>
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

      {entry.website?.startingRate && (
        <p className="coach-card-rate">{entry.website.startingRate.label}</p>
      )}

      {variant !== "marketplace" && (
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
