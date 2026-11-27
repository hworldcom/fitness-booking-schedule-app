import assert from "node:assert/strict";
import test from "node:test";
import { parseAthleteCoach } from "@/server/db/connections/athlete-coaches-repository";
const id = "29200000-0000-4000-8000-000000000001";
const row = {
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
  coachPublic: false,
  coachSlug: null,
  coachPortrait: null,
};
test("athlete roster rejects private contact data, impossible status/identity and forged public media", () => {
  const parsed = parseAthleteCoach(row);
  assert.equal(parsed.sortAt, row.sortAt);
  assert.equal(parsed.profileHref, null);
  assert.equal(parsed.portraitUrl, null);
  for (const patch of [
    { externalClientId: id },
    { email: "coach@example.test" },
    { key: `e:${id}` },
    { status: "external" },
    { status: "connected" },
    { status: "pending" },
    { profileId: "invalid" },
    { key: `p:29200000-0000-4000-8000-000000000002` },
    { canSend: true },
    { name: "bad\nname" },
    { lastSessionAt: "invalid" },
    { coachSlug: "private" },
    { coachPortrait: { source: "account", path: id, updatedAt: row.sortAt } },
    { coachPublic: true, coachSlug: "../../private" },
    {
      coachPublic: true,
      coachSlug: "public",
      coachPortrait: {
        source: "account",
        path: "29200000-0000-4000-8000-000000000002",
        updatedAt: row.sortAt,
      },
    },
  ])
    assert.throws(() => parseAthleteCoach({ ...row, ...patch }));
  assert.equal(
    parseAthleteCoach({ ...row, coachPublic: true, coachSlug: "public-coach" })
      .profileHref,
    "/coaches/public-coach",
  );
  assert.equal(
    parseAthleteCoach({ ...row, bookingId: id, canSend: true }).canSend,
    true,
  );
});
