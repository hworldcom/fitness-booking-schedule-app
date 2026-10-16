import "server-only";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { currentCoachPrivateBookingRecords } from "@/server/db/coaches/booking-repository";
import { currentActorProjection } from "@/server/db/authorization/repository";
import { withAuthorizedActor } from "@/server/authorization/service";

export async function currentConnectedAthleteDetail(pairId: string) {
  if (!isCanonicalUuid(pairId)) return { status: "not-found" as const };
  return withAuthorizedActor(async (tx, actor) => {
    const owner = await currentActorProjection(tx, actor);
    const bookings = await currentCoachPrivateBookingRecords(tx, actor, pairId);
    return { actorKey: `${owner.runSlug}:${owner.profileSlug}`, bookings };
  });
}
