"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, MapPinned, MapPinOff } from "lucide-react";
import { profileInitials } from "@/auth/profile-presentation";
import type { CoachDirectoryEntry } from "@/domain/coaches";
import { Avatar, Pill } from "@/components/ui";
import { CoachTodayAvailability } from "./coach-today-availability";

const LazyLocationResultsMap = dynamic(
  () =>
    import("@/location/components/location-results-map").then(
      (module) => module.LocationResultsMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="coach-map-state" role="status">
        <MapPinned size={24} aria-hidden="true" />
        <strong>Loading the coach map…</strong>
        <span>
          The coach list remains available while the public map starts.
        </span>
      </div>
    ),
  },
);

export function CoachExploreResults({
  entries,
}: {
  entries: readonly CoachDirectoryEntry[];
}) {
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [providerUnavailable, setProviderUnavailable] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const mapPoints = useMemo(
    () =>
      entries.map(({ coach, primaryLocation }) =>
        Object.freeze({
          id: coach.profileId,
          name: coach.displayName,
          label: primaryLocation.location.label,
          ariaLabel: `Select ${coach.displayName} at primary training location ${primaryLocation.publicName}, ${primaryLocation.location.label}`,
          latitude: primaryLocation.location.latitude,
          longitude: primaryLocation.location.longitude,
          initials: profileInitials(coach.displayName),
          imageUrl: coach.portraitUrl,
        }),
      ),
    [entries],
  );
  const selectedEntry =
    entries.find(({ coach }) => coach.profileId === selectedCoachId) ?? null;

  const selectFromMap = useCallback((profileId: string) => {
    setSelectedCoachId(profileId);
    const card = cardRefs.current.get(profileId);
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);
  const markProviderUnavailable = useCallback(
    () => setProviderUnavailable(true),
    [],
  );

  const mapStatus = providerUnavailable ? "provider" : "ready";

  return (
    <section
      className="coach-results"
      aria-label={`${entries.length} matching coaches`}
    >
      <div className="coach-results-summary">
        <span>
          {entries.length} coach{entries.length === 1 ? "" : "es"}
        </span>
        <small>Ordered by coach name</small>
      </div>
      <div className="coach-explore-layout">
        <div className="coach-card-grid">
          {entries.map((entry) => {
            const { coach, primaryLocation } = entry;
            return (
              <article
                className={`coach-card ${
                  selectedCoachId === coach.profileId ? "selected" : ""
                }`}
                key={coach.profileId}
                ref={(element) => {
                  if (element) cardRefs.current.set(coach.profileId, element);
                  else cardRefs.current.delete(coach.profileId);
                }}
                tabIndex={-1}
                onFocusCapture={() => setSelectedCoachId(coach.profileId)}
              >
                <div className="coach-card-topline">
                  <Avatar
                    initials={profileInitials(coach.displayName)}
                    imageUrl={coach.portraitUrl}
                    alt=""
                  />
                  <Pill tone="lime">
                    {coach.trustKind === "verified" && (
                      <BadgeCheck size={13} aria-hidden="true" />
                    )}
                    {coach.trustKind === "verified"
                      ? "Verified coach"
                      : "Demo coach"}
                  </Pill>
                </div>
                <div>
                  <h2>{coach.displayName}</h2>
                  <div className="coach-discipline-list">
                    {coach.disciplines.map((discipline) => (
                      <span key={discipline}>{discipline}</span>
                    ))}
                  </div>
                </div>
                <p className="coach-card-bio">{coach.bio}</p>
                <div className="coach-location-line">
                  <MapPinned size={17} aria-hidden="true" />
                  <span>
                    <small className="coach-location-kicker">
                      Primary training location
                    </small>
                    <strong>{primaryLocation.publicName}</strong>
                    <small>{primaryLocation.location.label}</small>
                  </span>
                </div>
                <CoachTodayAvailability entry={entry} limit={2} />
                <div className="coach-card-actions">
                  {mapStatus === "ready" && (
                    <button
                      type="button"
                      className="coach-card-map-button"
                      onClick={() => setSelectedCoachId(coach.profileId)}
                      aria-pressed={selectedCoachId === coach.profileId}
                    >
                      Show on map
                    </button>
                  )}
                  <Link
                    href={`/coaches/${coach.slug}`}
                    className="coach-card-link"
                    aria-label={`View ${coach.displayName}'s coach profile`}
                  >
                    View profile <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="coach-map-panel" aria-label="Coach location map">
          <div className="coach-map-heading">
            <div>
              <span className="eyebrow">COACH-SELECTED LOCATIONS</span>
              <h2>Map of matching coaches</h2>
            </div>
            <p>
              Pins show each coach&apos;s primary training location—not live
              location, presence or proof of availability.
            </p>
          </div>
          {selectedEntry && mapStatus === "ready" && (
            <section
              className="coach-map-detail"
              aria-label={`${selectedEntry.coach.displayName} map details`}
              aria-live="polite"
            >
              <header>
                <Avatar
                  initials={profileInitials(selectedEntry.coach.displayName)}
                  imageUrl={selectedEntry.coach.portraitUrl}
                  alt=""
                />
                <div>
                  <span className="eyebrow">SELECTED COACH</span>
                  <h3>{selectedEntry.coach.displayName}</h3>
                </div>
              </header>
              <div className="coach-map-primary">
                <MapPinned size={15} aria-hidden="true" />
                <span>
                  <small>Primary training location</small>
                  <strong>{selectedEntry.primaryLocation.publicName}</strong>
                  <em>{selectedEntry.primaryLocation.location.label}</em>
                </span>
              </div>
              <CoachTodayAvailability entry={selectedEntry} limit={5} />
              <Link href={`/coaches/${selectedEntry.coach.slug}`}>
                View full profile and schedule
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </section>
          )}
          {mapStatus === "ready" ? (
            <LazyLocationResultsMap
              points={mapPoints}
              selectedPointId={selectedCoachId}
              onSelectPoint={selectFromMap}
              onUnavailable={markProviderUnavailable}
            />
          ) : (
            <div
              className="coach-map-state unavailable"
              role="status"
              data-map-state={mapStatus}
            >
              <MapPinOff size={25} aria-hidden="true" />
              <strong>Map unavailable</strong>
              <span>
                The public map could not load in this browser. The same coach
                results remain available in the list.
              </span>
              <small>Use the accessible coach list to continue.</small>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
