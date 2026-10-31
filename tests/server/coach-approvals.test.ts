import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  coachApprovalEmail,
  createEmailTransport,
} from "@/server/notifications/delivery";
import { parseCoachApprovalEmail } from "@/server/notifications/coach-approval";
import { coachApplicationEmail } from "@/server/notifications/delivery";
const payload = {
  kind: "coach-approval" as const,
  event: "approved" as const,
  id: randomUUID(),
  email: "coach@example.test",
  displayName: '<Coach> & "Training"',
  approvedAt: "2026-10-30T12:00:00.000Z",
};
test("approval email is recipient-only, escaped, honest about publication and strips staff internals", () => {
  const parsed = parseCoachApprovalEmail({
    ...payload,
    reason: "PRIVATE",
    reviewerReference: "PRIVATE",
    phoneNumber: "PRIVATE",
  });
  assert.deepEqual(parsed, payload);
  const email = coachApprovalEmail(parsed, "https://movx.club");
  assert.deepEqual(email.to, [payload.email]);
  assert.equal(email.from, "MovX Club <notification@movx.club>");
  assert.equal(email.reply_to, "hello@movx.club");
  assert.match(email.text, /was approved/);
  assert.match(email.text, /hidden until you publish/);
  assert.match(email.text, /https:\/\/movx.club\/profile\/coach/);
  assert.doesNotMatch(email.html, /<Coach>|PRIVATE/);
  assert.match(email.html, /&lt;Coach&gt; &amp; &quot;Training&quot;/);
  for (const patch of [
    { id: "bad" },
    { email: "coach@example.test\r\nBcc: other@example.test" },
    { email: "not an email" },
    { kind: "coach-application" },
    { event: "rejected" },
    { displayName: "A" },
    { approvedAt: "tomorrow" },
  ])
    assert.throws(() => parseCoachApprovalEmail({ ...payload, ...patch }));
});
test("approval provider retries keep one stable kind-specific key and ambiguous handoffs stay unknown", async () => {
  const keys: string[] = [],
    bodies: unknown[] = [];
  const send = createEmailTransport(
    {
      transport: "resend",
      siteUrl: "https://movx.club",
      apiKey: "re_fixture_only",
    },
    async (_url, init) => {
      keys.push(new Headers(init?.headers).get("idempotency-key")!);
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({ id: "fixture-provider-id" });
    },
  );
  for (let i = 0; i < 2; i++)
    assert.deepEqual(await send(payload), {
      status: "accepted",
      providerId: "fixture-provider-id",
    });
  assert.deepEqual(keys, [
    `coach-approval-notice/${payload.id}`,
    `coach-approval-notice/${payload.id}`,
  ]);
  assert.deepEqual(bodies[0], bodies[1]);
  for (const status of [408, 409, 500])
    assert.deepEqual(
      await createEmailTransport(
        {
          transport: "resend",
          siteUrl: "https://movx.club",
          apiKey: "re_fixture_only",
        },
        async () => new Response("", { status }),
      )(payload),
      { status: "unknown" },
    );
});
test("submission email includes only a configured matching staff review link", () => {
  const p = {
    kind: "coach-application" as const,
    id: randomUUID(),
    email: "hello@movx.club" as const,
    profileId: randomUUID(),
    applicationRevision: 1,
    displayName: "QA Coach",
    submittedAt: payload.approvedAt,
    applicantEmail: payload.email,
  };
  assert.match(
    coachApplicationEmail(p, "https://movx.club", "https://admin.movx.club")
      .text,
    new RegExp(`https://admin.movx.club/admin/coaches/${p.profileId}`),
  );
  assert.doesNotMatch(
    coachApplicationEmail(p, "https://movx.club", "https://admin-uat.movx.club")
      .text,
    /\/admin\/coaches/,
  );
});
