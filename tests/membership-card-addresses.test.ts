import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveMembershipCardAssetAddress,
  deriveMembershipCardLineageAddress,
} from "../src/solana/membership-card-addresses";

test("stable lineage PDA does not depend on wallet or membership period", async () => {
  const lineageId = new Uint8Array(32).fill(7);
  const [firstAddress, firstBump] =
    await deriveMembershipCardLineageAddress(lineageId);
  const [secondAddress, secondBump] =
    await deriveMembershipCardLineageAddress(lineageId);

  assert.equal(firstAddress, secondAddress);
  assert.equal(firstBump, secondBump);
});

test("each replacement generation derives a different asset under the same lineage", async () => {
  const lineageId = new Uint8Array(32).fill(8);
  const [generationZero] = await deriveMembershipCardAssetAddress(lineageId, 0);
  const [generationOne] = await deriveMembershipCardAssetAddress(lineageId, 1);
  const [lineage] = await deriveMembershipCardLineageAddress(lineageId);

  assert.notEqual(generationZero, generationOne);
  assert.notEqual(generationZero, lineage);
  assert.notEqual(generationOne, lineage);
});

test("client rejects empty lineage IDs and invalid generation values", async () => {
  await assert.rejects(() =>
    deriveMembershipCardLineageAddress(new Uint8Array(32)),
  );
  await assert.rejects(() =>
    deriveMembershipCardAssetAddress(new Uint8Array(32).fill(1), -1),
  );
  await assert.rejects(() =>
    deriveMembershipCardAssetAddress(new Uint8Array(32).fill(1), 0x1_0000_0000),
  );
});
