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
  connectionSection,
  connectionPresentation,
  freshConnectionRange,
  mergeConnectionRows,
  type ConnectionPages,
} from "@/features/connections/connection-model";
import { ConnectionLists } from "@/features/connections/connection-lists";
import { ConnectionHistory } from "@/features/connections/connection-history";
import { BookingConnectionOptions } from "@/features/connections/booking-connection-options";

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
function pages(patch: Partial<ConnectionPages> = {}): ConnectionPages {
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
function markup(value: ConnectionPages, mayInitiate = true) {
  return renderToStaticMarkup(
    createElement(ConnectionLists, {
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
  assert.equal(connectionSection(connection()), "outgoing");
  assert.equal(
    connectionSection(
      connection(1, { senderProfileId: id(102), recipientProfileId: id(101) }),
    ),
    "incoming",
  );
  assert.equal(
    connectionSection(connection(1, { status: "accepted" })),
    "accepted",
  );
  for (const status of ["declined", "withdrawn", "removed"] as const)
    assert.equal(connectionSection(connection(1, { status })), "history");
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
    createElement(ConnectionHistory, {
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

test("athlete perspective reverses consent sections without changing actor IDs or consent", () => {
  const outgoing = connection(1, {
    senderProfileId: id(102),
    recipientProfileId: id(101),
  });
  assert.equal(connectionSection(outgoing, "athlete"), "outgoing");
  assert.equal(connectionSection(outgoing, "coach"), "incoming");
  const incoming = connection();
  assert.equal(connectionSection(incoming, "athlete"), "incoming");
  const applied = applyConnectionResult(pages(), outgoing, "athlete");
  assert.equal(applied.outgoing?.items[0].id, outgoing.id);
  assert.equal(applied.accepted?.items.length, 0);
});

test("athlete coach presentation never selects athlete private media and gates public shortcuts", () => {
  const connected = connection(1, {
    status: "accepted",
    coachPortraitUrl: "/images/coaches/daniel.webp",
    athleteAvatarUrl: "/api/connections/private/athlete-avatar",
  });
  assert.deepEqual(connectionPresentation(connected, "athlete"), {
    name: "Test Coach",
    imageUrl: "/images/coaches/daniel.webp",
    profileHref: "/coaches/test-coach",
  });
  assert.deepEqual(
    connectionPresentation({ ...connected, coachPublic: false }, "athlete"),
    { name: "Test Coach", imageUrl: null, profileHref: null },
  );
  assert.equal(
    connectionPresentation({ ...connected, status: "pending" }, "athlete")
      .profileHref,
    null,
  );
});

test("My coaches uses retained counterpart identity, server flags and no hidden-coach new-session action", () => {
  const row = connection(1, {
    status: "accepted",
    coachPublic: false,
    canDisconnect: true,
  });
  const html = renderToStaticMarkup(
    createElement(ConnectionLists, {
      role: "athlete",
      pages: pages({ accepted: { items: [row], nextCursor: null } }),
      busy: false,
      mayInitiate: true,
      onRefresh: noop,
      onPage: noop,
      onDecision: noop,
      onHistory: noop,
      renderHistory: () => null,
    }),
  );
  assert.match(html, /My coaches/);
  assert.match(html, /Test Coach/);
  assert.doesNotMatch(
    html,
    /Amina Athlete|View coach and request a session|\/coaches\/test-coach|athlete-avatar/,
  );
  assert.match(html, /Disconnect/);
  assert.match(html, /not available for new session requests/);
  const incoming = renderToStaticMarkup(
    createElement(ConnectionLists, {
      role: "athlete",
      pages: pages({
        incoming: {
          items: [connection(2, { canAccept: false, canDecline: true })],
          nextCursor: null,
        },
      }),
      busy: false,
      mayInitiate: true,
      onRefresh: noop,
      onPage: noop,
      onDecision: noop,
      onHistory: noop,
      renderHistory: () => null,
    }),
  );
  assert.doesNotMatch(incoming, /Accept connection/);
  assert.match(incoming, /Decline connection/);
});

test("athlete booking controls ask the coach for consent and link the athlete list", () => {
  const incoming = renderToStaticMarkup(
    createElement(BookingConnectionOptions, {
      role: "athlete",
      booking,
      context: {
        canSend: false,
        connection: connection(1, {
          canAccept: true,
          canDecline: true,
          canWithdraw: false,
        }),
      },
      error: null,
      busy: false,
      mayInitiate: true,
      onLoad: noop,
      onMutation: noop,
    }),
  );
  assert.match(incoming, /Connection with Test Coach/);
  assert.match(incoming, /This coach is waiting for your decision/);
  assert.match(incoming, /Accept connection/);
  assert.doesNotMatch(incoming, /Send connection request/);
  const accepted = renderToStaticMarkup(
    createElement(BookingConnectionOptions, {
      role: "athlete",
      booking,
      context: {
        canSend: false,
        connection: connection(1, { status: "accepted", canDisconnect: true }),
      },
      error: null,
      busy: false,
      mayInitiate: true,
      onLoad: noop,
      onMutation: noop,
    }),
  );
  assert.match(accepted, /href="#my-coaches"/);
  assert.match(accepted, /View My coaches/);
});

test("athlete history returns to the original athlete session, preserving selected-request continuity", () => {
  const row: ConnectionHistoryReference = {
    id: id(310),
    requestId: id(310),
    bookingId: booking.id,
    requestStatus: "accepted",
    bookingStatus: "cancelled",
    createdAt: "2026-10-14T10:00:00.123456+00:00",
    scheduledStartAt: booking.scheduledStartAt,
    scheduledEndAt: booking.scheduledEndAt,
    coachTimezone: booking.coachTimezone,
    trainingLocationName: booking.location.name,
    publicLocationLabel: booking.location.publicLabel,
  };
  const html = renderToStaticMarkup(
    createElement(ConnectionHistory, {
      role: "athlete",
      name: "Test Coach",
      page: { items: [row], nextCursor: null },
      message: null,
      busy: false,
      bookingIds: new Set([booking.id]),
      onLoad: noop,
    }),
  );
  assert.match(html, new RegExp(`href="#athlete-booking-${booking.id}"`));
  assert.match(html, /Accepted request · Cancelled session/);
  assert.equal((html.match(/data-history-id=/g) ?? []).length, 1);
  assert.doesNotMatch(html, /coach-booking-|conversation|private note/);
});

test("loading another page rebuilds authorised rows and current statuses without restoring revoked cached entries", async () => {
  const cursor = { createdAt: "2026-10-14T10:00:00.123456+00:00", id: id(8) };
  const calls: unknown[] = [];
  const result = await freshConnectionRange(4, async (after) => {
    calls.push(after);
    return {
      status: "ready" as const,
      value: after
        ? { items: [{ id: id(4), status: "cancelled" }], nextCursor: null }
        : {
            items: [
              { id: id(2), status: "cancelled" },
              { id: id(3), status: "confirmed" },
            ],
            nextCursor: cursor,
          },
    };
  });
  assert.deepEqual(calls, [null, cursor]);
  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.deepEqual(
      result.value.items.map((row) => row.id),
      [id(2), id(3), id(4)],
    );
    assert.equal(result.value.items[0].status, "cancelled");
    assert.equal(result.value.nextCursor, null);
  }
  const denied = await freshConnectionRange(4, async (after) =>
    after
      ? { status: "forbidden" as const }
      : {
          status: "ready" as const,
          value: { items: [{ id: id(2) }], nextCursor: cursor },
        },
  );
  assert.deepEqual(denied, { status: "forbidden" });
});
