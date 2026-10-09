export const CURRENT_LOCATION_PROVIDER = "geoapify";
export const LEGACY_LOCATION_PROVIDER = "mapbox";

export type PersistedLocationProvider =
  typeof CURRENT_LOCATION_PROVIDER | typeof LEGACY_LOCATION_PROVIDER;

export function isPersistedLocationProvider(
  value: unknown,
): value is PersistedLocationProvider {
  return (
    value === CURRENT_LOCATION_PROVIDER || value === LEGACY_LOCATION_PROVIDER
  );
}
