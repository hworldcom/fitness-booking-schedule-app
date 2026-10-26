import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarPeriod,
  localDate,
  validDate,
  validTrainingCommand,
  spontaneousDefaults,
} from "../src/training/contracts";
const commandId = "12000000-0000-4000-8000-000000000001";
test("spontaneous early-morning defaults describe a completed workout on today's date", () => {
  const log = spontaneousDefaults("2026-11-03T00:30:00Z", "UTC");
  assert.equal(log.minutes, 30);
  assert.equal(log.startsAt, "2026-11-03T00:00:00.000Z");
  const berlin = spontaneousDefaults("2026-11-02T23:30:00Z", "Europe/Berlin");
  assert.equal(localDate(berlin.startsAt, "Europe/Berlin"), "2026-11-03");
});
test("calendar covers complete Monday-first weeks and42-day month boundaries", () => {
  assert.deepEqual(calendarPeriod("2026-11-01", "week"), {
    from: "2026-10-26",
    through: "2026-11-01",
    previous: "2026-10-25",
    next: "2026-11-08",
  });
  assert.equal(calendarPeriod("2026-11-30", "month").through, "2026-12-06");
  assert.equal(
    localDate("2026-10-25T23:30:00Z", "Europe/Berlin"),
    "2026-10-26",
  );
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2026-99-99"), false);
});
test("training commands bound input and reject extra authority or invalid optional data", () => {
  const args = {
    commandId,
    title: "Boxing",
    date: "2026-11-03",
    time: "19:00",
    timezone: "Europe/Berlin",
  };
  assert.equal(validTrainingCommand({ action: "save", args }), true);
  for (const extra of [
    { profileId: commandId },
    { minutes: -1 },
    { weekly: "yes" },
    { notes: "x".repeat(2001) },
    { timezone: "Invalid/Zone" },
    { time: "24:00" },
    { actualMinutes: 0 },
  ])
    assert.equal(
      validTrainingCommand({ action: "save", args: { ...args, ...extra } }),
      false,
    );
  assert.equal(
    validTrainingCommand({
      action: "list",
      args: { from: "2026-01-01", through: "2026-02-12", timezone: "UTC" },
    }),
    false,
  );
});
