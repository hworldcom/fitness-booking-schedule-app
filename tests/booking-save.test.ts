import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKING_REQUEST_TIMEOUT_MS,
  reloadSavedBooking,
  saveCoachBooking,
} from "@/features/session-types/booking-client";
import type { CoachSessionCommand } from "@/domain/typed-sessions";

const bookingId = "40000000-0000-4000-8000-000000000001";
const command: CoachSessionCommand = {
  action: "override",
  commandId: "40000000-0000-4000-8000-000000000002",
  bookingId,
  expectedRevision: 0,
  typeId: "40000000-0000-4000-8000-000000000003",
  typeRevision: 0,
  locationId: "40000000-0000-4000-8000-000000000004",
  startsAt: "2026-11-08T10:00:00.000Z",
  durationMinutes: 60,
};
const saved = { status: "saved", bookingId, revision: 1 };
const request =
  (body: unknown, status = 200): typeof fetch =>
  async () =>
    Response.json(body, { status });

test("a verified save keeps the exact reviewed command and same-origin request contract", async () => {
  assert.equal(BOOKING_REQUEST_TIMEOUT_MS, 15000);
  const r = await saveCoachBooking(command, {
    request: async (url, init) => {
      assert.equal(url, "/api/session-bookings?coach=true");
      assert.equal(init?.credentials, "same-origin");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), command);
      return Response.json(saved);
    },
  });
  assert.deepEqual(r, saved);
  assert.deepEqual(
    await saveCoachBooking(
      {
        ...command,
        action: "create",
        athleteId: bookingId,
        bookingId: undefined,
        expectedRevision: undefined,
      },
      { request: request({ ...saved, revision: 0 }) },
    ),
    { ...saved, revision: 0 },
  );
});

test("only matching HTTP/DTO failures are definitive; contradictory or unrelated success stays uncertain", async () => {
  for (const [status, code] of Object.entries({
    invalid: 400,
    conflict: 409,
    forbidden: 403,
    "signed-out": 401,
    unavailable: 503,
  }))
    assert.deepEqual(
      await saveCoachBooking(command, { request: request({ status }, code) }),
      { status },
    );
  for (const [body, code] of [
    [saved, 503],
    [{ status: "conflict" }, 200],
    [{ ...saved, revision: 0 }, 200],
    [{ ...saved, bookingId: command.commandId }, 200],
    [{ ...saved, revision: 1.5 }, 200],
    [null, 200],
  ] as const)
    await assert.rejects(
      saveCoachBooking(command, { request: request(body, code) }),
    );
  await assert.rejects(
    saveCoachBooking(command, {
      request: async () => new Response("invalid JSON"),
    }),
  );
});

test(
  "a stalled write times out even if transport ignores abort; late success cannot change its settled outcome",
  { timeout: 2000 },
  async () => {
    let late!: (response: Response) => void;
    let signal: AbortSignal | undefined;
    const result = saveCoachBooking(command, {
      timeoutMs: 5,
      request: async (_url, init) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>((resolve) => {
          late = resolve;
        });
      },
    });
    await assert.rejects(result, /could not be verified/);
    assert.equal(signal?.aborted, true);
    late(Response.json(saved));
    await assert.rejects(result, /could not be verified/);
    assert.deepEqual(
      await saveCoachBooking(command, { request: request(saved) }),
      saved,
    );
  },
);

test(
  "a received header does not bypass the body deadline",
  { timeout: 2000 },
  async () => {
    let signal: AbortSignal | undefined;
    await assert.rejects(
      saveCoachBooking(command, {
        timeoutMs: 5,
        request: async (_url, init) => {
          signal = init?.signal ?? undefined;
          return new Response(new ReadableStream({ start() {} }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      }),
      /could not be verified/,
    );
    assert.equal(signal?.aborted, true);
  },
);

test(
  "leaving the actor cancels pending work and a pre-cancelled attempt starts no request",
  { timeout: 2000 },
  async () => {
    const controller = new AbortController();
    let calls = 0;
    let signal: AbortSignal | undefined;
    const result = saveCoachBooking(command, {
      signal: controller.signal,
      request: async (_url, init) => {
        calls++;
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      },
    });
    controller.abort();
    await assert.rejects(result);
    assert.equal(signal?.aborted, true);
    await assert.rejects(
      saveCoachBooking(command, {
        signal: controller.signal,
        request: async () => {
          calls++;
          return Response.json(saved);
        },
      }),
    );
    assert.equal(calls, 1);
  },
);

test(
  "refresh cannot replace a committed save with another booking, old revision or failed/stalled read",
  { timeout: 2000 },
  async () => {
    const detail = {
      bookingId,
      revision: 1,
      startsAt: command.startsAt,
      endsAt: "2026-11-08T11:00:00.000Z",
      changes: [],
    };
    assert.deepEqual(
      await reloadSavedBooking(bookingId, 1, {
        request: request({ status: "ready", detail }),
      }),
      detail,
    );
    for (const body of [
      { status: "unavailable" },
      { status: "ready", detail: { ...detail, revision: 0 } },
      { status: "ready", detail: { ...detail, bookingId: command.commandId } },
      { status: "ready", detail: { ...detail, startsAt: "invalid" } },
    ])
      await assert.rejects(
        reloadSavedBooking(bookingId, 1, { request: request(body) }),
      );
    await assert.rejects(
      reloadSavedBooking(bookingId, 1, {
        request: request({ status: "ready", detail }, 503),
      }),
    );
    await assert.rejects(
      reloadSavedBooking(bookingId, 1, {
        timeoutMs: 5,
        request: async () => new Promise<Response>(() => {}),
      }),
    );
  },
);
