import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProfileImageInBrowser } from "@/profile-images/browser-normalization";
import { PROFILE_IMAGE_MAX_PREPARED_BYTES } from "@/profile-images/contracts";

async function browser(
  encode: (type: string) => Blob | null,
  work: (closed: () => number) => Promise<void>,
) {
  const keys = ["document", "createImageBitmap"] as const;
  const original = keys.map((k) =>
    Object.getOwnPropertyDescriptor(globalThis, k),
  );
  let closes = 0;
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: async () => ({
      width: 800,
      height: 600,
      close() {
        closes++;
      },
    }),
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement() {
        return {
          getContext() {
            return { drawImage() {} };
          },
          toBlob(callback: (blob: Blob | null) => void, type: string) {
            callback(encode(type));
          },
        };
      },
    },
  });
  try {
    await work(() => closes);
  } finally {
    keys.forEach((k, i) => {
      if (original[i]) Object.defineProperty(globalThis, k, original[i]!);
      else Reflect.deleteProperty(globalThis, k);
    });
  }
}
const source = () =>
  new File([new Uint8Array([1, 2, 3])], "small.png", { type: "image/png" });
const encoded = (type: string, size = 50) =>
  new Blob([new Uint8Array(size)], { type });
test("a PNG fallback to a WebP request uses a supported JPEG encoder", async () => {
  const tried: string[] = [];
  await browser(
    (type) => {
      tried.push(type);
      return encoded(type === "image/webp" ? "image/png" : type);
    },
    async (closed) => {
      const result = await normalizeProfileImageInBrowser(source());
      assert.equal(result.type, "image/jpeg");
      assert.equal(result.size, 50);
      assert.deepEqual(tried, ["image/webp", "image/jpeg"]);
      assert.equal(closed(), 1);
    },
  );
});
test("WebP remains preferred and a PNG-only browser is supported", async () => {
  await browser(
    (type) => encoded(type),
    async () =>
      assert.equal(
        (await normalizeProfileImageInBrowser(source())).type,
        "image/webp",
      ),
  );
  await browser(
    () => encoded("image/png"),
    async () =>
      assert.equal(
        (await normalizeProfileImageInBrowser(source())).type,
        "image/png",
      ),
  );
});
test("encoder failures and unexpected/empty formats never report a size error", async () => {
  for (const encode of [
    () => null,
    () => encoded("image/gif"),
    (type: string) => encoded(type, 0),
    () => {
      throw Error("encoder unavailable");
    },
  ]) {
    await browser(encode, async (closed) => {
      await assert.rejects(
        normalizeProfileImageInBrowser(source()),
        /Your browser could not prepare this image/,
      );
      assert.equal(closed(), 1);
    });
  }
});
test("only genuinely oversized prepared results receive the size message", async () => {
  await browser(
    (type) => encoded(type, PROFILE_IMAGE_MAX_PREPARED_BYTES + 1),
    async (closed) => {
      await assert.rejects(
        normalizeProfileImageInBrowser(source()),
        /prepared image exceeds 512 KB/,
      );
      assert.equal(closed(), 1);
    },
  );
  await browser(
    (type) => encoded(type, PROFILE_IMAGE_MAX_PREPARED_BYTES),
    async () =>
      assert.equal(
        (await normalizeProfileImageInBrowser(source())).size,
        PROFILE_IMAGE_MAX_PREPARED_BYTES,
      ),
  );
});
