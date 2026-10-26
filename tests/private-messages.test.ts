import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HistoricalContact } from "@/features/messages/historical-contact";
import { validSessionTitle, sessionTitle } from "@/domain/session-titles";
import {
  parseMessageInbox,
  parseMessageConversation,
  parseMessageThread,
  validMessageBody,
  validMessageCommand,
  type MessageConversation,
} from "@/domain/private-messages";
const id = "ac024400-0000-4000-8000-000000000001";
test("obsolete message approval commands and request filtering are rejected while ordinary messaging remains valid", () => {
  for (const action of ["request-consent", "consent"])
    assert.equal(
      validMessageCommand({
        action,
        args: {
          conversationId: id,
          submissionId: id,
          consentId: id,
          body: "Opening message",
          decision: "accept",
        },
      }),
      false,
    );
  assert.equal(
    validMessageCommand({ action: "inbox", args: { filter: "requests" } }),
    false,
  );
  for (const filter of ["all", "unread"])
    assert.equal(
      validMessageCommand({ action: "inbox", args: { filter } }),
      true,
    );
  assert.equal(
    validMessageCommand({
      action: "send",
      args: {
        conversationId: id,
        submissionId: id,
        contextId: null,
        body: "Normal message",
      },
    }),
    true,
  );
});
test("historical pending contact stays readable without approval controls or duplicated accepted messages", () => {
  const value: MessageConversation = {
    id,
    coachProfileId: id,
    athleteProfileId: id,
    actorProfileId: id,
    counterpartName: "Earlier coach",
    counterpartImageUrl: null,
    counterpartProfileHref: null,
    role: "athlete",
    activityAt: "2026-10-17T10:00:00Z",
    canSendGeneral: true,
    canRequestGeneral: false,
    blocked: false,
    blockedByMe: false,
    unread: false,
    consent: {
      id,
      senderProfileId: id,
      recipientProfileId: id,
      body: "Earlier text <script>must stay plain</script>",
      status: "pending",
    },
  };
  const html = renderToStaticMarkup(
    createElement(HistoricalContact, { conversation: value }),
  );
  assert.match(html, /Earlier contact/);
  assert.match(
    html,
    /Earlier text &lt;script&gt;must stay plain&lt;\/script&gt;/,
  );
  assert.match(html, /You/);
  assert.doesNotMatch(
    html,
    /<button|<script>|Accept messages|Decline|Withdraw/,
  );
  for (const status of [
    "accepted",
    "declined",
    "withdrawn",
    "revoked",
  ] as const)
    assert.equal(
      renderToStaticMarkup(
        createElement(HistoricalContact, {
          conversation: { ...value, consent: { ...value.consent!, status } },
        }),
      ),
      "",
    );
});
test("session titles stay optional and bounded; edit and history scope commands validate", () => {
  for (const title of ["", "  Footwork  ", "🥊".repeat(100)])
    assert.equal(validSessionTitle(title), true);
  for (const title of [
    null,
    "x".repeat(101),
    "🥊".repeat(101),
    "one\ntwo",
    "one\ttwo",
    "\ud800",
    "\u2028",
  ])
    assert.equal(validSessionTitle(title), false);
  assert.equal(sessionTitle(""), "Training session");
  assert.equal(
    validMessageCommand({
      action: "session-title",
      args: { bookingId: id, title: "Footwork", expectedRevision: 0 },
    }),
    true,
  );
  assert.equal(
    validMessageCommand({
      action: "session-title",
      args: { bookingId: id, title: "Footwork", expectedRevision: -1 },
    }),
    false,
  );
  assert.equal(
    validMessageCommand({
      action: "thread",
      args: { conversationId: id, contextId: id, after: 50 },
    }),
    true,
  );
  assert.equal(
    validMessageCommand({
      action: "thread",
      args: { conversationId: id, contextId: "forged" },
    }),
    false,
  );
});
const conversation = {
  id,
  coachProfileId: id,
  athleteProfileId: id,
  actorProfileId: id,
  counterpartName: "Coach",
  counterpartImageUrl: null,
  counterpartProfileHref: null,
  role: "athlete",
  activityAt: "2026-10-15T10:00:00Z",
  canSendGeneral: false,
  canRequestGeneral: false,
  blocked: false,
  blockedByMe: false,
  unread: true,
  consent: null,
};
test("message profile links accept only eligible coach, member and legacy relationship routes", () => {
  assert.equal(
    parseMessageConversation({
      ...conversation,
      counterpartProfileHref: undefined,
    }).counterpartProfileHref,
    null,
  );
  for (const [role, href] of [
    ["athlete", "/coaches/test-coach"],
    ["coach", "/coaches/test-coach"],
    ["coach", `/members/${id}`],
    ["athlete", `/members/${id}`],
    ["coach", `/coach/athletes/${id}`],
  ]) {
    assert.equal(
      parseMessageConversation({
        ...conversation,
        role,
        counterpartProfileHref: href,
      }).counterpartProfileHref,
      href,
    );
  }
  for (const href of [
    "https://example.com/profile",
    "//example.com/profile",
    "javascript:alert(1)",
    "/profile",
    "/profile/coach",
    "/members/ac024400-0000-4000-8000-000000000002",
    `/members/${id}?extra=1`,
    "/coaches/test-coach?private=1",
    "/coaches/test-coach#section",
    "/coaches/%2e%2e",
    "/coaches/test%2fcoach",
    `/coach/athletes/${id}`,
    false,
  ])
    assert.throws(() =>
      parseMessageConversation({
        ...conversation,
        counterpartProfileHref: href,
      }),
    );
  for (const href of [
    "/coach/athletes/not-a-pair",
    `/coach/athletes/${id}?extra=1`,
  ])
    assert.throws(() =>
      parseMessageConversation({
        ...conversation,
        role: "coach",
        counterpartProfileHref: href,
      }),
    );
});
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
    hasOlder: false,
    hasNewer: false,
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
