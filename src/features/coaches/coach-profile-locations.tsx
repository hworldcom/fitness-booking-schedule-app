"use client";

import dynamic from "next/dynamic";
import { MapPin, MapPinned, MapPinOff } from "lucide-react";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { CoachTrainingLocation } from "@/domain/coaches";
import { assignCoachProfileLocationColors } from "./coach-profile-location-colors";

const LazyLocationResultsMap = dynamic(
  () =>
    import("@/location/components/location-results-map").then(
      (module) => module.LocationResultsMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="public-coach-location-map-state" role="status">
        <MapPinned size={24} aria-hidden="true" />
        <strong>Loading the location map…</strong>
        <span>The complete training-location list is ready below.</span>
      </div>
    ),
  },
);

type LocationColorStyle = CSSProperties &
  Readonly<{
    "--coach-public-location-accent": string;
    "--coach-public-location-tint": string;
    "--coach-public-location-ink": string;
  }>;

export function CoachProfileLocations({
  coachName,
  locations,
}: {
  coachName: string;
  locations: readonly CoachTrainingLocation[];
}) {
  const primaryLocation = locations.find((location) => location.isPrimary);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    primaryLocation?.id ?? locations[0]?.id ?? null,
  );
  const [providerUnavailable, setProviderUnavailable] = useState(false);
  const singleLocation = locations.length === 1;
  const resolvedSelectedLocationId = locations.some(
    ({ id }) => id === selectedLocationId,
  )
    ? selectedLocationId
    : (primaryLocation?.id ?? locations[0]?.id ?? null);
  const colors = useMemo(
    () =>
      singleLocation
        ? new Map([
            [
              locations[0]!.id,
              { accent: "#61417b", tint: "#f1ebf7", ink: "#432c56" },
            ],
          ])
        : assignCoachProfileLocationColors(locations.map(({ id }) => id)),
    [locations, singleLocation],
  );
  const points = useMemo(
    () =>
      locations.map((location, index) => {
        const color = colors.get(location.id);
        if (!color) {
          throw new Error("Coach profile location color is unavailable.");
        }
        return Object.freeze({
          id: location.id,
          name: location.publicName,
          label: location.location.label,
          ariaLabel: `Select training location${singleLocation ? "" : ` ${index + 1}`}: ${location.publicName}, ${location.location.label}`,
          latitude: location.location.latitude,
          longitude: location.location.longitude,
          initials: String(index + 1),
          imageUrl: null,
          markerAppearance: Object.freeze({
            background: color.accent,
            foreground: "#ffffff",
            accent: color.accent,
          }),
        });
      }),
    [colors, locations, singleLocation],
  );

  const markProviderUnavailable = useCallback(
    () => setProviderUnavailable(true),
    [],
  );

  return (
    <section
      className="public-coach-locations"
      aria-labelledby="public-coach-locations-title"
    >
      <div className="coach-section-heading">
        <div>
          <span className="eyebrow">CONFIRMED PLACES</span>
          <h3 id="public-coach-locations-title">Training locations</h3>
        </div>
      </div>
      <p>
        These are training options, not the coach&apos;s current position. Each
        available session names its actual venue.
      </p>
      <div
        className="public-coach-location-map"
        role="region"
        aria-label={`${coachName} training locations map`}
      >
        {providerUnavailable ? (
          <div
            className="public-coach-location-map-state unavailable"
            role="status"
            data-map-state="provider"
          >
            <MapPinOff size={24} aria-hidden="true" />
            <strong>Map unavailable</strong>
            <span>
              Every confirmed training location remains available in the list
              below.
            </span>
          </div>
        ) : (
          <LazyLocationResultsMap
            points={points}
            selectedPointId={resolvedSelectedLocationId}
            onSelectPoint={setSelectedLocationId}
            onUnavailable={markProviderUnavailable}
            canvasAriaLabel={`${coachName} training locations`}
            coincidentItemLabel="Location"
            recenterOnSelection={false}
            markerVariant={singleLocation ? "pin" : "badge"}
          />
        )}
      </div>
      <ul aria-label="Training location map legend">
        {locations.map((location, index) => {
          const color = colors.get(location.id);
          if (!color) return null;
          const selected = resolvedSelectedLocationId === location.id;
          const style: LocationColorStyle = {
            "--coach-public-location-accent": color.accent,
            "--coach-public-location-tint": color.tint,
            "--coach-public-location-ink": color.ink,
          };
          return (
            <li
              key={location.id}
              style={style}
              data-location-id={location.id}
              data-location-color={color.accent}
              data-selected={selected ? "true" : "false"}
            >
              <button
                type="button"
                onClick={() => setSelectedLocationId(location.id)}
                aria-pressed={selected}
                aria-label={`Show ${location.publicName} on the map`}
                disabled={providerUnavailable}
              >
                <span className="public-coach-location-key" aria-hidden="true">
                  {singleLocation ? <MapPin size={15} /> : index + 1}
                </span>
                <span>
                  <strong>{location.publicName}</strong>
                  <small>{location.location.label}</small>
                </span>
                {location.isPrimary && <em>Primary base</em>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
