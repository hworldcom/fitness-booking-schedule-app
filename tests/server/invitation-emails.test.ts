import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  invitationEmail,
  parseInvitationEmail,
} from "@/server/notifications/invitation-email";
import { createEmailTransport } from "@/server/notifications/delivery";
test("invitation mail escapes content and keeps secret in fragment, never Auth or HTTP query", async () => {
  const value = {
    kind: "coach-invitation" as const,
    id: randomUUID(),
    email: "client@example.test",
    coachName: "Coach <script>",
    token: "A".repeat(43),
  };
  const email = invitationEmail(value, "http://localhost:3100");
  assert.ok(email.html.includes("Coach &lt;script&gt;"));
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.text.includes("/invitations#" + value.token));
  assert.ok(!email.text.includes("?"));
  assert.ok(!email.text.includes("session notes:"));
  assert.throws(() => parseInvitationEmail({ ...value, token: "short" }));
  assert.throws(() => invitationEmail(value, "https://attacker.test/path"));
  let calls = 0;
  const send = createEmailTransport(
    {
      transport: "mailpit",
      siteUrl: "http://localhost:3100",
      mailpitUrl: "http://127.0.0.1:55324",
    },
    async (url, init) => {
      calls++;
      assert.equal(String(url), "http://127.0.0.1:55324/api/v1/send");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.To[0].Email, value.email);
      assert.ok(body.Text.includes(value.token));
      return Response.json({ ID: "captured" });
    },
  );
  assert.deepEqual(await send(value), {
    status: "accepted",
    providerId: "captured",
  });
  assert.equal(calls, 1);
});
