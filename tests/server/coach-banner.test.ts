import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  normalizeCoachBanner,
  InvalidCoachBannerError,
} from "@/server/coaches/banner-normalization";
import {
  storeAndAttachCoachBanner,
  readCurrentCoachBanner,
} from "@/server/coaches/banner-workflow";
import type { ProfileImageStorage } from "@/server/storage/contracts";

test("real banner variants rotate/crop/re-encode and strip private metadata", async () => {
  const source = await sharp({
    create: {
      width: 1800,
      height: 1000,
      channels: 4,
      background: { r: 30, g: 70, b: 90, alpha: 0.7 },
    },
  })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Artist: "Private Artist", Copyright: "Private source" } },
    })
    .toBuffer();
  const variants = await normalizeCoachBanner(source);
  for (const [key, bytes] of Object.entries(variants)) {
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, key === "card" ? 800 : 1600);
    assert.equal(metadata.height, key === "card" ? 300 : 600);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.equal(metadata.hasAlpha, false);
    assert.ok(bytes.byteLength <= (key === "card" ? 393216 : 1048576));
  }
  const png = await sharp({
    create: { width: 800, height: 300, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  assert.ok((await normalizeCoachBanner(png)).hero.byteLength);
  const webp = await sharp(png).webp().toBuffer();
  assert.ok((await normalizeCoachBanner(webp)).card.byteLength);
});

test("malformed, oversized, tiny, animated and excessive-pixel banners are rejected", async () => {
  const oversizedPixels = await sharp({
    create: { width: 6000, height: 4100, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const tiny = await sharp({
    create: { width: 319, height: 120, channels: 3, background: "white" },
  })
    .webp()
    .toBuffer();
  const animation = await sharp(
    Buffer.concat([
      Buffer.alloc(800 * 300 * 3, 40),
      Buffer.alloc(800 * 300 * 3, 180),
    ]),
    { raw: { width: 800, height: 600, channels: 3, pageHeight: 300 } },
  )
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(animation).metadata()).pages, 2);
  for (const bytes of [
    new Uint8Array(),
    new Uint8Array([1, 2, 3]),
    new Uint8Array(4 * 1024 * 1024 + 1),
    Buffer.from('<svg width="800" height="300"></svg>'),
    tiny,
    oversizedPixels,
    animation,
  ]) {
    await assert.rejects(normalizeCoachBanner(bytes), InvalidCoachBannerError);
  }
});

function storage(
  events: string[],
  failUploadAt = 0,
  cleanupFails = false,
): ProfileImageStorage {
  let uploads = 0;
  return {
    upload: async (object) => {
      events.push("upload:" + object.path);
      return { status: ++uploads === failUploadAt ? "unavailable" : "ready" };
    },
    remove: async (object) => {
      events.push("remove:" + object.path);
      return { status: cleanupFails ? "unavailable" : "ready" };
    },
    download: async () => ({ status: "unavailable" }),
    publicPortraitUrl: () => null,
  };
}
const variants = [
  { path: "new-card", bytes: new Uint8Array([1]) },
  { path: "new-hero", bytes: new Uint8Array([2]) },
];
test("a banner hidden, replaced or revoked during download never returns downloaded bytes", async () => {
  const original = { status: "ready" as const, path: "current", revision: 3 };
  for (const after of [
    { status: "not-found" as const },
    { status: "forbidden" as const },
    { ...original, revision: 4 },
    { ...original, path: "replacement" },
  ]) {
    let reads = 0;
    const result = await readCurrentCoachBanner(
      3,
      async () => (++reads === 1 ? original : after),
      {
        download: async () => ({
          status: "ready",
          bytes: new Uint8Array([7, 8, 9]),
        }),
      },
    );
    assert.notEqual(result.status, "ready");
    assert.equal("bytes" in result, false);
  }
  let downloaded = false;
  assert.deepEqual(
    await readCurrentCoachBanner(2, async () => original, {
      download: async () => {
        downloaded = true;
        return { status: "unavailable" };
      },
    }),
    { status: "not-found" },
  );
  assert.equal(downloaded, false);
});
test("partial upload never attaches and all new objects are safely retired", async () => {
  const events: string[] = [];
  const result = await storeAndAttachCoachBanner(
    storage(events, 2),
    variants,
    async () => {
      throw Error("Must not attach");
    },
  );
  assert.deepEqual(result, { status: "unavailable" });
  assert.deepEqual(events, [
    "upload:new-card",
    "upload:new-hero",
    "remove:new-card",
    "remove:new-hero",
  ]);
});
test("conflict/lost authority/unknown attachment clean only new objects; failed old cleanup preserves success", async () => {
  for (const status of ["conflict", "forbidden", "unavailable"] as const) {
    const events: string[] = [];
    assert.deepEqual(
      await storeAndAttachCoachBanner(storage(events), variants, async () => ({
        status,
      })),
      { status },
    );
    assert.deepEqual(events.slice(-2), ["remove:new-card", "remove:new-hero"]);
  }
  const events: string[] = [];
  const result = await storeAndAttachCoachBanner(
    storage(events, 0, true),
    variants,
    async () => {
      events.push("attach");
      return {
        status: "saved",
        value: "new-reference",
        previousPaths: ["old-card", "old-hero"],
      };
    },
  );
  assert.deepEqual(result, {
    status: "saved",
    value: "new-reference",
    cleanupPending: true,
  });
  assert.deepEqual(events, [
    "upload:new-card",
    "upload:new-hero",
    "attach",
    "remove:old-card",
    "remove:old-hero",
  ]);
});
