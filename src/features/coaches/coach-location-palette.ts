function preferredPaletteIndex(locationId: string, paletteSize: number) {
  return Array.from(locationId).reduce(
    (total, character) =>
      (total + (character.codePointAt(0) ?? 0)) % paletteSize,
    0,
  );
}

export function assignCoachLocationPaletteIndexes(
  locationIds: readonly string[],
  paletteSize: number,
): ReadonlyMap<string, number> {
  if (!Number.isSafeInteger(paletteSize) || paletteSize < 1) {
    throw new RangeError("A positive palette size is required.");
  }

  const assignments = new Map<string, number>();
  const usedIndexes = new Set<number>();

  for (const locationId of locationIds) {
    if (assignments.has(locationId)) continue;

    let paletteIndex = preferredPaletteIndex(locationId, paletteSize);
    if (usedIndexes.size < paletteSize) {
      while (usedIndexes.has(paletteIndex)) {
        paletteIndex = (paletteIndex + 1) % paletteSize;
      }
    }

    assignments.set(locationId, paletteIndex);
    usedIndexes.add(paletteIndex);
  }

  return assignments;
}
