import "server-only";
import { withAuthorizedActor } from "@/server/authorization/service";
import { currentActorProjection } from "@/server/db/authorization/repository";
import { currentClientPrivateBookingRecords } from "@/server/db/coaches/booking-repository";
import { currentClientCoachBookingRequestRecords } from "@/server/db/coaches/booking-request-repository";

export function currentSessionHistoryPreview() {
  return withAuthorizedActor(async (transaction, actor) => {
    const owner = await currentActorProjection(transaction, actor);
    const bookings = await currentClientPrivateBookingRecords(
      transaction,
      actor,
    );
    const requests = await currentClientCoachBookingRequestRecords(
      transaction,
      {
        pageSize: 20,
      },
    );
    return {
      actorIdentity: `${owner.runSlug}:${owner.profileSlug}:${owner.role}`,
      bookings,
      requests,
    };
  });
}
