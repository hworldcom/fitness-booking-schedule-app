"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, MapPinned, MapPinOff } from "lucide-react";
import { profileInitials } from "@/auth/profile-presentation";
import type { CoachProjection } from "@/domain/coaches";
import { Avatar, Pill } from "@/components/ui";

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
  coaches,
}: {
  coaches: readonly CoachProjection[];
}) {
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [providerUnavailable, setProviderUnavailable] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const mapPoints = useMemo(
    () =>
      coaches.map((coach) =>
        Object.freeze({
          id: coach.profileId,
          name: coach.displayName,
          label: coach.location.label,
          latitude: coach.location.latitude,
          longitude: coach.location.longitude,
          initials: profileInitials(coach.displayName),
          imageUrl: coach.portraitUrl,
        }),
      ),
    [coaches],
  );

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
      aria-label={`${coaches.length} matching coaches`}
    >
      <div className="coach-results-summary">
        <span>
          {coaches.length} coach{coaches.length === 1 ? "" : "es"}
        </span>
        <small>Ordered by coach name</small>
      </div>
      <div className="coach-explore-layout">
        <div className="coach-card-grid">
          {coaches.map((coach) => (
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
                  <strong>
                    {coach.gymName ?? "Independent training place"}
                  </strong>
                  <small>{coach.location.label}</small>
                </span>
              </div>
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
          ))}
        </div>

        <aside className="coach-map-panel" aria-label="Coach location map">
          <div className="coach-map-heading">
            <div>
              <span className="eyebrow">COACH-SELECTED LOCATIONS</span>
              <h2>Map of matching coaches</h2>
            </div>
            <p>
              Pins show public training places—not live location, presence or
              proof of availability.
            </p>
          </div>
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
