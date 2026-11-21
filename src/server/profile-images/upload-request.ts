import "server-only";
import {
  isPreparedProfileImageType,
  PROFILE_IMAGE_MAX_PREPARED_BYTES,
} from "@/profile-images/contracts";

/** Validate untrusted transport before mutation work; never buffer an unbounded body. */
export async function readPreparedProfileImage(
  request: Request,
  siteUrl: string | undefined,
): Promise<Uint8Array | null> {
  const mime = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  const declared = request.headers.get("content-length");
  if (
    !siteUrl ||
    request.headers.get("origin") !== siteUrl ||
    !isPreparedProfileImageType(mime) ||
    (declared !== null &&
      (!/^\d+$/.test(declared) ||
        Number(declared) < 1 ||
        Number(declared) > PROFILE_IMAGE_MAX_PREPARED_BYTES))
  )
    return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > PROFILE_IMAGE_MAX_PREPARED_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    if (length === 0) return null;
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  } finally {
    reader.releaseLock();
  }
}
