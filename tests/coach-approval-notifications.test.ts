import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  parseNotificationPage,
  notificationHref,
} from "@/notifications/contracts";
const at = "2026-10-30T12:00:00.000Z";
test("approval bell whitelists a past event and uses only the private owner destination", () => {
  const item = {
    id: randomUUID(),
    kind: "coach-approval",
    event: "approved",
    displayName: "Coach",
    approvedAt: at,
    createdAt: at,
    readAt: null,
    reason: "PRIVATE",
    reviewerReference: "PRIVATE",
    email: "private@example.test",
    href: "https://evil.test",
  };
  const page = parseNotificationPage({
    items: [item],
    unreadCount: 1,
    hasMore: false,
    snapshotAt: at,
  });
  assert.doesNotMatch(JSON.stringify(page), /PRIVATE|private@|evil/);
  assert.equal(notificationHref(page.items[0]), "/profile/coach");
  for (const patch of [
    { event: "suspended" },
    { displayName: "Coach\nHeader" },
    { approvedAt: "tomorrow" },
    { createdAt: "2026-10-30T12:01:00Z" },
  ])
    assert.throws(() =>
      parseNotificationPage({
        items: [{ ...item, ...patch }],
        unreadCount: 1,
        hasMore: false,
        snapshotAt: at,
      }),
    );
});
