"use client";

import {
  isAuthSessionSnapshot,
  UNAVAILABLE_AUTH_SESSION,
  type AuthSessionSnapshot,
} from "../contracts";

export async function fetchVerifiedAuthSession(): Promise<AuthSessionSnapshot> {
  try {
    const response = await fetch("/api/auth/session", {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return UNAVAILABLE_AUTH_SESSION;
    const value: unknown = await response.json();
    return isAuthSessionSnapshot(value) ? value : UNAVAILABLE_AUTH_SESSION;
  } catch {
    return UNAVAILABLE_AUTH_SESSION;
  }
}
