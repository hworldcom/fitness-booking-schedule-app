"use client";

import { supabasePublicConfig } from "../config";
import type { AuthenticationResult } from "../gateway";
import type { AuthenticationCommand } from "../operations";

/** Navigation transport stays inside the adapter; views never receive vendor URLs. */
export function startGoogleAuthentication(
  command: Extract<AuthenticationCommand, { action: "start-google" }>,
): AuthenticationResult {
  const config = supabasePublicConfig();
  if (!config || window.location.origin !== config.siteUrl)
    return { status: "unavailable" };
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/auth/google/start";
  form.hidden = true;
  for (const name of ["returnTo", "intent"] as const) {
    const value = command[name];
    if (value === undefined) continue;
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = name;
    field.value = value;
    form.append(field);
  }
  document.body.append(form);
  try {
    form.submit();
    return { status: "redirecting" };
  } finally {
    form.remove();
  }
}

export async function googleAuthenticationAvailable(signal?: AbortSignal) {
  try {
    const response = await fetch("/api/auth/google", {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
    const value: unknown = await response.json();
    return (
      response.ok &&
      !!value &&
      typeof value === "object" &&
      Object.keys(value).length === 1 &&
      "available" in value &&
      value.available === true
    );
  } catch {
    return false;
  }
}
