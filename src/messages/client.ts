import {
  parseMessageResult,
  type MessageAction,
} from "@/domain/private-messages";
import { MESSAGE_VERSION_HEADER } from "./version";
export class MailboxError extends Error {
  constructor(readonly status: string) {
    super(
      status === "rate-limited"
        ? "Please wait before sending again. Your draft is safe."
        : status === "conflict"
          ? "This conversation changed. Refresh and check its permissions before retrying."
          : status === "signed-out" || status === "forbidden"
            ? "Your access changed. Sign in again to continue."
            : "Messages are unavailable. Your draft is safe; try again.",
    );
  }
}
export async function messageRead(
  action: "inbox" | "thread" | "contact",
  args: Record<string, string | number> = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams(
    Object.entries(args).map(([k, v]) => [k, String(v)]),
  );
  const response = await fetch(`/api/messages?${params}`, {
    headers: { [MESSAGE_VERSION_HEADER]: "2" },
    cache: "no-store",
    credentials: "same-origin",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || result.status !== "ready")
    throw new MailboxError(result.status ?? "unavailable");
  return parseMessageResult(action, result.value);
}
export async function messageWrite(
  action: MessageAction,
  args: Record<string, unknown>,
) {
  const response = await fetch("/api/messages", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      [MESSAGE_VERSION_HEADER]: "2",
    },
    body: JSON.stringify({ action, args }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || result.status !== "ready")
    throw new MailboxError(result.status ?? "unavailable");
  window.dispatchEvent(new Event("movx:messages"));
  return parseMessageResult(action, result.value);
}
export function messageError(error: unknown) {
  return error instanceof MailboxError
    ? error.message
    : "Messages are unavailable. Your draft is safe; try again.";
}
export function accessRevoked(error: unknown) {
  return (
    error instanceof MailboxError &&
    ["signed-out", "forbidden"].includes(error.status)
  );
}

export function definitiveMessageFailure(error: unknown) {
  return (
    error instanceof MailboxError &&
    ["conflict", "rate-limited", "invalid"].includes(error.status)
  );
}
