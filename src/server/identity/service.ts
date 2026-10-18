import "server-only";

import type {
  ApplicationIdentitySnapshot,
  EnrolledApplicationIdentity,
  ProfileCompletionResult,
} from "@/auth/identity-contracts";
import { registrationProfileInput } from "@/auth/registration-profile";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import {
  currentApplicationProfile,
  completeApplicationRegistration,
  UsernameTakenError,
  type ApplicationIdentityRecord,
} from "@/server/db/identity/repository";

function enrolledSnapshot(
  identity: ApplicationIdentityRecord,
): EnrolledApplicationIdentity {
  return Object.freeze({
    status: "enrolled",
    profile: Object.freeze({
      id: identity.profileId,
      slug: identity.profileSlug,
      displayName: identity.displayName,
    }),
    demoRun: Object.freeze({
      id: identity.runId,
      slug: identity.runSlug,
      name: identity.runName,
    }),
    role: identity.role,
  });
}

export async function enrollApplicationIdentity(
  session: AuthSessionSnapshot,
  inputValue: unknown,
): Promise<ProfileCompletionResult> {
  if (session.status !== "signed-in") {
    return Object.freeze({
      status:
        session.status === "signed-out" ||
        session.status === "recovery-required"
          ? "signed-out"
          : "unavailable",
    });
  }
  const input = registrationProfileInput(inputValue);
  if (!input) return Object.freeze({ status: "invalid" });

  try {
    const identity = await completeApplicationRegistration(
      session.subject,
      input,
    );
    return identity
      ? enrolledSnapshot(identity)
      : Object.freeze({ status: "profile-required" });
  } catch (error) {
    if (error instanceof UsernameTakenError)
      return Object.freeze({ status: "username-taken" });
    return Object.freeze({ status: "unavailable" });
  }
}

export async function currentApplicationIdentity(
  session: AuthSessionSnapshot,
): Promise<ApplicationIdentitySnapshot> {
  if (session.status !== "signed-in") {
    return Object.freeze({
      status:
        session.status === "signed-out" ||
        session.status === "recovery-required"
          ? "signed-out"
          : "unavailable",
    });
  }

  try {
    const identity = await currentApplicationProfile(session.subject);
    return identity
      ? enrolledSnapshot(identity)
      : Object.freeze({ status: "profile-required" });
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}
