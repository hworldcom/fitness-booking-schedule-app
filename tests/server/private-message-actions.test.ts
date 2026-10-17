import assert from "node:assert/strict";
import test from "node:test";
import { currentMessageCommand } from "@/server/messages/service";

test("retired message approval commands and filtering fail before authorization or database access", async () => {
  const id = "ac028000-0000-4000-8000-000000000001";
  for (const action of ["request-consent", "consent"])
    assert.deepEqual(
      await currentMessageCommand({
        action,
        args: {
          conversationId: id,
          submissionId: id,
          consentId: id,
          body: "Retired opening",
          decision: "accept",
        },
      }),
      { status: "invalid" },
    );
  assert.deepEqual(
    await currentMessageCommand({
      action: "inbox",
      args: { filter: "requests" },
    }),
    { status: "invalid" },
  );
});
