import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  parseVerificationEmail,
  type VerificationEmailPayload,
} from "@/server/notifications/verification";
import {
  verificationEmail,
  createEmailTransport,
} from "@/server/notifications/delivery";
const payload: VerificationEmailPayload = {
  kind: "verification",
  id: randomUUID(),
  email: "hello@movx.club",
  authUserId: randomUUID(),
  verifiedEmail: "new&verified@example.test",
  registeredAt: "2026-11-06T10:00:00.000Z",
  verifiedAt: "2026-11-06T10:01:00.000Z",
  provider: "email",
};
test("verification email states the confirmed address and time without claiming profile or coach approval", () => {
  assert.deepEqual(
    parseVerificationEmail({
      ...payload,
      password: "PRIVATE",
      token: "PRIVATE",
      name: "PRIVATE",
    }),
    payload,
  );
  const m = verificationEmail(payload, "https://movx.club");
  assert.deepEqual(m.to, ["hello@movx.club"]);
  assert.equal(m.from, "MovX Club <notification@movx.club>");
  assert.equal(m.reply_to, "hello@movx.club");
  for (const v of [
    payload.verifiedEmail,
    payload.verifiedAt,
    payload.registeredAt,
    payload.authUserId,
    "https://movx.club",
    "email address was verified",
    "Profile setup may still be incomplete",
  ])
    assert.ok(m.text.includes(v));
  assert.match(m.html, /new&amp;verified/);
  assert.doesNotMatch(
    m.text + m.html,
    /PRIVATE|coach application was approved|token_hash/,
  );
  for (const patch of [
    { email: "other@example.test" },
    { verifiedEmail: "x@example.test\r\nBcc: other@example.test" },
    { verifiedAt: "tomorrow" },
    { provider: "unknown-provider" },
    { id: "bad" },
    { kind: "registration" },
  ])
    assert.throws(() => parseVerificationEmail({ ...payload, ...patch }));
});
test("verification retries use a separate stable provider key from signup alerts", async () => {
  const requests: RequestInit[] = [];
  const send = createEmailTransport(
    { transport: "resend", siteUrl: "https://movx.club", apiKey: "re_fixture" },
    async (_url, init) => {
      requests.push(init!);
      return Response.json({ id: "verification-receipt" });
    },
  );
  for (let i = 0; i < 2; i++)
    assert.deepEqual(await send(payload), {
      status: "accepted",
      providerId: "verification-receipt",
    });
  await send({
    kind: "registration",
    id: payload.id,
    email: payload.email,
    authUserId: payload.authUserId,
    signupEmail: payload.verifiedEmail,
    registeredAt: payload.registeredAt,
    verifiedAtSignup: false,
    provider: "email",
  });
  assert.equal(
    new Headers(requests[0].headers).get("Idempotency-Key"),
    `verification-notice/${payload.id}`,
  );
  assert.equal(
    new Headers(requests[1].headers).get("Idempotency-Key"),
    new Headers(requests[0].headers).get("Idempotency-Key"),
  );
  assert.notEqual(
    new Headers(requests[2].headers).get("Idempotency-Key"),
    new Headers(requests[0].headers).get("Idempotency-Key"),
  );
  for (const request of requests)
    assert.deepEqual(JSON.parse(String(request.body)).to, ["hello@movx.club"]);
  assert.deepEqual(
    await createEmailTransport(
      {
        transport: "resend",
        siteUrl: "https://movx.club",
        apiKey: "re_fixture",
      },
      async () => new Response(null, { status: 500 }),
    )(payload),
    { status: "unknown" },
  );
});
