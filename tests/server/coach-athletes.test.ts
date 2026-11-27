import assert from "node:assert/strict";
import test from "node:test";
import { parseCoachAthlete } from "@/server/db/connections/coach-athletes-repository";
const id = "20000000-0000-4000-8000-000000000001";
const row = {
  key: `e:${id}`,
  profileId: null,
  externalClientId: id,
  name: "Private contact",
  status: "external",
  lastSessionAt: null,
  nextSessionAt: null,
  sortAt: "2026-11-27T10:00:00.123456+00:00",
  bookingId: null,
  connection: null,
  canSend: false,
};
test("roster parser excludes private email and rejects identity/permission contradictions", () => {
  assert.equal(parseCoachAthlete(row).sortAt, row.sortAt);
  for (const patch of [
    { email: "private@example.test" },
    { profileId: id },
    { key: `p:${id}` },
    { externalClientId: null },
    { bookingId: id },
    { canSend: true },
    { status: "connected" },
    { name: "bad\nname" },
    { lastSessionAt: "invalid" },
  ])
    assert.throws(() => parseCoachAthlete({ ...row, ...patch }));
  const registered = {
    ...row,
    key: `p:${id}`,
    profileId: id,
    externalClientId: null,
    status: "unconnected",
    bookingId: id,
    canSend: true,
  };
  assert.equal(parseCoachAthlete(registered).profileId, id);
  assert.throws(() => parseCoachAthlete({ ...registered, bookingId: null }));
});
