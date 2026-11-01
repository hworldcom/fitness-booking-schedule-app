import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  clientFields,
  parseClientCommand,
  parseInvitationCommand,
  parseExternalPage,
  parseInvitationReview,
  parseClientInvitation,
} from "@/domain/external-clients";
import { parseTypedRequest } from "@/domain/typed-sessions";
test("external client input is bounded and optional email never guesses aliases", () => {
  assert.deepEqual(
    clientFields({ name: "  Grace  ", email: "  Grace+Boxing@Example.TEST " }),
    { name: "Grace", email: "grace+boxing@example.test" },
  );
  assert.deepEqual(clientFields({ name: "Name only", email: "" }), {
    name: "Name only",
    email: null,
  });
  for (const v of [
    { name: "" },
    { name: "a".repeat(121) },
    { name: "Name\nInjected" },
    { name: "Name", email: "a@b" },
    { name: "Name", email: "x\r\n@b.test" },
    { name: "Name", email: 7 },
  ])
    assert.equal(clientFields(v), null);
  const create = {
    action: "create",
    operationId: randomUUID(),
    name: "Name only",
    email: null,
  };
  assert.ok(parseClientCommand(create));
  assert.equal(parseClientCommand({ ...create, id: randomUUID() }), null);
  assert.equal(
    parseClientCommand({ ...create, linkedProfileId: randomUUID() }),
    null,
  );
  assert.throws(() => parseExternalPage({ items: [], next: "forged" }));
});
test("booking creation chooses exactly one real participant reference", () => {
  const value = {
    commandId: randomUUID(),
    action: "create",
    typeId: randomUUID(),
    typeRevision: 1,
    locationId: randomUUID(),
    startsAt: "2026-11-04T10:00:00Z",
    durationMinutes: 60,
    externalClientId: randomUUID(),
  };
  assert.ok(parseTypedRequest(value, true));
  assert.equal(
    parseTypedRequest({ ...value, athleteId: randomUUID() }, true),
    null,
  );
  const base = { ...value, externalClientId: undefined };
  assert.equal(parseTypedRequest(base, true), null);
  assert.ok(parseTypedRequest({ ...base, athleteId: randomUUID() }, true));
  assert.equal(
    parseTypedRequest(
      {
        ...value,
        action: "override",
        bookingId: randomUUID(),
        expectedRevision: 0,
      },
      true,
    ),
    null,
  );
});
test("invitations require exact operation and current client/invitation revisions", () => {
  const v = {
    action: "send",
    operationId: randomUUID(),
    externalClientId: randomUUID(),
    clientRevision: 1,
    expectedInvitationId: null,
    expectedRevision: null,
  };
  assert.ok(parseInvitationCommand(v));
  assert.equal(parseInvitationCommand({ ...v, token: "chosen" }), null);
  assert.equal(parseInvitationCommand({ ...v, clientRevision: -1 }), null);
  assert.equal(
    parseInvitationCommand({ ...v, expectedInvitationId: randomUUID() }),
    null,
  );
});

test("invitation projections fail closed and strip recipient/history metadata from public review", () => {
  assert.deepEqual(
    parseInvitationReview({
      state: "pending",
      coachName: "Coach",
      email: "private@example.test",
      sessionCount: 3,
    }),
    { state: "pending", coachName: "Coach" },
  );
  assert.deepEqual(
    parseInvitationReview({ state: "unavailable", coachName: "private" }),
    { state: "unavailable" },
  );
  assert.throws(() => parseInvitationReview(null));
  assert.throws(() => parseInvitationReview({ state: "pending" }));
  assert.throws(() =>
    parseClientInvitation({ id: randomUUID(), status: "invented" }),
  );
});
