import assert from "node:assert/strict";
import test from "node:test";
import {
  eventBannerSnapshot,
  eventBannerUrl,
  isEventBannerResult,
} from "@/domain/event-banners";
import {
  readCurrentCoachBanner,
  storeAndAttachCoachBanner,
} from "@/server/coaches/banner-workflow";
import type { ProfileImageStorage } from "@/server/storage/contracts";
import { POST, DELETE } from "@/app/api/coach/events/[id]/banner/route";
import { GET as publicBytes } from "@/app/api/events/[slug]/banner/[variant]/route";
const id = "93560000-0000-4000-8000-000000000001";

test("event banner snapshots expose versioned routes, never private storage references or altered identities", () => {
  const eventBanner = eventBannerSnapshot(id, 3, true, true);
  assert.ok(isEventBannerResult({ status: "ready", eventBanner }));
  assert.equal(
    eventBanner.banner?.card.url,
    `/api/coach/events/${id}/banner/card?v=3`,
  );
  assert.equal(
    eventBannerUrl(id, "card", 3, true),
    "/api/events/group-93560000000040008000000000000001/banner/card?v=3",
  );
  for (const changed of [
    { ...eventBanner, revision: -1 },
    { ...eventBanner, eventId: "../other" },
    { ...eventBanner, storagePath: "private/object.webp" },
    {
      ...eventBanner,
      banner: {
        ...eventBanner.banner,
        card: { ...eventBanner.banner!.card, url: "/api/profile/avatar" },
      },
    },
  ])
    assert.equal(
      isEventBannerResult({ status: "saved", eventBanner: changed }),
      false,
    );
  assert.ok(
    isEventBannerResult({
      status: "ready",
      eventBanner: eventBannerSnapshot(id, 0, false, false),
    }),
  );
  assert.equal(
    isEventBannerResult({ status: "forbidden", eventBanner }),
    false,
  );
});

test("event uploads and cleanup use their separate bucket scope, including partial failures and actor/reference races", async () => {
  for (const fail of [false, true]) {
    const calls: { kind: string; scope: string; path: string }[] = [];
    let count = 0,
      attached = false;
    const storage: ProfileImageStorage = {
      upload: async (o) => {
        calls.push({ kind: "upload", ...o });
        return { status: fail && ++count === 2 ? "unavailable" : "ready" };
      },
      remove: async (o) => {
        calls.push({ kind: "remove", ...o });
        return { status: "ready" };
      },
      download: async () => ({ status: "unavailable" }),
      publicPortraitUrl: () => null,
    };
    const result = await storeAndAttachCoachBanner(
      storage,
      [
        { path: "card", bytes: new Uint8Array([1]) },
        { path: "hero", bytes: new Uint8Array([2]) },
      ],
      async () => {
        attached = true;
        return {
          status: "saved",
          value: 42,
          previousPaths: ["old-card", "old-hero"],
        };
      },
      "event-banner",
    );
    assert.equal(attached, !fail);
    assert.equal(result.status, fail ? "unavailable" : "saved");
    assert.ok(calls.every((x) => x.scope === "event-banner"));
    assert.deepEqual(
      calls.filter((x) => x.kind === "remove").map((x) => x.path),
      fail ? ["card", "hero"] : ["old-card", "old-hero"],
    );
  }
  let checks = 0;
  let scope = "";
  const result = await readCurrentCoachBanner(
    2,
    async () =>
      ++checks === 1
        ? { status: "ready", revision: 2, path: "old" }
        : { status: "not-found" },
    {
      download: async (o) => {
        scope = o.scope;
        return { status: "ready", bytes: new Uint8Array([9]) };
      },
    },
    "event-banner",
  );
  assert.equal(scope, "event-banner");
  assert.equal(result.status, "not-found");
  assert.equal("bytes" in result, false);
});

test("event upload endpoints reject invalid IDs, origins, revisions, source types and bodies before owner access", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  const context = { params: Promise.resolve({ id }) };
  for (const extra of [
    {
      origin: "https://forged.test",
      "if-match": '"0"',
      "content-type": "image/png",
    },
    {
      origin: "http://localhost:3100",
      "if-match": "*",
      "content-type": "image/png",
    },
    {
      origin: "http://localhost:3100",
      "if-match": '"0"',
      "content-type": "image/svg+xml",
    },
  ]) {
    const response = await POST(
      new Request(`http://localhost:3100/api/coach/events/${id}/banner`, {
        method: "POST",
        headers: extra,
        body: new Uint8Array([1, 2]),
      }),
      context,
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { status: "invalid" });
  }
  const response = await DELETE(
    new Request("http://localhost:3100/api/coach/events/bad/banner", {
      method: "DELETE",
      headers: { origin: "http://localhost:3100", "if-match": '"0"' },
    }),
    { params: Promise.resolve({ id: "bad" }) },
  );
  assert.equal(response.status, 400);
  const missing = await publicBytes(
    new Request("http://localhost:3100/api/events/missing/banner/card?v=1"),
    { params: Promise.resolve({ slug: "missing", variant: "card" }) },
  );
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), "private, no-store");
  assert.equal(missing.headers.get("x-content-type-options"), "nosniff");
  const huge = await POST(
    new Request(`http://localhost:3100/api/coach/events/${id}/banner`, {
      method: "POST",
      headers: {
        origin: "http://localhost:3100",
        "if-match": '"0"',
        "content-type": "image/png",
      },
      body: new Uint8Array(4 * 1024 * 1024 + 1),
    }),
    context,
  );
  assert.equal(huge.status, 400);
});
