"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, MapPinned, MapPinOff } from "lucide-react";
import { profileInitials } from "@/auth/profile-presentation";
import type { CoachDirectoryEntry } from "@/domain/coaches";
import { Avatar } from "@/components/ui";
import { CompactCoachCard } from "./compact-coach-card";
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
  const markProviderUnavailable = useCallback(() => {
    setProviderUnavailable(true);
    setSelectedCoachId(null);
  }, []);

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
      <div
        className={`coach-explore-layout ${
          mapStatus === "provider" ? "map-unavailable" : ""
        }`}
      >
        <div className="coach-card-grid">
          {entries.map((entry) => {
            const { coach } = entry;
            return (
              <CompactCoachCard
                key={coach.profileId}
                entry={entry}
                variant="result"
                selected={selectedCoachId === coach.profileId}
                cardRef={(element) => {
                  if (element) cardRefs.current.set(coach.profileId, element);
                  else cardRefs.current.delete(coach.profileId);
                }}
                onFocusCapture={() => setSelectedCoachId(coach.profileId)}
                onShowOnMap={
                  mapStatus === "ready"
                    ? () => setSelectedCoachId(coach.profileId)
                    : undefined
                }
              />
            );
          })}
        </div>

        <aside
          className={`coach-map-panel ${
            selectedEntry && mapStatus === "ready" ? "has-selection" : ""
          }`}
          aria-label="Coach location map"
        >
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
