import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { eventBannerSnapshot } from "@/domain/event-banners";
import { requestEventBanner } from "@/features/coach-events/banner-client";
import { EventBannerEditor } from "@/features/coach-events/banner-editor";
const id = "93570000-0000-4000-8000-000000000001";
const banner = eventBannerSnapshot(id, 7, true, true);

test("event banner client sends original bounded sources and the independent media revision, with no automatic retry", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "banner.png", {
    type: "image/png",
  });
  const calls: RequestInit[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, `/api/coach/events/${id}/banner`);
    calls.push(init!);
    return Response.json({ status: "saved", eventBanner: banner });
  };
  assert.equal(
    (
      await requestEventBanner(
        id,
        { method: "POST", revision: 6, file },
        fetcher,
      )
    ).status,
    "saved",
  );
  assert.equal(calls[0].body, file);
  assert.equal(calls[0].cache, "no-store");
  assert.deepEqual(calls[0].headers, {
    "if-match": '"6"',
    "content-type": "image/png",
  });
  await requestEventBanner(id, { method: "DELETE", revision: 7 }, fetcher);
  assert.equal(calls[1].method, "DELETE");
  assert.equal(calls[1].body, undefined);
  assert.deepEqual(calls[1].headers, { "if-match": '"7"' });
  let attempts = 0;
  const missing = await requestEventBanner(
    id,
    { method: "POST", revision: 7, file },
    async () => {
      attempts++;
      throw new Error("lost acknowledgement");
    },
  );
  assert.equal(missing.status, "unavailable");
  assert.equal(attempts, 1);
});

test("foreign, malformed and mismatched acknowledgements never appear as a saved image", async () => {
  const file = new File(["x"], "a.png", { type: "image/png" });
  const foreign = eventBannerSnapshot(
    "93570000-0000-4000-8000-000000000002",
    8,
    true,
    true,
  );
  for (const [body, status] of [
    [{ status: "saved", eventBanner: foreign }, 200],
    [{ status: "saved", eventBanner: banner }, 503],
    [{ status: "ready", eventBanner: banner }, 200],
    [{ status: "saved", eventBanner: { ...banner, rawPath: "private" } }, 200],
  ] as const) {
    assert.equal(
      (
        await requestEventBanner(
          id,
          { method: "POST", revision: 7, file },
          async () => Response.json(body, { status }),
        )
      ).status,
      "unavailable",
    );
  }
  assert.equal(
    (
      await requestEventBanner(id, { method: "GET" }, async () =>
        Response.json({ status: "conflict" }, { status: 409 }),
      )
    ).status,
    "conflict",
  );
  assert.equal(
    (
      await requestEventBanner(id, { method: "GET" }, async () =>
        Response.json({ status: "ready", eventBanner: banner }),
      )
    ).status,
    "ready",
  );
  let sent = false;
  for (const file of [
    new File(["x"], "bad.svg", { type: "image/svg+xml" }),
    new File([], "empty.png", { type: "image/png" }),
    new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", {
      type: "image/png",
    }),
  ]) {
    assert.equal(
      (
        await requestEventBanner(
          id,
          { method: "POST", revision: 7, file },
          async () => {
            sent = true;
            throw new Error();
          },
        )
      ).status,
      "invalid",
    );
  }
  assert.equal(sent, false);
});

test("saved-session banner controls respect read-only state and remain outside session-term forms", () => {
  const ready = renderToStaticMarkup(
    createElement(EventBannerEditor, {
      eventId: id,
      initial: { status: "ready", eventBanner: banner },
    }),
  );
  assert.match(ready, /Replace event banner \(saves immediately\)/);
  assert.match(ready, /Remove event banner/);
  assert.doesNotMatch(ready, /<form/);
  const closed = renderToStaticMarkup(
    createElement(EventBannerEditor, {
      eventId: id,
      initial: { status: "ready", eventBanner: { ...banner, editable: false } },
    }),
  );
  assert.match(closed, /read-only/);
  assert.doesNotMatch(closed, /type="file"|Remove event banner/);
  const unavailable = renderToStaticMarkup(
    createElement(EventBannerEditor, {
      eventId: id,
      initial: { status: "unavailable" },
    }),
  );
  assert.match(unavailable, /Load latest banner/);
  assert.doesNotMatch(unavailable, /type="file"/);
});
