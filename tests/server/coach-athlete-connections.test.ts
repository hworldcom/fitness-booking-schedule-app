import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/connections/[connectionId]/athlete-avatar/route";
import {
  loadConnectionHistoryAction,
  loadConnectionPagesAction,
  loadConnectionPageAction,
  mutateConnectionAction,
} from "@/app/connections/actions";
import { connectionAthleteAvatarBytes } from "@/server/connections/avatar";
import {
  currentConnectionHistory,
  sendCoachAthleteConnection,
} from "@/server/connections/service";

const id = "9a221000-0000-4000-8000-000000000001";
const version = "2026-10-14T12:00:00.000Z";
const reference = {
  status: "ready" as const,
  value: { path: `${id}/${id}.webp`, updatedAt: version },
};
const bytes = new Uint8Array([82, 73, 70, 70]);

test("pending, disconnected and unauthorized avatar reads never call Storage", async () => {
  for (const status of [
    "not-found",
    "signed-out",
    "forbidden",
    "unavailable",
  ] as const) {
    let calls = 0;
    const result = await connectionAthleteAvatarBytes(id, {
      reference: async () => ({ status }),
      download: async () => {
        calls++;
        return bytes;
      },
    });
    assert.equal(result.status, status);
    assert.equal(calls, 0);
    assert.equal("bytes" in result, false);
  }
});
test("disconnect or replacement during download revokes connection-only bytes", async () => {
  for (const changed of [
    { status: "not-found" as const },
    {
      status: "ready" as const,
      value: { ...reference.value, updatedAt: "2026-10-14T12:01:00.000Z" },
    },
  ]) {
    let reads = 0;
    const result = await connectionAthleteAvatarBytes(id, {
      reference: async () => (++reads === 1 ? reference : changed),
      download: async () => bytes,
    });
    assert.equal(result.status, "not-found");
    assert.equal("bytes" in result, false);
    assert.equal(reads, 2);
  }
});
test("accepted unchanged references yield bytes and provider failures stay bounded", async () => {
  const result = await connectionAthleteAvatarBytes(id, {
    reference: async () => reference,
    download: async () => bytes,
  });
  assert.equal(result.status, "ready");
  if (result.status === "ready") assert.deepEqual(result.bytes, bytes);
  for (const download of [
    async () => null,
    async () => {
      throw new Error("private-provider-detail");
    },
  ]) {
    const failed = await connectionAthleteAvatarBytes(id, {
      reference: async () => reference,
      download,
    });
    assert.deepEqual(failed, { status: "unavailable" });
    assert.doesNotMatch(JSON.stringify(failed), /private-provider-detail|webp/);
  }
});
test("malformed avatar routes return private non-cacheable errors", async () => {
  const response = await GET(
    new Request("http://localhost/api/connections/invalid/athlete-avatar"),
    { params: Promise.resolve({ connectionId: "invalid" }) },
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.equal(await response.text(), "");
});
test("untrusted connection/action/cursor inputs fail before identity or database access", async () => {
  const idle = { status: "idle" as const, message: "", connection: null };
  const form = new FormData();
  form.set("intent", "accept");
  form.set("connectionId", "invalid");
  form.set("actorProfileId", id);
  assert.equal((await mutateConnectionAction(idle, form)).status, "invalid");
  form.set("intent", "send");
  form.set("bookingId", id);
  form.set("operationId", id);
  form.set("previousId", "old-invalid");
  assert.equal((await mutateConnectionAction(idle, form)).status, "invalid");
  assert.deepEqual(await loadConnectionPagesAction("operator"), {
    accepted: null,
    incoming: null,
    outgoing: null,
    history: null,
  });
  assert.deepEqual(await loadConnectionPageAction("operator", "accepted"), {
    status: "invalid",
  });
  assert.deepEqual(
    await loadConnectionPageAction("athlete", "accepted", {
      id,
      createdAt: "invalid",
    }),
    { status: "invalid" },
  );
  assert.deepEqual(await loadConnectionHistoryAction("invalid"), {
    status: "invalid",
  });
  assert.deepEqual(
    await loadConnectionHistoryAction(
      Symbol.for("forged-id") as unknown as string,
    ),
    { status: "invalid" },
  );
  assert.deepEqual(await sendCoachAthleteConnection("invalid", id, null), {
    status: "invalid",
  });
  assert.deepEqual(await currentConnectionHistory(id, { pageSize: 51 }), {
    status: "invalid",
  });
});

test("connection cache versions bind actor/run/perspective and every authoritative read, even when empty data repeats", async () => {
  const { connectionWorkspaceVersion } =
    await import("@/server/connections/workspace-version");
  const empty = { accepted: { items: [], nextCursor: null } };
  const first = connectionWorkspaceVersion(
    "auth-a:profile-a:run-a:member",
    "athlete",
    empty,
    "read-one",
  );
  assert.equal(
    first,
    connectionWorkspaceVersion(
      "auth-a:profile-a:run-a:member",
      "athlete",
      JSON.parse(JSON.stringify(empty)),
      "read-one",
    ),
  );
  for (const scope of [
    "auth-b:profile-b:run-a:member",
    "auth-a:profile-a:run-b:member",
    "auth-a:profile-a:run-a:operator",
  ])
    assert.notEqual(
      first,
      connectionWorkspaceVersion(scope, "athlete", empty, "read-one"),
    );
  assert.notEqual(
    first,
    connectionWorkspaceVersion(
      "auth-a:profile-a:run-a:member",
      "coach",
      empty,
      "read-one",
    ),
  );
  assert.notEqual(
    first,
    connectionWorkspaceVersion(
      "auth-a:profile-a:run-a:member",
      "athlete",
      empty,
      "read-two",
    ),
  );
  assert.notEqual(
    connectionWorkspaceVersion(
      "auth-a:profile-a:run-a:member",
      "athlete",
      empty,
    ),
    connectionWorkspaceVersion(
      "auth-a:profile-a:run-a:member",
      "athlete",
      empty,
    ),
  );
});
