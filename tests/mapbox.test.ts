import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildPermanentGeocodingUrl,
  parsePermanentGeocodingResponse,
  resolveMapboxBrowserConfiguration,
} from "@/mapbox/provider";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicToken = "pk.test-header.test-signature";

test("Mapbox browser configuration accepts only an explicit public token", () => {
  assert.deepEqual(resolveMapboxBrowserConfiguration(undefined), {
    status: "missing",
  });
  assert.deepEqual(resolveMapboxBrowserConfiguration("sk.secret.value"), {
    status: "invalid",
  });
  assert.deepEqual(resolveMapboxBrowserConfiguration("placeholder"), {
    status: "invalid",
  });
  assert.deepEqual(resolveMapboxBrowserConfiguration(` ${publicToken} `), {
    status: "ready",
    accessToken: publicToken,
  });
});

test("persistable search uses explicit permanent Geocoding v6 requests", () => {
  const url = buildPermanentGeocodingUrl(
    "Tempelhofer Damm 104, Berlin",
    publicToken,
  );
  assert.equal(url.origin, "https://api.mapbox.com");
  assert.equal(url.pathname, "/search/geocode/v6/forward");
  assert.equal(url.searchParams.get("q"), "Tempelhofer Damm 104, Berlin");
  assert.equal(url.searchParams.get("permanent"), "true");
  assert.equal(url.searchParams.get("autocomplete"), "false");
  assert.equal(url.searchParams.get("country"), "de");
  assert.equal(url.searchParams.get("access_token"), publicToken);
  assert.equal(url.searchParams.has("session_token"), false);
});

test("Mapbox Geocoding responses become bounded provider-neutral candidates", () => {
  assert.deepEqual(
    parsePermanentGeocodingResponse({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "address.1",
          geometry: { type: "Point", coordinates: [13.403665, 52.473086] },
          properties: {
            name: "Tempelhofer Damm 104",
            place_formatted: "Berlin, Germany",
            full_address: "Tempelhofer Damm 104, 12099 Berlin, Germany",
          },
        },
        {
          type: "Feature",
          id: "invalid.1",
          geometry: { type: "Point", coordinates: [181, 95] },
          properties: { name: "Invalid" },
        },
      ],
    }),
    [
      {
        id: "address.1",
        label: "Tempelhofer Damm 104, 12099 Berlin, Germany",
        latitude: 52.473086,
        longitude: 13.403665,
      },
    ],
  );
});

test("Mapbox UI stays client-only and never requests device location or Search Box", () => {
  const explore = readFileSync(
    path.join(root, "src/features/coaches/coach-explore-results.tsx"),
    "utf8",
  );
  const picker = readFileSync(
    path.join(root, "src/features/coaches/coach-location-picker.tsx"),
    "utf8",
  );
  const provider = readFileSync(
    path.join(root, "src/mapbox/provider.ts"),
    "utf8",
  );
  assert.match(explore, /ssr:\s*false/);
  assert.match(picker, /ssr:\s*false/);
  for (const source of [explore, picker, provider]) {
    assert.doesNotMatch(
      source,
      /navigator\.geolocation|watchPosition|getCurrentPosition/,
    );
    assert.doesNotMatch(source, /search\/searchbox|\/suggest|\/retrieve/);
    assert.doesNotMatch(source, /sk\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  }
});
