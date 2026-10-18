import assert from "node:assert/strict";
import test from "node:test";
import { directoryAreaLabel } from "@/server/coaches/directory-area";
import reference from "@/server/coaches/data/berlin-neighborhoods.json";

test("public primary training points resolve to their actual neighborhoods rather than one default district", () => {
  for (const [latitude, longitude, expected] of [
    [52.473086, 13.403665, "Tempelhof, Berlin"],
    [52.503389, 13.398444, "Kreuzberg, Berlin"],
    [52.502312, 13.395447, "Kreuzberg, Berlin"],
    [52.446019, 13.437642, "Britz, Berlin"],
    [52.496568, 13.392365, "Kreuzberg, Berlin"],
    [52.534, 13.425, "Prenzlauer Berg, Berlin"],
    [52.52, 13.405, "Mitte, Berlin"],
  ] as const) {
    assert.equal(directoryAreaLabel({ latitude, longitude }), expected);
  }
});

test("invalid/out-of-region coordinates do not invent a Berlin area", () => {
  for (const [latitude, longitude] of [
    [NaN, 13.4],
    [52.5, Infinity],
    [48.85, 2.35],
    [13.405, 52.52],
    [0, 0],
  ])
    assert.equal(directoryAreaLabel({ latitude, longitude }), null);
});

test("points on a boundary get a broad city label instead of an arbitrary neighborhood", () => {
  const [longitude, latitude] =
    reference.neighborhoods[0]!.polygons[0]![0]![0]!;
  assert.equal(
    directoryAreaLabel({ latitude: latitude!, longitude: longitude! }),
    "Berlin",
  );
});
