import {
  CURRENT_LOCATION_PROVIDER,
  LocationSearchError,
  type LocationCandidate,
  type LocationSearchConfiguration,
  type LocationSearchFailure,
} from "../contracts";

const BERLIN_CENTER = Object.freeze({ longitude: 13.405, latitude: 52.52 });
const BERLIN_SEARCH_RADIUS_METERS = 50_000;
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
  url.searchParams.set("filter", "countrycode:de");
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
        type: "circle" as const,
        lon: BERLIN_CENTER.longitude,
        lat: BERLIN_CENTER.latitude,
        radius: BERLIN_SEARCH_RADIUS_METERS,
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
    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    const label = candidateLabel(properties);
    const providerId =
      text(properties.place_id) ||
      text(feature?.id) ||
      `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
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
  } catch {
    throw searchError("response");
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function preferredFailure(errors: readonly unknown[]) {
  const reasons = errors
    .filter((error): error is LocationSearchError =>
      Boolean(error instanceof LocationSearchError),
    )
    .map((error) => error.reason);
  if (reasons.includes("configuration")) return searchError("configuration");
  if (reasons.includes("quota")) return searchError("quota");
  if (reasons.includes("response")) return searchError("response");
  return searchError("provider");
}

function deduplicateCandidates(
  candidates: readonly LocationCandidate[],
): readonly LocationCandidate[] {
  const deduplicated: LocationCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = `${candidate.label.toLocaleLowerCase()}|${candidate.latitude.toFixed(6)}|${candidate.longitude.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicated.push(candidate);
    if (deduplicated.length === RESULT_LIMIT) break;
  }
  return Object.freeze(deduplicated);
}

export async function searchLocations(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<readonly LocationCandidate[]> {
  const geocodingUrl = buildGeoapifyGeocodingUrl(query, apiKey);
  const gymRequest = buildGeoapifyGymSearchRequest(query, apiKey);

  const settled = await Promise.allSettled([
    fetch(geocodingUrl, {
      headers: { Accept: "application/geo+json" },
      signal,
    })
      .then(responseJson)
      .then((value) => parseGeoapifyResponse(value, "place")),
    fetch(gymRequest.url, {
      method: "POST",
      headers: {
        Accept: "application/geo+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gymRequest.body),
      signal,
    })
      .then(responseJson)
      .then((value) => parseGeoapifyResponse(value, "gym")),
  ]);

  const rejected = settled
    .filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    .map((result) => result.reason);
  const aborted = rejected.find(isAbortError);
  if (aborted) throw aborted;

  const candidates: LocationCandidate[] = [];
  const geocoding = settled[0];
  if (geocoding.status === "fulfilled") {
    candidates.push(...geocoding.value);
  }
  const gyms = settled[1];
  if (gyms.status === "fulfilled") {
    candidates.unshift(...gyms.value);
  }
  const result = deduplicateCandidates(candidates);
  if (result.length > 0 || rejected.length === 0) return result;
  throw preferredFailure(rejected);
}
