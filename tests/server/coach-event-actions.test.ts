import assert from "node:assert/strict";
import test from "node:test";
import {
  changeOwnedGroupEvent,
  ownedGroupEvent,
  ownedGroupEvents,
} from "@/server/group-sessions/owner-service";

test("owner group adapters reject malformed reads and athlete commands before authorization/database entry", async () => {
  assert.equal((await ownedGroupEvent("forged")).status, "invalid");
  assert.equal(
    (await ownedGroupEvents({ at: "forged", id: "forged" })).status,
    "invalid",
  );
  const id = "00000000-0000-4000-8000-000000000001";
  for (const command of [
    { action: "join", args: { id, registrationId: id } },
    { action: "owner-list", args: {} },
    { action: "cancel", args: { id, coachProfileId: id } },
  ])
    assert.equal(
      (
        await changeOwnedGroupEvent(
          command as never,
          Array(3).fill(id).join(":"),
        )
      ).status,
      "invalid",
    );
  assert.equal(
    (await changeOwnedGroupEvent({ action: "cancel", args: { id } }, "forged"))
      .status,
    "invalid",
  );
});
