export const MAPBOX_PROVIDER = "mapbox";
export const MAPBOX_STYLE = "mapbox://styles/mapbox/streets-v12";

export type MapboxBrowserConfiguration =
  | Readonly<{ status: "ready"; accessToken: string }>
  | Readonly<{ status: "missing" | "invalid" }>;

export type MapboxGeocodingCandidate = Readonly<{
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}>;

export type MapboxSearchFailure =
  "configuration" | "quota" | "provider" | "response";

export class MapboxSearchError extends Error {
  constructor(readonly reason: MapboxSearchFailure) {
    super("Mapbox location search is unavailable.");
    this.name = "MapboxSearchError";
  }
}

function trimmedToken(value: string | undefined) {
  return value?.trim() ?? "";
}

export function resolveMapboxBrowserConfiguration(
  value: string | undefined,
): MapboxBrowserConfiguration {
  const accessToken = trimmedToken(value);
  if (!accessToken) return Object.freeze({ status: "missing" });
  if (!/^pk\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken)) {
    return Object.freeze({ status: "invalid" });
  }
  return Object.freeze({ status: "ready", accessToken });
}

function normalizedSearchQuery(value: string) {
  return value.trim().replaceAll(/\s+/g, " ");
}

export function buildPermanentGeocodingUrl(query: string, accessToken: string) {
  const normalized = normalizedSearchQuery(query);
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;
  if (
    normalized.length < 3 ||
    normalized.length > 256 ||
    wordCount > 20 ||
    normalized.includes(";")
  ) {
    throw new MapboxSearchError("response");
  }
  if (resolveMapboxBrowserConfiguration(accessToken).status !== "ready") {
    throw new MapboxSearchError("configuration");
  }

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", normalized);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("permanent", "true");
  url.searchParams.set("autocomplete", "false");
  url.searchParams.set("country", "de");
  url.searchParams.set("language", "en,de");
  url.searchParams.set("limit", "5");
  url.searchParams.set("types", "address,street,place,locality,neighborhood");
  url.searchParams.set("proximity", "13.405,52.52");
  return url;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function candidateLabel(properties: Record<string, unknown>) {
  const fullAddress = text(properties.full_address);
  if (fullAddress) return fullAddress;
  const name = text(properties.name_preferred) || text(properties.name);
  const place = text(properties.place_formatted);
  return [name, place].filter(Boolean).join(", ");
}

export function parsePermanentGeocodingResponse(
  value: unknown,
): readonly MapboxGeocodingCandidate[] {
  const response = record(value);
  if (!response || !Array.isArray(response.features)) {
    throw new MapboxSearchError("response");
  }

  const candidates: MapboxGeocodingCandidate[] = [];
  const seen = new Set<string>();
  for (const rawFeature of response.features) {
    const feature = record(rawFeature);
    const geometry = record(feature?.geometry);
    const properties = record(feature?.properties);
    const coordinates = geometry?.coordinates;
    const id = text(feature?.id);
    if (
      geometry?.type !== "Point" ||
      !Array.isArray(coordinates) ||
      !properties ||
      !id
    ) {
      continue;
    }
    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    const label = candidateLabel(properties);
    if (
      !label ||
      label.length > 240 ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      continue;
    }
    const key = `${label}|${latitude.toFixed(6)}|${longitude.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(Object.freeze({ id, label, latitude, longitude }));
    if (candidates.length === 5) break;
  }
  return Object.freeze(candidates);
}

export async function searchPermanentMapboxLocations(
  query: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch(buildPermanentGeocodingUrl(query, accessToken), {
      headers: { Accept: "application/geo+json" },
      signal,
    });
  } catch (error) {
    if (error instanceof MapboxSearchError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new MapboxSearchError("provider");
  }

  if (response.status === 401 || response.status === 403) {
    throw new MapboxSearchError("configuration");
  }
  if (response.status === 429) throw new MapboxSearchError("quota");
  if (!response.ok) throw new MapboxSearchError("provider");
  try {
    return parsePermanentGeocodingResponse(await response.json());
  } catch (error) {
    if (error instanceof MapboxSearchError) throw error;
    throw new MapboxSearchError("response");
  }
}
