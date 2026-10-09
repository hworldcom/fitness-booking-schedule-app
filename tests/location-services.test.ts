import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  GEOAPIFY_GYM_CATEGORIES,
  buildGeoapifyGeocodingUrl,
  buildGeoapifyGymSearchRequest,
  parseGeoapifyResponse,
  resolveLocationSearchConfiguration,
  searchLocations,
} from "@/location";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiKey = "geoapify_test_key_1234567890";

test("location search configuration accepts only a bounded public key", () => {
  assert.deepEqual(resolveLocationSearchConfiguration(undefined), {
    status: "missing",
  });
  assert.deepEqual(resolveLocationSearchConfiguration("short"), {
    status: "invalid",
  });
  assert.deepEqual(
    resolveLocationSearchConfiguration("placeholder_geoapify_key_123"),
    { status: "invalid" },
  );
  assert.deepEqual(resolveLocationSearchConfiguration(` ${apiKey} `), {
    status: "ready",
    apiKey,
  });
});

test("Geoapify requests cover both general places and gym categories", () => {
  const geocodingUrl = buildGeoapifyGeocodingUrl(
    "Tempelhofer Damm 104, Berlin",
    apiKey,
  );
  assert.equal(geocodingUrl.origin, "https://api.geoapify.com");
  assert.equal(geocodingUrl.pathname, "/v1/geocode/search");
  assert.equal(
    geocodingUrl.searchParams.get("text"),
    "Tempelhofer Damm 104, Berlin",
  );
  assert.equal(geocodingUrl.searchParams.get("filter"), "countrycode:de");
  assert.equal(geocodingUrl.searchParams.get("apiKey"), apiKey);

  const gyms = buildGeoapifyGymSearchRequest("Groundline MMA", apiKey);
  assert.equal(gyms.url.pathname, "/v2/places");
  assert.equal(gyms.body.name, "Groundline MMA");
  assert.deepEqual(gyms.body.categories, GEOAPIFY_GYM_CATEGORIES);
  assert.ok(GEOAPIFY_GYM_CATEGORIES.includes("sport.fitness.gym"));
  assert.ok(GEOAPIFY_GYM_CATEGORIES.includes("sport.dojo"));
  assert.ok(GEOAPIFY_GYM_CATEGORIES.includes("activity.sport_club"));
});

test("Geoapify responses become bounded provider-neutral candidates", () => {
  assert.deepEqual(
    parseGeoapifyResponse(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [13.403665, 52.473086] },
            properties: {
              place_id: "gym-1",
              name: "Groundline MMA",
              formatted: "Groundline MMA, Linderstraße 9, Berlin, Germany",
            },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [181, 95] },
            properties: { place_id: "invalid", name: "Invalid" },
          },
        ],
      },
      "gym",
    ),
    [
      {
        id: "gym:gym-1",
        label: "Groundline MMA, Linderstraße 9, Berlin, Germany",
        latitude: 52.473086,
        longitude: 13.403665,
        kind: "gym",
        provider: "geoapify",
      },
    ],
  );
});

test("combined search prefers and deduplicates named gym results", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<Readonly<{ url: string; method: string }>> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(Object.freeze({ url, method: init?.method ?? "GET" }));
    return Response.json({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [13.399, 52.501] },
          properties: {
            place_id: "shared-place",
            name: "Groundline MMA",
            formatted: "Groundline MMA, Berlin, Germany",
          },
        },
      ],
    });
  };
  try {
    const results = await searchLocations("Groundline MMA", apiKey);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(({ method }) => method).sort(), ["GET", "POST"]);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.kind, "gym");
    assert.equal(results[0]?.provider, "geoapify");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("combined search uses a valid endpoint when its peer is malformed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/v1/geocode/search")) {
      return Response.json({ unexpected: true });
    }
    return Response.json({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [13.399, 52.501] },
          properties: {
            place_id: "gym-result",
            name: "Groundline MMA",
            formatted: "Groundline MMA, Berlin, Germany",
          },
        },
      ],
    });
  };
  try {
    const results = await searchLocations("Groundline MMA", apiKey);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.kind, "gym");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("location providers stay isolated behind the location module", () => {
  const explore = readFileSync(
    path.join(root, "src/features/coaches/coach-explore-results.tsx"),
    "utf8",
  );
  const picker = readFileSync(
    path.join(root, "src/features/coaches/coach-location-picker.tsx"),
    "utf8",
  );
  const packageJson = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8"),
  ) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  const maplibreRuntime = readFileSync(
    path.join(root, "src/location/providers/maplibre.ts"),
    "utf8",
  );
  const workerPreparation = readFileSync(
    path.join(root, "scripts/prepare-maplibre-worker.mjs"),
    "utf8",
  );

  assert.match(explore, /ssr:\s*false/);
  assert.match(picker, /ssr:\s*false/);
  assert.equal(packageJson.dependencies["maplibre-gl"], "6.13.0");
  assert.equal(packageJson.dependencies["mapbox-gl"], undefined);
  assert.match(packageJson.scripts.predev, /prepare:map/);
  assert.match(packageJson.scripts["predev:local"], /prepare:map/);
  assert.match(packageJson.scripts.prebuild, /prepare:map/);
  assert.match(packageJson.scripts["prebuild:vercel"], /prepare:map/);
  assert.match(maplibreRuntime, /\/vendor\/maplibre-gl-worker\.mjs/);
  assert.match(workerPreparation, /maplibre-gl-worker\.mjs/);
  for (const source of [explore, picker]) {
    assert.doesNotMatch(source, /maplibre-gl|tiles\.openfreemap\.org/);
    assert.doesNotMatch(source, /api\.geoapify\.com/);
    assert.doesNotMatch(
      source,
      /navigator\.geolocation|watchPosition|getCurrentPosition/,
    );
  }
});
