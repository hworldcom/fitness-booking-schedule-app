import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  BOOKING_EVENTS,
  bookingNotificationHref,
  parseBookingNotification,
  type BookingNotification,
} from "@/notifications/bookings";
import {
  parseNotificationPage,
  notificationHref,
} from "@/notifications/contracts";
const event: BookingNotification = {
  kind: "booking",
  event: "requested",
  sourceKind: "request",
  sourceId: randomUUID(),
  slotId: randomUUID(),
  recipientRole: "coach",
  startsAt: "2026-10-26T09:00:00.000Z",
  endsAt: "2026-10-26T10:00:00.000Z",
  venueName: "Berlin studio",
};
test("booking history has coach-only typed metadata and safe existing workspace destinations", () => {
  const identity = {
    id: randomUUID(),
    createdAt: "2026-10-23T09:00:00.000Z",
    readAt: null,
  };
  const parsed = parseNotificationPage({
    items: [
      {
        ...event,
        ...identity,
        body: "PRIVATE",
        email: "PRIVATE",
        href: "https://evil.test",
      },
    ],
    unreadCount: 1,
    hasMore: false,
    snapshotAt: identity.createdAt,
  });
  assert.ok(!JSON.stringify(parsed).includes("PRIVATE"));
  assert.ok(!JSON.stringify(parsed).includes("evil.test"));
  assert.equal(
    notificationHref(parsed.items[0]),
    `/coach?view=bookings&section=requests&occurrence=${event.slotId}#coach-occurrence-${event.slotId}`,
  );
  assert.throws(() =>
    parseNotificationPage({
      items: [{ ...event, ...identity, recipientRole: "athlete" }],
      unreadCount: 1,
      hasMore: false,
      snapshotAt: identity.createdAt,
    }),
  );
  for (const key of ["confirmed", "cancelled", "changed"] as const) {
    const page = parseNotificationPage({
      items: [
        {
          ...event,
          ...identity,
          event: key,
          sourceKind: "booking",
          recipientRole: "athlete",
        },
      ],
      unreadCount: 1,
      hasMore: false,
      snapshotAt: identity.createdAt,
    });
    assert.equal(page.items[0].kind, "booking");
    assert.equal(
      notificationHref(page.items[0]),
      `/sessions#athlete-booking-${event.sourceId}`,
    );
  }
  assert.equal(
    bookingNotificationHref({ ...event, recipientRole: "athlete" }),
    "/sessions#booking-requests",
  );
  assert.equal(
    bookingNotificationHref({
      ...event,
      event: "changed",
      sourceKind: "booking",
    }),
    `/coach?view=bookings#coach-booking-${event.sourceId}`,
  );
  for (const patch of [
    { event: "constructor" },
    { sourceId: "//evil.test" },
    { slotId: "../secret" },
    { event: "confirmed" },
    { endsAt: event.startsAt },
    { startsAt: "invalid" },
    { venueName: "a\r\nb" },
    { recipientRole: "operator" },
  ])
    assert.throws(() => parseBookingNotification({ ...event, ...patch }));
  for (const key of Object.keys(BOOKING_EVENTS)) {
    const sourceKind = ["confirmed", "changed", "cancelled"].includes(key)
      ? "booking"
      : "request";
    assert.ok(parseBookingNotification({ ...event, event: key, sourceKind }));
  }
});
