import "server-only";

import sharp from "sharp";
import {
  PROFILE_IMAGE_DIMENSION,
  PROFILE_IMAGE_MAX_CANONICAL_BYTES,
  PROFILE_IMAGE_MIME_TYPE,
  PROFILE_IMAGE_WEBP_QUALITY,
} from "@/profile-images/contracts";

export class InvalidProfileImageError extends Error {
  constructor(message = "The profile image is invalid.") {
    super(message);
    this.name = "InvalidProfileImageError";
  }
}

export async function normalizeCanonicalProfileImage(input: Uint8Array) {
  if (
    input.byteLength === 0 ||
    input.byteLength > PROFILE_IMAGE_MAX_CANONICAL_BYTES
  ) {
    throw new InvalidProfileImageError();
  }

  try {
    const source = sharp(input, {
      animated: false,
      failOn: "warning",
      limitInputPixels: PROFILE_IMAGE_DIMENSION * PROFILE_IMAGE_DIMENSION,
    });
    const metadata = await source.metadata();
    if (
      metadata.format !== "webp" ||
      metadata.width !== PROFILE_IMAGE_DIMENSION ||
      metadata.height !== PROFILE_IMAGE_DIMENSION ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new InvalidProfileImageError();
    }

    const { data, info } = await source
      .rotate()
      .resize(PROFILE_IMAGE_DIMENSION, PROFILE_IMAGE_DIMENSION, {
        fit: "cover",
        position: "attention",
      })
      .webp({ quality: PROFILE_IMAGE_WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (
      info.format !== "webp" ||
      info.width !== PROFILE_IMAGE_DIMENSION ||
      info.height !== PROFILE_IMAGE_DIMENSION ||
      data.byteLength > PROFILE_IMAGE_MAX_CANONICAL_BYTES
    ) {
      throw new InvalidProfileImageError();
    }

    return Object.freeze({
      bytes: new Uint8Array(data),
      contentType: PROFILE_IMAGE_MIME_TYPE,
    });
  } catch (error) {
    if (error instanceof InvalidProfileImageError) throw error;
    throw new InvalidProfileImageError();
  }
}
