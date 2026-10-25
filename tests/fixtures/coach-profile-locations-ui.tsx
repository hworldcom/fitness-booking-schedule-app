"use client";

import { useState } from "react";
import { CoachProfileLocations } from "@/features/coaches/coach-profile-locations";
import { LocationResultsMap } from "@/location/components/location-results-map";
import type { CoachTrainingLocation } from "@/domain/coaches";

const locations: readonly CoachTrainingLocation[] = [
  [
    "Fabrik Training",
    "Near Museum Neukölln — Alt-Britz 81, 12359 Berlin",
    52.447,
    13.436,
  ],
  ["Second training place", "Kreuzberg, Berlin", 52.5, 13.42],
  ["Third training place", "Wedding, Berlin", 52.55, 13.38],
].map(([name, label, latitude, longitude], index) => ({
  id: `99000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  publicName: String(name),
  timezone: "Europe/Berlin",
  selectedGymId: null,
  gymName: null,
  location: {
    kind: "independent",
    label: String(label),
    latitude: Number(latitude),
    longitude: Number(longitude),
    source: "fixture",
    provider: null,
    confirmedAt: "2026-10-25T12:00:00Z",
  },
  status: "active",
  isPrimary: index === 0,
  sortOrder: index,
  deactivatedAt: null,
  recordSource: "fixture",
  updatedAt: "2026-10-25T12:00:00Z",
}));
const directoryPoints = [
  {
    id: "directory-coach",
    name: "Directory coach",
    label: "Berlin",
    ariaLabel: "Select directory coach",
    latitude: 52.5,
    longitude: 13.4,
    initials: "DC",
    imageUrl: null,
  },
];

export default function LocationFixture() {
  const [mode, setMode] = useState("single");
  const [long, setLong] = useState(false);
  const [variant, setVariant] = useState<"badge" | "pin" | undefined>();
  const places = (mode === "single" ? locations.slice(0, 1) : locations).map(
    (place, index) => ({
      ...place,
      publicName:
        long && index === 0
          ? "A long public training location name that wraps clearly on a phone"
          : place.publicName,
      location: {
        ...place.location,
        label:
          long && index === 0
            ? "A long confirmed meeting address with entrance instructions beside the accessible courtyard, Alt-Britz 81, 12359 Berlin"
            : place.location.label,
        ...(mode === "coincident" && index === 1
          ? {
              latitude: locations[0]!.location.latitude,
              longitude: locations[0]!.location.longitude,
            }
          : {}),
      },
    }),
  );
  return (
    <main
      className="public-app-main"
      style={{ maxWidth: 1200, margin: "auto", padding: 20 }}
    >
      <p>Isolated MOV-99 map fixture. No account or location writes.</p>
      <label>
        Scenario{" "}
        <select
          aria-label="Scenario"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="single">One location</option>
          <option value="multiple">Multiple locations</option>
          <option value="coincident">Shared coordinates</option>
          <option value="directory">Directory marker default</option>
        </select>
      </label>{" "}
      <label>
        <input
          type="checkbox"
          checked={long}
          onChange={(event) => setLong(event.target.checked)}
        />{" "}
        Long names and addresses
      </label>
      {mode === "directory" ? (
        <div className="coach-discovery">
          <label>
            Marker presentation{" "}
            <select
              aria-label="Marker presentation"
              value={variant ?? "default"}
              onChange={(event) =>
                setVariant(
                  event.target.value === "default"
                    ? undefined
                    : (event.target.value as "badge" | "pin"),
                )
              }
            >
              <option value="default">Default</option>
              <option value="pin">Pin</option>
              <option value="badge">Badge</option>
            </select>
          </label>
          <LocationResultsMap
            points={directoryPoints}
            selectedPointId="directory-coach"
            onSelectPoint={() => {}}
            onUnavailable={() => {}}
            markerVariant={variant}
          />
        </div>
      ) : (
        <article className="coach-personal-website">
          <CoachProfileLocations
            key={mode}
            coachName="Fixture coach"
            locations={places}
          />
        </article>
      )}
    </main>
  );
}
