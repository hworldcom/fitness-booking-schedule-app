import assert from "node:assert/strict";
import test from "node:test";
import { calendarCommand, isCalendarResult } from "@/calendar/connection";

const generation = "11111111-1111-4111-8111-111111111111";
test("Calendar browser commands cannot choose an actor, carry secrets or replay unkeyed replacements", () => {
  assert.deepEqual(calendarCommand({ action: "disconnect", generation }), {
    action: "disconnect",
    generation,
  });
  assert.ok(
    calendarCommand({ action: "replace", generation, commandId: generation }),
  );
  assert.ok(
    calendarCommand({
      action: "recover",
      generation,
      calendarId: "existing@group.calendar.google.com",
    }),
  );
  for (const input of [
    null,
    [],
    { action: "replace", generation },
    { action: "recover", generation, calendarId: "primary" },
    { action: "recover", generation, calendarId: "x\nInjected" },
    { action: "recover", generation, calendarId: "https://example.test" },
    { action: "disconnect", generation, profileId: "other" },
    { action: "check", generation, refreshToken: "secret" },
    { action: "export", generation },
    { action: "check", generation: "bad" },
  ])
    assert.equal(calendarCommand(input), null);
});
test("Calendar response parsing rejects private records, extra credentials and contradictory shapes", () => {
  const connection = {
    state: "connected",
    generation,
    email: "owner@example.test",
    calendarId: "movx@group.calendar.google.com",
    checkedAt: "2026-11-11T20:00:00Z",
  };
  assert.equal(
    isCalendarResult({ status: "ready", enabled: true, connection }),
    true,
  );
  for (const input of [
    {
      status: "ready",
      enabled: true,
      connection: { ...connection, credential_ciphertext: "private" },
    },
    {
      status: "ready",
      enabled: true,
      connection,
      record: { pending_verifier: "private" },
    },
    { status: "unavailable", credential: "private" },
    {
      status: "ready",
      enabled: true,
      connection: { ...connection, state: "unknown" },
    },
    {
      status: "ready",
      enabled: true,
      connection: { ...connection, checkedAt: "not-time" },
    },
    {
      status: "ready",
      enabled: true,
      connection: { ...connection, generation: "bad" },
    },
  ])
    assert.equal(isCalendarResult(input), false);
});
