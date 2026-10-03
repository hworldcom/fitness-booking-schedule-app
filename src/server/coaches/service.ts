import "server-only";

import type {
  CoachDirectoryState,
  CoachDirectoryFilters,
  CoachEditorState,
  CoachProfileInput,
  PublicCoachProfileState,
} from "@/domain/coaches";
import { isCoachPublicSlug } from "@/domain/coaches";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import {
  activeCoachGymOptions,
  currentOwnedCoachProfileRecord,
  publicCoachDirectoryRecords,
  publicCoachProfileRecord,
  upsertOwnedCoachProfileRecord,
} from "@/server/db/coaches/repository";

export async function publicCoachDirectory(
  filters: CoachDirectoryFilters,
): Promise<CoachDirectoryState> {
  try {
    return Object.freeze({
      status: "ready",
      coaches: await publicCoachDirectoryRecords(filters),
      filters,
    });
  } catch {
    return Object.freeze({ status: "unavailable", filters });
  }
}

export async function publicCoachProfile(
  slug: string,
): Promise<PublicCoachProfileState> {
  if (!isCoachPublicSlug(slug)) {
    return Object.freeze({ status: "not-found" });
  }
  try {
    const coach = await publicCoachProfileRecord(slug);
    return coach
      ? Object.freeze({ status: "ready", coach })
      : Object.freeze({ status: "not-found" });
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}

export async function currentCoachEditor(): Promise<CoachEditorState> {
  const result = await withAuthorizedActor(async (transaction, actor) => {
    const owner = await currentActorProjection(transaction, actor);
    const coach = await currentOwnedCoachProfileRecord(transaction, actor);
    const gyms = await activeCoachGymOptions(transaction, actor);
    return Object.freeze({
      coach,
      gyms,
      ownerDisplayName: owner.displayName,
    });
  });
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized", ...result.value });
}

export async function saveOwnedCoachProfile(input: CoachProfileInput) {
  const result = await withAuthorizedActor((transaction) =>
    upsertOwnedCoachProfileRecord(transaction, input),
  );
  if (result.status !== "authorized") return result;
  return Object.freeze({ status: "authorized" as const, slug: result.value });
}
