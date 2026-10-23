import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { notificationHandlers } from "@/server/notifications/http";
import { currentNotificationCommand } from "@/server/notifications/service";
import {
  createEmailTransport,
  dispatchNotificationBatch,
  messageEmail,
  bookingEmail,
  type DeliveryOutcome,
  type DeliveryRepository,
} from "@/server/notifications/delivery";
import { runNotificationWorker } from "@/server/notifications/worker";
import { GET as cron } from "@/app/api/internal/notifications/dispatch/route";
import type { BookingNotification } from "@/notifications/bookings";
import { NOTIFICATION_VERSION_HEADER } from "@/notifications/contracts";
const site = "http://localhost:3100";
const payload = {
  id: randomUUID(),
  conversationId: randomUUID(),
  email: "athlete@example.test",
};
test("cached message-only clients retain v1 while new clients opt into booking history", async () => {
  const versions: number[] = [];
  const handler = notificationHandlers(
    async (_input, version) => {
      versions.push(version);
      return { status: "ready", value: {} };
    },
    () => site,
  );
  assert.equal(
    (await handler.GET(new Request(site + "/api/notifications"))).status,
    200,
  );
  assert.equal(
    (
      await handler.GET(
        new Request(site + "/api/notifications", {
          headers: { [NOTIFICATION_VERSION_HEADER]: "2" },
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handler.POST(
        new Request(site + "/api/notifications", {
          method: "POST",
          headers: {
            origin: site,
            "content-type": "application/json",
            [NOTIFICATION_VERSION_HEADER]: "2",
          },
          body: JSON.stringify({
            action: "read-all",
            args: { throughAt: new Date().toISOString() },
          }),
        }),
      )
    ).status,
    200,
  );
  assert.deepEqual(versions, [1, 2, 2]);
  assert.equal(
    (
      await handler.GET(
        new Request(site + "/api/notifications", {
          headers: { [NOTIFICATION_VERSION_HEADER]: "3" },
        }),
      )
    ).status,
    400,
  );
  assert.equal(versions.length, 3);
});
test("booking receipts preserve semantic snapshots, escaping and two independent recipient idempotency keys", async () => {
  const event: BookingNotification = {
    kind: "booking",
    event: "requested",
    sourceKind: "request",
    sourceId: randomUUID(),
    slotId: randomUUID(),
    recipientRole: "athlete",
    startsAt: "2026-10-26T09:00:00.000Z",
    endsAt: "2026-10-26T10:15:00.000Z",
    venueName: "<img src=x onerror=alert(1)> & studio",
  };
  const first = { ...event, id: randomUUID(), email: "athlete@example.test" },
    second = {
      ...event,
      id: randomUUID(),
      email: "coach@example.test",
      recipientRole: "coach" as const,
    };
  const email = bookingEmail(first, site);
  assert.match(email.subject, /Booking request submitted/);
  assert.match(email.text, /not a confirmed booking/);
  assert.match(email.text, /75 min/);
  assert.ok(email.text.includes("/sessions#booking-requests"));
  assert.ok(email.html.includes("&lt;img"));
  assert.ok(!email.html.includes("<img"));
  assert.equal(email.reply_to, "hello@movx.club");
  assert.deepEqual(email.to, ["athlete@example.test"]);
  const requests: RequestInit[] = [];
  const send = createEmailTransport(
    { transport: "resend", siteUrl: site, apiKey: "re_fixture" },
    async (_url, init) => {
      requests.push(init!);
      return Response.json({ id: "provider-id" });
    },
  );
  await send(first);
  await send(first);
  await send(second);
  assert.equal(
    new Headers(requests[0].headers).get("idempotency-key"),
    new Headers(requests[1].headers).get("idempotency-key"),
  );
  assert.notEqual(
    new Headers(requests[0].headers).get("idempotency-key"),
    new Headers(requests[2].headers).get("idempotency-key"),
  );
  assert.equal(
    new Headers(requests[0].headers).get("idempotency-key"),
    `booking-notice/${first.id}`,
  );
  assert.ok(!String(requests[0].body).includes("coach@example.test"));
  assert.throws(() => bookingEmail({ ...first, sourceId: "../hidden" }, site));
});
test("invalid notification commands fail before Auth or database work", async () => {
  assert.deepEqual(
    await currentNotificationCommand({
      action: "list",
      args: { recipientId: randomUUID() },
    }),
    { status: "invalid" },
  );
});
test("recipient HTTP API bounds payloads and enforces origin without private caching", async () => {
  const calls: unknown[] = [];
  const handlers = notificationHandlers(
    async (input) => {
      calls.push(input);
      return { status: "signed-out" };
    },
    () => site,
  );
  const get = await handlers.GET(
    new Request(`${site}/api/notifications?filter=unread`),
  );
  assert.equal(get.status, 401);
  assert.equal(get.headers.get("cache-control"), "private, no-store");
  assert.equal(get.headers.get("vary"), "Cookie");
  assert.equal(calls.length, 1);
  for (const query of ["recipientId=anything", "filter=all&filter=unread"])
    assert.equal(
      (await handlers.GET(new Request(`${site}/api/notifications?${query}`)))
        .status,
      400,
    );
  const post = (
    body: string | ArrayBuffer,
    origin = site,
    type = "application/json",
  ) =>
    handlers.POST(
      new Request(`${site}/api/notifications`, {
        method: "POST",
        headers: { origin, "content-type": type },
        body,
      }),
    );
  assert.equal((await post("{}", "https://evil.example")).status, 403);
  assert.equal((await post("{}", site, "text/plain")).status, 400);
  assert.equal((await post("x".repeat(2049))).status, 400);
  assert.equal((await post(new Uint8Array([255, 254]).buffer)).status, 400);
  assert.equal((await post("{")).status, 400);
  assert.equal((await post('{"action":"list","args":{}}')).status, 400);
  assert.equal(calls.length, 1);
  assert.equal((await post('{"action":"read","args":{}}')).status, 401);
});
test("dispatch uses per-attempt eligibility and fences stale/ambiguous results", async () => {
  const claims = Array.from({ length: 4 }, () => ({
    id: randomUUID(),
    leaseId: randomUUID(),
  }));
  const outcomes: DeliveryOutcome[] = [];
  let prepared = 0,
    sent = 0;
  const repo: DeliveryRepository = {
    claim: async () => claims,
    prepare: async (claim) =>
      ++prepared === 1 ? null : { ...payload, id: claim.id },
    finish: async (_claim, outcome) => {
      outcomes.push(outcome);
      return outcomes.length !== 3;
    },
  };
  const result = await dispatchNotificationBatch(repo, async () => {
    if (++sent === 2) throw Error("connection lost after possible acceptance");
    return { status: "accepted", providerId: "captured" };
  });
  assert.deepEqual(result, {
    claimed: 4,
    accepted: 1,
    retry: 0,
    failed: 0,
    unknown: 1,
    suppressed: 1,
    stale: 1,
    deferred: 0,
  });
  assert.equal(outcomes[1].status, "unknown");
  let clock = 0;
  const bounded = await dispatchNotificationBatch(
    {
      ...repo,
      claim: async () => claims,
      prepare: async () => {
        throw Error("Must not prepare after deadline");
      },
    },
    async () => ({ status: "accepted" }),
    () => (clock++ === 0 ? 0 : 45001),
  );
  assert.equal(bounded.deferred, 4);
});
test("message emails identify the sender and authenticated destination without private text", () => {
  const email = messageEmail(payload, site);
  assert.equal(email.from, "MovX Club <notification@movx.club>");
  assert.equal(email.reply_to, "hello@movx.club");
  assert.deepEqual(email.to, [payload.email]);
  assert.match(email.text, new RegExp(payload.conversationId));
  assert.match(email.html, /Sign in to read and reply/);
  for (const origin of [
    "javascript:alert(1)",
    "https://name:password@example.test",
    "https://example.test/private",
  ])
    assert.throws(() => messageEmail(payload, origin));
});
test("Resend transport uses a stable idempotency key and classifies uncertain handoffs honestly", async () => {
  const requests: RequestInit[] = [];
  const send = createEmailTransport(
    { transport: "resend", siteUrl: site, apiKey: "re_test_key" },
    async (_url, init) => {
      requests.push(init!);
      return Response.json({ id: "provider-id" });
    },
  );
  assert.deepEqual(await send(payload), {
    status: "accepted",
    providerId: "provider-id",
  });
  await send(payload);
  assert.equal(
    new Headers(requests[0].headers).get("Idempotency-Key"),
    `message-notice/${payload.id}`,
  );
  assert.equal(
    new Headers(requests[1].headers).get("Idempotency-Key"),
    new Headers(requests[0].headers).get("Idempotency-Key"),
  );
  assert.equal(
    JSON.parse(requests[0].body as string).reply_to,
    "hello@movx.club",
  );
  for (const [status, expected] of [
    [429, "retry"],
    [422, "failed"],
    [401, "failed"],
    [503, "unknown"],
    [408, "unknown"],
    [409, "unknown"],
  ] as const) {
    const send = createEmailTransport(
      { transport: "resend", siteUrl: site, apiKey: "re_test_key" },
      async () => new Response(null, { status }),
    );
    assert.equal((await send(payload)).status, expected);
  }
  const malformed = createEmailTransport(
    { transport: "resend", siteUrl: site, apiKey: "re_test_key" },
    async () => new Response("not JSON"),
  );
  assert.equal((await malformed(payload)).status, "unknown");
  assert.throws(() =>
    createEmailTransport({ transport: "resend", siteUrl: site }),
  );
  assert.throws(() =>
    createEmailTransport({
      transport: "mailpit",
      siteUrl: site,
      mailpitUrl: "https://external.example",
    }),
  );
});
test("delivery is opt-in and cron rejects absent/short/wrong credentials", async () => {
  await assert.rejects(runNotificationWorker({}), /disabled/);
  await assert.rejects(
    runNotificationWorker({ NOTIFICATION_DELIVERY_ENABLED: "true" }),
    /explicit/,
  );
  const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal(
      (await cron(new Request(`${site}/api/internal/notifications/dispatch`)))
        .status,
      503,
    );
    process.env.CRON_SECRET = "a".repeat(32);
    assert.equal(
      (
        await cron(
          new Request(`${site}/api/internal/notifications/dispatch`, {
            headers: { authorization: "Bearer wrong" },
          }),
        )
      ).status,
      401,
    );
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
