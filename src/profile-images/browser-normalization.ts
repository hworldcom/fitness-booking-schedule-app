import {
  PROFILE_IMAGE_DIMENSION,
  PROFILE_IMAGE_MAX_CANONICAL_BYTES,
  PROFILE_IMAGE_MAX_SOURCE_BYTES,
  PROFILE_IMAGE_MIME_TYPE,
  PROFILE_IMAGE_WEBP_QUALITY,
} from "./contracts";

const ACCEPTED_SOURCE_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export class BrowserProfileImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserProfileImageError";
  }
}

export function validateProfileImageSource(file: Pick<File, "size" | "type">) {
  if (!ACCEPTED_SOURCE_TYPES.includes(file.type)) {
    return "Choose a JPEG, PNG or WebP image.";
  }
  if (file.size <= 0 || file.size > PROFILE_IMAGE_MAX_SOURCE_BYTES) {
    return "Choose an image no larger than 8 MB.";
  }
  return null;
}

function canvasWebp(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new BrowserProfileImageError(
              "This browser could not prepare the image as WebP.",
            ),
          );
          return;
        }
        resolve(blob);
      },
      PROFILE_IMAGE_MIME_TYPE,
      PROFILE_IMAGE_WEBP_QUALITY / 100,
    );
  });
}

export async function normalizeProfileImageInBrowser(file: File) {
  const validationError = validateProfileImageSource(file);
  if (validationError) throw new BrowserProfileImageError(validationError);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new BrowserProfileImageError(
      "This image could not be decoded. Choose a different file.",
    );
  }

  try {
    if (bitmap.width < 1 || bitmap.height < 1) {
      throw new BrowserProfileImageError("This image has invalid dimensions.");
    }
    const cropSize = Math.min(bitmap.width, bitmap.height);
    const sourceX = Math.floor((bitmap.width - cropSize) / 2);
    const sourceY = Math.floor((bitmap.height - cropSize) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = PROFILE_IMAGE_DIMENSION;
    canvas.height = PROFILE_IMAGE_DIMENSION;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new BrowserProfileImageError(
        "This browser could not prepare the image.",
      );
    }
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      PROFILE_IMAGE_DIMENSION,
      PROFILE_IMAGE_DIMENSION,
    );
    const result = await canvasWebp(canvas);
    if (
      result.type !== PROFILE_IMAGE_MIME_TYPE ||
      result.size > PROFILE_IMAGE_MAX_CANONICAL_BYTES
    ) {
      throw new BrowserProfileImageError(
        "The prepared image is still too large. Choose a simpler image.",
      );
    }
    return result;
  } finally {
    bitmap.close();
  }
}
