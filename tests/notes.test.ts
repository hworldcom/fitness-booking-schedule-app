import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeVideoReferences,
  parseNotesCommand,
  validNoteText,
} from "../src/notes/contracts";
const bookingId = "11000000-0000-4000-8000-000000000001",
  operationId = "11000000-0000-4000-8000-000000000002";
test("video references normalize supported video URLs, strip tracking and bound content", () => {
  assert.deepEqual(
    normalizeVideoReferences([
      {
        label: " Footwork ",
        url: "https://youtu.be/M7lc1UVf-VE?si=tracking&t=42s",
      },
      {
        label: "A reel",
        url: "https://instagram.com/reel/ABC_123/?igsh=tracking",
      },
    ]),
    [
      {
        label: "Footwork",
        url: "https://www.youtube.com/watch?v=M7lc1UVf-VE&t=42",
      },
      { label: "A reel", url: "https://www.instagram.com/reel/ABC_123/" },
    ],
  );
  for (const url of [
    "javascript:alert(1)",
    "http://youtu.be/M7lc1UVf-VE",
    "https://youtube.com.evil.test/watch?v=M7lc1UVf-VE",
    "https://user@youtube.com/watch?v=M7lc1UVf-VE",
    "https://youtube.com:444/watch?v=M7lc1UVf-VE",
    "https://instagram.com/username/",
    "https://youtube.com/playlist?list=foo",
    "https://youtu.be/bad",
  ])
    assert.throws(() => normalizeVideoReferences([{ label: "Video", url }]));
  assert.throws(() =>
    normalizeVideoReferences(
      Array(6).fill({ label: "Video", url: "https://youtu.be/M7lc1UVf-VE" }),
    ),
  );
  assert.throws(() =>
    normalizeVideoReferences([
      { label: "\n", url: "https://youtu.be/M7lc1UVf-VE" },
    ]),
  );
});
test("notes normalize plain text and keep bounded explicit kind/revision/operation authority", () => {
  const c = {
    action: "save",
    args: {
      bookingId,
      operationId,
      kind: "shared",
      revision: 0,
      body: "  First\r\nSecond  ",
      videos: [],
    },
  };
  assert.equal(parseNotesCommand(c)?.args.body, "First\nSecond");
  for (const args of [
    { ...c.args, body: " " },
    { ...c.args, body: "x".repeat(2001) },
    { ...c.args, body: "\u0000" },
    { ...c.args, authorId: bookingId },
    { ...c.args, kind: "unknown" },
    { ...c.args, revision: -1 },
  ])
    assert.equal(parseNotesCommand({ ...c, args }), null);
  assert.ok(validNoteText("😀".repeat(2000)));
  assert.equal(validNoteText("😀".repeat(2001)), false);
  assert.ok(
    parseNotesCommand({ ...c, args: { ...c.args, kind: "plan", body: "" } }),
  );
  assert.equal(
    parseNotesCommand({
      ...c,
      args: {
        ...c.args,
        kind: "plan",
        body: "",
        videos: [{ label: "Video", url: "https://youtu.be/M7lc1UVf-VE" }],
      },
    }),
    null,
  );
  assert.equal(
    parseNotesCommand({
      action: "read",
      args: {
        bookingId,
        kind: "private",
        before: { at: "invalid", id: bookingId },
      },
    }),
    null,
  );
  assert.equal(
    parseNotesCommand({
      action: "read",
      args: { bookingId, kind: "shared", authorId: bookingId },
    }),
    null,
  );
});
