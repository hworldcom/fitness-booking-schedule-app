import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  LocationSearchError,
  buildGeoapifyGeocodingUrl,
  buildGeoapifyFacilitySearchUrl,
  parseGeoapifyResponse,
  resolveLocationSearchConfiguration,
  searchLocations,
} from "@/location";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiKey = "geoapify_test_key_1234567890";
function feature(
  properties: Record<string, unknown> = {},
  coordinates: unknown = [13.389507, 52.526682],
) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates },
    properties: {
      place_id: "chimosa",
      name: "Chimosa",
      formatted: "Chimosa, Linienstraße 127, 10115 Berlin, Germany",
      country_code: "de",
      city: "Berlin",
      result_type: "amenity",
      ...properties,
    },
  };
}
function collection(...features: unknown[]) {
  return { type: "FeatureCollection", features };
}
const reason = (expected: string) => (error: unknown) =>
  error instanceof LocationSearchError && error.reason === expected;

test("location search configuration accepts only a bounded public key", () => {
  assert.deepEqual(resolveLocationSearchConfiguration(undefined), {
    status: "missing",
  });
  for (const value of [
    "short",
    "placeholder_geoapify_key_123",
    "x".repeat(201),
    "invalid key with spaces 12345",
  ]) {
    assert.deepEqual(resolveLocationSearchConfiguration(value), {
      status: "invalid",
    });
  }
  assert.deepEqual(resolveLocationSearchConfiguration(` ${apiKey} `), {
    status: "ready",
    apiKey,
  });
});

test("facility and address requests constrain Berlin while only facilities request named amenities", () => {
  const address = buildGeoapifyGeocodingUrl(
    "  Linienstraße  127, Berlin ",
    apiKey,
  );
  const facility = buildGeoapifyFacilitySearchUrl("  McFIT  Berlin ", apiKey);
  assert.equal(facility.origin, "https://api.geoapify.com");
  assert.equal(facility.pathname, "/v1/geocode/search");
  assert.equal(facility.searchParams.get("text"), "McFIT Berlin");
  assert.equal(facility.searchParams.get("type"), "amenity");
  assert.equal(address.searchParams.has("type"), false);
  assert.equal(address.searchParams.get("text"), "Linienstraße 127, Berlin");
  assert.match(
    facility.searchParams.get("filter")!,
    /^place:.+\|countrycode:de$/,
  );
  assert.equal(
    facility.searchParams.get("filter"),
    address.searchParams.get("filter"),
  );
  assert.equal(facility.searchParams.get("bias"), "proximity:13.405,52.52");
  assert.equal(facility.searchParams.get("limit"), "5");
  assert.equal(facility.searchParams.has("categories"), false);
});

test("facility parsing accepts non-fitness categories and rejects unnamed, generic, outside or malformed results", () => {
  const response = collection(
    feature(),
    feature({
      place_id: "museum",
      name: "Futurium",
      formatted: "Futurium, Alexanderufer 2, Berlin",
      category: "entertainment.museum",
    }),
    feature({ name: "", formatted: "Berlin, Germany" }),
    feature({ result_type: "street" }),
    feature({ result_type: "city" }),
    feature({ result_type: "building" }),
    feature({ result_type: undefined }),
    feature({ city: "Potsdam" }),
    feature({ country_code: "us" }),
    feature({ city: undefined }),
    feature({ country_code: undefined }),
    feature({}, [11.576, 48.137]),
    feature({}, [181, 95]),
    feature({}, ["13.389507", "52.526682"]),
    feature({}, [null, null]),
    feature({}, [13.389507, Number.NaN]),
    feature({ formatted: "x".repeat(241) }),
    {
      geometry: { type: "LineString", coordinates: [13.389507, 52.526682] },
      properties: {},
    },
    null,
  );
  const results = parseGeoapifyResponse(response, "facility");
  assert.deepEqual(
    results.map(({ id, kind, provider }) => ({ id, kind, provider })),
    [
      { id: "facility:chimosa", kind: "facility", provider: "geoapify" },
      { id: "facility:museum", kind: "facility", provider: "geoapify" },
    ],
  );
  assert.equal(
    results[0]?.label,
    "Chimosa, Linienstraße 127, 10115 Berlin, Germany",
  );
  assert.equal(results[0]?.latitude, 52.526682);
  assert.equal(results[0]?.longitude, 13.389507);
  // A missing or non-fitness category cannot hide a valid named amenity.
  assert.equal(
    parseGeoapifyResponse(
      collection(feature({ category: "catering.cafe" })),
      "facility",
    ).length,
    1,
  );
});

