import assert from "node:assert/strict";
import test from "node:test";
import { parseTypedRequest } from "@/domain/typed-sessions";
import {
  parseGroupSessionCommand,
  parsePublicGroupQuery,
} from "@/domain/group-sessions";
import {
  calendarQueryKey,
  parseCalendarQuery,
  calendarSelection,
  calendarHref,
} from "@/domain/coach-calendar";
const id = "93420000-0000-4000-8000-000000000001";
const request = {
  commandId: id,
  typeId: id,
  typeRevision: 1,
  locationId: id,
  startsAt: "2026-11-03T10:15:00Z",
};
test("typed request boundaries keep actors server-derived and durations bounded", () => {
  assert.ok(parseTypedRequest(request));
  for (const changes of [
    { clientId: id },
    { typeRevision: -1 },
    { startsAt: "2026-11-03T10:16:00Z" },
    { commandId: "bad" },
    { locationId: null },
    { durationMinutes: 75 },
  ])
    assert.equal(parseTypedRequest({ ...request, ...changes }), null);
  const create = {
    ...request,
    action: "create",
    durationMinutes: 90,
    athleteId: id,
  };
  assert.ok(parseTypedRequest(create, true));
  assert.equal(
    parseTypedRequest({ ...create, durationMinutes: 120 }, true),
    null,
  );
  assert.equal(parseTypedRequest({ ...create, bookingId: id }, true), null);
  assert.ok(
    parseTypedRequest(
      {
        ...request,
        action: "override",
        durationMinutes: 75,
        bookingId: id,
        expectedRevision: 2,
      },
      true,
    ),
  );
  assert.equal(
    parseTypedRequest(
      { ...request, action: "override", durationMinutes: 75, bookingId: id },
      true,
    ),
    null,
  );
});
test("type filters bind calendar cursors and public group IDs", () => {
  const base = {
    from: "2026-11-03",
    through: "2026-11-03",
    type: "all",
    venueId: null,
    history: false,
    after: null,
  } as const;
  assert.ok(parseCalendarQuery({ ...base, sessionTypeId: id }));
  assert.notEqual(
    calendarQueryKey({ ...base, sessionTypeId: id }),
    calendarQueryKey(base),
  );
  assert.equal(parseCalendarQuery({ ...base, sessionTypeId: "forged" }), null);
  const selection = calendarSelection({ sessionType: id }, "2026-11-03");
  assert.match(calendarHref(selection), new RegExp("sessionType=" + id));
  const parsed = parsePublicGroupQuery({
    action: "list",
    args: { sessionTypeId: id },
  });
  assert.ok(parsed?.action === "list");
  assert.equal(parsed.args.sessionTypeId, id);
  assert.equal(
    parsePublicGroupQuery({ action: "list", args: { sessionTypeId: "bad" } }),
    null,
  );
  assert.equal(
    parseGroupSessionCommand({
      action: "save-draft",
      args: { sessionTypeId: id },
    }),
    null,
  );
});
