import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import type { CoachDirectoryEntry } from "@/domain/coaches";
import { sessionUuid } from "@/domain/session-types";
import type { CoachExploreView } from "./marketplace-search-contract";

export type ExplorePoint = Readonly<{ latitude: number; longitude: number }>;
export type ExplorePlace = ExplorePoint & Readonly<{ label: string }>;
export type ExploreBounds = Readonly<{
  west: number;
  south: number;
  east: number;
  north: number;
}>;
export type ExplorePreferences = Readonly<{
  version: 1;
  view: CoachExploreView | null;
  favorites: readonly string[];
  places: Readonly<{ home: ExplorePlace | null; work: ExplorePlace | null }>;
}>;
export const BERLIN_SEARCH_ORIGIN: ExplorePlace = Object.freeze({
  label: "Berlin centre",
  latitude: 52.52,
  longitude: 13.405,
});
export const EMPTY_EXPLORE_PREFERENCES: ExplorePreferences = Object.freeze({
  version: 1,
  view: null,
  favorites: Object.freeze([]),
  places: Object.freeze({ home: null, work: null }),
});
export function explorePreferenceScope(
  session: AuthSessionSnapshot,
  actor: ActorSnapshot,
) {
  if (session.status === "signed-in" && actor.status === "authorized")
    return `${actor.demoRun.slug}:${session.subject}`;
  if (session.status === "signed-out" && actor.status === "signed-out")
    return "guest";
  if (session.status === "disabled" && actor.status === "preview")
    return "preview";
  return null;
}
export function exploreStorageKey(scope: string) {
  return `movx:explore:v1:${encodeURIComponent(scope)}`;
}

/** Ephemeral location must also reset when a known session changes while actor verification is unavailable. */
export function exploreVisitScope(
  session: AuthSessionSnapshot,
  actor: ActorSnapshot,
) {
  return (
    explorePreferenceScope(session, actor) ??
    `unverified:${session.status}:${session.status === "signed-in" ? session.subject : ""}`
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isExplorePoint(value: unknown): value is ExplorePoint {
  if (!record(value)) return false;
  return (
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    Math.abs(value.latitude) <= 90 &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.longitude) <= 180
  );
}
export function isExplorePlace(value: unknown): value is ExplorePlace {
  if (!record(value) || typeof value.label !== "string") return false;
  const label = value.label;
  return (
    isExplorePoint(value) && label.trim().length > 0 && label.length <= 240
  );
}
/** Invalid or oversized browser data is unavailable, not a verified empty preference set. */
export function parseExplorePreferences(
  raw: string,
): ExplorePreferences | null {
  if (raw.length > 48_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !record(value) ||
      value.version !== 1 ||
      ![null, "list", "map"].includes(value.view as null) ||
      !Array.isArray(value.favorites) ||
      value.favorites.length > 300 ||
      !value.favorites.every(sessionUuid) ||
      !record(value.places) ||
      !["home", "work"].every(
        (key) =>
          value.places &&
          record(value.places) &&
          (value.places[key] === null || isExplorePlace(value.places[key])),
      )
    )
      return null;
    return Object.freeze({
      version: 1,
      view: value.view as CoachExploreView | null,
      favorites: Object.freeze([...new Set(value.favorites as string[])]),
      places: Object.freeze({
        home: value.places.home as ExplorePlace | null,
        work: value.places.work as ExplorePlace | null,
      }),
    });
  } catch {
    return null;
  }
}
export function distanceInKm(from: ExplorePoint, to: ExplorePoint) {
  const rad = Math.PI / 180;
  const latitude = (to.latitude - from.latitude) * rad;
  const longitude = (to.longitude - from.longitude) * rad;
  const a =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(from.latitude * rad) *
      Math.cos(to.latitude * rad) *
      Math.sin(longitude / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export function formatExploreDistance(km: number) {
  if (km < 0.1) return "under 100 m";
  if (km < 1) return `${Math.round(km * 10) * 100} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
export function pointInExploreBounds(
  point: ExplorePoint,
  bounds: ExploreBounds,
) {
  if (point.latitude < bounds.south || point.latitude > bounds.north)
    return false;
  if (bounds.east - bounds.west >= 360) return true;
  const width = (((bounds.east - bounds.west) % 360) + 360) % 360;
  const offset = (((point.longitude - bounds.west) % 360) + 360) % 360;
  return offset <= width;
}
export function selectExploreEntries(
  entries: readonly CoachDirectoryEntry[],
  origin: ExplorePoint,
  bounds: ExploreBounds | null,
  favorites: readonly string[],
  savedOnly: boolean,
) {
  const saved = new Set(favorites);
  return entries
    .filter(
      (entry) =>
        (!savedOnly || saved.has(entry.coach.profileId)) &&
        (!bounds ||
          pointInExploreBounds(entry.primaryLocation.location, bounds)),
    )
    .map((entry) => ({
      entry,
      distance: distanceInKm(origin, entry.primaryLocation.location),
    }))
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        a.entry.coach.displayName.localeCompare(
          b.entry.coach.displayName,
          "en",
        ) ||
        a.entry.coach.profileId.localeCompare(b.entry.coach.profileId),
    );
}
