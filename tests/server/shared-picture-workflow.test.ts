import assert from "node:assert/strict";
import test from "node:test";
import { readCurrentSharedPicture } from "@/server/profile-images/shared-picture-workflow";

const reference = {
  path: "private-object",
  version: "first",
  avatarVersion: "avatar-first",
};
const bytes = new Uint8Array([1, 2, 3]);
test("shared picture returns canonical bytes only after a second matching grant/reference read", async () => {
  let reads = 0;
  const result = await readCurrentSharedPicture(
    async () => {
      reads++;
      return reference;
    },
    async (path) => {
      assert.equal(path, reference.path);
      return { status: "ready", bytes };
    },
  );
  assert.deepEqual(result, { status: "ready", bytes });
  assert.equal(reads, 2);
  assert.doesNotMatch(JSON.stringify(result), /private-object/);
});
test("missing sharing or publication grant never accesses Storage", async () => {
  const result = await readCurrentSharedPicture(
    async () => null,
    async () => {
      throw new Error("must not download");
    },
  );
  assert.deepEqual(result, { status: "not-found" });
});
test("revocation, replacement and either version change during download discard bytes", async () => {
  for (const after of [
    null,
    { ...reference, path: "replacement" },
    { ...reference, version: "new" },
    { ...reference, avatarVersion: "new" },
  ]) {
    let reads = 0;
    const result = await readCurrentSharedPicture(
      async () => (++reads === 1 ? reference : after),
      async () => ({ status: "ready", bytes }),
    );
    assert.deepEqual(result, { status: "not-found" });
  }
});
test("failed Storage or reference verification never masquerades as ready bytes", async () => {
  assert.deepEqual(
    await readCurrentSharedPicture(
      async () => reference,
      async () => ({ status: "unavailable" }),
    ),
    { status: "unavailable" },
  );
  assert.deepEqual(
    await readCurrentSharedPicture(
      async () => {
        throw new Error("database unavailable");
      },
      async () => ({ status: "ready", bytes }),
    ),
    { status: "unavailable" },
  );
});
