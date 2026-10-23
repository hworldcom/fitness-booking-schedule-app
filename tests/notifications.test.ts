import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NotificationBell } from "@/components/notification-bell";
import {
  notificationHref,
  parseNotificationPage,
  validNotificationCommand,
} from "@/notifications/contracts";
import type { ActorSnapshot } from "@/auth/actor-contracts";
const id = "11111111-1111-4111-8111-111111111111";
const at = "2026-10-23T12:00:00.000Z";
test("notification commands reject caller-chosen recipients, unsafe IDs and incomplete cursors", () => {
  for (const value of [
    null,
    [],
    { action: "list", args: { recipientId: id } },
    { action: "list", args: { beforeAt: at } },
    { action: "read", args: { id: "../messages" } },
    { action: "read-all", args: { throughAt: "invalid" } },
    { action: "send", args: {} },
    { action: "read", args: { id, conversationId: id } },
  ])
    assert.equal(validNotificationCommand(value), false);
  for (const value of [
    { action: "list", args: {} },
    { action: "list", args: { filter: "unread", beforeAt: at, beforeId: id } },
    { action: "read", args: { id } },
    { action: "read-all", args: { throughAt: at } },
  ])
    assert.equal(validNotificationCommand(value), true);
});
test("notification responses whitelist metadata and bound pages/counts/destinations", () => {
  const page = {
    items: [
      {
        id,
        conversationId: id,
        senderName: "Coach",
        createdAt: at,
        readAt: null,
        body: "PRIVATE",
        email: "private@example.test",
      },
    ],
    unreadCount: 1,
    hasMore: false,
    snapshotAt: at,
  };
  assert.doesNotMatch(
    JSON.stringify(parseNotificationPage(page)),
    /PRIVATE|@example|body|email/,
  );
  assert.equal(notificationHref(page.items[0]), `/messages?conversation=${id}`);
  assert.throws(() => notificationHref({ conversationId: "//evil.test" }));
  for (const bad of [
    { ...page, unreadCount: -1 },
    { ...page, hasMore: "true" },
    { ...page, items: Array(21).fill(page.items[0]) },
    { ...page, items: [{ ...page.items[0], readAt: "not a date" }] },
  ])
    assert.throws(() => parseNotificationPage(bad));
});
test("private notification bell is present only for an authorized actor", () => {
  const authorized: ActorSnapshot = {
    status: "authorized",
    profile: {
      slug: "fixture",
      displayName: "Fixture",
      avatarUrl: null,
      coachPortraitUrl: null,
    },
    demoRun: { slug: "fixture", name: "Fixture" },
    role: "member",
    coachAccessStatus: "not-applied",
  };
  assert.match(
    renderToStaticMarkup(
      createElement(NotificationBell, { actor: authorized }),
    ),
    /Notifications, loading/,
  );
  for (const status of [
    "signed-out",
    "preview",
    "forbidden",
    "unavailable",
  ] as const)
    assert.equal(
      renderToStaticMarkup(
        createElement(NotificationBell, { actor: { status } }),
      ),
      "",
    );
});
