import "server-only";

import type { EffectiveAvailabilityCommand } from "@/domain/effective-availability";
import { withAuthorizedActor } from "@/server/authorization/service";
import { CoachAvailabilityConflictError } from "@/server/db/coaches/availability-repository";
import {
  ownedEffectiveAvailabilityRecord,
  saveOwnedEffectiveAvailabilityRecord,
} from "@/server/db/coaches/effective-availability-repository";

export async function currentEffectiveAvailability(
  fromDate: string,
  throughDate: string,
) {
  return withAuthorizedActor((transaction) =>
    ownedEffectiveAvailabilityRecord(transaction, fromDate, throughDate),
  );
}

export async function saveCurrentEffectiveAvailability(
  command: EffectiveAvailabilityCommand,
  preview = false,
) {
  return withAuthorizedActor(async (transaction) => {
    try {
      return await saveOwnedEffectiveAvailabilityRecord(
        transaction,
        command,
        preview,
      );
    } catch (error) {
      if (error instanceof CoachAvailabilityConflictError)
        return Object.freeze({ outcome: "invalid" as const });
      throw error;
    }
  });
}
