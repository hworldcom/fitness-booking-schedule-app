import { assignCoachLocationPaletteIndexes } from "./coach-location-palette";

export type CoachProfileLocationColor = Readonly<{
  accent: string;
  tint: string;
  ink: string;
}>;

function colorAt(index: number) {
  const hue = Number(((index * 137.50776405) % 360).toFixed(3));
  return Object.freeze({
    accent: `hsl(${hue} 48% 34%)`,
    tint: `hsl(${hue} 52% 95%)`,
    ink: `hsl(${hue} 52% 22%)`,
  });
}

export function assignCoachProfileLocationColors(
  locationIds: readonly string[],
): ReadonlyMap<string, CoachProfileLocationColor> {
  const uniqueIds = [...new Set(locationIds)];
  if (uniqueIds.length === 0) return new Map();
  const paletteIndexes = assignCoachLocationPaletteIndexes(
    uniqueIds,
    uniqueIds.length,
  );
  return new Map(
    uniqueIds.map((locationId) => {
      const paletteIndex = paletteIndexes.get(locationId);
      if (paletteIndex === undefined) {
        throw new Error(
          "Coach profile location color assignment is incomplete.",
        );
      }
      return [locationId, colorAt(paletteIndex)] as const;
    }),
  );
}
