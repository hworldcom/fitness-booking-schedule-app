import "server-only";

import type { AuthenticationResult } from "@/auth/gateway";

export function authenticationProviderFailure(
  error: unknown,
  operation: "request" | "password" | "proof" | "update",
): AuthenticationResult {
  const info =
    error && typeof error === "object"
      ? (error as { code?: string; status?: number })
      : {};
  if (
    info.status === 429 ||
    info.code === "over_email_send_rate_limit" ||
    info.code === "over_request_rate_limit"
  )
    return { status: "rate-limited", retryAfterSeconds: null };
  if (
    operation === "request" &&
    [
      "user_already_exists",
      "email_exists",
      "user_not_found",
      "signup_disabled",
      "otp_disabled",
    ].includes(info.code ?? "")
  )
    return { status: "requested", next: "/check-email" };
  if (info.status && info.status >= 500) return { status: "unavailable" };
  if (operation === "update" && info.code === "same_password")
    return { status: "invalid", message: "password-unchanged" };
  if (info.code === "weak_password")
    return { status: "invalid", message: "password-unsafe" };
  if (
    operation === "proof" &&
    [
      "otp_expired",
      "validation_failed",
      "flow_state_expired",
      "flow_state_not_found",
    ].includes(info.code ?? "")
  )
    return { status: "invalid-proof" };
  if (
    operation === "password" &&
    ["invalid_credentials", "email_not_confirmed", "user_banned"].includes(
      info.code ?? "",
    )
  )
    return { status: "invalid-credentials" };
  return { status: "unavailable" };
}
