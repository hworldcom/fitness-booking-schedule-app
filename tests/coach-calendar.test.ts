import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarDays,
  calendarDates,
  calendarHref,
  calendarItemKey,
  calendarPeriod,
  calendarQueryKey,
  calendarSelection,
  calendarStatusLabel,
  itemOnCalendarDate,
  mergeCalendarItems,
  parseCalendarPage,
  parseCalendarQuery,
  type CalendarQuery,
} from "@/domain/coach-calendar";
import {
  calendarLanes,
  calendarMinutes,
  calendarActorAccess,
  calendarDetailHref,
  calendarItemRange,
} from "@/features/coaches/coach-calendar-model";
import {
  calendarFixture,
  CALENDAR_FIXTURE_ITEMS,
} from "./fixtures/coach-calendar-data";
import type { ActorSnapshot } from "@/auth/actor-contracts";

const selection = calendarSelection(
  { date: "2026-10-16", calendarView: "month" },
  "2026-10-16",
);
const period = calendarPeriod(selection);
const query: CalendarQuery = {
  from: period.from,
  through: period.through,
  type: "all",
  venueId: null,
  history: false,
  after: null,
};

test("calendar uses Monday-first periods and 42 local dates through leap years and DST", () => {
  assert.deepEqual(calendarPeriod({ date: "2026-10-16", view: "week" }), {
    from: "2026-10-12",
    through: "2026-10-18",
    previous: "2026-10-09",
    next: "2026-10-23",
  });
  const leap = calendarPeriod({ date: "2028-02-29", view: "month" });
  assert.equal(leap.from, "2028-01-31");
  assert.equal(leap.through, "2028-03-12");
  assert.equal(calendarDates(leap.from, leap.through).length, 42);
  assert.equal(addCalendarDays("2026-10-25", 1), "2026-10-26");
  assert.equal(
    calendarPeriod({ date: "2026-12-31", view: "day" }).next,
    "2027-01-01",
  );
});
test("calendar URL state rejects repeated/forged values and preserves filters across day navigation", () => {
  const safe = calendarSelection(
    {
      date: "bad",
      calendarView: ["month"],
      type: "forged",
      venue: "not-a-uuid",
      history: ["1"],
    },
    "2026-10-16",
  );
  assert.deepEqual(safe, {
    date: "2026-10-16",
    view: "week",
    type: "all",
    venueId: null,
    history: false,
  });
  const href = calendarHref({
    ...selection,
    type: "group",
    history: true,
    venueId: "60000000-0000-4000-8000-000000000001",
  });
  assert.match(href, /section=calendar/);
  assert.match(href, /calendarView=month/);
  assert.match(href, /history=1/);
  assert.match(href, /type=group/);
});
test("bounded calendar actions bind cursors to period/type/venue/history and preserve microseconds", () => {
  assert.ok(parseCalendarQuery(query));
  const cursor = {
    at: "2026-10-16T10:00:00.123456+00:00",
    source: "booking",
    id: "10000000-0000-4000-8000-000000000001",
    queryKey: calendarQueryKey(query),
  };
  assert.equal(
    parseCalendarQuery({ ...query, after: cursor })?.after?.at,
    cursor.at,
  );
  for (const bad of [
    { ...query, through: addCalendarDays(query.from, 42) },
    { ...query, from: "2026-02-31" },
    { ...query, history: "1" },
    { ...query, ownerId: "forged" },
    { ...query, after: { ...cursor, queryKey: "other-period" } },
    { ...query, after: { ...cursor, source: "draft" } },
  ])
    assert.equal(parseCalendarQuery(bad), null);
});
test("month previews/counts are complete even when agenda pages fill on earlier dates", () => {
  let data = calendarFixture(query);
  assert.equal(data.page.items.length, 50);
  assert.ok(data.page.total > 50);
  assert.ok(data.page.nextCursor);
  const later = data.page.days.find((d) => d.date === "2026-11-07");
  assert.equal(later?.previews.length, 3);
  assert.equal(later?.total, 5);
  let items = [...data.page.items];
  while (data.page.nextCursor) {
    data = calendarFixture({ ...query, after: data.page.nextCursor });
    items = mergeCalendarItems(items, data.page.items);
  }
  assert.equal(items.length, data.page.total);
  assert.equal(new Set(items.map(calendarItemKey)).size, items.length);
});
test("calendar projection strips identities/media/notes and rejects impossible kind/status/count combinations", () => {
  const page = calendarFixture(query).page;
  const value = {
    ...page,
    athleteEmail: "private",
    items: page.items.map((i) => ({
      ...i,
      athleteId: "private",
      avatarUrl: "secret",
      notes: "private",
    })),
  };
  const parsed = parseCalendarPage(value, query);
  assert.doesNotMatch(
    JSON.stringify(parsed),
    /private\"|athleteId|avatarUrl|notes|athleteEmail/,
  );
  for (const changed of [
    { ...page.items[0], source: "group", status: "draft" },
    {
      ...page.items[0],
      source: "booking",
      status: "confirmed",
      pendingCount: 1,
    },
    { ...page.items[0], endsAt: page.items[0].startsAt },
  ])
    assert.throws(() =>
      parseCalendarPage({ ...page, items: [changed] }, query),
    );
  assert.throws(() =>
    parseCalendarPage(
      { ...page, items: [page.items[0], page.items[0]] },
      query,
    ),
  );
  assert.throws(() =>
    parseCalendarPage(
      {
        ...page,
        days: [
          {
            date: "2026-11-07",
            total: 5,
            previews: Array(4).fill(page.items[0]),
          },
        ],
      },
      query,
    ),
  );
});
test("history stays terminal, past private confirmations do not auto-complete and groups outside horizon remain real", () => {
  const booking = CALENDAR_FIXTURE_ITEMS.find(
    (i) => i.source === "booking" && i.status === "confirmed",
  )!;
  assert.equal(
    calendarStatusLabel(booking, "2026-10-16T08:30:00Z"),
    "Confirmed",
  );
  const group = CALENDAR_FIXTURE_ITEMS.find(
    (i) => i.source === "group" && i.endsAt < "2026-10-14",
  )!;
  assert.equal(calendarStatusLabel(group, "2026-10-16T08:30:00Z"), "Ended");
  assert.ok(
    calendarFixture({ ...query, history: true }).page.total >
      calendarFixture(query).page.total,
  );
  const outside = calendarFixture({
    ...query,
    from: "2026-12-03",
    through: "2026-12-03",
  });
  assert.equal(outside.page.items.length, 1);
  assert.equal(outside.page.items[0].source, "group");
  assert.match(
    calendarDetailHref(booking),
    new RegExp(`#coach-booking-${booking.id}$`),
  );
});
test("overnight groups use half-open local dates and overlapping history gets distinct lanes", () => {
  const item = CALENDAR_FIXTURE_ITEMS.find(
    (i) => i.title === "Evening training camp",
  )!;
  assert.equal(calendarItemRange(item), "17 Oct, 22:00 – 18 Oct, 00:30");
  assert.equal(calendarItemRange(item, "2026-10-18"), "00:00–00:30");
  assert.equal(calendarItemRange(item, "2026-10-17"), "22:00–24:00");
  assert.equal(itemOnCalendarDate(item, "2026-10-18"), true);
  assert.equal(
    itemOnCalendarDate(
      { ...item, endsAt: "2026-10-17T22:00:00Z" },
      "2026-10-18",
    ),
    false,
  );
  assert.equal(calendarMinutes(item.startsAt, "2026-10-17"), 22 * 60);
  assert.equal(calendarMinutes(item.endsAt, "2026-10-17"), 1440);
  const lanes = calendarLanes(
    [
      item,
      {
        ...item,
        id: "10000000-0000-4000-8000-000000009999",
        status: "cancelled",
      },
    ],
    "2026-10-17",
  );
  assert.deepEqual(
    lanes.map((i) => i.lane),
    [0, 1],
  );
  assert.equal(lanes[0].lanes, 2);
});
test("calendar history allows suspended owners but clears another account/run or revoked coach access", () => {
  const data = {
    scope: "coach-user:profile:run:member",
    actorIdentity: "coach:run:member",
  };
  const session = {
    status: "signed-in" as const,
    subject: "coach-user",
    email: "coach@example.test",
    expiresAt: 123,
  };
  const actor: ActorSnapshot = {
    status: "authorized",
    profile: {
      slug: "coach",
      displayName: "Coach",
      avatarUrl: null,
      coachPortraitUrl: null,
    },
    demoRun: { slug: "run", name: "Run" },
    role: "member",
    coachAccessStatus: "suspended",
  };
  assert.equal(calendarActorAccess(session, actor, data), "allowed");
  assert.equal(
    calendarActorAccess(session, actor, { ...data, mayEditAvailability: true }),
    "denied",
  );
  assert.equal(
    calendarActorAccess({ ...session, subject: "other" }, actor, data),
    "denied",
  );
  assert.equal(
    calendarActorAccess(
      session,
      { ...actor, coachAccessStatus: "pending" },
      data,
    ),
    "denied",
  );
  assert.equal(
    calendarActorAccess(session, { status: "unavailable" }, data),
    "pending",
  );
  assert.equal(calendarFixture(query, 0, true).mayEditAvailability, false);
});
