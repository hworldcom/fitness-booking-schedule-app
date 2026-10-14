import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { ConnectionRole } from "@/domain/coach-athlete-connections";

export function connectionWorkspaceVersion(
  actorScope: string,
  role: ConnectionRole,
  state: unknown,
  readId: string = randomUUID(),
) {
  return createHash("sha256")
    .update(JSON.stringify([actorScope, role, readId, state]))
    .digest("hex");
}
