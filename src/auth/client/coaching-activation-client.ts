"use client";

import {
  isCoachingActivationSnapshot,
  UNAVAILABLE_COACHING_ACTIVATION,
} from "../coaching-activation-contracts";

export async function activateCoaching() {
  try {
    const response = await fetch("/api/auth/coaching", {
      method: "POST",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const value: unknown = await response.json();
    return isCoachingActivationSnapshot(value)
      ? value
      : UNAVAILABLE_COACHING_ACTIVATION;
  } catch {
    return UNAVAILABLE_COACHING_ACTIVATION;
  }
}
