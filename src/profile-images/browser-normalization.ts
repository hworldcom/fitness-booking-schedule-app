import {
  PROFILE_IMAGE_DIMENSION,
  PROFILE_IMAGE_MAX_PREPARED_BYTES,
  PROFILE_IMAGE_PREPARED_MIME_TYPES,
  PROFILE_IMAGE_MAX_SOURCE_BYTES,
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
  if (file.size <= 0)
    return "This image file is empty. Choose a different image.";
  if (file.size > PROFILE_IMAGE_MAX_SOURCE_BYTES) {
    return "Choose an image no larger than 8 MB.";
  }
  return null;
}

async function prepareCanvasImage(canvas: HTMLCanvasElement) {
  let oversized = false;
  // Unsupported canvas encoders can silently return PNG. Try each supported
  // transport explicitly; the server validates and stores only canonical WebP.
  for (const type of PROFILE_IMAGE_PREPARED_MIME_TYPES) {
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob(resolve, type, PROFILE_IMAGE_WEBP_QUALITY / 100);
      } catch {
        resolve(null);
      }
    });
    if (!blob || blob.type !== type || blob.size === 0) continue;
    if (blob.size > PROFILE_IMAGE_MAX_PREPARED_BYTES) {
      oversized = true;
      continue;
    }
    return blob;
  }
  throw new BrowserProfileImageError(
    oversized
      ? "The prepared image exceeds 512 KB. Choose a smaller or less detailed photo."
      : "Your browser could not prepare this image. Try another browser or a different photo.",
  );
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
    return await prepareCanvasImage(canvas);
  } finally {
    bitmap.close();
  }
}
