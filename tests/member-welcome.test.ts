import assert from "node:assert/strict";
import test from "node:test";
import { parseMessageConversation } from "@/domain/private-messages";
import { messageVersion, MESSAGE_VERSION_HEADER } from "@/messages/version";

const official = {
  id: "ae013100-0000-4000-8000-000000000001",
  coachProfileId: null,
  athleteProfileId: "ae013100-0000-4000-8000-000000000002",
  actorProfileId: "ae013100-0000-4000-8000-000000000002",
  counterpartName: "MovX",
  counterpartImageUrl: null,
  counterpartProfileHref: null,
  role: "movx",
  activityAt: "2026-10-27T10:00:00Z",
  canSendGeneral: false,
  canRequestGeneral: false,
  blocked: false,
  blockedByMe: false,
  unread: true,
  consent: null,
};

test("official welcome DTO cannot claim a human profile, media or interaction capabilities", () => {
  assert.equal(parseMessageConversation(official).role, "movx");
  for (const patch of [
    { coachProfileId: official.actorProfileId },
    { actorProfileId: official.id },
    { counterpartName: "A coach" },
    { counterpartProfileHref: "/members/" + official.actorProfileId },
    { counterpartImageUrl: "/images/coaches/jake-miller.webp" },
    { canSendGeneral: true },
    { canRequestGeneral: true },
    { blocked: true },
    { blockedByMe: true },
    { consent: {} },
  ])
    assert.throws(() => parseMessageConversation({ ...official, ...patch }));
  assert.throws(() =>
    parseMessageConversation({ ...official, role: "athlete" }),
  );
});

test("message version opt-in preserves absent/v1 clients and rejects unknown versions", () => {
  assert.equal(messageVersion(new Headers()), 1);
  assert.equal(
    messageVersion(new Headers({ [MESSAGE_VERSION_HEADER]: "1" })),
    1,
  );
  assert.equal(
    messageVersion(new Headers({ [MESSAGE_VERSION_HEADER]: "2" })),
    2,
  );
  for (const value of ["0", "3", "02", "", "2,1", "welcome"])
    assert.equal(
      messageVersion(new Headers({ [MESSAGE_VERSION_HEADER]: value })),
      null,
    );
});
