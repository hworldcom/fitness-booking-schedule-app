import {
  normalizeVideoReferences,
  type VideoReference,
} from "@/domain/video-references";
export {
  normalizeVideoReferences,
  type VideoReference,
} from "@/domain/video-references";
import { isCanonicalUuid } from "@/domain/coach-bookings";

export type NoteKind = "shared" | "private";
export type NoteEntry = Readonly<{
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  videos: readonly VideoReference[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}>;
export type NoteCursor = Readonly<{ at: string; id: string }>;
export type SessionNotesPage = Readonly<{
  bookingId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  status: string;
  viewerId: string;
  viewerIsCoach: boolean;
  canWrite: boolean;
  kind: NoteKind;
  conversationHref: string | null;
  plan: NoteEntry | null;
  entries: readonly NoteEntry[];
  next: NoteCursor | null;
  total: number;
}>;
export type NotesCommand = Readonly<{
  action: "read" | "save";
  args: {
    bookingId: string;
    kind: NoteKind | "plan";
    before?: NoteCursor;
    operationId?: string;
    entryId?: string;
    revision?: number;
    body?: string;
    videos?: readonly VideoReference[];
  };
}>;
export type NotesResult =
  | { status: "ready"; scope: string; value: SessionNotesPage }
  | { status: "saved"; scope: string; value: { id: string; revision: number } }
  | { status: "conflict"; scope: string; current: NoteEntry | null }
  | {
      status:
        | "invalid"
        | "forbidden"
        | "signed-out"
        | "actor-changed"
        | "unavailable"
        | "limit";
    };

const cleanText = (s: string) => s.replace(/\r\n?/g, "\n").trim();
export const noteCharacterCount = (value: string) =>
  Array.from(cleanText(value)).length;

export function noteTextError(value: unknown, plan = false): string | null {
  if (typeof value !== "string") return "Enter plain text before saving.";
  const text = cleanText(value),
    count = noteCharacterCount(value),
    limit = plan ? 8000 : 2000;
  if (!plan && !text) return "Write a note before saving.";
  if (count > limit) {
    const excess = count - limit;
    return `Remove ${excess.toLocaleString("en-GB")} ${excess === 1 ? "character" : "characters"} to stay within the ${limit.toLocaleString("en-GB")} character limit.`;
  }
  if (new TextEncoder().encode(text).length > (plan ? 32000 : 8000))
    return "This text is too large to save. Shorten it and try again.";
  const unsupported = /[\p{Cc}\p{Cs}]/u.exec(text.replace(/[\n\t]/g, " "));
  if (unsupported) {
    // Locate the rejected character in the actual draft, including leading space.
    const normalized = value.replace(/\r\n?/g, "\n"),
      start = normalized.indexOf(text);
    const before = normalized.slice(0, start + unsupported.index);
    const lines = before.split("\n");
    return `Remove or retype the unsupported character at line ${lines.length}, character ${Array.from(lines.at(-1) ?? "").length + 1}.`;
  }
  return null;
}

export function validNoteText(value: unknown, plan = false) {
  return noteTextError(value, plan) === null;
}
export function parseNotesCommand(input: unknown): NotesCommand | null {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input))
      return null;
    const { action, args, ...extra } = input as Record<string, unknown>;
    if (
      Object.keys(extra).length ||
      !args ||
      typeof args !== "object" ||
      Array.isArray(args)
    )
      return null;
    const a = args as Record<string, unknown>;
    if (
      !isCanonicalUuid(String(a.bookingId)) ||
      !["shared", "private", "plan"].includes(String(a.kind))
    )
      return null;
    if (action === "read") {
      if (
        a.kind === "plan" ||
        Object.keys(a).some((k) => !["bookingId", "kind", "before"].includes(k))
      )
        return null;
      if (a.before !== undefined) {
        const c = a.before as NoteCursor;
        if (
          !c ||
          Object.keys(c).some((k) => !["at", "id"].includes(k)) ||
          !isCanonicalUuid(c.id) ||
          !Number.isFinite(Date.parse(c.at))
        )
          return null;
      }
      return { action, args: a as NotesCommand["args"] };
    }
    if (
      action !== "save" ||
      Object.keys(a).some(
        (k) =>
          ![
            "bookingId",
            "kind",
            "operationId",
            "entryId",
            "revision",
            "body",
            "videos",
          ].includes(k),
      ) ||
      !isCanonicalUuid(String(a.operationId)) ||
      (a.entryId !== undefined && !isCanonicalUuid(String(a.entryId))) ||
      !Number.isInteger(a.revision) ||
      Number(a.revision) < 0 ||
      !validNoteText(a.body, a.kind === "plan")
    )
      return null;
    const videos = normalizeVideoReferences(a.videos ?? []);
    const body = cleanText(a.body as string);
    if (a.kind === "plan" && !body && videos.length) return null;
    return { action, args: { ...a, body, videos } as NotesCommand["args"] };
  } catch {
    return null;
  }
}
export function parseSessionNotesPage(value: unknown): SessionNotesPage {
  const p = value as SessionNotesPage;
  if (
    !p ||
    !isCanonicalUuid(p.bookingId) ||
    !isCanonicalUuid(p.viewerId) ||
    !["shared", "private"].includes(p.kind) ||
    typeof p.viewerIsCoach !== "boolean" ||
    typeof p.canWrite !== "boolean" ||
    (p.kind === "private" && !p.viewerIsCoach) ||
    typeof p.title !== "string" ||
    typeof p.venue !== "string" ||
    ![p.startsAt, p.endsAt].every((s) => Number.isFinite(Date.parse(s))) ||
    !Array.isArray(p.entries) ||
    p.entries.length > 20 ||
    !Number.isInteger(p.total) ||
    p.total < 0 ||
    p.total > 100 ||
    (p.conversationHref !== null &&
      !/^\/messages\?booking=[0-9a-f-]{36}$/.test(p.conversationHref))
  )
    throw Error("Invalid notes response");
  if (
    p.next !== null &&
    (!isCanonicalUuid(p.next.id) || !Number.isFinite(Date.parse(p.next.at)))
  )
    throw Error("Invalid notes cursor");
  for (const e of [...p.entries, ...(p.plan ? [p.plan] : [])]) {
    if (
      !isCanonicalUuid(e.id) ||
      !isCanonicalUuid(e.authorId) ||
      typeof e.authorName !== "string" ||
      !validNoteText(e.body, e === p.plan) ||
      !Number.isInteger(e.revision) ||
      e.revision < 1 ||
      ![e.createdAt, e.updatedAt].every((s) => Number.isFinite(Date.parse(s)))
    )
      throw Error("Invalid note entry");
    normalizeVideoReferences(e.videos);
  }
  return p;
}
