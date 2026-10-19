/* eslint-disable react/no-children-prop -- Nested provider props keep this server-rendered fixture typed. */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthSessionProvider } from "@/auth/client/session-provider";
import { ActorProvider } from "@/auth/client/actor-provider";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import { PrivateScheduleAccess } from "@/features/coaches/private-schedule-access";
import {
  legacyPrivateScheduleSummary,
  parsePrivateScheduleCount,
  privateScheduleSummary,
} from "@/domain/private-schedule-summary";
import {
  PUBLIC_SCHEDULE_ACTOR,
  PUBLIC_SCHEDULE_IDENTITY,
  PUBLIC_SCHEDULE_SUBJECT,
  PUBLIC_SCHEDULE_NOW,
  publicFixtureSlot,
} from "./fixtures/public-schedule-data";

const summary = (count: number) =>
  privateScheduleSummary(
    Array.from({ length: 7 }, (_, index) => ({
      date: `2026-10-${19 + index}`,
      count: index === 0 ? count : 0,
    })),
  );

const expected = {
  subject: PUBLIC_SCHEDULE_SUBJECT,
  actorIdentity: PUBLIC_SCHEDULE_IDENTITY,
};
const signedIn: AuthSessionSnapshot = {
  status: "signed-in",
  subject: PUBLIC_SCHEDULE_SUBJECT,
  email: "disposable@users.movx.test",
  expiresAt: null,
};
const returnTo = "/@test_coach?date=2026-10-22#private-schedule";
function page(
  session: AuthSessionSnapshot,
  options: Partial<Parameters<typeof PrivateScheduleAccess>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(AuthSessionProvider, {
      initialSession: session,
      children: createElement(ActorProvider, {
        initialActor: PUBLIC_SCHEDULE_ACTOR,
        children: createElement(PrivateScheduleAccess, {
          expected,
          summary: summary(12),
          returnTo,
          children: createElement("p", {}, "PRIVATE_TIME_10:15_AND_SLOT_ID"),
          ...options,
        }),
      }),
    }),
  );
}

test("guest, recovery and unverified states render only the aggregate and safe login return", () => {
  for (const status of [
    "signed-out",
    "recovery-required",
    "unavailable",
    "disabled",
  ] as const) {
    const html = page({ status });
    assert.doesNotMatch(html, /PRIVATE_TIME/);
    assert.match(html, /<strong>12<\/strong>/);
    assert.match(html, /in the next 7 days/);
    assert.equal((html.match(/<time dateTime=/g) ?? []).length, 7);
    assert.match(html, /2026-10-25/);
    assert.match(html, /Sign in to view schedule/);
    assert.ok(html.includes(encodeURIComponent(returnTo)));
    assert.equal((html.match(/id="private-schedule"/g) ?? []).length, 1);
  }
});
test("only the matching authorized account sees details; account/dataset changes conceal them", () => {
  assert.match(page(signedIn), /PRIVATE_TIME/);
  for (const html of [
    page({ ...signedIn, subject: "another-account" }),
    page(signedIn, {
      expected: { ...expected, actorIdentity: "other:dataset:member" },
    }),
    page(signedIn, { expected: null }),
  ]) {
    assert.doesNotMatch(html, /PRIVATE_TIME/);
    assert.match(html, /Reload schedule/);
    assert.doesNotMatch(html, /Request session/);
  }
});
test("verified zero and unavailable summaries stay distinct and retry is explicit", () => {
  const empty = page({ status: "signed-out" }, { summary: summary(0) });
  assert.match(empty, /<strong>0<\/strong>/);
  assert.doesNotMatch(empty, /couldn’t verify/);
  const failed = page(
    { status: "signed-out" },
    { summary: { status: "unavailable" } },
  );
  assert.match(failed, /couldn’t verify open slots/);
  assert.match(failed, /Retry availability/);
  assert.doesNotMatch(failed, /<strong>0<\/strong>|PRIVATE_TIME/);
});
test("legacy summary counts only unique future requestable starts over seven local dates", () => {
  const duplicate = publicFixtureSlot(0, 12, 999);
  assert.deepEqual(
    legacyPrivateScheduleSummary(
      [
        publicFixtureSlot(0, 12),
        duplicate,
        publicFixtureSlot(6, 12),
        publicFixtureSlot(7, 12),
        publicFixtureSlot(-1, 12),
        { ...publicFixtureSlot(0, 8), startsAt: PUBLIC_SCHEDULE_NOW },
        { ...publicFixtureSlot(1, 12), requestEligibility: "booked" },
        { ...publicFixtureSlot(2, 12), requestEligibility: "withdrawn" },
        { ...publicFixtureSlot(3, 12), requestEligibility: "unavailable" },
      ],
      PUBLIC_SCHEDULE_NOW,
    ),
    {
      status: "ready",
      count: 2,
      days: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-10-${16 + i}`,
        count: i === 0 || i === 6 ? 1 : 0,
      })),
    },
  );
});
test("summary uses Berlin local dates across daylight saving and UTC date boundaries", () => {
  for (const [now, beforeBoundary, afterBoundary] of [
    ["2026-10-24T22:30:00Z", "2026-10-31T22:45:00Z", "2026-10-31T23:00:00Z"],
    ["2026-03-28T23:30:00Z", "2026-04-04T21:45:00Z", "2026-04-04T22:00:00Z"],
  ]) {
    const slots = [beforeBoundary, afterBoundary].map((startsAt) => ({
      ...publicFixtureSlot(1),
      startsAt,
    }));
    assert.equal(legacyPrivateScheduleSummary(slots, now).status, "ready");
    assert.equal(
      (
        legacyPrivateScheduleSummary(slots, now) as ReturnType<
          typeof privateScheduleSummary
        >
      ).count,
      1,
    );
  }
});
test("malformed, negative, fractional and unbounded counts fail closed", () => {
  assert.equal(parsePrivateScheduleCount(0), 0);
  assert.equal(parsePrivateScheduleCount(700), 700);
  for (const value of [
    null,
    undefined,
    "0",
    -1,
    1.5,
    NaN,
    Infinity,
    701,
    { count: 3 },
  ])
    assert.throws(() => parsePrivateScheduleCount(value));
});
