import assert from "node:assert/strict";
import test from "node:test";
import {
  coachProfileHref,
  coachRedirectHref,
  publicCoachHandle,
  parseCoachHandleConfirmation,
  isCoachPublicHandleResult,
} from "@/domain/coach-public-url";
import { publicScheduleHref } from "@/domain/public-coach-schedule";
import { safeReturnTo } from "@/auth/return-to";

test("public coach namespace rejects arbitrary roots and private identifiers", () => {
  assert.equal(publicCoachHandle("@Coach_amy"), "coach_amy");
  assert.equal(publicCoachHandle("%40Coach_amy"), "coach_amy");
  for (const value of [
    "coach_amy",
    "@ab",
    "@3amy",
    "@amy/name",
    "@amy%2fname",
    "@amy@example.com",
    "@@amy",
    "@amy?secret=yes",
    "@аmy",
    "@amy ",
    "%2540amy",
    "%40amy%2fname",
  ])
    assert.equal(publicCoachHandle(value), null, value);
  assert.equal(
    coachProfileHref({ slug: "legacy", publicPath: "/@amy" }),
    "/@amy",
  );
  assert.equal(
    coachProfileHref({ slug: "legacy", publicPath: "//evil.test" }),
    "/coaches/legacy",
  );
});
test("redirects keep a single valid date or schedule section, discarding private and repeated queries", () => {
  assert.equal(
    coachRedirectHref("/@amy", {
      date: "2026-10-20",
      token: "secret",
      returnTo: "//evil.test",
    }),
    "/@amy?date=2026-10-20#private-schedule",
  );
  for (const date of [
    "2026-02-30",
    ["2026-10-20", "2026-10-21"],
    "https://evil.test",
    "2026-1-1",
  ])
    assert.equal(coachRedirectHref("/@amy", { date }), "/@amy");
  assert.equal(
    coachRedirectHref("/@amy", { section: "private-schedule" }),
    "/@amy#private-schedule",
  );
  assert.equal(coachRedirectHref("/@amy", { section: "//evil.test" }), "/@amy");
  assert.equal(
    publicScheduleHref("legacy", "2026-10-20", "/@amy"),
    "/@amy?date=2026-10-20#private-schedule",
  );
  assert.equal(
    safeReturnTo(
      "/@amy?date=2026-10-20#private-schedule",
      "http://localhost:3100",
    ),
    "/@amy?date=2026-10-20#private-schedule",
  );
});
test("public username confirmation requires exact displayed username/revision and explicit consent", () => {
  const input = { username: "amy", expectedRevision: 2, consent: true };
  assert.deepEqual(parseCoachHandleConfirmation(input), {
    username: "amy",
    expectedRevision: 2,
  });
  for (const bad of [
    { ...input, consent: false },
    { ...input, expectedRevision: -1 },
    { ...input, username: "@amy" },
    { ...input, profileId: "other" },
    { ...input, username: "Amy" },
  ])
    assert.equal(parseCoachHandleConfirmation(bad), null);
  assert.equal(
    isCoachPublicHandleResult({
      status: "ready",
      schemaVersion: 1,
      username: null,
      revision: 0,
      confirmed: true,
    }),
    false,
  );
  assert.equal(
    isCoachPublicHandleResult({
      status: "ready",
      schemaVersion: 1,
      username: "amy",
      revision: 1,
      confirmed: false,
      legalName: "private",
    }),
    false,
  );
});
