import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  parseGroupNotification,
  groupNotificationHref,
  groupNotificationExplanation,
  type GroupNotification,
} from "@/notifications/groups";
import { parseNotificationPage } from "@/notifications/contracts";
const notice: GroupNotification = {
  kind: "group",
  event: "confirmed",
  sessionId: randomUUID(),
  recipientRole: "athlete",
  title: "<Group> & practice",
  startsAt: "2026-10-29T17:00:00.000Z",
  endsAt: "2026-10-29T18:00:00.000Z",
  venueName: "Berlin & studio",
  eventStatus: "confirmed",
  participationStatus: "pending",
  affectedCount: null,
};
test("group events preserve separate participation state, private role and allowlisted destinations", () => {
  assert.equal(parseGroupNotification(notice).participationStatus, "pending");
  assert.match(
    groupNotificationExplanation(notice),
    /still awaiting coach approval/,
  );
  assert.equal(
    groupNotificationHref(notice),
    `/events/group-${notice.sessionId.replaceAll("-", "")}`,
  );
  const coach = {
    ...notice,
    recipientRole: "coach" as const,
    participationStatus: null,
    affectedCount: 2,
  };
  assert.equal(
    groupNotificationHref(coach),
    `/coach/events/${notice.sessionId}`,
  );
  assert.match(groupNotificationExplanation(coach), /2 athletes affected/);
  assert.equal(
    parseNotificationPage({
      items: [
        {
          ...coach,
          id: randomUUID(),
          createdAt: notice.startsAt,
          readAt: null,
        },
      ],
      unreadCount: 1,
      hasMore: false,
      snapshotAt: notice.endsAt,
    }).items[0].kind,
    "group",
  );
  assert.throws(() =>
    parseNotificationPage({
      items: [
        {
          ...notice,
          id: randomUUID(),
          createdAt: notice.startsAt,
          readAt: null,
        },
      ],
      unreadCount: 1,
      hasMore: false,
      snapshotAt: notice.endsAt,
    }),
  );
});
test("invalid group authority, source/state combinations and counts fail closed", () => {
  for (const patch of [
    { sessionId: "javascript:bad" },
    { event: "changed" },
    { eventStatus: "open" },
    { participationStatus: "declined" },
    { affectedCount: 2 },
    { title: "x\r\nTo: other@example.test" },
    { recipientRole: "coach", participationStatus: null, affectedCount: 101 },
  ])
    assert.throws(() => parseGroupNotification({ ...notice, ...patch }));
});
