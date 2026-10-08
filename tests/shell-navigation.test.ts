import assert from "node:assert/strict";
import test from "node:test";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import { navigationForActor } from "@/components/shell";

const PUBLIC_PATHS = ["/", "/explore", "/how-it-works", "/profile"];

test("personal sessions are omitted from every unauthorized shell state", () => {
  const states: readonly ActorSnapshot["status"][] = [
    "preview",
    "signed-out",
    "forbidden",
    "unavailable",
  ];
  for (const status of states) {
    assert.deepEqual(
      navigationForActor(status).map(({ href }) => href),
      PUBLIC_PATHS,
    );
  }
});

test("authorized shell navigation includes the personal sessions route", () => {
  assert.deepEqual(
    navigationForActor("authorized").map(({ href }) => href),
    ["/", "/explore", "/sessions", "/how-it-works", "/profile"],
  );
});
