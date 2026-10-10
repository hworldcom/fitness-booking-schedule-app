import type { LocationMapPoint } from "./contracts";

export type LocationMarkerLayout = Readonly<{
  pointId: string;
  offset: readonly [number, number];
  coincidentIndex: number;
  coincidentCount: number;
}>;

const MARKER_SPACING_PX = 42;

function coordinateKey(point: LocationMapPoint) {
  return `${point.longitude}:${point.latitude}`;
}

export function layoutLocationMapMarkers(
  points: readonly LocationMapPoint[],
): readonly LocationMarkerLayout[] {
  const groups = new Map<string, LocationMapPoint[]>();
  const pointIds = new Set<string>();
  for (const point of points) {
    if (
      pointIds.has(point.id) ||
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude)
    ) {
      throw new Error("Location marker input is invalid.");
    }
    pointIds.add(point.id);
    const key = coordinateKey(point);
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }

  const layouts = new Map<string, LocationMarkerLayout>();
  for (const group of groups.values()) {
    const ordered = [...group].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const columns = Math.ceil(Math.sqrt(ordered.length));
    const rows = Math.ceil(ordered.length / columns);
    ordered.forEach((point, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const offset: readonly [number, number] =
        ordered.length === 1
          ? [0, 0]
          : [
              (column - (columns - 1) / 2) * MARKER_SPACING_PX,
              (row - (rows - 1) / 2) * MARKER_SPACING_PX,
            ];
      layouts.set(
        point.id,
        Object.freeze({
          pointId: point.id,
          offset: Object.freeze(offset),
          coincidentIndex: index + 1,
          coincidentCount: ordered.length,
        }),
      );
    });
  }

  return Object.freeze(
    points.map((point) => {
      const layout = layouts.get(point.id);
      if (!layout) throw new Error("Location marker layout is incomplete.");
      return layout;
    }),
  );
}
