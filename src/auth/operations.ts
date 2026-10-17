import type { AuthenticationResult } from "./gateway";

export type AuthenticationCommand =
  | Readonly<{
      action: "register" | "sign-in";
      email: string;
      password: string;
      returnTo?: string;
      intent?: "client" | "coach";
    }>
  | Readonly<{
      action: "request-code" | "request-recovery" | "resend-confirmation";
      email: string;
      returnTo?: string;
      intent?: "client" | "coach";
    }>
  | Readonly<{ action: "verify-code"; email: string; code: string }>
  | Readonly<{
      action: "confirm-email";
      flow: string;
      tokenHash: string;
      type: "signup" | "magiclink" | "recovery";
    }>
  | Readonly<{ action: "reset-password"; password: string }>
  | Readonly<{
      action: "change-password";
      password: string;
      currentPassword: string;
    }>
  | Readonly<{ action: "sign-out" }>;

export function parseAuthenticationCommand(
  value: unknown,
): AuthenticationCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const fields: Record<string, readonly string[]> = {
    register: ["email", "password", "returnTo", "intent"],
    "sign-in": ["email", "password", "returnTo", "intent"],
    "request-code": ["email", "returnTo", "intent"],
    "request-recovery": ["email", "returnTo", "intent"],
    "resend-confirmation": ["email", "returnTo", "intent"],
    "verify-code": ["email", "code"],
    "confirm-email": ["flow", "tokenHash", "type"],
    "reset-password": ["password"],
    "change-password": ["password", "currentPassword"],
    "sign-out": [],
  };
  if (typeof input.action !== "string" || !Object.hasOwn(fields, input.action))
    return null;
  const allowed = fields[input.action];
  if (
    Object.keys(input).some((key) => key !== "action" && !allowed.includes(key))
  )
    return null;
  for (const key of allowed) {
    if (key === "returnTo" || key === "intent") continue;
    if (
      typeof input[key] !== "string" ||
      (input[key] as string).length > (key === "email" ? 254 : 512)
    )
      return null;
  }
  if (
    input.returnTo !== undefined &&
    (typeof input.returnTo !== "string" || input.returnTo.length > 2048)
  )
    return null;
  if (
    input.intent !== undefined &&
    input.intent !== "client" &&
    input.intent !== "coach"
  )
    return null;
  if (
    input.action === "confirm-email" &&
    (!/^[0-9a-f]{64}$/.test(input.flow as string) ||
      !/^[A-Za-z0-9_-]{32,256}$/.test(input.tokenHash as string) ||
      !["signup", "magiclink", "recovery"].includes(input.type as string))
  )
    return null;
  return input as AuthenticationCommand;
}

export function isAuthenticationResult(
  value: unknown,
): value is AuthenticationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (typeof input.status !== "string") return false;
  const allowed: Record<string, readonly string[]> = {
    success: ["status", "email", "next"],
    requested: ["status", "next"],
    invalid: ["status", "message"],
    "invalid-credentials": ["status"],
    "invalid-proof": ["status"],
    unavailable: ["status"],
    forbidden: ["status"],
    "rate-limited": ["status", "retryAfterSeconds"],
    "recovery-required": ["status", "next"],
    "password-updated": ["status", "next"],
  };
  if (
    !Object.hasOwn(allowed, input.status) ||
    Object.keys(input).some(
      (key) => !allowed[input.status as string].includes(key),
    )
  )
    return false;
  if (
    input.next !== undefined &&
    (typeof input.next !== "string" ||
      input.next.length > 4096 ||
      !input.next.startsWith("/") ||
      input.next.startsWith("//") ||
      /[\\\u0000-\u001f]/.test(input.next))
  )
    return false;
  if (
    ["recovery-required", "password-updated"].includes(input.status) &&
    typeof input.next !== "string"
  )
    return false;
  if (
    input.status === "success" &&
    input.email !== null &&
    (typeof input.email !== "string" ||
      input.email.length > 254 ||
      !input.email.includes("@"))
  )
    return false;
  if (
    input.status === "invalid" &&
    ![
      "email",
      "code",
      "password-too-short",
      "password-too-long",
      "password-invalid",
      "password-unsafe",
    ].includes(input.message as string)
  )
    return false;
  if (
    input.status === "rate-limited" &&
    input.retryAfterSeconds !== null &&
    (!Number.isSafeInteger(input.retryAfterSeconds) ||
      (input.retryAfterSeconds as number) <= 0 ||
      (input.retryAfterSeconds as number) > 86400)
  )
    return false;
  return true;
}
