import assert from "node:assert/strict";
import test from "node:test";
import { trainingHandler } from "../../src/server/training/http";
test("training HTTP rejects foreign/oversized/malformed envelopes before actor work", async () => {
  let calls = 0;
  const handler = trainingHandler(
    async () => {
      calls++;
      return { status: "signed-out" };
    },
    () => "http://localhost:3100",
  );
  const req = (body: string, origin = "http://localhost:3100") =>
    new Request("http://localhost:3100/api/training", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body,
    });
  assert.equal((await handler(req("{}", "https://evil.test"))).status, 403);
  assert.equal((await handler(req('"' + "x".repeat(12001) + '"'))).status, 400);
  assert.equal(
    (await handler(req('{"command":{},"scope":"own","profileId":"forged"}')))
      .status,
    400,
  );
  assert.equal(calls, 0);
  const denied = await handler(
    req(
      JSON.stringify({ command: { action: "list", args: {} }, scope: "own" }),
    ),
  );
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get("cache-control")!, /no-store/);
  assert.equal(denied.headers.get("vary"), "Cookie");
});
test("uncertain service failures stay unavailable so a possibly committed save can retry exactly", async () => {
  const handler = trainingHandler(
    async () => {
      throw Error("connection interrupted");
    },
    () => "http://localhost:3100",
  );
  const response = await handler(
    new Request("http://localhost:3100/api/training", {
      method: "POST",
      headers: {
        origin: "http://localhost:3100",
        "content-type": "application/json",
      },
      body: JSON.stringify({ command: {}, scope: "own" }),
    }),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, "unavailable");
});
