import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  PROFILE_IMAGE_DIMENSION,
  PROFILE_IMAGE_MAX_CANONICAL_BYTES,
} from "@/profile-images/contracts";
import {
  InvalidProfileImageError,
  normalizeCanonicalProfileImage,
} from "@/server/profile-images/image-normalization";

async function webp(width = 512, height = 512) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 130, g: 180, b: 90 },
    },
  })
    .withMetadata()
    .webp({ quality: 95 })
    .toBuffer();
}

test("canonical profile images are re-encoded without metadata", async () => {
  const result = await normalizeCanonicalProfileImage(await webp());
  assert.equal(result.contentType, "image/webp");
  assert.ok(result.bytes.byteLength <= PROFILE_IMAGE_MAX_CANONICAL_BYTES);
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, PROFILE_IMAGE_DIMENSION);
  assert.equal(metadata.height, PROFILE_IMAGE_DIMENSION);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
});

test("the server rejects non-canonical and malformed upload bytes", async () => {
  await assert.rejects(
    normalizeCanonicalProfileImage(await webp(256, 512)),
    InvalidProfileImageError,
  );
  const png = await sharp(await webp())
    .png()
    .toBuffer();
  await assert.rejects(
    normalizeCanonicalProfileImage(png),
    InvalidProfileImageError,
  );
  await assert.rejects(
    normalizeCanonicalProfileImage(new Uint8Array([1, 2, 3])),
    InvalidProfileImageError,
  );
  await assert.rejects(
    normalizeCanonicalProfileImage(
      new Uint8Array(PROFILE_IMAGE_MAX_CANONICAL_BYTES + 1),
    ),
    InvalidProfileImageError,
  );
});
