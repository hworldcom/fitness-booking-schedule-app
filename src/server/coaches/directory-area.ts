import "server-only";
import reference from "./data/berlin-neighborhoods.json";

const X_METRES = 111195 * Math.cos((52.5 * Math.PI) / 180);
const Y_METRES = 111195;
const BORDER_METRES = 5;
type Point = readonly [number, number];

const areas = reference.neighborhoods.map(({ name, polygons }) => ({
  name,
  polygons: polygons.map((rings) => {
    const projected = rings.map((ring) =>
      ring.map(([x, y]) => [x * X_METRES, y * Y_METRES] as Point),
    );
    const outer = projected[0]!;
    return {
      rings: projected,
      left: Math.min(...outer.map(([x]) => x)) - BORDER_METRES,
      right: Math.max(...outer.map(([x]) => x)) + BORDER_METRES,
      bottom: Math.min(...outer.map(([, y]) => y)) - BORDER_METRES,
      top: Math.max(...outer.map(([, y]) => y)) + BORDER_METRES,
    };
  }),
}));

/** Ray crossing with a guard wider than the reference's simplification error. */
function ringPosition([x, y]: Point, ring: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j]!;
    const [bx, by] = ring[i]!;
    const dx = bx - ax,
      dy = by - ay;
    const length = dx * dx + dy * dy;
    const fraction = length
      ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length))
      : 0;
    if (
      (x - ax - fraction * dx) ** 2 + (y - ay - fraction * dy) ** 2 <=
      BORDER_METRES ** 2
    )
      return "border";
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
      inside = !inside;
  }
  return inside ? "inside" : "outside";
}

export function directoryAreaLabel(
  location: Readonly<{ latitude: number; longitude: number }>,
): string | null {
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const point: Point = [longitude * X_METRES, latitude * Y_METRES];
  const names = new Set<string>();
  let border = false;
  for (const area of areas) {
    for (const polygon of area.polygons) {
      const [x, y] = point;
      if (
        x < polygon.left ||
        x > polygon.right ||
        y < polygon.bottom ||
        y > polygon.top
      )
        continue;
      const outer = ringPosition(point, polygon.rings[0]!);
      if (outer === "outside") continue;
      if (outer === "border") {
        border = true;
        continue;
      }
      const holes = polygon.rings
        .slice(1)
        .map((ring) => ringPosition(point, ring));
      if (holes.includes("border")) border = true;
      else if (!holes.includes("inside")) names.add(area.name);
    }
  }
  if (border || names.size > 1) return "Berlin";
  const name = names.values().next().value;
  return name ? `${name}, Berlin` : null;
}
