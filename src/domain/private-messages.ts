import { isCanonicalUuid } from "./coach-bookings";
export type MessageConsent = Readonly<{
  id: string;
  senderProfileId: string;
  recipientProfileId: string;
  body: string;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "revoked";
}>;
export type MessageConversation = Readonly<{
  id: string;
  coachProfileId: string;
  athleteProfileId: string;
  actorProfileId: string;
  counterpartName: string;
  role: "coach" | "athlete";
  activityAt: string;
  canSendGeneral: boolean;
  canRequestGeneral: boolean;
  blocked: boolean;
  blockedByMe: boolean;
  unread: boolean;
  consent: MessageConsent | null;
}>;
export type MessageContext = Readonly<{
  id: string;
  kind: "inquiry" | "request" | "booking";
  requestId: string | null;
  bookingId: string | null;
  status: string | null;
  startsAt: string | null;
  endsAt: string | null;
  venue: string | null;
  deadline: string | null;
  canSend: boolean;
}>;
export type MessageEntry = Readonly<{
  id: string;
  seq: number;
  senderProfileId: string | null;
  kind: "text" | "request" | "status";
  body: string | null;
  createdAt: string;
  contextId: string | null;
  status: string | null;
}>;
export type MessageThread = Readonly<{
  conversation: MessageConversation;
  entries: readonly MessageEntry[];
  contexts: readonly MessageContext[];
  lastSeq: number;
  readThrough: number;
}>;
export type MessageInbox = Readonly<{
  items: readonly MessageConversation[];
  unreadCount: number;
}>;
export type MessageAction =
  | "inbox"
  | "thread"
  | "contact"
  | "open"
  | "inquire"
  | "send"
  | "request-consent"
  | "consent"
  | "read"
  | "block"
  | "unblock";
