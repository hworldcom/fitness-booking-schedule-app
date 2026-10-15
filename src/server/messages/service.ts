import "server-only";
import { validMessageCommand } from "@/domain/private-messages";
import { withAuthorizedActor } from "@/server/authorization/service";
import {
  messageCommandRecord,
  MessageConflictError,
} from "@/server/db/messages/repository";
export async function currentMessageCommand(command: unknown) {
  if (!validMessageCommand(command)) return { status: "invalid" as const };
  try {
    const result = await withAuthorizedActor(
      (tx) => messageCommandRecord(tx, command),
      { rethrow: (e) => e instanceof MessageConflictError },
    );
    return result.status === "authorized"
      ? { status: "ready" as const, value: result.value }
      : result;
  } catch (error) {
    if (error instanceof MessageConflictError) return { status: error.reason };
    throw error;
  }
}
