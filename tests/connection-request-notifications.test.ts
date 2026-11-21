import assert from "node:assert/strict";
import test from "node:test";
import {
  notificationHref,
  parseNotificationPage,
} from "@/notifications/contracts";
import { notificationList, notificationWrite } from "@/notifications/client";

const id = "25300000-0000-4000-8000-000000000001";
const at = "2026-11-21T12:00:00.000Z";
const notice = {
  id,
  kind: "connection-request",
  requestId: id,
  senderName: "Coach Mas",
  recipientRole: "athlete",
  createdAt: at,
  readAt: null,
};
const page = (item: object) => ({
  items: [item],
  unreadCount: 1,
  hasMore: false,
  snapshotAt: at,
});

test("connection request notices whitelist private metadata and use the recipient's requests tab", () => {
  for (const recipientRole of ["coach", "athlete"] as const) {
    const parsed = parseNotificationPage(
      page({
        ...notice,
        recipientRole,
        email: "private@example.test",
        bookingId: id,
        body: "PRIVATE",
        href: "https://foreign.invalid",
      }),
    );
    assert.deepEqual(parsed.items, [{ ...notice, recipientRole }]);
    assert.equal(
      notificationHref(parsed.items[0]),
      recipientRole === "coach"
        ? "/coach/athletes?section=requests"
        : "/my-coaches?section=requests",
    );
  }
});

test("malformed connection identities, recipients, names and read states fail closed", () => {
  for (const invalid of [
    { requestId: "../other" },
    { requestId: null },
    { senderName: "" },
    { senderName: "\nprivate" },
    { senderName: "x".repeat(81) },
    { recipientRole: "sender" },
    { recipientRole: "admin" },
    { readAt: "invalid" },
    { createdAt: "invalid" },
    { id: "invalid" },
  ])
    assert.throws(() => parseNotificationPage(page({ ...notice, ...invalid })));
});

test("bell reads and explicit writes opt into version6 without caller-chosen recipients", async (t) => {
  const original = globalThis.fetch;
  const requests: RequestInit[] = [];
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async (_url, init) => {
    requests.push(init!);
    return Response.json({
      status: "ready",
      value: init?.method === "POST" ? {} : page(notice),
    });
  };
  const signal = new AbortController().signal;
  assert.equal(
    (await notificationList({}, signal)).items[0].kind,
    "connection-request",
  );
  await notificationWrite({ action: "read", args: { id } }, signal);
  for (const request of requests) {
    assert.equal(
      new Headers(request.headers).get("x-movx-notification-version"),
      "6",
    );
    assert.equal(request.credentials, "same-origin");
  }
  assert.deepEqual(JSON.parse(String(requests[1].body)), {
    action: "read",
    args: { id },
  });
});
