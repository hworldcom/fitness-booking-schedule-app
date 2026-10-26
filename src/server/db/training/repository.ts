import "server-only";
import { sql } from "drizzle-orm";
import type { TrainingCommand } from "@/training/contracts";
import type { ActorDatabaseTransaction } from "../authorization/repository";
export async function trainingCommandRecord(
  tx: ActorDatabaseTransaction,
  command: TrainingCommand,
) {
  const [row] = await tx.execute<{ value: unknown }>(
    sql`select app.athlete_training_command(${command.action},${JSON.stringify(command.args)}::jsonb) value`,
  );
  if (!row) throw Error("Training unavailable");
  return row.value;
}
