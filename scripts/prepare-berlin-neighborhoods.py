"""Prepare the offline Home-card area reference from Berlin's public WFS GeoJSON.

Usage: python3 scripts/prepare-berlin-neighborhoods.py source.geojson output.json
No network requests, application configuration or coach data are accessed.
"""

import hashlib
import json
import math
from pathlib import Path
import sys

X_METRES = 111195 * math.cos(math.radians(52.5))
Y_METRES = 111195
TOLERANCE_METRES = 2


def distance_squared(point, start, end):
    px, py = point[0] * X_METRES, point[1] * Y_METRES
    ax, ay = start[0] * X_METRES, start[1] * Y_METRES
    dx, dy = (end[0] - start[0]) * X_METRES, (end[1] - start[1]) * Y_METRES
    length = dx * dx + dy * dy
    fraction = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length)) if length else 0
    return (px - ax - fraction * dx) ** 2 + (py - ay - fraction * dy) ** 2


def simplify(ring):
    keep = {0, len(ring) - 1}
    pending = [(0, len(ring) - 1)]
    while pending:
        start, end = pending.pop()
        maximum, furthest = TOLERANCE_METRES ** 2, None
        for index in range(start + 1, end):
            distance = distance_squared(ring[index], ring[start], ring[end])
            if distance > maximum:
                maximum, furthest = distance, index
        if furthest is not None:
            keep.add(furthest)
            pending.extend([(start, furthest), (furthest, end)])
    points = [ring[index] for index in sorted(keep)]
    if len(points) < 4:
        points = ring
    return [[round(x, 7), round(y, 7)] for x, y in points]


def main():
    source_path, output_path = map(Path, sys.argv[1:])
    raw = source_path.read_bytes()
    source = json.loads(raw)
    neighborhoods = []
    for feature in source["features"]:
        geometry = feature["geometry"]
        assert geometry["type"] == "MultiPolygon"
        name = feature["properties"]["nam"]
        polygons = [[simplify(ring) for ring in polygon] for polygon in geometry["coordinates"]]
        assert all(12 < x < 15 and 51 < y < 54 for polygon in polygons for ring in polygon for x, y in ring)
        neighborhoods.append({"name": name, "polygons": polygons})
    result = {
        "source": "https://gdi.berlin.de/services/wfs/alkis_ortsteile",
        "license": "dl-de-zero-2.0",
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "simplificationMetres": TOLERANCE_METRES,
        "neighborhoods": sorted(neighborhoods, key=lambda item: item["name"]),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Keep generated geometry compact; retain the actual polygon coordinates.
    text = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
    output_path.write_text(text + "\n")
    print(f"Prepared {len(neighborhoods)} neighborhoods; {len(text.encode())} bytes")


if __name__ == "__main__":
    main()
