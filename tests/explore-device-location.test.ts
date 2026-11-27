import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readDeviceLocation } from "@/features/coaches/explore-saved-places";

function device(
  t: TestContext,
  implementation?: Geolocation["getCurrentPosition"],
) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: implementation
        ? { getCurrentPosition: implementation }
        : undefined,
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  });
}
test("an explicit location request uses fresh native coordinates and preserves actual uncertainty", async (t) => {
  let calls = 0;
  device(t, (success, _failure, options) => {
    calls++;
    assert.deepEqual(options, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
    success({
      coords: Object.create({
        latitude: 52.51,
        longitude: 13.45,
        accuracy: 80,
      }),
    } as GeolocationPosition);
  });
  assert.equal(calls, 0);
  assert.deepEqual(await readDeviceLocation(), {
    latitude: 52.51,
    longitude: 13.45,
    accuracyMeters: 80,
    label: "Current location",
  });
  assert.equal(calls, 1);
});
test("denial, native timeout, unavailable and invalid readings have distinct actionable outcomes", async (t) => {
  let fail: PositionErrorCallback | undefined;
  device(t, (_success, failure) => {
    fail = failure ?? undefined;
  });
  for (const [code, expected] of [
    [1, /browser settings/],
    [2, /could not be found/],
    [3, /timed out/],
  ] as const) {
    const result = assert.rejects(readDeviceLocation(), expected);
    fail!({ code } as GeolocationPositionError);
    await result;
  }
});
test("a silent permission request returns control after the application deadline; a late reply cannot change the result", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let success: PositionCallback | undefined;
  device(t, (callback) => {
    success = callback;
  });
  const result = assert.rejects(readDeviceLocation(), /taking too long/);
  t.mock.timers.tick(15000);
  await result;
  success!({
    coords: { latitude: 52.51, longitude: 13.45, accuracy: 10 },
  } as GeolocationPosition);
});
test("missing browser location support and invalid positions never produce a fallback coordinate", async (t) => {
  device(t);
  await assert.rejects(readDeviceLocation(), /unavailable in this browser/);
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: NaN, longitude: 13.45 },
          } as GeolocationPosition),
      },
    },
  });
  await assert.rejects(readDeviceLocation(), /invalid location/);
});
