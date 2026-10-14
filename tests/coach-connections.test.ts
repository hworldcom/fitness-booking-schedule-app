import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ConnectionHistoryReference,
  ConnectionProjection,
} from "@/domain/coach-athlete-connections";
import type { PrivateBookingProjection } from "@/domain/coach-bookings";
import {
  applyConnectionResult,
  coachConnectionSection,
  mergeConnectionRows,
  type CoachConnectionPages,
} from "@/features/coaches/coach-connections-model";
import { CoachAthleteConnections } from "@/features/coaches/coach-athlete-connections";
import { CoachConnectionHistory } from "@/features/coaches/coach-connection-history";
import { BookingConnectionOptions } from "@/features/coaches/booking-connection-options";

const id = (n: number) =>
  `9a222000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function connection(
  n = 1,
  patch: Partial<ConnectionProjection> = {},
): ConnectionProjection {
  return {
    id: id(n),
    pairId: id(100),
    attemptNumber: n,
    coachProfileId: id(101),
    athleteProfileId: id(102),
    senderProfileId: id(101),
    recipientProfileId: id(102),
    status: "pending",
    createdAt: "2026-10-14T10:00:00.123456+00:00",
    updatedAt: "2026-10-14T10:00:00.124Z",
    decidedAt: null,
    removedAt: null,
    coachDisplayName: "Test Coach",
    athleteDisplayName: "Amina Athlete",
    coachSlug: "test-coach",
    coachPublic: true,
    coachPortraitUrl: null,
    athleteAvatarUrl: null,
    canAccept: false,
    canDecline: false,
    canWithdraw: true,
    canDisconnect: false,
    ...patch,
  };
}
function pages(
  patch: Partial<CoachConnectionPages> = {},
): CoachConnectionPages {
  const empty = { items: [], nextCursor: null };
  return {
    accepted: empty,
    incoming: empty,
    outgoing: empty,
    history: empty,
    ...patch,
  };
}
const noop = () => {};
function markup(value: CoachConnectionPages, mayInitiate = true) {
  return renderToStaticMarkup(
    createElement(CoachAthleteConnections, {
      pages: value,
      busy: false,
      mayInitiate,
      onRefresh: noop,
      onPage: noop,
      onDecision: noop,
      onHistory: noop,
      renderHistory: () => null,
    }),
  );
}
const booking: PrivateBookingProjection = {
  id: id(200),
  slotId: id(201),
  coachProfileId: id(101),
  coachDisplayName: "Test Coach",
  coachSlug: "test-coach",
  coachPortraitUrl: null,
  clientProfileId: id(102),
  clientDisplayName: "Amina Athlete",
  clientAvatarUrl: null,
  status: "confirmed",
  scheduledStartAt: "2026-10-15T10:00:00Z",
  scheduledEndAt: "2026-10-15T11:00:00Z",
  coachTimezone: "Europe/Berlin",
  location: {
    trainingLocationId: id(203),
    name: "Studio",
    kind: "independent",
    gymName: null,
    publicLabel: "Berlin",
  },
  cancelledBy: null,
  cancelledAt: null,
  completedAt: null,
  createdAt: "2026-10-14T10:00:00Z",
};

test("connection consent sections follow recipient and terminal state, not the send button", () => {
  assert.equal(coachConnectionSection(connection()), "outgoing");
  assert.equal(
    coachConnectionSection(
      connection(1, { senderProfileId: id(102), recipientProfileId: id(101) }),
    ),
    "incoming",
  );
  assert.equal(
    coachConnectionSection(connection(1, { status: "accepted" })),
    "accepted",
  );
  for (const status of ["declined", "withdrawn", "removed"] as const)
    assert.equal(coachConnectionSection(connection(1, { status })), "history");
});

test("overlapping older pages preserve stable identities, server order and microsecond values", () => {
  const first = connection(1),
    second = connection(2),
    updated = { ...second, status: "removed" as const },
    third = connection(3);
  const rows = mergeConnectionRows([first, second], [updated, third]);
  assert.deepEqual(
    rows.map((row) => row.id),
    [first.id, second.id, third.id],
  );
  assert.equal(rows[1].status, "removed");
  assert.equal(rows[0].createdAt, "2026-10-14T10:00:00.123456+00:00");
  assert.equal(second.status, "pending");
});

test("removal and fresh consent discard stale active pair media without erasing attempts or a newer relationship", () => {
  const accepted = connection(1, {
    status: "accepted",
    athleteAvatarUrl: "/api/connections/old/athlete-avatar",
  });
  const historical = connection(2, { status: "declined" });
  const before = pages({
    accepted: { items: [accepted], nextCursor: null },
    history: { items: [historical], nextCursor: null },
  });
  const removed = applyConnectionResult(before, {
    ...accepted,
    status: "removed",
    athleteAvatarUrl: null,
  });
  assert.equal(removed.accepted?.items.length, 0);
  assert.deepEqual(
    removed.history?.items.map((row) => row.id),
    [accepted.id, historical.id],
  );
  const pending = connection(3);
  const fresh = applyConnectionResult(before, pending);
  assert.equal(fresh.accepted?.items.length, 0);
  assert.equal(fresh.outgoing?.items[0].id, pending.id);
  const reconnected = applyConnectionResult(fresh, {
    ...pending,
    status: "accepted",
    canWithdraw: false,
    canDisconnect: true,
  });
  const stale = applyConnectionResult(reconnected, {
    ...accepted,
    status: "removed",
    athleteAvatarUrl: null,
  });
  assert.equal(stale.accepted?.items[0].id, pending.id);
});

test("pending and terminal lists never render connection-derived avatar bytes", () => {
  const pending = connection(1, {
    athleteAvatarUrl: "/api/connections/private/athlete-avatar",
    canAccept: true,
    canDecline: true,
    canWithdraw: false,
  });
  const html = markup(
    pages({
      incoming: { items: [pending], nextCursor: null },
      history: {
        items: [
          connection(2, {
            status: "removed",
            athleteAvatarUrl: pending.athleteAvatarUrl,
            canWithdraw: false,
          }),
        ],
        nextCursor: null,
      },
    }),
  );
  assert.doesNotMatch(html, /private\/athlete-avatar/);
  assert.match(html, /Accept connection/);
  assert.match(html, /Decline connection/);
  assert.match(html, /No connected athletes yet/);
});

test("suspended presentation preserves resolution/history while suppressing new consent", () => {
  const incoming = connection(1, {
    recipientProfileId: id(101),
    senderProfileId: id(102),
    canAccept: true,
    canDecline: true,
    canWithdraw: false,
  });
  const accepted = connection(2, {
    status: "accepted",
    canWithdraw: false,
    canDisconnect: true,
    athleteAvatarUrl: "/api/connections/accepted/athlete-avatar",
  });
  const html = markup(
    pages({
      incoming: { items: [incoming], nextCursor: null },
      accepted: { items: [accepted], nextCursor: null },
      outgoing: { items: [connection(3)], nextCursor: null },
    }),
    false,
  );
  assert.doesNotMatch(html, /Accept connection/);
  for (const label of [
    "Decline connection",
    "Withdraw request",
    "Disconnect",
    "View shared history",
  ])
    assert.ok(html.includes(label));
  assert.doesNotMatch(html, /accepted\/athlete-avatar/);
  assert.match(html, /AA/);
  const options = renderToStaticMarkup(
    createElement(BookingConnectionOptions, {
      booking,
      context: { connection: null, canSend: true },
      error: null,
      busy: false,
      mayInitiate: false,
      onLoad: noop,
      onMutation: noop,
    }),
  );
  assert.doesNotMatch(options, /Send connection request/);
});

test("empty, unavailable and paged lists make no invented total or hidden identity claim", () => {
  const html = markup(
    pages({
      accepted: null,
      incoming: {
        items: [connection()],
        nextCursor: {
          createdAt: "2026-10-14T10:00:00.123456+00:00",
          id: id(1),
        },
      },
    }),
  );
  assert.match(html, /My athletes could not be verified/);
  assert.match(html, /1 shown · More available/);
  assert.match(html, /Load more incoming requests/);
  assert.doesNotMatch(html, /1 connected athlete/);
});

test("history keeps one continuing accepted request/session and unsuccessful original contexts", () => {
  const first: ConnectionHistoryReference = {
    id: id(300),
    requestId: id(300),
    bookingId: booking.id,
    requestStatus: "accepted",
    bookingStatus: "cancelled",
    createdAt: "2026-10-14T10:00:00.123456+00:00",
    scheduledStartAt: booking.scheduledStartAt,
    scheduledEndAt: booking.scheduledEndAt,
    coachTimezone: booking.coachTimezone,
    trainingLocationName: "Retained Studio",
    publicLocationLabel: "Berlin",
  };
  const declined = {
    ...first,
    id: id(301),
    requestId: id(301),
    bookingId: null,
    requestStatus: "declined" as const,
    bookingStatus: null,
  };
  const html = renderToStaticMarkup(
    createElement(CoachConnectionHistory, {
      name: "Amina Athlete",
      page: {
        items: [first, declined],
        nextCursor: { createdAt: declined.createdAt, id: declined.id },
      },
      message: null,
      busy: false,
      bookingIds: new Set([booking.id]),
      onLoad: noop,
    }),
  );
  assert.equal((html.match(/data-history-id=/g) ?? []).length, 2);
  assert.match(html, /Accepted request · Cancelled session/);
  assert.match(html, /Declined request/);
  assert.ok(html.includes(`href="#coach-booking-${booking.id}"`));
  assert.ok(html.includes(`data-request-id="${declined.id}"`));
  assert.match(html, /Load older shared history/);
  assert.doesNotMatch(html, /Conversation|private notes|Send message/);
});

test("booking context remains unknown until checked and reconnect requires an explicit fresh request", () => {
  const base = {
    booking,
    error: null,
    busy: false,
    mayInitiate: true,
    onLoad: noop,
    onMutation: noop,
  };
  const unknown = renderToStaticMarkup(
    createElement(BookingConnectionOptions, { ...base, context: undefined }),
  );
  assert.match(unknown, /Connection options/);
  assert.doesNotMatch(unknown, /Not connected|Send connection request/);
  const eligible = renderToStaticMarkup(
    createElement(BookingConnectionOptions, {
      ...base,
      context: {
        connection: connection(1, { status: "removed", canWithdraw: false }),
        canSend: true,
      },
    }),
  );
  assert.match(eligible, /Request reconnection/);
  const cancelled = renderToStaticMarkup(
    createElement(BookingConnectionOptions, {
      ...base,
      context: { connection: null, canSend: false },
    }),
  );
  assert.doesNotMatch(cancelled, /Send connection request/);
  assert.match(cancelled, /confirmed or completed shared session is required/);
});
