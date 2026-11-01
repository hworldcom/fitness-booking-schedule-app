// Explicit fictional API for the isolated local preview only. Production never imports it.
import {
  parseNotesCommand,
  type NoteEntry,
  type SessionNotesPage,
} from "../../src/notes/contracts";
import {
  previewBookingId,
  previewIds,
  previewPlan,
  previewEntries,
  previewPrivate,
  previewWorkout,
} from "./session-notes-data";
let plan = structuredClone(previewPlan),
  workout = structuredClone(previewWorkout);
const shared = structuredClone(previewEntries),
  privateNotes = [structuredClone(previewPrivate)];
const retries = new Map<string, { payload: string; result: unknown }>();
export const previewRole = (request: Request) =>
  request.headers.get("cookie")?.includes("notes_preview_role=athlete")
    ? "athlete"
    : "coach";
export function actorResponse(request: Request) {
  const role = previewRole(request);
  return Response.json({
    status: "authorized",
    profile: {
      slug: role,
      displayName: role === "coach" ? "Alex" : "Sam",
      avatarUrl: null,
      coachPortraitUrl: null,
    },
    demoRun: { slug: "notes-preview", name: "Fictional notes preview" },
    role: "member",
    coachAccessStatus: role === "coach" ? "approved" : "not-applied",
  });
}
export async function notesResponse(request: Request) {
  const envelope = await request.json(),
    command = parseNotesCommand(envelope.command),
    role = previewRole(request),
    scope = "notes-preview:" + role,
    id = previewIds[role];
  const respond = (result: unknown, status = 200) =>
    Response.json(result, { status, headers: { "cache-control": "no-store" } });
  if (!command || envelope.scope !== scope)
    return respond({ status: "invalid" }, 400);
  const a = command.args;
  if (
    a.bookingId !== previewBookingId ||
    (a.kind === "private" && role !== "coach") ||
    (command.action === "save" && a.kind === "plan" && role !== "coach")
  )
    return respond({ status: "forbidden" }, 403);
  const entries = a.kind === "private" ? privateNotes : shared;
  if (command.action === "read") {
    const value: SessionNotesPage = {
      bookingId: previewBookingId,
      title: "Footwork & distance",
      startsAt: "2026-11-02T10:00:00Z",
      endsAt: "2026-11-02T11:00:00Z",
      venue: "Studio North · Berlin",
      status: "confirmed",
      viewerId: id,
      viewerIsCoach: role === "coach",
      canWrite: true,
      kind: a.kind as "shared" | "private",
      conversationHref: null,
      plan: a.kind === "shared" ? plan : null,
      entries: entries.slice(-20),
      next: null,
      total: entries.length,
    };
    return respond({ status: "ready", scope, value });
  }
  const key = role + ":" + a.operationId,
    payload = JSON.stringify(command),
    retry = retries.get(key);
  if (retry)
    return retry.payload === payload
      ? respond(retry.result)
      : respond({ status: "conflict", scope, current: null }, 409);
  const existing =
    a.kind === "plan" ? plan : entries.find((e) => e.id === a.entryId);
  if (
    existing &&
    (existing.revision !== a.revision || existing.authorId !== id)
  )
    return respond(
      {
        status: "conflict",
        scope,
        current: existing.authorId === id ? existing : null,
      },
      409,
    );
  const entry: NoteEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    authorId: id,
    authorName: role === "coach" ? "Alex · Coach" : "Sam",
    body: a.body!,
    videos: a.videos ?? [],
    revision: (existing?.revision ?? 0) + 1,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (a.kind === "plan") plan = entry;
  else if (existing) entries[entries.indexOf(existing)] = entry;
  else entries.push(entry);
  const result = {
    status: "saved",
    scope,
    value: { id: entry.id, revision: entry.revision },
  };
  retries.set(key, { payload, result });
  return respond(result);
}
export async function trainingResponse(request: Request) {
  const { command } = await request.json();
  if (command.action === "list")
    return Response.json({
      status: "ready",
      scope: "notes-preview:coach",
      value: {
        items: [workout],
        next: null,
        now: "2026-10-31T16:00:00Z",
        weekCount: 1,
        monthCount: 1,
        remindersEnabled: false,
      },
    });
  const a = command.args;
  workout = {
    ...workout,
    title: a.title,
    notes: a.notes,
    videos: a.videos ?? workout.videos,
    actualMinutes: a.actualMinutes,
    intensity: a.intensity,
    revision: workout.revision + 1,
  };
  return Response.json({
    status: "ready",
    scope: "notes-preview:coach",
    value: { saved: true },
  });
}
