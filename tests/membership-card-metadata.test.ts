import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const metadataPath = "public/membership-card/devnet/basic-active.json";
const imagePath = "public/membership-card/devnet/basic-active.png";
const imageSourcePath = "public/membership-card/devnet/basic-active.svg";

test("Devnet membership-card metadata is wallet-readable and privacy bounded", async () => {
  const [metadataText, image, imageSource] = await Promise.all([
    readFile(metadataPath, "utf8"),
    readFile(imagePath),
    readFile(imageSourcePath, "utf8"),
  ]);
  const metadata = JSON.parse(metadataText) as {
    name?: unknown;
    description?: unknown;
    image?: unknown;
    category?: unknown;
    attributes?: Array<{ trait_type?: unknown; value?: unknown }>;
    properties?: { files?: Array<{ uri?: unknown; type?: unknown }> };
  };

  assert.equal(metadata.name, "MovX Basic Membership");
  assert.equal(metadata.category, "image");
  assert.equal(
    metadata.image,
    "https://staging.movx.club/membership-card/devnet/basic-active.png",
  );
  assert.equal(metadata.external_url, "https://staging.movx.club/my-access");
  assert.deepEqual(metadata.properties?.files, [
    {
      uri: metadata.image,
      type: "image/png",
    },
  ]);
  assert(
    metadata.attributes?.some(({ trait_type }) => trait_type === "Status"),
  );
  assert(
    metadata.attributes?.some(
      ({ trait_type, value }) =>
        trait_type === "Visits remaining" && value === 10,
    ),
  );
  assert.deepEqual(
    [...image.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  assert.match(imageSource, /MovX Basic Membership/);

  const publicPayload = `${metadataText}\n${imageSource}`.toLowerCase();
  for (const prohibited of [
    "email",
    "selected gym",
    "reservation",
    "attendance location",
    "payment balance",
  ]) {
    assert.equal(publicPayload.includes(prohibited), false, prohibited);
  }
});
