import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  parseCoachApplicationEmail,
  type CoachApplicationEmailPayload,
} from "@/server/notifications/coach-application";
import {
  coachApplicationEmail,
  createEmailTransport,
} from "@/server/notifications/delivery";

const payload: CoachApplicationEmailPayload = {
  kind: "coach-application",
  id: randomUUID(),
  email: "hello@movx.club",
  profileId: randomUUID(),
  applicationRevision: 3,
  displayName: '<Coach> & "Training"',
  submittedAt: "2026-10-25T12:00:00.000Z",
  applicantEmail: "coach@example.test",
};

test("staff email contains the submitted identity and workspace with escaped HTML and no invented review link", () => {
  const email = coachApplicationEmail(payload, "https://uat.movx.club");
  assert.deepEqual(email.to, ["hello@movx.club"]);
  assert.equal(email.from, "MovX Club <notification@movx.club>");
  assert.equal(email.reply_to, "hello@movx.club");
  assert.match(email.text, /was submitted/);
  for (const value of [
    payload.displayName,
    payload.applicantEmail,
    payload.profileId,
    payload.submittedAt,
    "Application revision: 3",
    "https://uat.movx.club",
  ])
    assert.ok(email.text.includes(value));
  assert.ok(email.html.includes("&lt;Coach&gt; &amp; &quot;Training&quot;"));
  assert.equal(email.html.includes("<Coach>"), false);
  assert.match(email.text, /check the current application state/);
  assert.equal(email.html.includes("/admin"), false);
});

test("staff payload parsing rejects recipient override, injected headers and malformed identities while stripping extras", () => {
  assert.deepEqual(
    parseCoachApplicationEmail({
      ...payload,
      secret: "private",
      runId: randomUUID(),
    }),
    payload,
  );
  for (const patch of [
    { email: "other@example.test" },
    { applicantEmail: "coach@example.test\r\nBcc: outsider@example.test" },
    { id: "not-an-id" },
    { profileId: null },
    { displayName: "  " },
    { displayName: "Coach\nName" },
    { submittedAt: "tomorrow" },
    { applicationRevision: 0 },
    { applicationRevision: 1.5 },
    { applicationRevision: 1000001 },
  ])
    assert.throws(
      () => parseCoachApplicationEmail({ ...payload, ...patch }),
      /Invalid application email/,
    );
});

test("staff Resend deliveries use a distinct stable idempotency key and a fixed recipient", async () => {
  const requests: RequestInit[] = [];
  const send = createEmailTransport(
    {
      transport: "resend",
      siteUrl: "https://uat.movx.club",
      apiKey: "re_test_key",
    },
    async (_url, init) => {
      requests.push(init!);
      return Response.json({ id: "provider-staff" });
    },
  );
  assert.deepEqual(await send(payload), {
    status: "accepted",
    providerId: "provider-staff",
  });
  await send(payload);
  for (const request of requests) {
    assert.equal(
      new Headers(request.headers).get("Idempotency-Key"),
      `coach-application-notice/${payload.id}`,
    );
    assert.deepEqual(JSON.parse(request.body as string).to, [
      "hello@movx.club",
    ]);
  }
});

test("staff sends retain bounded rejection/unknown recovery and loopback-only capture", async () => {
  for (const [status, expected] of [
    [429, "retry"],
    [422, "failed"],
    [503, "unknown"],
    [408, "unknown"],
  ] as const) {
    const send = createEmailTransport(
      {
        transport: "resend",
        siteUrl: "https://uat.movx.club",
        apiKey: "re_test_key",
      },
      async () => new Response(null, { status }),
    );
    assert.equal((await send(payload)).status, expected);
  }
  assert.throws(
    () =>
      createEmailTransport({
        transport: "mailpit",
        siteUrl: "https://uat.movx.club",
        mailpitUrl: "https://mail.example.test",
      }),
    /loopback/,
  );
});

test("staff email includes the private submitted contact snapshot, with optional socials omitted and HTML escaped", () => {
  const applicationContact = {
    phoneNumber: "+4915123456789",
    instagramUrl: "https://www.instagram.com/test_coach",
    facebookUrl: "https://www.facebook.com/profile.php?id=123&ref=review",
    linkedinUrl: "https://www.linkedin.com/in/test-coach",
  };
  const rendered = coachApplicationEmail(
    { ...payload, applicationContact },
    "https://uat.movx.club",
  );
  for (const value of Object.values(applicationContact))
    assert.ok(rendered.text.includes(value));
  assert.ok(rendered.html.includes("id=123&amp;ref=review"));
  const minimal = coachApplicationEmail(
    {
      ...payload,
      applicationContact: {
        ...applicationContact,
        instagramUrl: null,
        facebookUrl: null,
        linkedinUrl: null,
      },
    },
    "https://uat.movx.club",
  );
  assert.match(minimal.text, /Phone number: \+4915123456789/);
  assert.equal(minimal.text.includes("Instagram:"), false);
  assert.equal(minimal.text.includes("Facebook:"), false);
  assert.equal(minimal.text.includes("LinkedIn:"), false);
  assert.equal(
    coachApplicationEmail(payload, "https://uat.movx.club").text.includes(
      "Phone number:",
    ),
    false,
  );
});

test("staff parser rejects invalid contact snapshots and continues accepting pre-contact jobs", () => {
  const applicationContact = {
    phoneNumber: "+4915123456789",
    instagramUrl: null,
    facebookUrl: null,
    linkedinUrl: null,
  };
  for (const patch of [
    { phoneNumber: "+49151\r\nBcc: other@test" },
    { instagramUrl: "https://instagram.com.evil.test/coach" },
    { linkedinUrl: "javascript:alert(1)" },
    { facebookUrl: false },
  ])
    assert.throws(() =>
      parseCoachApplicationEmail({
        ...payload,
        applicationContact: { ...applicationContact, ...patch },
      }),
    );
  assert.deepEqual(parseCoachApplicationEmail(payload), payload);
  assert.equal(
    parseCoachApplicationEmail({ ...payload, applicationContact: null })
      .applicationContact,
    null,
  );
  assert.deepEqual(
    parseCoachApplicationEmail({
      ...payload,
      applicationContact: { ...applicationContact, secret: "stripped" },
    }).applicationContact,
    applicationContact,
  );
});
