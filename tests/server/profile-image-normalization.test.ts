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

test("prepared JPEG and PNG are validated then stored as metadata-free canonical WebP", async () => {
  for (const format of ["jpeg", "png"] as const) {
    const input = await sharp(await webp())
      .withMetadata()
      .toFormat(format)
      .toBuffer();
    const result = await normalizeCanonicalProfileImage(input);
    const metadata = await sharp(result.bytes).metadata();
    assert.equal(result.contentType, "image/webp");
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
    assert.equal(metadata.pages ?? 1, 1);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.ok(result.bytes.length <= PROFILE_IMAGE_MAX_CANONICAL_BYTES);
  }
});
test("other encodings, animated images and oversized dimensions cannot bypass prepared validation", async () => {
  for (const format of ["gif", "avif", "tiff"] as const) {
    await assert.rejects(
      normalizeCanonicalProfileImage(
        await sharp(await webp())
          .toFormat(format)
          .toBuffer(),
      ),
      InvalidProfileImageError,
    );
  }
  const frames = Buffer.alloc(512 * 1024 * 3);
  frames.fill(255, 512 * 512 * 3);
  const animated = await sharp(frames, {
    raw: { width: 512, height: 1024, channels: 3, pageHeight: 512 },
  })
    .webp({ loop: 0 })
    .toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  await assert.rejects(
    normalizeCanonicalProfileImage(animated),
    InvalidProfileImageError,
  );
  await assert.rejects(
    normalizeCanonicalProfileImage(
      await sharp({
        create: { width: 513, height: 512, channels: 3, background: "red" },
      })
        .png()
        .toBuffer(),
    ),
    InvalidProfileImageError,
  );
});
