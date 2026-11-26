"use client";

import { useState } from "react";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import { ActorProvider } from "@/auth/client/actor-provider";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { Shell } from "@/components/shell";
import type { CoachDirectoryFilters } from "@/domain/coaches";
import { publicCoachStartingRate } from "@/domain/coach-starting-rate";
import { CoachDirectory } from "@/features/coaches/coach-discovery";
import type { CoachExploreView } from "@/features/coaches/marketplace-search-contract";
import { directoryEntry } from "./coach-directory";

const rows = [
  {
    entry: directoryEntry(1, "Near Coach", {
      disciplines: ["Boxing"],
      portraitUrl: "/images/coaches/daniel-park.webp",
    }),
    latitude: 52.52,
    longitude: 13.405,
  },
  {
    entry: directoryEntry(2, "Group Coach", {
      disciplines: ["Fitness"],
      portraitUrl: "/images/coaches/jake-miller.webp",
    }),
    latitude: 52.51,
    longitude: 13.45,
  },
  {
    entry: directoryEntry(3, "Far Coach", { disciplines: ["Boxing"] }),
    latitude: 52.56,
    longitude: 13.52,
  },
].map(({ entry, latitude, longitude }) => ({
  ...entry,
  primaryLocation: {
    ...entry.primaryLocation,
    location: { ...entry.primaryLocation.location, latitude, longitude },
  },
  website: {
    schemaVersion: 1 as const,
    revision: 1,
    brandLabel: "",
    introduction:
      "A fictional public coaching introduction for isolated interface validation.",
    focusLabels: ["Fundamentals"],
    banner: null,
    ...(entry.coach.displayName === "Group Coach"
      ? { startingRate: publicCoachStartingRate(2500) }
      : {}),
  },
}));

export function ExploreDiscoveryFixture({
  filters,
  view,
}: {
  filters: CoachDirectoryFilters;
  view: CoachExploreView | null;
}) {
  const [viewer, setViewer] = useState("guest");
  const [failure, setFailure] = useState(false);
  const actor: ActorSnapshot =
    viewer === "guest"
      ? { status: "signed-out" }
      : viewer === "unknown"
        ? { status: "unavailable" }
        : {
            status: "authorized",
            profile: {
              slug: `fixture-${viewer}`,
              displayName: `Fixture ${viewer}`,
              avatarUrl: null,
              coachPortraitUrl: null,
            },
            demoRun: { slug: "explore-fixture", name: "Explore fixture" },
            role: "member",
            coachAccessStatus: "not-applied",
          };
  const session: AuthSessionSnapshot =
    viewer === "guest"
      ? { status: "signed-out" }
      : viewer === "unknown"
        ? { status: "unavailable" }
        : {
            status: "signed-in",
            subject: `fixture-${viewer}`,
            email: `${viewer}@fixture.movx.test`,
            expiresAt: null,
          };
  const entries = rows.filter(
    (entry) =>
      (!filters.query ||
        `${entry.coach.displayName} ${entry.coach.bio}`
          .toLowerCase()
          .includes(filters.query.toLowerCase())) &&
      (!filters.discipline ||
        entry.coach.disciplines.includes(filters.discipline)) &&
      (!filters.location ||
        entry.primaryLocation.location.label
          .toLowerCase()
          .includes(filters.location.toLowerCase())) &&
      (filters.sessionFormat !== "group" ||
        entry.coach.displayName === "Group Coach"),
  );
  return (
    <>
      <AuthSessionProvider key={viewer} initialSession={session}>
        <ActorProvider initialActor={actor}>
          <Shell>
            <CoachDirectory
              state={
                failure
                  ? { status: "unavailable", filters }
                  : { status: "ready", filters, entries }
              }
              searchView={view}
              locationSearchConfiguration={{
                status: "ready",
                apiKey: "geoapify_test_key_1234567890",
              }}
            />
          </Shell>
        </ActorProvider>
      </AuthSessionProvider>
      <fieldset data-testid="fixture-controls" style={{ margin: 20 }}>
        <legend>Isolated fixture controls</legend>
        {["guest", "a", "b", "unknown"].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setViewer(value);
              window.scrollTo(0, 0);
            }}
          >
            Fixture {value}
          </button>
        ))}
        <button type="button" onClick={() => setFailure((value) => !value)}>
          Toggle directory failure
        </button>
      </fieldset>
    </>
  );
}
