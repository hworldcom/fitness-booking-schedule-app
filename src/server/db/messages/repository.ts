import "server-only";
import { materializeMessageMedia } from "./media";
import { sql } from "drizzle-orm";
import {
  parseMessageResult,
  type MessageCommand,
} from "@/domain/private-messages";
import type { ActorDatabaseTransaction } from "../authorization/repository";
export class MessageConflictError extends Error {
  constructor(readonly reason: "conflict" | "rate-limited" = "conflict") {
    super("Message operation could not be completed.");
  }
}
export async function messageCommandRecord(
  tx: ActorDatabaseTransaction,
  command: MessageCommand,
) {
  try {
    const rows = await tx.execute<{ result: unknown }>(
      sql`select app.message_command(${command.action}::text,${JSON.stringify(command.args)}::jsonb) result`,
    );
    if (rows.length !== 1) throw new MessageConflictError();
    return parseMessageResult(
      command.action,
      materializeMessageMedia(rows[0].result),
    );
  } catch (error) {
    let current: unknown = error;
    for (let i = 0; i < 5; i++) {
      if (!current || typeof current !== "object") break;
      const e = current as { code?: string; message?: string; cause?: unknown };
      if (
        [
          "40001",
          "P0001",
          "23505",
          "23514",
          "23503",
          "22P02",
          "22003",
        ].includes(e.code ?? "")
      )
        throw new MessageConflictError(
          e.message?.includes("rate limited") ? "rate-limited" : "conflict",
        );
      current = e.cause;
    }
    throw error;
  }
}
