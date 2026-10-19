import {
  CURRENT_LOCATION_PROVIDER,
  LocationSearchError,
  type LocationCandidate,
  type LocationSearchConfiguration,
  type LocationSearchFailure,
} from "../contracts";

const BERLIN_CENTER = Object.freeze({ longitude: 13.405, latitude: 52.52 });
// Geoapify city lookup for Berlin, DE (OSM relation 62422), checked 2026-10-19.
// A place filter constrains the city boundary; proximity only ranks its results.
const BERLIN_PLACE_ID =
  "513147ea984eca2a4059cb694fc939424a40f00101f901d6f3000000000000c002089203064265726c696e";
// Outer bounds rounded outward from the existing official Berlin reference.
const BERLIN_BOUNDS = {
  west: 13.0883,
  south: 52.3382,
  east: 13.7612,
  north: 52.6756,
};
const RESULT_LIMIT = 5;

export const GEOAPIFY_GYM_CATEGORIES = Object.freeze([
  "sport.fitness.gym",
  "sport.fitness.fitness_centre",
  "sport.dojo",
  "sport.sports_centre",
  "activity.sport_club",
] as const);

function trimmedApiKey(value: string | undefined) {
  return value?.trim() ?? "";
}

export function resolveLocationSearchConfiguration(
  value: string | undefined,
): LocationSearchConfiguration {
  const apiKey = trimmedApiKey(value);
  if (!apiKey) return Object.freeze({ status: "missing" });
  if (
    apiKey.length < 20 ||
    apiKey.length > 200 ||
    !/^[A-Za-z0-9_-]+$/.test(apiKey) ||
    /^(?:your|replace|placeholder)/i.test(apiKey)
  ) {
    return Object.freeze({ status: "invalid" });
  }
  return Object.freeze({ status: "ready", apiKey });
}

function normalizedSearchQuery(value: string) {
  return value.trim().replaceAll(/\s+/g, " ");
}

function validatedQuery(query: string) {
  const normalized = normalizedSearchQuery(query);
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;
  if (normalized.length < 3 || normalized.length > 160 || wordCount > 20) {
    throw new LocationSearchError("response");
  }
  return normalized;
}

function validatedApiKey(apiKey: string) {
  const configuration = resolveLocationSearchConfiguration(apiKey);
  if (configuration.status !== "ready") {
    throw new LocationSearchError("configuration");
  }
  return configuration.apiKey;
}

export function buildGeoapifyGeocodingUrl(query: string, apiKey: string) {
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", validatedQuery(query));
  url.searchParams.set("apiKey", validatedApiKey(apiKey));
  url.searchParams.set("format", "geojson");
  url.searchParams.set("filter", `place:${BERLIN_PLACE_ID}|countrycode:de`);
  url.searchParams.set(
    "bias",
    `proximity:${BERLIN_CENTER.longitude},${BERLIN_CENTER.latitude}`,
  );
  url.searchParams.set("lang", "en");
  url.searchParams.set("limit", String(RESULT_LIMIT));
  return url;
}

export function buildGeoapifyGymSearchRequest(query: string, apiKey: string) {
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("apiKey", validatedApiKey(apiKey));
  return Object.freeze({
    url,
    body: Object.freeze({
      categories: GEOAPIFY_GYM_CATEGORIES,
      name: validatedQuery(query),
      filter: Object.freeze({
        type: "place" as const,
        id: BERLIN_PLACE_ID,
      }),
      bias: Object.freeze({
        type: "proximity" as const,
        lon: BERLIN_CENTER.longitude,
        lat: BERLIN_CENTER.latitude,
      }),
      limit: RESULT_LIMIT,
      lang: "en",
    }),
  });
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
  const name = text(properties.name);
  const formatted = text(properties.formatted);
  if (!name) return formatted;
  if (
    !formatted ||
    formatted.toLocaleLowerCase().includes(name.toLocaleLowerCase())
  ) {
    return formatted || name;
  }
  return `${name}, ${formatted}`;
}

export function parseGeoapifyResponse(
  value: unknown,
  kind: LocationCandidate["kind"],
): readonly LocationCandidate[] {
  const response = record(value);
  if (!response || !Array.isArray(response.features)) {
    throw new LocationSearchError("response");
  }

  const candidates: LocationCandidate[] = [];
  const seen = new Set<string>();
  for (const rawFeature of response.features) {
    const feature = record(rawFeature);
    const geometry = record(feature?.geometry);
    const properties = record(feature?.properties);
    const coordinates = geometry?.coordinates;
    if (
      geometry?.type !== "Point" ||
      !Array.isArray(coordinates) ||
      !properties
    ) {
      continue;
    }
    const longitude = coordinates[0];
    const latitude = coordinates[1];
    const label = candidateLabel(properties);
    if (
      !label ||
      label.length > 240 ||
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < BERLIN_BOUNDS.south ||
      latitude > BERLIN_BOUNDS.north ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < BERLIN_BOUNDS.west ||
      longitude > BERLIN_BOUNDS.east ||
      text(properties.country_code).toLowerCase() !== "de" ||
      text(properties.city).toLowerCase() !== "berlin" ||
      (kind === "gym" &&
        (!Array.isArray(properties.categories) ||
          !properties.categories.some(
            (category) =>
              typeof category === "string" &&
              GEOAPIFY_GYM_CATEGORIES.some(
                (accepted) =>
                  category === accepted || category.startsWith(`${accepted}.`),
              ),
          )))
    ) {
      continue;
    }
    const providerId =
      text(properties.place_id) ||
      text(feature?.id) ||
      `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    const key = `${label.toLocaleLowerCase()}|${latitude.toFixed(6)}|${longitude.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(
      Object.freeze({
        id: `${kind}:${providerId}`,
        label,
        latitude,
        longitude,
        kind,
        provider: CURRENT_LOCATION_PROVIDER,
      }),
    );
    if (candidates.length === RESULT_LIMIT) break;
  }
  return Object.freeze(candidates);
}

function searchError(reason: LocationSearchFailure) {
  return new LocationSearchError(reason);
}

async function responseJson(response: Response) {
  if (response.status === 401 || response.status === 403) {
    throw searchError("configuration");
  }
  if (response.status === 429) throw searchError("quota");
  if (!response.ok) throw searchError("provider");
  try {
    return await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw searchError("response");
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function searchLocations(
  query: string,
  apiKey: string,
  kind: LocationCandidate["kind"] = "gym",
  signal?: AbortSignal,
): Promise<readonly LocationCandidate[]> {
  const gymRequest =
    kind === "gym" ? buildGeoapifyGymSearchRequest(query, apiKey) : null;
  const url = gymRequest?.url ?? buildGeoapifyGeocodingUrl(query, apiKey);
  try {
    const response = await fetch(url, {
      ...(gymRequest
        ? {
            method: "POST",
            headers: {
              Accept: "application/geo+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(gymRequest.body),
          }
        : { headers: { Accept: "application/geo+json" } }),
      signal,
    });
    const value = await responseJson(response);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return parseGeoapifyResponse(value, kind);
  } catch (error) {
    if (isAbortError(error) || error instanceof LocationSearchError)
      throw error;
    throw searchError("provider");
  }
}
