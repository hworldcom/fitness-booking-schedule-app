import assert from "node:assert/strict";
import test from "node:test";
import { materializeMessageMedia } from "@/server/db/messages/media";
import { parseMessageConversation } from "@/domain/private-messages";
import { createSupabaseProfileImageStorage } from "@/server/storage/supabase-profile-images";
const id = "9a221000-0000-4000-8000-000000000001";
const base = {
  id,
  coachProfileId: id,
  athleteProfileId: id,
  actorProfileId: id,
  counterpartName: "Coach",
  role: "athlete",
  activityAt: "2026-10-17T12:00:00Z",
  canSendGeneral: true,
  canRequestGeneral: false,
  blocked: false,
  blockedByMe: false,
  unread: false,
  consent: null,
};
const updatedAt = "2026-10-17T12:00:00Z";
const project = (media: unknown, role = "athlete") =>
  parseMessageConversation(
    materializeMessageMedia({ ...base, role, counterpartMedia: media }),
  );
test("message media maps public portraits and opaque independent private endpoints, discarding raw references", () => {
  assert.equal(project(null).counterpartImageUrl, null);
  const fixture = project({
    kind: "coach-portrait",
    source: "fixture",
    path: "/images/coaches/daniel-park.webp",
    updatedAt,
  });
  assert.equal(fixture.counterpartImageUrl, "/images/coaches/daniel-park.webp");
  for (const [kind, path] of [
    ["connection-avatar", `/api/connections/${id}/athlete-avatar`],
    ["request-avatar", `/api/coach/requests/${id}/client-avatar`],
  ]) {
    const result = project(
      { kind, id, updatedAt, avatar_storage_path: "private-secret" },
      "coach",
    );
    assert.ok(result.counterpartImageUrl?.startsWith(path + "?v="));
    assert.doesNotMatch(
      JSON.stringify(result),
      /private-secret|counterpartMedia|storage_path/,
    );
  }
  assert.equal(
    project({
      kind: "coach-portrait",
      source: "storage",
      path: `${id}/${id}.webp`,
      updatedAt,
    }).counterpartImageUrl,
    null,
  );
});
test("uploaded public portraits use the configured public bucket and preserve their version", () => {
  const value = materializeMessageMedia(
    {
      ...base,
      counterpartMedia: {
        kind: "coach-portrait",
        source: "storage",
        path: `${id}/${id}.webp`,
        updatedAt,
      },
    },
    createSupabaseProfileImageStorage({
      client: async () => null,
      publicOrigin: () => "http://127.0.0.1:55321",
    }),
  );
  assert.equal(
    parseMessageConversation(value).counterpartImageUrl,
    `http://127.0.0.1:55321/storage/v1/object/public/coach-portraits/${id}/${id}.webp?v=${encodeURIComponent(updatedAt)}`,
  );
});
test("member photos bind to the exact counterpart in either chat direction", () => {
  for (const role of ["athlete", "coach"]) {
    const result = project({ kind: "member-avatar", id, updatedAt }, role);
    assert.equal(
      result.counterpartImageUrl,
      `/api/members/${id}/avatar?v=${encodeURIComponent(new Date(updatedAt).toISOString())}`,
    );
    assert.ok(!("counterpartMedia" in result));
    assert.throws(() =>
      project(
        {
          kind: "member-avatar",
          id: "9a221000-0000-4000-8000-000000000002",
          updatedAt,
        },
        role,
      ),
    );
  }
});
test("malformed, wrong-role and arbitrary image references fail closed", () => {
  for (const raw of [
    { kind: "connection-avatar", id, updatedAt },
    {
      kind: "coach-portrait",
      source: "fixture",
      path: "https://tracking.example/pixel",
      updatedAt,
    },
    {
      kind: "coach-portrait",
      source: "storage",
      path: "some-other-owner/object.webp",
      updatedAt,
    },
    {
      kind: "coach-portrait",
      source: "fixture",
      path: "/images/coaches/daniel-park.webp",
      updatedAt: "invalid",
    },
  ])
    assert.throws(() => project(raw));
  for (const url of [
    "javascript:alert(1)",
    "https://tracking.example/image",
    `/api/connections/${id}/athlete-avatar?v=invalid`,
    `/api/connections/${id}/athlete-avatar?v=${updatedAt}&extra=1`,
  ])
    assert.throws(() =>
      parseMessageConversation({ ...base, counterpartImageUrl: url }),
    );
});