test("own-address parsing accepts Berlin address results without requiring a named amenity", () => {
  const address = feature({
    name: "",
    formatted: "Linienstraße 127, 10115 Berlin, Germany",
    result_type: "building",
  });
  const results = parseGeoapifyResponse(
    collection(
      address,
      feature({ city: "Potsdam" }),
      feature({}, [13.07, 52.52]),
    ),
    "place",
  );
  assert.equal(results.length, 1);
  assert.equal(results[0]?.kind, "place");
  assert.equal(results[0]?.label, "Linienstraße 127, 10115 Berlin, Germany");
  assert.throws(
    () => parseGeoapifyResponse({ results: [] }, "facility"),
    reason("response"),
  );
});

test("candidate parsing deduplicates and caps accepted results after rejecting invalid entries", () => {
  const features = [
    feature({ city: "Potsdam" }),
    feature(),
    feature(),
    ...Array.from({ length: 8 }, (_, i) =>
      feature(
        {
          place_id: `venue-${i}`,
          name: `Gym ${i}`,
          formatted: `Gym ${i}, Berlin`,
        },
        [13.4 + i / 1000, 52.52],
      ),
    ),
  ];
  const results = parseGeoapifyResponse(collection(...features), "facility");
  assert.equal(results.length, 5);
  assert.equal(results[0]?.id, "facility:chimosa");
  assert.equal(results[4]?.id, "facility:venue-3");
});

test("facility-first and own-address lookup each call one geocoder request with distinct result scope", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json(collection(feature()));
  };
  try {
    assert.equal(
      (await searchLocations("McFIT Berlin", apiKey))[0]?.kind,
      "facility",
    );
    assert.equal(calls.length, 1);
    const facility = new URL(calls[0]!.url);
    assert.equal(facility.pathname, "/v1/geocode/search");
    assert.equal(facility.searchParams.get("type"), "amenity");
    assert.equal(calls[0]!.init?.method ?? "GET", "GET");
    assert.equal(calls[0]!.init?.body, undefined);
    assert.equal(
      (await searchLocations("Linienstraße 127", apiKey, "place"))[0]?.kind,
      "place",
    );
    assert.equal(calls.length, 2);
    const address = new URL(calls[1]!.url);
    assert.equal(address.pathname, "/v1/geocode/search");
    assert.equal(address.searchParams.has("type"), false);
    assert.equal(
      address.searchParams.get("filter"),
      facility.searchParams.get("filter"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid queries and configuration fail before consuming provider requests", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return Response.json(collection());
  };
  try {
    for (const query of [
      "ab",
      "x".repeat(161),
      Array(21).fill("facility").join(" "),
    ]) {
      await assert.rejects(
        () => searchLocations(query, apiKey),
        reason("response"),
      );
    }
    await assert.rejects(
      () => searchLocations("Chimosa", "bad-key"),
      reason("configuration"),
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("empty results stay empty and provider/configuration/quota/response failures remain distinct", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json(collection());
    assert.deepEqual(await searchLocations("Missing gym", apiKey), []);
    for (const [status, expected] of [
      [401, "configuration"],
      [403, "configuration"],
      [429, "quota"],
      [503, "provider"],
    ] as const) {
      globalThis.fetch = async () => new Response("Unavailable", { status });
      await assert.rejects(
        () => searchLocations("Chimosa", apiKey),
        reason(expected),
      );
    }
    globalThis.fetch = async () => Response.json({ unexpected: true });
    await assert.rejects(
      () => searchLocations("Chimosa", apiKey),
      reason("response"),
    );
    globalThis.fetch = async () => new Response("invalid json");
    await assert.rejects(
      () => searchLocations("Address Berlin", apiKey, "place"),
      reason("response"),
    );
    globalThis.fetch = async () => {
      throw new TypeError("Network unavailable");
    };
    await assert.rejects(
      () => searchLocations("Chimosa", apiKey),
      reason("provider"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cancellation propagates and ignores a response completed after its request was aborted", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.signal, controller.signal);
      controller.abort();
      return Response.json(collection(feature()));
    };
    await assert.rejects(
      () => searchLocations("Chimosa", apiKey, "facility", controller.signal),
      { name: "AbortError" },
    );
    globalThis.fetch = async () => {
      throw new DOMException("Cancelled", "AbortError");
    };
    await assert.rejects(() => searchLocations("Chimosa", apiKey), {
      name: "AbortError",
    });
    globalThis.fetch = async () => {
      const response = Response.json(collection());
      response.json = async () => {
        throw new DOMException("Cancelled body", "AbortError");
      };
      return response;
    };
    await assert.rejects(() => searchLocations("Chimosa", apiKey), {
      name: "AbortError",
    });
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
