"use client";

import type { AuthenticationResult } from "../gateway";
import {
  isAuthenticationResult,
  type AuthenticationCommand,
} from "../operations";

export async function postAuthenticationCommand(
  command: AuthenticationCommand,
): Promise<AuthenticationResult> {
  try {
    const response = await fetch("/api/auth/operations", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
    });
    const value: unknown = await response.json();
    if (
      !isAuthenticationResult(value) ||
      (response.status >= 500 && value.status !== "unavailable")
    )
      return { status: "unavailable" };
    return value;
  } catch {
    return { status: "unavailable" };
  }
}
