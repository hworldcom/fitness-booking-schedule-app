import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  parseRegistrationEmail,
  type RegistrationEmailPayload,
} from "@/server/notifications/registration";
import {
  registrationEmail,
  createEmailTransport,
} from "@/server/notifications/delivery";

const payload: RegistrationEmailPayload = {
  kind: "registration",
  id: randomUUID(),
  email: "hello@movx.club",
  authUserId: randomUUID(),
  signupEmail: "new&member@example.test",
  registeredAt: "2026-11-06T10:00:00.000Z",
  provider: "email",
  verifiedAtSignup: false,
};

test("registration mail reports unverified signup without inventing a completed profile or verified identity", () => {
  const p = parseRegistrationEmail({
    ...payload,
    password: "SECRET",
    access_token: "SECRET",
    raw_user_meta_data: { full_name: "SECRET" },
  });
  assert.deepEqual(p, payload);
  const mail = registrationEmail(p, "https://movx.club");
  assert.deepEqual(mail.to, ["hello@movx.club"]);
  assert.equal(mail.from, "MovX Club <notification@movx.club>");
  assert.equal(mail.reply_to, "hello@movx.club");
  for (const value of [
    payload.signupEmail,
    payload.authUserId,
    payload.registeredAt,
    "https://movx.club",
    "No (unverified)",
    "Profile setup may still be incomplete",
  ])
    assert.ok(mail.text.includes(value), value);
  assert.match(mail.html, /new&amp;member/);
  assert.doesNotMatch(mail.html + mail.text, /SECRET|\/admin/);
  const google = registrationEmail(
    { ...payload, provider: "google", verifiedAtSignup: true },
    "https://uat.movx.club",
  );
  assert.match(google.text, /Email verified at signup: Yes/);
  assert.match(google.text, /Registration method: Google/);
});

test("staff parsing rejects recipient changes, header injection and malformed or excessive snapshots", () => {
  for (const patch of [
    { email: "attacker@example.test" },
    { signupEmail: "x@example.test\r\nBcc: other@example.test" },
    { signupEmail: "<script>@example.test" },
    { signupEmail: "x".repeat(321) + "@example.test" },
    { authUserId: "bad" },
    { id: "bad" },
    { registeredAt: "tomorrow" },
    { verifiedAtSignup: "true" },
    { provider: "<img src=x>" },
    { kind: "message" },
  ])
    assert.throws(
      () => parseRegistrationEmail({ ...payload, ...patch }),
      /Invalid registration email/,
    );
  assert.throws(() =>
    registrationEmail(payload, "https://example.test/private"),
  );
});

test("staff retries retain one registration idempotency key and never send to the signup address", async () => {
  const requests: RequestInit[] = [];
  const send = createEmailTransport(
    { transport: "resend", siteUrl: "https://movx.club", apiKey: "re_fixture" },
    async (_url, init) => {
      requests.push(init!);
      return Response.json({ id: "fixture-receipt" });
    },
  );
  for (let i = 0; i < 2; i++)
    assert.deepEqual(await send(payload), {
      status: "accepted",
      providerId: "fixture-receipt",
    });
  for (const request of requests) {
    assert.equal(
      new Headers(request.headers).get("Idempotency-Key"),
      `registration-notice/${payload.id}`,
    );
    assert.deepEqual(JSON.parse(String(request.body)).to, ["hello@movx.club"]);
  }
  assert.equal(requests[0].body, requests[1].body);
  for (const [status, outcome] of [
    [429, "retry"],
    [422, "failed"],
    [408, "unknown"],
    [409, "unknown"],
    [500, "unknown"],
  ] as const) {
    const transport = createEmailTransport(
      {
        transport: "resend",
        siteUrl: "https://movx.club",
        apiKey: "re_fixture",
      },
      async () => new Response(null, { status }),
    );
    assert.equal((await transport(payload)).status, outcome);
  }
});
