import assert from "node:assert/strict";
import test from "node:test";
import { readPreparedProfileImage } from "@/server/profile-images/upload-request";
import { PROFILE_IMAGE_MAX_PREPARED_BYTES } from "@/profile-images/contracts";
import { POST as avatarPOST } from "@/app/api/profile/avatar/route";
import { POST as portraitPOST } from "@/app/api/coach/portrait/route";
const site = "http://localhost:3100";
const request = (
  type = "image/jpeg",
  body: BodyInit = new Uint8Array([1, 2, 3]),
  headers: Record<string, string> = {},
) =>
  new Request(site + "/api/profile/avatar", {
    method: "POST",
    headers: { origin: site, "content-type": type, ...headers },
    body,
  });
test("prepared transport accepts bounded JPEG/PNG/WebP and normalized MIME parameters", async () => {
  for (const type of [
    "image/jpeg",
    "image/png",
    "image/webp",
    "IMAGE/JPEG; charset=binary",
  ]) {
    assert.deepEqual(
      await readPreparedProfileImage(request(type), site),
      new Uint8Array([1, 2, 3]),
    );
  }
});
test("foreign, unconfigured, unsupported, empty and invalid declared sizes fail closed", async () => {
  for (const r of [
    request("image/svg+xml"),
    request("image/gif"),
    request("image/jpeg", new Uint8Array()),
    request("image/jpeg", undefined, { origin: "https://foreign.invalid" }),
    ...[
      "0",
      "-1",
      "NaN",
      "1.2",
      String(PROFILE_IMAGE_MAX_PREPARED_BYTES + 1),
    ].map((n) => request("image/jpeg", undefined, { "content-length": n })),
  ])
    assert.equal(await readPreparedProfileImage(r, site), null);
  assert.equal(await readPreparedProfileImage(request(), undefined), null);
});
test("chunked overflow is cancelled without consuming the remaining body", async () => {
  let cancelled = false,
    pulls = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        pulls++;
        c.enqueue(new Uint8Array(128 * 1024));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const r = new Request(site, {
    method: "POST",
    headers: { origin: site, "content-type": "image/png" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  assert.equal(await readPreparedProfileImage(r, site), null);
  assert.equal(cancelled, true);
  assert.equal(pulls, 5);
});
test("both actual upload routes reject invalid transport before mutation services", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = site;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-public-key";
  for (const POST of [avatarPOST, portraitPOST])
    for (const r of [
      request("image/svg+xml"),
      request("image/jpeg", new Uint8Array()),
      request(
        "image/jpeg",
        new Uint8Array(PROFILE_IMAGE_MAX_PREPARED_BYTES + 1),
      ),
      request("image/png", undefined, { origin: "https://foreign.invalid" }),
    ]) {
      const response = await POST(r);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        status: "invalid",
        imageUrl: null,
      });
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
});
