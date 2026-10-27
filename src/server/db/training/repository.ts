import "server-only";
import { sql } from "drizzle-orm";
import type { TrainingCommand } from "@/training/contracts";
import type { ActorDatabaseTransaction } from "../authorization/repository";
export class TrainingDatabaseError extends Error {
  constructor(public readonly status: "conflict" | "invalid") {
    super("Training command rejected.");
  }
}

export async function trainingCommandRecord(
  tx: ActorDatabaseTransaction,
  command: TrainingCommand,
) {
  try {
    const [row] = await tx.execute<{ value: unknown }>(
      sql`select app.athlete_training_command(${command.action},${JSON.stringify(command.args)}::jsonb) value`,
    );
    if (!row) throw Error("Training unavailable");
    return row.value;
  } catch (error) {
    let current = error;
    for (
      let depth = 0;
      depth < 8 && current && typeof current === "object";
      depth++
    ) {
      const value = current as { code?: string; cause?: unknown };
      if (["40001", "23505"].includes(value.code ?? ""))
        throw new TrainingDatabaseError("conflict");
      if (
        ["22023", "22007", "22008", "22P02", "23514"].includes(value.code ?? "")
      )
        throw new TrainingDatabaseError("invalid");
      current = value.cause;
    }
    throw error;
  }
}
