import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const metadataVersion = "v1";
const publicDirectory = `public/membership-card/devnet/basic-active/${metadataVersion}`;
const publicUrl = `https://staging.movx.club/membership-card/devnet/basic-active/${metadataVersion}`;
const metadataPath = `${publicDirectory}/metadata.json`;
const imagePath = `${publicDirectory}/card.png`;
const imageSourcePath = `${publicDirectory}/card.svg`;
const imageUrl = `${publicUrl}/card.png`;

const expectedSha256 = {
  metadata: "9c7ab129fe2163fe6d78eaa6fa8c2eadacca889a800692771047d3a7c929c646",
  image: "ba5e3b295164466d21d5b3b454300af8b87dde4ce1173d1f25702deb5c424d18",
  imageSource:
    "eaf4ed21afb2f77b4c3b291636146c5b6d7ecc489ab5607d8cdfaec3529ede20",
} as const;

type Metadata = Readonly<{
  name?: unknown;
  description?: unknown;
  image?: unknown;
  external_url?: unknown;
  category?: unknown;
  attributes?: Array<{ trait_type?: unknown; value?: unknown }>;
  properties?: {
    files?: Array<{ uri?: unknown; type?: unknown }>;
    category?: unknown;
  };
}>;

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function assertExactKeys(
  value: object,
  expected: readonly string[],
  label: string,
) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
}

test("Devnet membership-card metadata is wallet-readable, versioned, and privacy bounded", async () => {
  const [metadataText, image, imageSource] = await Promise.all([
    readFile(metadataPath, "utf8"),
    readFile(imagePath),
    readFile(imageSourcePath, "utf8"),
  ]);
  const metadata = JSON.parse(metadataText) as Metadata;

  assertExactKeys(
    metadata,
    [
      "name",
      "description",
      "image",
      "external_url",
      "category",
      "attributes",
      "properties",
    ],
    "metadata exposes only reviewed display fields",
  );
  assert.equal(metadata.name, "MovX Basic Membership");
  assert.equal(metadata.category, "image");
  assert.equal(metadata.image, imageUrl);
  assert.equal(metadata.external_url, "https://staging.movx.club/my-access");
  assert(metadata.properties);
  assertExactKeys(
    metadata.properties,
    ["files", "category"],
    "properties exposes only the reviewed file descriptor",
  );
  assert.deepEqual(metadata.properties.files, [
    {
      uri: imageUrl,
      type: "image/png",
    },
  ]);
  assert.equal(metadata.properties.category, "image");
  assert.deepEqual(
    metadata.attributes?.map(({ trait_type }) => trait_type),
    [
      "Network",
      "Status",
      "Plan",
      "Included visits",
      "Visits used",
      "Visits remaining",
      "Valid from",
      "Valid until",
    ],
  );
  assert(
    metadata.attributes?.some(
      ({ trait_type, value }) =>
        trait_type === "Visits remaining" && value === 10,
    ),
  );

  for (const publicAssetUrl of [
    metadata.image,
    metadata.properties.files?.[0]?.uri,
  ]) {
    assert.equal(typeof publicAssetUrl, "string");
    const parsed = new URL(publicAssetUrl);
    assert.equal(parsed.origin, "https://staging.movx.club");
    assert.match(
      parsed.pathname,
      /\/membership-card\/devnet\/basic-active\/v\d+\//,
    );
    assert.equal(parsed.pathname.includes("/api/"), false);
    assert.equal(parsed.search, "");
    assert.equal(parsed.hash, "");
  }

  assert.deepEqual(
    [...image.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  assert.match(imageSource, /MovX Basic Membership/);
  assert.equal(sha256(metadataText), expectedSha256.metadata);
  assert.equal(sha256(image), expectedSha256.image);
  assert.equal(sha256(imageSource), expectedSha256.imageSource);

  const publicPayload = `${metadataText}\n${imageSource}`.toLowerCase();
  for (const prohibited of [
    "email",
    "member wallet",
    "selected gym",
    "reservation",
    "attendance location",
    "attendance history",
    "payment balance",
    "membership_period",
    "3idz8hddpfaz1jww3gmh7yd6yokuufdb1txem2h6kpfe",
  ]) {
    assert.equal(publicPayload.includes(prohibited), false, prohibited);
  }
  assert.equal(
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(publicPayload),
    false,
    "email address",
  );
  assert.equal(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(
      publicPayload,
    ),
    false,
    "UUID",
  );
});

test("the first Devnet fixture no longer uses mutable-looking unversioned paths", async () => {
  for (const retiredPath of [
    "public/membership-card/devnet/basic-active.json",
    "public/membership-card/devnet/basic-active.png",
    "public/membership-card/devnet/basic-active.svg",
  ]) {
    await assert.rejects(readFile(retiredPath), { code: "ENOENT" });
  }
});