export type MessageCommand = Readonly<{
  action: MessageAction;
  args: Record<string, unknown>;
}>;
export function validMessageBody(body: unknown): body is string {
  return (
    typeof body === "string" &&
    body.trim().length > 0 &&
    !body.includes("\0") &&
    !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
      body,
    ) &&
    [...body].length <= 4000 &&
    new TextEncoder().encode(body).length <= 16000
  );
}
export function validMessageCommand(
  command: unknown,
): command is MessageCommand {
  if (!command || typeof command !== "object" || Array.isArray(command))
    return false;
  const { action, args } = command as Partial<MessageCommand>;
  if (
    !args ||
    typeof args !== "object" ||
    Array.isArray(args) ||
    new TextEncoder().encode(JSON.stringify(command)).length > 32768
  )
    return false;
  const id = (key: string) =>
    typeof args[key] === "string" && isCanonicalUuid(args[key]);
  if (action === "inbox")
    return (
      (args.filter === undefined ||
        ["all", "unread", "requests"].includes(String(args.filter))) &&
      ((args.beforeAt === undefined && args.beforeId === undefined) ||
        (id("beforeId") &&
          typeof args.beforeAt === "string" &&
          Number.isFinite(Date.parse(args.beforeAt))))
    );
  if (action === "contact") return id("coachId");
  if (action === "open") return id("coachId") || id("pairId");
  if (action === "inquire")
    return id("coachId") && id("submissionId") && validMessageBody(args.body);
  if (!id("conversationId")) return false;
  if (action === "thread")
    return (
      [args.before, args.after].every(
        (v) =>
          v === undefined ||
          (Number.isSafeInteger(v) &&
            Number(v) >= 0 &&
            Number(v) <= 2147483647),
      ) && !(args.before !== undefined && args.after !== undefined)
    );
  if (action === "send")
    return (
      id("submissionId") &&
      (args.contextId === null || id("contextId")) &&
      validMessageBody(args.body)
    );
  if (action === "request-consent")
    return id("submissionId") && validMessageBody(args.body);
  if (action === "consent")
    return (
      id("consentId") &&
      ["accept", "decline", "withdraw"].includes(String(args.decision))
    );
  if (action === "read")
    return (
      Number.isSafeInteger(args.through) &&
      Number(args.through) >= 0 &&
      Number(args.through) <= 2147483647
    );
  return action === "block" || action === "unblock";
}
// Rebuild DTOs from allowed fields; never forward a raw JSON database record.
type ObjectValue = Record<string, unknown>;
function object(v: unknown): ObjectValue {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Invalid message response.");
  return v as ObjectValue;
}
function text(v: unknown): string {
  if (typeof v !== "string") throw Error("Invalid message response.");
  return v;
}
function uuid(v: unknown): string {
  const s = text(v);
  if (!isCanonicalUuid(s)) throw Error("Invalid message response.");
  return s;
}
function nullable(v: unknown) {
  return v === null ? null : text(v);
}
function nullableId(v: unknown) {
  return v === null ? null : uuid(v);
}
function integer(v: unknown) {
  if (!Number.isSafeInteger(v) || Number(v) < 0)
    throw Error("Invalid message response.");
  return Number(v);
}
function bool(v: unknown) {
  if (typeof v !== "boolean") throw Error("Invalid message response.");
  return v;
}
function values(v: unknown, max: number) {
  if (!Array.isArray(v) || v.length > max)
    throw Error("Invalid message response.");
  return v as unknown[];
}
function choice<T extends string>(v: unknown, allowed: readonly T[]): T {
  if (!allowed.includes(v as T)) throw Error("Invalid message response.");
  return v as T;
}
function consent(v: unknown): MessageConsent | null {
  if (v === null) return null;
  const a = object(v);
  return {
    id: uuid(a.id),
    senderProfileId: uuid(a.senderProfileId),
    recipientProfileId: uuid(a.recipientProfileId),
    body: text(a.body),
    status: choice(a.status, [
      "pending",
      "accepted",
      "declined",
      "withdrawn",
      "revoked",
    ]),
  };
}
export function parseMessageConversation(v: unknown): MessageConversation {
  const a = object(v);
  return {
    id: uuid(a.id),
    coachProfileId: uuid(a.coachProfileId),
    athleteProfileId: uuid(a.athleteProfileId),
    actorProfileId: uuid(a.actorProfileId),
    counterpartName: text(a.counterpartName),
    role: choice(a.role, ["coach", "athlete"]),
    activityAt: text(a.activityAt),
    canSendGeneral: bool(a.canSendGeneral),
    canRequestGeneral: bool(a.canRequestGeneral),
    blocked: bool(a.blocked),
    blockedByMe: bool(a.blockedByMe),
    unread: bool(a.unread),
    consent: consent(a.consent),
  };
}
export function parseMessageInbox(v: unknown): MessageInbox {
  const a = object(v);
  return {
    items: values(a.items, 20).map(parseMessageConversation),
    unreadCount: integer(a.unreadCount),
  };
}
export function parseMessageThread(v: unknown): MessageThread {
  const a = object(v);
  return {
    conversation: parseMessageConversation(a.conversation),
    lastSeq: integer(a.lastSeq),
    readThrough: integer(a.readThrough),
    entries: values(a.entries, 50).map((v) => {
      const e = object(v);
      return {
        id: uuid(e.id),
        seq: integer(e.seq),
        senderProfileId: nullableId(e.senderProfileId),
        kind: choice(e.kind, ["text", "request", "status"]),
        body: nullable(e.body),
        createdAt: text(e.createdAt),
        contextId: nullableId(e.contextId),
        status: nullable(e.status),
      };
    }),
    contexts: values(a.contexts, 50).map((v) => {
      const c = object(v);
      return {
        id: uuid(c.id),
        kind: choice(c.kind, ["inquiry", "request", "booking"]),
        requestId: nullableId(c.requestId),
        bookingId: nullableId(c.bookingId),
        status: nullable(c.status),
        startsAt: nullable(c.startsAt),
        endsAt: nullable(c.endsAt),
        venue: nullable(c.venue),
        deadline: nullable(c.deadline),
        canSend: bool(c.canSend),
      };
    }),
  };
}
export function parseMessageResult(action: MessageAction, v: unknown): unknown {
  if (action === "inbox") return parseMessageInbox(v);
  if (action === "thread") return parseMessageThread(v);
  const a = object(v);
  if (action === "contact")
    return { coachId: uuid(a.coachId), name: text(a.name) };
  if (["inquire", "send", "open", "request-consent"].includes(action))
    return {
      conversationId: uuid(a.conversationId),
      ...(a.entryId ? { entryId: uuid(a.entryId) } : {}),
      ...(a.consentId ? { consentId: uuid(a.consentId) } : {}),
    };
  return {};
}
export function messageStatusLabel(status: string | null) {
  return (
    (
      {
        pending: "Awaiting coach confirmation",
        accepted: "Confirmed",
        confirmed: "Confirmed",
        completed: "Completed",
        cancelled: "Cancelled",
        declined: "Not confirmed",
        withdrawn: "Withdrawn",
        expired: "Expired",
        "not-selected": "Not confirmed",
        "occurrence-closed": "Session unavailable",
      } as Record<string, string>
    )[status ?? ""] ?? "Request updated"
  );
}
