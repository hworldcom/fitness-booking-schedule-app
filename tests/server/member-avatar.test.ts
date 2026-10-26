import assert from "node:assert/strict";
import test from "node:test";
import { memberAvatarBytes } from "@/server/member-profiles/avatar";

const id = "ae011700-0000-4000-8000-000000000001";
const version = "2026-10-26T12:00:00.000Z";
const ref = {
  path: `${id}/${id}.webp`,
  updatedAt: version,
  viewer: "dataset:viewer",
};
const bytes = new Uint8Array([1, 2, 3]);

test("member photo conditional reuse reauthorizes but skips Storage only for an exact current version and viewer", async () => {
  let checks = 0,
    downloads = 0;
  const dependencies = {
    reference: async () => {
      checks++;
      return { status: "ready" as const, value: ref };
    },
    download: async () => {
      downloads++;
      return bytes;
    },
  };
  const first = await memberAvatarBytes(id, version, null, dependencies);
  assert.equal(first.status, "ready");
  if (first.status !== "ready") throw Error("Expected image");
  assert.equal(checks, 2);
  assert.equal(downloads, 1);
  assert.equal(
    (await memberAvatarBytes(id, version, first.etag, dependencies)).status,
    "not-modified",
  );
  assert.equal(checks, 3);
  assert.equal(downloads, 1);
  assert.equal(
    (
      await memberAvatarBytes(id, version, first.etag, {
        ...dependencies,
        reference: async () => ({ status: "signed-out" as const }),
      })
    ).status,
    "signed-out",
  );
  assert.equal(
    (
      await memberAvatarBytes(id, version, first.etag, {
        ...dependencies,
        reference: async () => ({
          status: "ready" as const,
          value: { ...ref, viewer: "dataset:other" },
        }),
      })
    ).status,
    "ready",
  );
  assert.equal(downloads, 2);
  assert.equal(
    (
      await memberAvatarBytes(
        id,
        "2026-10-25T12:00:00Z",
        first.etag,
        dependencies,
      )
    ).status,
    "not-found",
  );
  assert.equal(downloads, 2);
});

test("photo read never releases bytes after revoked actor/target, removed/replaced image or changed viewer", async () => {
  for (const after of [
    { status: "forbidden" as const },
    { status: "not-found" as const },
    { status: "ready" as const, value: { ...ref, path: "changed" } },
    {
      status: "ready" as const,
      value: { ...ref, updatedAt: "2026-10-27T12:00:00Z" },
    },
    { status: "ready" as const, value: { ...ref, viewer: "dataset:other" } },
  ]) {
    let calls = 0;
    const result = await memberAvatarBytes(id, version, null, {
      reference: async () =>
        ++calls === 1 ? { status: "ready" as const, value: ref } : after,
      download: async () => bytes,
    });
    assert.notEqual(result.status, "ready");
    assert.ok(!("bytes" in result));
  }
});

test("missing, malformed, unavailable and failed photos fail closed without caching success", async () => {
  let called = false;
  const dependencies = {
    reference: async () => {
      called = true;
      return { status: "not-found" as const };
    },
    download: async () => {
      throw Error("must not download");
    },
  };
  assert.equal(
    (await memberAvatarBytes("invalid", version, null, dependencies)).status,
    "not-found",
  );
  assert.equal(
    (await memberAvatarBytes(id, null, null, dependencies)).status,
    "not-found",
  );
  assert.equal(called, false);
  assert.equal(
    (await memberAvatarBytes(id, version, null, dependencies)).status,
    "not-found",
  );
  assert.equal(
    (
      await memberAvatarBytes(id, version, null, {
        ...dependencies,
        reference: async () => {
          throw Error("offline");
        },
      })
    ).status,
    "unavailable",
  );
});
