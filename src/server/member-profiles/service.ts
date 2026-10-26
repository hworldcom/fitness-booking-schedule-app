import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { memberAvatarUrl } from "@/domain/member-profile";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import { memberProfileRecord } from "@/server/db/member-profiles/repository";

export async function currentMemberProfile(id: string) {
  if (!isCanonicalUuid(id)) return { status: "not-found" as const };
  return withAuthorizedActor(async (tx, actor) => {
    const owner = await currentActorProjection(tx, actor);
    const member = await memberProfileRecord(tx, id);
    return {
      actorKey: `${owner.runSlug}:${owner.profileSlug}`,
      profile: member
        ? {
            id: member.id,
            displayName: member.displayName,
            imageUrl: memberAvatarUrl(member.id, member.updatedAt),
          }
        : null,
    };
  });
}
