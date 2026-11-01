import { sessionUuid } from "./session-types";
export type ExternalClient = Readonly<{
  id: string;
  name: string;
  email: string | null;
  revision: number;
  linkedProfileId: string | null;
  createdAt: string;
}>;
export type ExternalClientPage = {
  items: ExternalClient[];
  next: string | null;
};
export type ClientInvitation = {
  id: string;
  revision: number;
  status: "pending" | "expired" | "accepted" | "declined" | "revoked";
  delivery:
    | "queued"
    | "leased"
    | "sending"
    | "retry"
    | "accepted"
    | "failed"
    | "unknown"
    | "suppressed";
  expiresAt: string;
  createdAt: string;
};
export type ExternalClientDetail = {
  client: ExternalClient;
  invitation: ClientInvitation | null;
  sessions: { id: string; startsAt: string; endsAt: string; status: string }[];
  nextOffset: number | null;
};
export function clientFields(
  value: unknown,
): { name: string; email: string | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.name !== "string" ||
    (v.email !== null && v.email !== undefined && typeof v.email !== "string")
  )
    return null;
  const name = v.name.trim(),
    email =
      typeof v.email === "string" ? v.email.trim().toLowerCase() || null : null;
  if (
    !name ||
    [...name].length > 120 ||
    new TextEncoder().encode(name).length > 480 ||
    /[\u0000-\u001f\u007f-\u009f]/.test(name) ||
    (email !== null &&
      (email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)))
  )
    return null;
  return { name, email };
}
const revision = (v: unknown) =>
  Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < 2147483647;
export function parseClientCommand(
  value: unknown,
): { action: "create" | "update"; args: Record<string, unknown> } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>,
    fields = clientFields(v);
  if (
    !fields ||
    !sessionUuid(v.operationId) ||
    !["create", "update"].includes(String(v.action)) ||
    Object.keys(v).some(
      (k) =>
        !["action", "operationId", "name", "email", "id", "revision"].includes(
          k,
        ),
    )
  )
    return null;
  if (
    v.action === "create"
      ? v.id !== undefined || v.revision !== undefined
      : !sessionUuid(v.id) || !revision(v.revision)
  )
    return null;
  const { action, ...rest } = v;
  return {
    action: action as "create" | "update",
    args: { ...rest, ...fields },
  };
}
export function parseInvitationCommand(value: unknown): {
  action: "send" | "resend" | "revoke";
  args: Record<string, unknown>;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    !["send", "resend", "revoke"].includes(String(v.action)) ||
    !sessionUuid(v.operationId) ||
    !sessionUuid(v.externalClientId) ||
    !revision(v.clientRevision) ||
    Object.keys(v).some(
      (k) =>
        ![
          "action",
          "operationId",
          "externalClientId",
          "clientRevision",
          "expectedInvitationId",
          "expectedRevision",
        ].includes(k),
    )
  )
    return null;
  if (
    v.expectedInvitationId === null
      ? v.expectedRevision !== null
      : !sessionUuid(v.expectedInvitationId) || !revision(v.expectedRevision)
  )
    return null;
  const { action, ...args } = v;
  return { action: action as "send" | "resend" | "revoke", args };
}
export function parseExternalClient(value: unknown): ExternalClient {
  const v = value as ExternalClient;
  const fields = clientFields(v);
  if (
    !v ||
    !fields ||
    fields.name !== v.name ||
    fields.email !== v.email ||
    !sessionUuid(v.id) ||
    !revision(v.revision) ||
    (v.linkedProfileId !== null && !sessionUuid(v.linkedProfileId)) ||
    !Number.isFinite(Date.parse(v.createdAt))
  )
    throw Error("Invalid external client projection");
  return {
    id: v.id,
    name: v.name,
    email: v.email,
    revision: v.revision,
    linkedProfileId: v.linkedProfileId,
    createdAt: v.createdAt,
  };
}
export function parseExternalPage(value: unknown): ExternalClientPage {
  const p = value as ExternalClientPage;
  if (
    !p ||
    !Array.isArray(p.items) ||
    p.items.length > 20 ||
    (p.next !== null && !sessionUuid(p.next))
  )
    throw Error("Invalid external clients page");
  return { items: p.items.map(parseExternalClient), next: p.next };
}
export function parseClientInvitation(value: unknown): ClientInvitation | null {
  if (value === null) return null;
  const v = value as ClientInvitation;
  if (
    !v ||
    !sessionUuid(v.id) ||
    !revision(v.revision) ||
    !["pending", "expired", "accepted", "declined", "revoked"].includes(
      v.status,
    ) ||
    ![
      "queued",
      "leased",
      "sending",
      "retry",
      "accepted",
      "failed",
      "unknown",
      "suppressed",
    ].includes(v.delivery) ||
    !Number.isFinite(Date.parse(v.expiresAt)) ||
    !Number.isFinite(Date.parse(v.createdAt))
  )
    throw Error("Invalid invitation projection");
  return {
    id: v.id,
    revision: v.revision,
    status: v.status,
    delivery: v.delivery,
    expiresAt: v.expiresAt,
    createdAt: v.createdAt,
  };
}
export function parseInvitationReview(value: unknown): {
  state: "pending" | "accepted" | "unavailable";
  coachName?: string;
} {
  const v = value as {
    state: "pending" | "accepted" | "unavailable";
    coachName?: unknown;
  };
  if (
    !v ||
    !["pending", "accepted", "unavailable"].includes(v.state) ||
    (v.state !== "unavailable" &&
      (typeof v.coachName !== "string" ||
        v.coachName.length < 1 ||
        v.coachName.length > 240))
  )
    throw Error("Invalid invitation review");
  return v.state === "unavailable"
    ? { state: v.state }
    : { state: v.state, coachName: v.coachName as string };
}
