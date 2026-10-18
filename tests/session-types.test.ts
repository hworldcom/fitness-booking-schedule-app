import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSessionTypeCommand,
  parseSessionTypes,
} from "@/domain/session-types";
const base = {
  commandId: "93400000-0000-4000-8000-000000000001",
  action: "save",
  id: "93400000-0000-4000-8000-000000000002",
  expectedRevision: -1,
  format: "private",
  name: "  Boxing technique  ",
  description: "Footwork and pads",
  color: "#2563eb",
  durationMinutes: 75,
  defaultLocationId: null,
  bookable: true,
};
test("session type commands reject ambiguous or invalid terms", () => {
  assert.equal(parseSessionTypeCommand(base)?.name, "Boxing technique");
  for (const durationMinutes of [60, 75, 90])
    assert.ok(parseSessionTypeCommand({ ...base, durationMinutes }));
  for (const change of [
    { durationMinutes: 45 },
    { durationMinutes: 120 },
    { name: " " },
    { name: "x".repeat(81) },
    { color: "red" },
    { format: "online" },
    { expectedRevision: 0.5 },
    { defaultLocationId: "invalid" },
    { price: 60 },
    { description: "x".repeat(1001) },
    { bookable: null },
  ])
    assert.equal(parseSessionTypeCommand({ ...base, ...change }), null);
  assert.equal(
    parseSessionTypeCommand({ ...base, commandId: undefined }),
    null,
  );
  assert.ok(
    parseSessionTypeCommand({
      commandId: base.commandId,
      action: "archive",
      id: base.id,
      expectedRevision: 2,
    }),
  );
  assert.equal(
    parseSessionTypeCommand({
      commandId: base.commandId,
      action: "archive",
      id: base.id,
      expectedRevision: -1,
    }),
    null,
  );
  assert.ok(
    parseSessionTypeCommand({ commandId: base.commandId, action: "defaults" }),
  );
  assert.equal(
    parseSessionTypeCommand({
      commandId: base.commandId,
      action: "defaults",
      id: base.id,
    }),
    null,
  );
});
test("catalog fails closed on corrupted duration or lifecycle", () => {
  const row = {
    id: base.id,
    format: base.format,
    name: "Boxing",
    description: base.description,
    color: base.color,
    durationMinutes: 75,
    defaultLocationId: null,
    bookable: true,
    revision: 1,
    archived: false,
  };
  assert.equal(parseSessionTypes([row])[0].durationMinutes, 75);
  assert.throws(() => parseSessionTypes([{ ...row, durationMinutes: 61 }]));
  assert.throws(() => parseSessionTypes([{ ...row, archived: "false" }]));
  assert.throws(() => parseSessionTypes([{ ...row, privateNotes: "hidden" }]));
});
