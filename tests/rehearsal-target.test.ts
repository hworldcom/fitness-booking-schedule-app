import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { createServer, type Server } from "node:net";
import test from "node:test";
import path from "node:path";
import {
  assertRehearsalPortsAvailable,
  rehearsalIdentityMatches,
  writeRehearsalIdentityRoute,
} from "../scripts/lib/rehearsal-target.mjs";

async function listen(server: Server, host: string) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}
const close = (server: Server) =>
  new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );

test("rehearsals reject an occupied IPv4 port without disturbing its owner", async () => {
  const foreign = createServer();
  const port = await listen(foreign, "127.0.0.1");
  try {
    await assert.rejects(assertRehearsalPortsAvailable([port]), /unavailable/);
    assert.ok(foreign.listening);
  } finally {
    await close(foreign);
  }
});

test("rehearsals reject an IPv6 localhost listener even when IPv4 is free", async () => {
  const foreign = createServer();
  const port = await listen(foreign, "::1");
  try {
    await assert.rejects(
      assertRehearsalPortsAvailable([port]),
      /unavailable on IPv6/,
    );
    assert.ok(foreign.listening);
  } finally {
    await close(foreign);
  }
  await assertRehearsalPortsAvailable([port]);
});

test("a generic200 or another run/role cannot pass fixture identity", async () => {
  await assert.rejects(
    rehearsalIdentityMatches("https://movx.club", "owned", "admin"),
  );
  let identity: Record<string, unknown> = { status: "ready" };
  const server = createHttpServer((_request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(identity));
  });
  const port = await listen(server, "127.0.0.1");
  const base = `http://127.0.0.1:${port}`;
  try {
    assert.equal(await rehearsalIdentityMatches(base, "owned", "admin"), false);
    identity = { runId: "other", role: "admin" };
    assert.equal(await rehearsalIdentityMatches(base, "owned", "admin"), false);
    identity = { runId: "owned", role: "public" };
    assert.equal(await rehearsalIdentityMatches(base, "owned", "admin"), false);
    identity = { runId: "owned", role: "admin" };
    assert.equal(await rehearsalIdentityMatches(base, "owned", "admin"), true);
  } finally {
    await close(server);
  }
});

test("fixture identity routes cannot be written into application source", async () => {
  await assert.rejects(
    writeRehearsalIdentityRoute(
      path.join(process.cwd(), "src"),
      "123456789a",
      "admin",
    ),
    /owned temporary source copy/,
  );
});
