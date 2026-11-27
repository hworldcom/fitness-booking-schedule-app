import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  isAthleteCoachFilter,
  isAthleteCoachCursor,
  mergeAthleteCoaches,
  type AthleteCoach,
} from "@/domain/athlete-coaches";
import { AthleteCoachRosterList } from "@/features/connections/athlete-coach-roster-list";
const id = "29200000-0000-4000-8000-000000000001";
const row: AthleteCoach = {
  key: `p:${id}`,
  profileId: id,
  name: "Group coach",
  status: "unconnected",
  lastSessionAt: null,
  nextSessionAt: "2035-01-01T10:00:00Z",
  sortAt: "2026-11-27T10:00:00.123456+00:00",
  bookingId: null,
  connection: null,
  canSend: false,
  profileHref: null,
  portraitUrl: null,
};
test("athlete filters and exact identity merging preserve distinct coaches with the same name", () => {
  for (const value of ["all", "connected", "unconnected"])
    assert.equal(isAthleteCoachFilter(value), true);
  for (const value of ["external", "pending", ["all"], null])
    assert.equal(isAthleteCoachFilter(value), false);
  assert.equal(isAthleteCoachCursor({ at: row.sortAt, key: row.key }), true);
  assert.equal(isAthleteCoachCursor({ at: row.sortAt, key: `e:${id}` }), false);
  assert.equal(
    isAthleteCoachCursor({ at: row.sortAt, key: row.key, extra: true }),
    false,
  );
  const other = {
    ...row,
    key: "p:29200000-0000-4000-8000-000000000002",
    profileId: "29200000-0000-4000-8000-000000000002",
  };
  const merged = mergeAthleteCoaches(
    [row, other],
    [{ ...row, name: "Updated coach" }],
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].name, "Updated coach");
  assert.equal(merged[1].name, row.name);
});
test("group-only and hidden coaches have truthful dates without new connection/profile authority", () => {
  const render = (coach: AthleteCoach) =>
    renderToStaticMarkup(
      createElement(AthleteCoachRosterList, {
        coaches: [coach],
        busy: false,
        onConnect() {},
        onDisconnect() {},
        onHistory() {},
        renderHistory() {
          return null;
        },
      }),
    );
  const hidden = render(row);
  assert.match(hidden, /Not connected/);
  assert.match(hidden, /Next: 1 Jan 2035/);
  assert.doesNotMatch(hidden, /href=|>Connect<|External|Invite/);
  const eligible = render({
    ...row,
    bookingId: id,
    canSend: true,
    profileHref: "/coaches/public-coach",
  });
  assert.match(eligible, /href="\/coaches\/public-coach"/);
  assert.match(eligible, />Connect</);
});
