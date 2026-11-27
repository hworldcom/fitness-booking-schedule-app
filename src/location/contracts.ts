import {
  CURRENT_LOCATION_PROVIDER,
  type PersistedLocationProvider,
} from "@/domain/locations";

export {
  CURRENT_LOCATION_PROVIDER,
  LEGACY_LOCATION_PROVIDER,
  isPersistedLocationProvider,
  type PersistedLocationProvider,
} from "@/domain/locations";

export function locationProviderLabel(
  provider: PersistedLocationProvider,
): string {
  return provider === CURRENT_LOCATION_PROVIDER ? "Geoapify" : "Mapbox";
}

export type LocationSearchConfiguration =
  | Readonly<{ status: "ready"; apiKey: string }>
  | Readonly<{ status: "missing" | "invalid" }>;

export type LocationCandidate = Readonly<{
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: "facility" | "place";
  provider: typeof CURRENT_LOCATION_PROVIDER;
}>;

export type LocationMapPoint = Readonly<{
  id: string;
  name: string;
  label: string;
  ariaLabel: string;
  latitude: number;
  longitude: number;
  initials: string;
  imageUrl: string | null;
  markerAppearance?: Readonly<{
    background: string;
    foreground: string;
    accent: string;
  }>;
}>;

export type LocationMapViewport = Readonly<{
  latitude: number;
  longitude: number;
  west: number;
  south: number;
  east: number;
  north: number;
}>;
export type LocationMapCamera = Readonly<{
  latitude: number;
  longitude: number;
  zoom: number;
  revision: number;
  accuracyMeters?: number | null;
}>;

export type LocationDevicePosition = Readonly<{
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}>;

/** The explicitly selected private search shortcut, never a public coach. */
export type LocationSavedPlaceMarker = Readonly<{
  kind: "home" | "work";
  latitude: number;
  longitude: number;
}>;

export type LocationSearchFailure =
  "configuration" | "quota" | "provider" | "response";

export class LocationSearchError extends Error {
  constructor(readonly reason: LocationSearchFailure) {
    super("Location search is unavailable.");
    this.name = "LocationSearchError";
  }
}
