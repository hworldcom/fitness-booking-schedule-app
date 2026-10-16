import assert from "node:assert/strict";
import test from "node:test";
import { changeGroupParticipation } from "@/server/group-sessions/participation-action";
import {
  athleteEventDetail,
  athleteGroupHistory,
  changeAthleteParticipation,
} from "@/server/group-sessions/athlete-service";

test("event actions reject malformed and owner-only commands before account/database work", async () => {
  const form = new FormData();
  assert.equal((await changeGroupParticipation(form)).status, "invalid");
  assert.equal((await athleteEventDetail("forged")).status, "invalid");
  assert.equal(
    (await athleteGroupHistory({ id: "forged", at: "invalid" })).status,
    "invalid",
  );
  assert.equal(
    (
      await changeAthleteParticipation(
        { action: "owner-list", args: {} } as never,
        "forged",
      )
    ).status,
    "invalid",
  );
});
