import assert from "node:assert/strict";
import test from "node:test";
import {
  COACH_STARTING_RATE_MAX_CENTS,
  parseCoachStartingRateInput,
  parseCoachStartingRateText,
  publicCoachStartingRate,
  parsePublicCoachStartingRate,
} from "@/domain/coach-starting-rate";

const valid = {
  schemaVersion: 1,
  expectedRevision: 0,
  amountCents: 6000,
  currency: "EUR",
  showPublicly: false,
};
test("rate input preserves independent amount/disclosure and rejects invalid money/currency/revisions", () => {
  for (const amountCents of [null, 0, 1, 6000, COACH_STARTING_RATE_MAX_CENTS])
    for (const showPublicly of [true, false]) {
      assert.deepEqual(
        parseCoachStartingRateInput({ ...valid, amountCents, showPublicly }),
        { ...valid, amountCents, showPublicly },
      );
    }
  for (const amountCents of [
    -1,
    0.5,
    NaN,
    Infinity,
    -Infinity,
    COACH_STARTING_RATE_MAX_CENTS + 1,
    Number.MAX_SAFE_INTEGER,
    "60",
    "6000",
    undefined,
    {},
    [],
  ])
    assert.equal(parseCoachStartingRateInput({ ...valid, amountCents }), null);
  for (const invalid of [
    { ...valid, currency: "USD" },
    { ...valid, currency: "eur" },
    { ...valid, showPublicly: "true" },
    { ...valid, expectedRevision: -1 },
    { ...valid, expectedRevision: 0.5 },
    { ...valid, expectedRevision: 2147483647 },
    { ...valid, profileId: "other-owner" },
    { ...valid, schemaVersion: 2 },
    null,
    [],
  ])
    assert.equal(parseCoachStartingRateInput(invalid), null);
});
test("owner decimal drafts convert exactly without rounding or grouping ambiguity", () => {
  for (const [text, amountCents] of [
    ["", null],
    ["  ", null],
    ["0", 0],
    ["0.01", 1],
    ["0,1", 10],
    ["60", 6000],
    ["60.50", 6050],
    ["60,50", 6050],
    ["21474836.47", 2147483647],
  ] as const)
    assert.deepEqual(parseCoachStartingRateText(text), { amountCents });
  for (const text of [
    "-1",
    "+1",
    "1e2",
    ".5",
    "1.001",
    "1,000",
    "1,000.00",
    "00",
    "€60",
    "21474836.48",
    "99999999999999",
    "NaN",
    "Infinity",
    null,
    6,
  ])
    assert.equal(parseCoachStartingRateText(text), null);
});
test("public rates distinguish Free and paid EUR private-session amounts without computed minima", () => {
  assert.equal(
    publicCoachStartingRate(0).label,
    "Sessions start from €0 (Free)",
  );
  assert.equal(publicCoachStartingRate(6000).label, "Sessions start from €60");
  assert.equal(
    publicCoachStartingRate(6050).label,
    "Sessions start from €60.50",
  );
  assert.equal(publicCoachStartingRate(1).label, "Sessions start from €0.01");
  assert.equal(
    publicCoachStartingRate(COACH_STARTING_RATE_MAX_CENTS).label,
    "Sessions start from €21,474,836.47",
  );
  const rate = publicCoachStartingRate(6000);
  assert.equal(rate.context, "private-session");
  assert.deepEqual(parsePublicCoachStartingRate(rate), rate);
  assert.equal(
    parsePublicCoachStartingRate({ ...rate, showPublicly: true }),
    null,
  );
  assert.equal(parsePublicCoachStartingRate({ ...rate, revision: 7 }), null);
  assert.equal(
    parsePublicCoachStartingRate({ ...rate, label: "Fixed booking price €60" }),
    null,
  );
  assert.equal(
    parsePublicCoachStartingRate({ ...rate, context: "group-seat" }),
    null,
  );
});
