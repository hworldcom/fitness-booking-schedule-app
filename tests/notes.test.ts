import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeVideoReferences,
  parseNotesCommand,
  validNoteText,
  noteTextError,
  noteCharacterCount,
} from "../src/notes/contracts";
import { videoReferenceErrors } from "../src/domain/video-references";
const bookingId = "11000000-0000-4000-8000-000000000001",
  operationId = "11000000-0000-4000-8000-000000000002";
test("Instagram plural Reel links save the existing canonical identity without accepting browsing URLs", () => {
  const expected = [
    { label: "Technique", url: "https://www.instagram.com/reel/ABC_123/" },
  ];
  const command = (url: string) =>
    parseNotesCommand({
      action: "save",
      args: {
        bookingId,
        operationId,
        kind: "shared",
        revision: 0,
        body: "Session feedback",
        videos: [{ label: "Technique", url }],
      },
    });
  for (const host of ["instagram.com", "www.instagram.com"]) {
    for (const suffix of ["", "/", "/?igsh=tracking#reference"]) {
      const url = `https://${host}/reels/ABC_123${suffix}`;
      assert.deepEqual(
        normalizeVideoReferences([{ label: "Technique", url }]),
        expected,
      );
      assert.deepEqual(videoReferenceErrors({ label: "Technique", url }), {});
      assert.deepEqual(command(url), command(expected[0].url));
    }
  }
  for (const url of [
    "https://instagram.com/reels/",
    "https://instagram.com/reels/ABC_123/extra",
    "https://instagram.com/reels/audio/123",
    "https://instagram.com/profile/",
    "https://instagram.com.evil.test/reels/ABC_123",
    "https://user@instagram.com/reels/ABC_123",
    "https://instagram.com:444/reels/ABC_123",
    "http://instagram.com/reels/ABC_123",
  ])
    assert.equal(command(url), null);
});
test("note feedback counts normalized Unicode text and locates rejected pasted characters", () => {
  assert.equal(noteCharacterCount("  😀\r\nA  "), 3);
  assert.equal(noteTextError(" \t\n "), "Write a note before saving.");
  assert.equal(noteTextError("😀".repeat(2000)), null);
  assert.match(noteTextError("😀".repeat(2001))!, /Remove 1 character.*2,000/);
  assert.match(noteTextError("x".repeat(2140))!, /Remove 140 characters/);
  assert.equal(noteTextError("", true), null);
  assert.equal(noteTextError("😀".repeat(8000), true), null);
  assert.match(noteTextError("x".repeat(8001), true)!, /8,000/);
  assert.match(
    noteTextError("  First\r\n😀\u0000bad ")!,
    /line 2, character 2/,
  );
  assert.match(noteTextError("A\ud800B")!, /line 1, character 2/);
  assert.equal(noteTextError("First\n\tSecond"), null);
  for (const text of [
    "",
    " ",
    "Valid",
    "😀".repeat(2000),
    "x".repeat(2001),
    "A\u0000B",
    "\ud800",
  ]) {
    assert.equal(validNoteText(text), noteTextError(text) === null);
  }
});

test("video feedback distinguishes title, provider, URL shape and timestamp failures", () => {
  const url = "https://youtu.be/M7lc1UVf-VE";
  assert.deepEqual(videoReferenceErrors({ label: "😀".repeat(80), url }), {});
  for (const label of ["", " ", "x".repeat(81), "A\u0000B", "A\nB", "\ud800"]) {
    const errors = videoReferenceErrors({ label, url });
    assert.ok(errors.label);
    assert.equal(errors.url, undefined);
    assert.throws(() => normalizeVideoReferences([{ label, url }]));
  }
  const failures = [
    ["not-a-url", /full video URL/],
    ["http://youtu.be/M7lc1UVf-VE", /HTTPS/],
    ["https://instagram.com/username/", /post or Reel.*Profile/],
    ["https://youtube.com/playlist?list=abc", /video or Shorts.*playlist/],
    ["https://youtu.be/M7lc1UVf-VE?t=1m30s", /seconds/],
    ["https://example.com/video", /Other websites/],
    ["https://youtu.be/M7lc1UVf-VE?tracking=" + "x".repeat(2048), /2,048/],
  ] as const;
  for (const [invalid, message] of failures) {
    const errors = videoReferenceErrors({ label: "Technique", url: invalid });
    assert.equal(errors.label, undefined);
    assert.match(errors.url!, message);
    assert.throws(() =>
      normalizeVideoReferences([{ label: "Technique", url: invalid }]),
    );
  }
  assert.deepEqual(videoReferenceErrors({ label: " ", url: "bad" }), {
    label: "Add a title for this video.",
    url: "Paste the full video URL, starting with https://.",
  });
});
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
