import assert from "node:assert/strict";
import test from "node:test";
import { createSessionRefresh } from "@/auth/client/session-refresh";
import type { AuthSessionSnapshot } from "@/auth/contracts";

test("older session responses cannot restore authority after a later recovery, login or sign-out", async () => {
  const pending: ((value: AuthSessionSnapshot) => void)[] = [];
  const applied: AuthSessionSnapshot[] = [];
  const controller = createSessionRefresh(
    () => new Promise((resolve) => pending.push(resolve)),
    (value) => applied.push(value),
  );
  const stale = controller.refresh(),
    current = controller.refresh();
  pending[1]({ status: "recovery-required" });
  await current;
  pending[0]({
    status: "signed-in",
    subject: "old",
    email: "old@example.test",
    expiresAt: null,
  });
  await stale;
  assert.deepEqual(applied, [{ status: "recovery-required" }]);
  const inFlight = controller.refresh();
  controller.invalidate({ status: "signed-out" });
  pending[2]({ status: "recovery-required" });
  await inFlight;
  assert.deepEqual(applied, [
    { status: "recovery-required" },
    { status: "signed-out" },
  ]);
});
