import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMessageInbox,
  parseMessageThread,
  validMessageBody,
  validMessageCommand,
} from "@/domain/private-messages";
const id = "ac024400-0000-4000-8000-000000000001";
const conversation = {
  id,
  coachProfileId: id,
  athleteProfileId: id,
  actorProfileId: id,
  counterpartName: "Coach",
  role: "athlete",
  activityAt: "2026-10-15T10:00:00Z",
  canSendGeneral: false,
  canRequestGeneral: false,
  blocked: false,
  blockedByMe: false,
  unread: true,
  consent: null,
};
test("message Unicode, body and envelope bounds reject invalid input without silently truncating", () => {
  assert.ok(validMessageBody("🥊".repeat(4000)));
  assert.ok(validMessageBody("First line\nSecond line"));
  for (const value of [
    "",
    " \n\t",
    "\u00a0",
    "x".repeat(4001),
    "🥊".repeat(4001),
    "\ud800",
    "\udfff",
    "Hi\0there",
    null,
  ])
    assert.equal(validMessageBody(value), false);
  assert.equal(
    validMessageCommand({
      action: "send",
      args: {
        conversationId: id,
        contextId: null,
        submissionId: id,
        body: "Hello",
      },
    }),
    true,
  );
  assert.equal(
    validMessageCommand({
      action: "send",
      args: {
        conversationId: id,
        contextId: null,
        submissionId: id,
        body: "Hello",
        junk: "x".repeat(33000),
      },
    }),
    false,
  );
  assert.equal(
    validMessageCommand({
      action: "thread",
      args: { conversationId: id, before: 5, after: 2 },
    }),
    false,
  );
  assert.equal(
    validMessageCommand({
      action: "consent",
      args: { conversationId: id, consentId: id, decision: "connect" },
    }),
    false,
  );
  assert.equal(
    validMessageCommand({ action: "open", args: { pairId: id } }),
    true,
  );
});
test("message DTO whitelist discards private media, identity and note fields", () => {
  const value = parseMessageInbox({
    items: [
      {
        ...conversation,
        email: "private@example.test",
        avatarUrl: "/private/secret",
        privateNotes: "Hidden",
      },
    ],
    unreadCount: 1,
  });
  assert.deepEqual(value.items[0], conversation);
  assert.ok(!/private|email|avatar|Notes/.test(JSON.stringify(value)));
  const thread = parseMessageThread({
    conversation,
    entries: [],
    contexts: [],
    lastSeq: 0,
    readThrough: 0,
    privateNotes: "Hidden",
  });
  assert.ok(!JSON.stringify(thread).includes("Hidden"));
  assert.throws(() =>
    parseMessageInbox({
      items: new Array(21).fill(conversation),
      unreadCount: 0,
    }),
  );
  assert.throws(() =>
    parseMessageThread({
      conversation,
      entries: [],
      contexts: [],
      lastSeq: -1,
      readThrough: 0,
    }),
  );
});
