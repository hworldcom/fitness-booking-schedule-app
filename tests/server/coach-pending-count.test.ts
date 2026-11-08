import assert from "node:assert/strict";
import test from "node:test";
import { currentOwnedPendingCoachBookingRequestCountRecord as count } from "@/server/db/coaches/booking-request-repository";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

const transaction = (rows: unknown) =>
  ({ execute: async () => rows }) as unknown as ActorDatabaseTransaction;
test("Pending count parses full safe counts without treating malformed/missing reads as zero", async () => {
  for (const value of [0, "0", 72, "72", Number.MAX_SAFE_INTEGER])
    assert.equal(await count(transaction([{ count: value }])), Number(value));
  for (const rows of [
    [],
    [{ count: null }],
    [{ count: undefined }],
    [{ count: -1 }],
    [{ count: "1.5" }],
    [{ count: "bad" }],
    [{ count: "9007199254740992" }],
    [{ count: 1 }, { count: 2 }],
  ])
    await assert.rejects(
      count(transaction(rows)),
      /Invalid pending request count/,
    );
  await assert.rejects(
    count({
      execute: async () => {
        throw Error("Unavailable");
      },
    } as unknown as ActorDatabaseTransaction),
    /Unavailable/,
  );
});
