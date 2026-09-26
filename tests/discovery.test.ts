import test from "node:test";
import assert from "node:assert/strict";
import { discoveryCatalogue } from "../src/features/discovery/catalogue";
import { searchCatalogue } from "../src/features/discovery/queries";
import { studios } from "../src/features/preview/catalogue";

const catalogue = discoveryCatalogue(studios);

test("public search indexes the supplied gym catalogue", () => {
  const yogaResults = searchCatalogue(catalogue, "yoga");
  assert.deepEqual(
    yogaResults.map((item) => item.title),
    ["Studio Vela", "Nightshift Athletic Club"],
  );
  assert.ok(yogaResults.every((item) => item.kind === "Studio"));
  assert.deepEqual(
    searchCatalogue(catalogue, "mayá fabrik").map((item) => item.title),
    ["Fabrik Training"],
  );
  assert.equal(searchCatalogue(catalogue, "yoga fabrik").length, 0);
  assert.equal(searchCatalogue(catalogue, "   ").length, 0);
});

test("the public catalogue contains only Explore gym destinations", () => {
  assert.ok(catalogue.length > 0);
  assert.ok(
    catalogue.every(
      (item) => item.kind === "Studio" && item.href.startsWith("/explore?q="),
    ),
  );
  assert.ok(
    catalogue.every(
      (item) =>
        !item.href.startsWith("/classes") &&
        !item.href.startsWith("/events") &&
        !item.href.startsWith("/challenges"),
    ),
  );
});
