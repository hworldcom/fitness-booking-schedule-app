import "server-only";
import { profileImageStorage } from "@/server/storage/profile-images";

import {
  FORBIDDEN_ACTOR,
  PREVIEW_ACTOR,
  SIGNED_OUT_ACTOR,
  UNAVAILABLE_ACTOR,
  isActorRole,
  type ActorSnapshot,
} from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import { privateAccountAvatarUrl } from "@/profile-images/contracts";
import { verifiedAuthSession } from "@/server/auth/session";
import {
  ActorContextRejectedError,
  currentActorProjection,
  withActorDatabaseContext,
  type ActorDatabaseTransaction,
} from "@/server/db/authorization/repository";
import { currentApplicationIdentity } from "@/server/identity/service";
import type { AuthorizedActor } from "./contracts";
import { applicationAccessMode } from "./env";

export type AuthorizedResult<T> =
  | Readonly<{ status: "preview" }>
  | Readonly<{ status: "authorized"; actor: AuthorizedActor; value: T }>
  | Readonly<{ status: "signed-out" | "forbidden" | "unavailable" }>;

type AuthorizedWorkOptions = Readonly<{
  rethrow?: (error: unknown) => boolean;
}>;

export async function withAuthorizedActor<T>(
  work: (
    transaction: ActorDatabaseTransaction,
    actor: AuthorizedActor,
  ) => Promise<T>,
  options?: AuthorizedWorkOptions,
): Promise<AuthorizedResult<T>> {
  const mode = applicationAccessMode();
  if (mode === "preview") return PREVIEW_ACTOR;
  if (mode === "unavailable") return UNAVAILABLE_ACTOR;

  const session = await verifiedAuthSession();
  return withAuthorizedSession(session, work, options);
}

export async function withAuthorizedSession<T>(
  session: AuthSessionSnapshot,
  work: (
    transaction: ActorDatabaseTransaction,
    actor: AuthorizedActor,
  ) => Promise<T>,
  options?: AuthorizedWorkOptions,
): Promise<AuthorizedResult<T>> {
  if (session.status === "signed-out" || session.status === "recovery-required")
    return SIGNED_OUT_ACTOR;
  if (session.status !== "signed-in") return UNAVAILABLE_ACTOR;

  const identity = await currentApplicationIdentity(session);
  if (identity.status === "unavailable") return UNAVAILABLE_ACTOR;
  if (identity.status !== "enrolled" || !isActorRole(identity.role)) {
    return FORBIDDEN_ACTOR;
  }

  const actor: AuthorizedActor = Object.freeze({
    authUserId: session.subject,
    profileId: identity.profile.id,
    runId: identity.demoRun.id,
    runRole: identity.role,
  });

  try {
    const value = await withActorDatabaseContext(actor, (transaction) =>
      work(transaction, actor),
    );
    return Object.freeze({ status: "authorized", actor, value });
  } catch (error) {
    if (options?.rethrow?.(error)) throw error;
    return error instanceof ActorContextRejectedError
      ? FORBIDDEN_ACTOR
      : UNAVAILABLE_ACTOR;
  }
}

async function actorSnapshotForSession(
  session: AuthSessionSnapshot,
): Promise<ActorSnapshot> {
  const mode = applicationAccessMode();
  if (mode === "preview") return PREVIEW_ACTOR;
  if (mode === "unavailable") return UNAVAILABLE_ACTOR;

  const result = await withAuthorizedSession(session, (transaction, actor) =>
    currentActorProjection(transaction, actor),
  );
  if (result.status !== "authorized") return result;

  return Object.freeze({
    status: "authorized",
    profile: Object.freeze({
      slug: result.value.profileSlug,
      displayName: result.value.displayName,
      avatarUrl: privateAccountAvatarUrl(result.value.avatarUpdatedAt),
      coachPortraitUrl: profileImageStorage.publicPortraitUrl(
        result.value.coachPortrait,
      ),
    }),
    demoRun: Object.freeze({
      slug: result.value.runSlug,
      name: result.value.runName,
    }),
    role: result.value.role,
    coachAccessStatus: result.value.coachAccess.status,
  });
}

export async function currentActorSnapshot(): Promise<ActorSnapshot> {
  return actorSnapshotForSession(await verifiedAuthSession());
}

export async function initialAuthorizationState() {
  const session = await verifiedAuthSession();
  return Object.freeze({
    session,
    actor: await actorSnapshotForSession(session),
  });
}
