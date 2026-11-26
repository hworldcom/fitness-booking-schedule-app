import assert from "node:assert/strict";
import test from "node:test";
import {
  readDeviceCoordinates,
  deviceAccuracyLabel,
  deviceAccuracyBounds,
} from "@/location/device-position";

test("device readings accept real coordinate getters and preserve reported uncertainty without invented fallback points", () => {
  const coordinates = Object.create({
    get latitude() {
      return 52.51;
    },
    get longitude() {
      return 13.45;
    },
    get accuracy() {
      return 120;
    },
  });
  assert.deepEqual(readDeviceCoordinates(coordinates), {
    latitude: 52.51,
    longitude: 13.45,
    accuracyMeters: 120,
  });
  for (const value of [
    null,
    undefined,
    {},
    [],
    { latitude: NaN, longitude: 13 },
    { latitude: 52, longitude: Infinity },
    { latitude: 91, longitude: 13 },
    { latitude: 52, longitude: -181 },
    { latitude: "52.5", longitude: 13 },
  ])
    assert.equal(readDeviceCoordinates(value), null);
  for (const accuracy of [undefined, null, NaN, Infinity, -10, 0, "20"])
    assert.deepEqual(
      readDeviceCoordinates({ latitude: 52.51, longitude: 13.45, accuracy }),
      { latitude: 52.51, longitude: 13.45, accuracyMeters: null },
    );
  assert.equal(deviceAccuracyLabel(null), "Accuracy unavailable");
  assert.equal(deviceAccuracyLabel(0), "Accuracy unavailable");
  assert.equal(deviceAccuracyLabel(12.2), "Accuracy about 13 m");
  assert.equal(deviceAccuracyLabel(8000), "Accuracy about 8.0 km");
});

test("accuracy camera bounds contain the reading, stay local across the antimeridian and handle very coarse or polar uncertainty", () => {
  const bounds = deviceAccuracyBounds({
    latitude: 52.51,
    longitude: 13.45,
    accuracyMeters: 120,
  })!;
  assert.ok(bounds[0][0] < 13.45 && bounds[1][0] > 13.45);
  assert.ok(bounds[0][1] < 52.51 && bounds[1][1] > 52.51);
  const wrapped = deviceAccuracyBounds({
    latitude: 0,
    longitude: 179.99,
    accuracyMeters: 8000,
  })!;
  assert.ok(wrapped[1][0] > 180);
  assert.ok(wrapped[1][0] - wrapped[0][0] < 1);
  for (const latitude of [-90, 0, 90]) {
    const world = deviceAccuracyBounds({
      latitude,
      longitude: 0,
      accuracyMeters: Number.MAX_VALUE,
    })!;
    assert.ok(world.flat().every(Number.isFinite));
    assert.ok(world[0][1] >= -85.052 && world[1][1] <= 85.052);
    assert.ok(world[1][0] - world[0][0] <= 360);
  }
  assert.equal(
    deviceAccuracyBounds({
      latitude: 52.51,
      longitude: 13.45,
      accuracyMeters: null,
    }),
    null,
  );
});
