import assert from "node:assert/strict";
import { createConnection, createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

async function probe(port, host) {
  const occupied = await new Promise((resolve, reject) => {
    const connection = createConnection({ host, port });
    connection.setTimeout(1000);
    connection.once("connect", () => {
      connection.destroy();
      resolve(true);
    });
    connection.once("error", (error) => {
      connection.destroy();
      if (error.code === "ECONNREFUSED") resolve(false);
      else reject(error);
    });
    connection.once("timeout", () => {
      connection.destroy();
      reject(Error("Port availability could not be verified."));
    });
  });
  if (occupied) throw Error("An existing service owns this port.");
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ host, port }, () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

/** Check both families: localhost can resolve to a different listener than IPv4. */
export async function assertRehearsalPortsAvailable(ports) {
  for (const port of ports) {
    assert.ok(Number.isInteger(port) && port > 1023 && port < 65536);
    try {
      await probe(port, "::1");
    } catch (error) {
      if (!["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code))
        throw Error(`Rehearsal port ${port} is unavailable on IPv6.`, {
          cause: error,
        });
    }
    try {
      await probe(port, "127.0.0.1");
    } catch (error) {
      throw Error(`Rehearsal port ${port} is unavailable on IPv4.`, {
        cause: error,
      });
    }
  }
}

/** A generic HTTP200 is insufficient proof that the fixture owns this server. */
export async function rehearsalIdentityMatches(base, runId, role) {
  const url = new URL(base);
  assert.ok(
    url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
  );
  try {
    const response = await fetch(new URL("/api/qa-stack-identity", url), {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (response.status !== 200) return false;
    const identity = await response.json();
    return identity.runId === runId && identity.role === role;
  } catch {
    return false;
  }
}

export async function writeRehearsalIdentityRoute(checkout, runId, role) {
  assert.match(runId, /^[a-f0-9]{10}$/);
  assert.ok(["application", "admin"].includes(role));
  const target = path.resolve(checkout);
  assert.ok(
    target.startsWith(path.resolve(tmpdir()) + path.sep) &&
      new RegExp(`^mov(?:68-notification-qa|145-admin)-${runId}-`).test(
        path.basename(target),
      ),
    "Identity routes belong only in the owned temporary source copy.",
  );
  const directory = path.join(target, "src/app/api/qa-stack-identity");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "route.ts"),
    `export const dynamic = "force-dynamic";
export function GET() {return Response.json(${JSON.stringify({ runId, role })},{headers:{"cache-control":"private, no-store"}});}`,
    { mode: 0o600 },
  );
}
