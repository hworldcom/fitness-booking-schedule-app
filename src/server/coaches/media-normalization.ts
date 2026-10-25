import "server-only";
import sharp from "sharp";
import {
  COACH_MEDIA_PHOTO_BYTES,
  COACH_MEDIA_VARIANTS,
} from "@/domain/coach-media";

export class InvalidCoachMediaPhoto extends Error {}
export async function normalizeCoachMediaPhoto(input: Uint8Array) {
  if (input.byteLength < 1 || input.byteLength > COACH_MEDIA_PHOTO_BYTES)
    throw new InvalidCoachMediaPhoto();
  try {
    const source = sharp(input, {
      animated: false,
      failOn: "warning",
      limitInputPixels: 24_000_000,
    });
    const meta = await source.metadata();
    if (
      !meta.format ||
      !["jpeg", "png", "webp"].includes(meta.format) ||
      !meta.width ||
      !meta.height ||
      meta.width > 8192 ||
      meta.height > 8192 ||
      meta.width < 24 ||
      meta.height < 24 ||
      (meta.pages ?? 1) !== 1
    )
      throw new InvalidCoachMediaPhoto();
    const normalize = async (variant: keyof typeof COACH_MEDIA_VARIANTS) => {
      const settings = COACH_MEDIA_VARIANTS[variant];
      const { data, info } = await source
        .clone()
        .rotate()
        .resize({
          width: settings.edge,
          height: settings.edge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (data.byteLength > settings.maxBytes)
        throw new InvalidCoachMediaPhoto();
      return {
        bytes: new Uint8Array(data),
        width: info.width,
        height: info.height,
      };
    };
    // Decode one variant at a time to bound peak memory for large sources.
    const thumbnail = await normalize("thumbnail"),
      full = await normalize("full");
    return { thumbnail, full };
  } catch {
    throw new InvalidCoachMediaPhoto();
  }
}
