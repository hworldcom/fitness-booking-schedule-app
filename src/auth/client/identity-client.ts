"use client";

import {
  isApplicationIdentitySnapshot,
  isProfileCompletionResult,
  UNAVAILABLE_APPLICATION_IDENTITY,
  type ApplicationIdentitySnapshot,
  type ProfileCompletionResult,
} from "../identity-contracts";
import type { RegistrationProfileInput } from "../registration-profile";

async function identityRequest(): Promise<ApplicationIdentitySnapshot> {
  try {
    const response = await fetch("/api/auth/identity", {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });
    const value: unknown = await response.json();
    return isApplicationIdentitySnapshot(value)
      ? value
      : UNAVAILABLE_APPLICATION_IDENTITY;
  } catch {
    return UNAVAILABLE_APPLICATION_IDENTITY;
  }
}

export async function completeApplicationProfile(
  input: RegistrationProfileInput,
): Promise<ProfileCompletionResult> {
  try {
    const response = await fetch("/api/auth/identity", {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const value: unknown = await response.json();
    return isProfileCompletionResult(value)
      ? value
      : UNAVAILABLE_APPLICATION_IDENTITY;
  } catch {
    return UNAVAILABLE_APPLICATION_IDENTITY;
  }
}

export function fetchCurrentIdentity() {
  return identityRequest();
}
