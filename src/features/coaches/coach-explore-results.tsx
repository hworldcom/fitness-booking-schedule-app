"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  List,
  Map as MapIcon,
  MapPinned,
  MapPinOff,
} from "lucide-react";
import { profileInitials } from "@/auth/profile-presentation";
import type {
  CoachDirectoryEntry,
  CoachDirectoryFilters,
} from "@/domain/coaches";
import { CompactCoachCard } from "./compact-coach-card";
import {
  coachDirectoryHref,
  type CoachExploreView,
} from "./marketplace-search-contract";

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
  filters,
  view,
}: {
  entries: readonly CoachDirectoryEntry[];
  filters: CoachDirectoryFilters;
  view: CoachExploreView;
}) {
  const router = useRouter();
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [providerUnavailable, setProviderUnavailable] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const selectedPreviewRef = useRef<HTMLElement>(null);
  const listHref = coachDirectoryHref(filters, {}, "list");
  const mapHref = coachDirectoryHref(filters, {}, "map");
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
    if (window.matchMedia("(max-width: 980px)").matches) return;
    const card = cardRefs.current.get(profileId);
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "nearest",
    });
  }, []);
  const markProviderUnavailable = useCallback(() => {
    setProviderUnavailable(true);
    setSelectedCoachId(null);
    if (window.matchMedia("(max-width: 980px)").matches && view === "map") {
      router.replace(listHref, { scroll: false });
    }
  }, [listHref, router, view]);

  const selectFromCard = useCallback(
    (profileId: string) => {
      setSelectedCoachId(profileId);
      if (window.matchMedia("(max-width: 980px)").matches && view !== "map") {
        router.push(mapHref, { scroll: false });
      }
    },
    [mapHref, router, view],
  );

  useEffect(() => {
    if (
      view !== "map" ||
      !selectedEntry ||
      !window.matchMedia("(max-width: 980px)").matches
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      selectedPreviewRef.current?.focus({ preventScroll: true });
      selectedPreviewRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedEntry, view]);

  const mapStatus = providerUnavailable ? "provider" : "ready";

  return (
    <section
      className="coach-results"
      aria-label={`${entries.length} matching coaches`}
    >
      <div className="coach-results-summary">
        <div>
          <h2>Coaches in Berlin</h2>
          <span>
            {entries.length} coach{entries.length === 1 ? "" : "es"}
          </span>
        </div>
        <small>Ordered by coach name</small>
      </div>
      <nav
        className="mobile-explore-view-switch"
        aria-label="Explore results view"
      >
        <Link
          href={listHref}
          scroll={false}
          className={view === "list" ? "active" : ""}
          aria-current={view === "list" ? "page" : undefined}
        >
          <List size={18} aria-hidden="true" />
          <span>List</span>
          <small>{entries.length}</small>
        </Link>
        {mapStatus === "ready" ? (
          <Link
            href={mapHref}
            scroll={false}
            className={view === "map" ? "active" : ""}
            aria-current={view === "map" ? "page" : undefined}
          >
            <MapIcon size={18} aria-hidden="true" />
            <span>Map</span>
          </Link>
        ) : (
          <span className="mobile-explore-view-disabled" aria-disabled="true">
            <MapPinOff size={18} aria-hidden="true" />
            <span>Map unavailable</span>
          </span>
        )}
      </nav>
      {providerUnavailable && (
        <div className="mobile-map-recovery" role="status">
          <MapPinOff size={18} aria-hidden="true" />
          <span>
            <strong>Map unavailable.</strong> Showing the complete coach list.
          </span>
        </div>
      )}
      <div
        className={`coach-explore-layout mobile-view-${view} ${
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
                    ? () => selectFromCard(coach.profileId)
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
            <Link className="mobile-map-back" href={listHref} scroll={false}>
              <ArrowLeft size={16} aria-hidden="true" /> Back to list
            </Link>
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
              ref={selectedPreviewRef}
              tabIndex={-1}
            >
              <CompactCoachCard entry={selectedEntry} availabilityLimit={5} />
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
