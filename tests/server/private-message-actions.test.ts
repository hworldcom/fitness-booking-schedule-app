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

test("person messages reject session attachments and filtering before reading Auth or SQL", async () => {
  const id = "ac028000-0000-4000-8000-000000000001";
  for (const command of [
    {
      action: "send",
      args: {
        conversationId: id,
        submissionId: id,
        body: "Hello",
        contextId: id,
      },
    },
    { action: "thread", args: { conversationId: id, contextId: id } },
  ])
    assert.deepEqual(await currentMessageCommand(command, 3), {
      status: "invalid",
    });
});
