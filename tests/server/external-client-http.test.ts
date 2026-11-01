import assert from "node:assert/strict";
import test from "node:test";
import { externalBody, externalResponse } from "@/server/external-clients/http";
import {
  invitationTokenHash,
  invitationReviewContext,
} from "@/server/external-clients/service";
test("external-client mutations reject foreign, malformed and oversized bodies before actor/database work", async () => {
  const keys = [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ] as const;
  const before = keys.map((k) => process.env[k]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  try {
    const request = (
      body: string,
      origin = "http://localhost:3100",
      type = "application/json",
    ) =>
      new Request("http://localhost:3100/api/coach/external-clients", {
        method: "POST",
        headers: { origin, "content-type": type },
        body,
      });
    assert.equal(
      await externalBody(request("{}", "https://foreign.example")),
      null,
    );
    assert.equal(
      await externalBody(request("{}", "http://localhost:3100", "text/plain")),
      null,
    );
    assert.equal(await externalBody(request("{malformed")), null);
    assert.equal(
      await externalBody(request(JSON.stringify({ name: "x".repeat(5000) }))),
      null,
    );
    assert.deepEqual(await externalBody(request('{"name":"Client"}')), {
      name: "Client",
    });
    const response = externalResponse({
      status: "conflict",
      message: "Current state changed",
    });
    assert.equal(response.status, 409);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("vary"), "Cookie");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    const hash = invitationTokenHash("A".repeat(43));
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.notEqual(invitationReviewContext(hash), hash);
    assert.notEqual(
      invitationReviewContext(hash),
      invitationReviewContext(invitationTokenHash("B".repeat(43))),
    );
    assert.notEqual(hash, invitationTokenHash("B".repeat(43)));
  } finally {
    keys.forEach((k, i) => {
      if (before[i] === undefined) delete process.env[k];
      else process.env[k] = before[i];
    });
  }
});
