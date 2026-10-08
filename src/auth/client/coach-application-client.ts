"use client";

import {
  isCoachApplicationSubmissionSnapshot,
  UNAVAILABLE_COACH_APPLICATION_SUBMISSION,
} from "../coach-application-contracts";

export async function submitCoachApplication() {
  try {
    const response = await fetch("/api/auth/coach-application", {
      method: "POST",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const value: unknown = await response.json();
    return isCoachApplicationSubmissionSnapshot(value)
      ? value
      : UNAVAILABLE_COACH_APPLICATION_SUBMISSION;
  } catch {
    return UNAVAILABLE_COACH_APPLICATION_SUBMISSION;
  }
}
