import "server-only";
import { sql } from "drizzle-orm";
import type { NotesCommand } from "@/notes/contracts";
import type { ActorDatabaseTransaction } from "../authorization/repository";

export class NotesDatabaseError extends Error {
  constructor(public readonly status: "conflict" | "invalid" | "forbidden") {
    super("Session notes command rejected.");
  }
}
export async function notesRecord(
  tx: ActorDatabaseTransaction,
  command: NotesCommand,
) {
  try {
    const [row] = await tx.execute<{ value: unknown }>(
      sql`select app.session_notes_command(${command.action},${JSON.stringify(command.args)}::jsonb) value`,
    );
    if (!row) throw Error("Session notes unavailable");
    return row.value;
  } catch (error) {
    let current = error;
    for (
      let depth = 0;
      depth < 8 && current && typeof current === "object";
      depth++
    ) {
      const e = current as { code?: string; cause?: unknown };
      if (["40001", "23505", "40P01"].includes(e.code ?? ""))
        throw new NotesDatabaseError("conflict");
      if (["22023", "22007", "22008", "22P02", "23514"].includes(e.code ?? ""))
        throw new NotesDatabaseError("invalid");
      if (e.code === "42501") throw new NotesDatabaseError("forbidden");
      current = e.cause;
    }
    throw error;
  }
}
