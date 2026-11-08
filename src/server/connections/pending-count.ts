import "server-only";
import type {
  ConnectionCursor,
  ConnectionPage,
  ConnectionProjection,
} from "@/domain/coach-athlete-connections";

// Reuse the existing actor/role-scoped incoming reader. Never mistake a first
// page (or a partial failed traversal) for the entire pending total.
export async function countIncomingConnectionPages(
  read: (
    cursor: ConnectionCursor | null,
  ) => Promise<ConnectionPage<ConnectionProjection>>,
) {
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let cursor: ConnectionCursor | null = null;
  do {
    const page = await read(cursor);
    for (const row of page.items) {
      if (row.status !== "pending")
        throw new Error("Unexpected connection state");
      ids.add(row.id);
    }
    cursor = page.nextCursor;
    if (cursor) {
      const key = JSON.stringify(cursor);
      if (cursors.has(key))
        throw new Error("Connection cursor did not advance");
      cursors.add(key);
    }
  } while (cursor);
  return ids.size;
}
