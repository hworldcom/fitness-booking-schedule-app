import assert from "node:assert/strict";
import test from "node:test";
import {
  TrainingDatabaseError,
  trainingCommandRecord,
} from "../../src/server/db/training/repository";
import type { ActorDatabaseTransaction } from "../../src/server/db/authorization/repository";

function failing(error: unknown) {
  return {
    execute: async () => {
      throw error;
    },
  } as unknown as ActorDatabaseTransaction;
}
const command = { action: "stop", args: {} } as const;
test("definitive SQL rejections escape the transaction as bounded training failures", async () => {
  for (const [code, status] of [
    ["40001", "conflict"],
    ["23505", "conflict"],
    ["22023", "invalid"],
    ["22007", "invalid"],
    ["22008", "invalid"],
    ["22P02", "invalid"],
    ["23514", "invalid"],
  ]) {
    const cause = { cause: { cause: { code } } };
    await assert.rejects(
      trainingCommandRecord(failing(cause), command),
      (error) =>
        error instanceof TrainingDatabaseError && error.status === status,
    );
  }
});
test("unknown database/transport failures preserve their identity for uncertain-write handling", async () => {
  for (const error of [
    new Error("Connection lost"),
    { cause: { code: "08006" } },
    { code: "XX000" },
  ])
    await assert.rejects(
      trainingCommandRecord(failing(error), command),
      (e) => e === error,
    );
});
