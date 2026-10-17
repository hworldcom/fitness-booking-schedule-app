import "server-only";
import sharp from "sharp";
import {
  COACH_BANNER_MAX_SOURCE_BYTES,
  COACH_BANNER_VARIANTS,
  type CoachBannerVariant,
} from "@/domain/coach-website";

export class InvalidCoachBannerError extends Error {}

export async function normalizeCoachBanner(input: Uint8Array) {
  if (!input.byteLength || input.byteLength > COACH_BANNER_MAX_SOURCE_BYTES)
    throw new InvalidCoachBannerError();
  try {
    const source = sharp(input, {
      animated: false,
      failOn: "warning",
      limitInputPixels: 24_000_000,
    });
    const metadata = await source.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      !metadata.width ||
      !metadata.height ||
      metadata.width < 320 ||
      metadata.height < 120 ||
      metadata.width > 8192 ||
      metadata.height > 8192 ||
      (metadata.pages ?? 1) !== 1
    )
      throw new InvalidCoachBannerError();
    const normalized = {} as Record<
      CoachBannerVariant,
      Uint8Array<ArrayBuffer>
    >;
    for (const variant of ["card", "hero"] as const) {
      const dimensions = COACH_BANNER_VARIANTS[variant];
      const { data, info } = await source
        .clone()
        .rotate()
        .resize(dimensions.width, dimensions.height, {
          fit: "cover",
          position: "centre",
        })
        .flatten({ background: "#f3f1ec" })
        .webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (
        info.width !== dimensions.width ||
        info.height !== dimensions.height ||
        data.byteLength > dimensions.maxBytes
      )
        throw new InvalidCoachBannerError();
      normalized[variant] = new Uint8Array(data);
    }
    return Object.freeze(normalized);
  } catch (error) {
    if (error instanceof InvalidCoachBannerError) throw error;
    throw new InvalidCoachBannerError();
  }
}
