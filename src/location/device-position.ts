import type { LocationDevicePosition } from "./contracts";

/** A usable point and its reported uncertainty, never an invented fallback. */
export function readDeviceCoordinates(
  value: unknown,
): LocationDevicePosition | null {
  if (!value || typeof value !== "object") return null;
  const { latitude, longitude, accuracy } = value as Record<string, unknown>;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    return null;
  return Object.freeze({
    latitude,
    longitude,
    accuracyMeters:
      typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy > 0
        ? accuracy
        : null,
  });
}

export function deviceAccuracyLabel(accuracyMeters: number | null) {
  if (
    accuracyMeters === null ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters <= 0
  )
    return "Accuracy unavailable";
  return `Accuracy about ${accuracyMeters < 1000 ? `${Math.ceil(accuracyMeters)} m` : `${(accuracyMeters / 1000).toFixed(1)} km`}`;
}

/** An uncertainty envelope within the map projection, including world wrap. */
export function deviceAccuracyBounds(
  position: LocationDevicePosition,
): [[number, number], [number, number]] | null {
  const accuracy = position.accuracyMeters;
  if (accuracy === null || !Number.isFinite(accuracy) || accuracy <= 0)
    return null;
  const latitudeSpread = Math.min(180, accuracy / 111_195);
  const longitudeSpread = Math.min(
    180,
    latitudeSpread /
      Math.max(0.000001, Math.cos((position.latitude * Math.PI) / 180)),
  );
  const projectedLatitude = (value: number) =>
    Math.max(-85.0511287798066, Math.min(85.0511287798066, value));
  return [
    [
      position.longitude - longitudeSpread,
      projectedLatitude(position.latitude - latitudeSpread),
    ],
    [
      position.longitude + longitudeSpread,
      projectedLatitude(position.latitude + latitudeSpread),
    ],
  ];
}
