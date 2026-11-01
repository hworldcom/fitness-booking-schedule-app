import "server-only";
import {
  parseNotesCommand,
  parseSessionNotesPage,
  type NotesResult,
  type NoteEntry,
} from "@/notes/contracts";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import { NotesDatabaseError, notesRecord } from "@/server/db/notes/repository";

export async function sessionNotesCommand(
  input: unknown,
  expectedScope: string,
): Promise<NotesResult> {
  const command = parseNotesCommand(input);
  if (
    !command ||
    typeof expectedScope !== "string" ||
    expectedScope.length > 200
  )
    return { status: "invalid" };
  try {
    const r = await withAuthorizedActor(
      async (tx, actor) => {
        const owner = await currentActorProjection(tx, actor);
        const scope = `${owner.runSlug}:${owner.profileSlug}`;
        if (scope !== expectedScope)
          return { status: "actor-changed" as const };
        const value = (await notesRecord(tx, command)) as {
          conflict?: boolean;
          current?: NoteEntry | null;
          limit?: boolean;
          id?: string;
          revision?: number;
        };
        if (command.action === "read")
          return {
            status: "ready" as const,
            scope,
            value: parseSessionNotesPage(value),
          };
        if (value.conflict)
          return {
            status: "conflict" as const,
            scope,
            current: value.current ?? null,
          };
        if (value.limit) return { status: "limit" as const };
        if (typeof value.id !== "string" || !Number.isInteger(value.revision))
          throw Error("Invalid note save result");
        return {
          status: "saved" as const,
          scope,
          value: { id: value.id, revision: value.revision! },
        };
      },
      { rethrow: (e) => e instanceof NotesDatabaseError },
    );
    return r.status === "authorized"
      ? r.value
      : { status: r.status === "preview" ? "forbidden" : r.status };
  } catch (e) {
    return e instanceof NotesDatabaseError
      ? e.status === "conflict"
        ? { status: "conflict", scope: expectedScope, current: null }
        : { status: e.status }
      : { status: "unavailable" };
  }
}
