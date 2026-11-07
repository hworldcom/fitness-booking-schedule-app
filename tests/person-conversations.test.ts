import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMessageThread,
  parseMessageResult,
} from "@/domain/private-messages";
const a = "ac017700-0000-4000-8000-000000000001",
  b = "ac017700-0000-4000-8000-000000000002",
  id = "ac017700-0000-4000-8000-000000000003";
const conversation = {
  id,
  coachProfileId: a,
  athleteProfileId: b,
  actorProfileId: a,
  counterpartName: "Other person",
  counterpartImageUrl: null,
  counterpartProfileHref: null,
  role: "coach",
  activityAt: "2026-11-07T00:00:00Z",
  canSendGeneral: true,
  canRequestGeneral: false,
  blocked: false,
  blockedByMe: false,
  unread: true,
  consent: null,
};
const context = {
  id,
  kind: "booking",
  requestId: null,
  bookingId: id,
  status: "confirmed",
  startsAt: "2026-11-09T10:00:00Z",
  endsAt: "2026-11-09T11:00:00Z",
  venue: "Original venue",
  deadline: null,
  canSend: true,
  title: "",
  titleRevision: 0,
  canEditTitle: true,
  actorRole: "athlete",
};
const contact = {
  id,
  senderProfileId: b,
  recipientProfileId: a,
  body: "Prior contact",
  status: "declined",
};
const thread = {
  conversation,
  entries: [],
  contexts: [context],
  lastSeq: 0,
  readThrough: 0,
  hasOlder: false,
  hasNewer: false,
  earlierContacts: [contact],
};
test("combined person history keeps each original booking role and passive prior contact without private extras", () => {
  const parsed = parseMessageThread({
    ...thread,
    privateNotes: "PRIVATE",
    contexts: [{ ...context, privateNotes: "PRIVATE" }],
    earlierContacts: [{ ...contact, email: "PRIVATE" }],
  });
  assert.equal(parsed.contexts[0].actorRole, "athlete");
  assert.deepEqual(parsed.earlierContacts, [contact]);
  assert.doesNotMatch(JSON.stringify(parsed), /PRIVATE/);
  for (const patch of [
    { contexts: [{ ...context, actorRole: "operator" }] },
    { earlierContacts: [null] },
    { earlierContacts: [contact, contact, contact] },
  ])
    assert.throws(() => parseMessageThread({ ...thread, ...patch }));
});

test("contact navigation can reuse an existing person conversation without sending or forwarding private fields", () => {
  assert.deepEqual(
    parseMessageResult("contact", {
      coachId: a,
      name: "Coach",
      conversationId: id,
      privateData: "PRIVATE",
    }),
    { coachId: a, name: "Coach", conversationId: id },
  );
  assert.deepEqual(
    parseMessageResult("contact", { coachId: a, name: "Coach" }),
    { coachId: a, name: "Coach" },
  );
  assert.throws(() =>
    parseMessageResult("contact", {
      coachId: a,
      name: "Coach",
      conversationId: "forged",
    }),
  );
});
