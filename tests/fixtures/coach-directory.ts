import type { CoachDirectoryEntry, CoachDiscipline } from "@/domain/coaches";

export function directoryEntry(
  sequence: number,
  displayName: string,
  options: Readonly<{
    portraitUrl?: string | null;
    trustKind?: "verified" | "demo";
    withAvailability?: boolean;
    disciplines?: readonly CoachDiscipline[];
  }> = {},
): CoachDirectoryEntry {
  const suffix = String(sequence).padStart(12, "0");
  const profileId = `10000000-0000-4000-8000-${suffix}`;
  const locationId = `60000000-0000-4000-8000-${suffix}`;
  const location = Object.freeze({
    id: locationId,
    publicName: `${displayName} training base`,
    timezone: "Europe/Berlin",
    selectedGymId: null,
    gymName: null,
    location: Object.freeze({
      kind: "independent" as const,
      label: `${sequence} Teststrasse, Berlin`,
      latitude: 52.5 + sequence / 10000,
      longitude: 13.4 + sequence / 10000,
      source: "manual" as const,
      provider: null,
      confirmedAt: "2026-10-12T08:00:00.000Z",
    }),
    status: "active" as const,
    isPrimary: true,
    sortOrder: 1,
    deactivatedAt: null,
    recordSource: options.trustKind === "verified" ? "user" : "fixture",
    updatedAt: "2026-10-12T08:00:00.000Z",
  });
  return Object.freeze({
    coach: Object.freeze({
      profileId,
      slug: displayName.toLowerCase().replaceAll(" ", "-"),
      displayName,
      bio: `${displayName} teaches focused private training.`,
      serviceMode: "private-training" as const,
      timezone: "Europe/Berlin",
      primaryLocationId: locationId,
      locations: Object.freeze([location]),
      selectedGymId: null,
      gymName: null,
      location: location.location,
      visibility: "visible" as const,
      recordSource:
        options.trustKind === "verified"
          ? ("user" as const)
          : ("fixture" as const),
      trustKind: options.trustKind ?? "demo",
      portraitUrl: options.portraitUrl ?? null,
      disciplines: Object.freeze(options.disciplines ?? (["Boxing"] as const)),
    }),
    primaryLocation: location,
    todaySlots: options.withAvailability
      ? Object.freeze([
          Object.freeze({
            id: `70000000-0000-4000-8000-${suffix}`,
            startsAt: "2026-10-12T08:00:00.000Z",
            endsAt: "2026-10-12T09:00:00.000Z",
            coachTimezone: "Europe/Berlin",
            requestEligibility: "requestable" as const,
            location: Object.freeze({
              trainingLocationId: locationId,
              name: location.publicName,
              kind: "independent" as const,
              selectedGymId: null,
              gymName: null,
              label: location.location.label,
              latitude: location.location.latitude,
              longitude: location.location.longitude,
              source: "manual" as const,
              provider: null,
              confirmedAt: location.location.confirmedAt,
            }),
          }),
        ])
      : Object.freeze([]),
  });
}
