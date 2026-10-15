import assert from "node:assert/strict";
import test from "node:test";
import {
  currentGroupSessionCommand,
  publicGroupSessions,
} from "@/server/group-sessions/service";

test("group services reject forged publication, participants and pagination before identity/database access", async () => {
  for (const input of [
    null,
    { action: "publish", args: {} },
    { action: "join", args: { id: "forged", registrationId: "forged" } },
    { action: "owner-list", args: { after: { at: "forged", id: "forged" } } },
  ])
    assert.deepEqual(await currentGroupSessionCommand(input), {
      status: "invalid",
    });
  assert.deepEqual(
    await publicGroupSessions({ action: "list", args: { runId: "forged" } }),
    { status: "invalid" },
  );
  assert.deepEqual(
    await publicGroupSessions({
      action: "detail",
      args: { slug: "not-a-session" },
    }),
    { status: "invalid" },
  );
});
