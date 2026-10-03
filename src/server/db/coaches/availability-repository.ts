import "server-only";

import { sql } from "drizzle-orm";
import type {
  CoachAvailabilityInput,
  CoachAvailabilityStatus,
  OwnedCoachAvailabilitySlot,
  PublicCoachAvailabilitySlot,
} from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { withDatabaseConnection } from "@/server/db/client";

type AvailabilityRow = Readonly<{
  id: string;
  starts_at: string | Date;
  ends_at: string | Date;
  coach_timezone: string;
  status: string;
  location_kind: string;
  selected_gym_id: string | null;
  gym_name: string | null;
  public_location_label: string;
  latitude: string;
  longitude: string;
  location_source: string;
  location_provider: string | null;
  location_confirmed_at: string | Date;
}>;

export class CoachAvailabilityConflictError extends Error {
  constructor(
    message = "The availability slot conflicts with current state.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CoachAvailabilityConflictError";
  }
}

function isAvailabilityStatus(value: string): value is CoachAvailabilityStatus {
  return (
    value === "open" ||
    value === "held" ||
    value === "booked" ||
    value === "withdrawn"
  );
}

function availabilitySelect() {
  return sql.raw(`
    slot.id,
    slot.starts_at,
    slot.ends_at,
    slot.coach_timezone,
    slot.status,
    slot.location_kind,
    slot.selected_gym_id,
    slot.gym_name,
    slot.public_location_label,
    slot.latitude,
    slot.longitude,
    slot.location_source,
    slot.location_provider,
    slot.location_confirmed_at
  `);
}

function mapAvailabilityBase(row: AvailabilityRow) {
  const startsAt = new Date(row.starts_at);
  const endsAt = new Date(row.ends_at);
  const confirmedAt = new Date(row.location_confirmed_at);
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  const locationKind = row.location_kind;
  const locationSource = row.location_source;

  if (
    !isAvailabilityStatus(row.status) ||
    (locationKind !== "gym" && locationKind !== "independent") ||
    (locationSource !== "fixture" &&
      locationSource !== "manual" &&
      locationSource !== "permanent-geocoding") ||
    (locationKind === "gym" && (!row.selected_gym_id || !row.gym_name)) ||
    (locationKind === "independent" &&
      (row.selected_gym_id !== null || row.gym_name !== null)) ||
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    endsAt <= startsAt ||
    !Number.isFinite(confirmedAt.getTime()) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new CoachAvailabilityConflictError();
  }

  return Object.freeze({
    id: row.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    coachTimezone: row.coach_timezone,
    status: row.status,
    location: Object.freeze({
      kind: locationKind,
      selectedGymId: row.selected_gym_id,
      gymName: row.gym_name,
      label: row.public_location_label,
      latitude,
      longitude,
      source: locationSource,
      provider: row.location_provider,
      confirmedAt: confirmedAt.toISOString(),
    }),
  });
}

function mapOwnedAvailability(
  row: AvailabilityRow,
): OwnedCoachAvailabilitySlot {
  return mapAvailabilityBase(row);
}

function mapPublicAvailability(
  row: AvailabilityRow,
): PublicCoachAvailabilitySlot {
  const slot = mapAvailabilityBase(row);
  return Object.freeze({
    id: slot.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    coachTimezone: slot.coachTimezone,
    location: slot.location,
  });
}

export async function publicCoachAvailabilityRecords(profileId: string) {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<AvailabilityRow>(sql`
      select ${availabilitySelect()}
      from app.coach_availability_slots as slot
      where slot.profile_id = ${profileId}::uuid
        and slot.status = 'open'
        and slot.starts_at > pg_catalog.statement_timestamp()
        and slot.ends_at
          <= pg_catalog.statement_timestamp() + interval '7 days'
      order by slot.starts_at, slot.id
    `);
    return Object.freeze(rows.map(mapPublicAvailability));
  });
}

export async function currentOwnedCoachAvailabilityRecords(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
) {
  const rows = await transaction.execute<AvailabilityRow>(sql`
    select ${availabilitySelect()}
    from app.coach_availability_slots as slot
    where slot.run_id = ${actor.runId}::uuid
      and slot.profile_id = ${actor.profileId}::uuid
      and slot.status <> 'withdrawn'
      and slot.ends_at > pg_catalog.statement_timestamp()
      and slot.starts_at
        <= pg_catalog.statement_timestamp() + interval '7 days'
    order by slot.starts_at, slot.id
  `);
  return Object.freeze(rows.map(mapOwnedAvailability));
}

function isPostgresAvailabilityError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      (current.code === "23P01" ||
        current.code === "23514" ||
        current.code === "23503" ||
        (current.code === "P0001" &&
          "message" in current &&
          typeof current.message === "string" &&
          current.message.includes("coach availability")))
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

async function availabilityMutation(
  work: () => Promise<readonly Readonly<{ slot_id: string }>[]>,
) {
  try {
    const rows = await work();
    const slotId = rows[0]?.slot_id;
    if (!slotId || rows.length !== 1) {
      throw new CoachAvailabilityConflictError();
    }
    return slotId;
  } catch (error) {
    if (error instanceof CoachAvailabilityConflictError) throw error;
    if (isPostgresAvailabilityError(error)) {
      throw new CoachAvailabilityConflictError(undefined, { cause: error });
    }
    throw error;
  }
}

export async function createOwnedCoachAvailabilityRecord(
  transaction: ActorDatabaseTransaction,
  input: CoachAvailabilityInput,
) {
  return availabilityMutation(() =>
    transaction.execute<{ slot_id: string }>(sql`
      select app.create_owned_coach_availability(
        ${input.localStart}::timestamp without time zone,
        ${input.durationMinutes}::integer
      ) as slot_id
    `),
  );
}

export async function updateOwnedCoachAvailabilityRecord(
  transaction: ActorDatabaseTransaction,
  slotId: string,
  input: CoachAvailabilityInput,
) {
  return availabilityMutation(() =>
    transaction.execute<{ slot_id: string }>(sql`
      select app.update_owned_coach_availability(
        ${slotId}::uuid,
        ${input.localStart}::timestamp without time zone,
        ${input.durationMinutes}::integer,
        ${input.refreshLocation}::boolean
      ) as slot_id
    `),
  );
}

export async function withdrawOwnedCoachAvailabilityRecord(
  transaction: ActorDatabaseTransaction,
  slotId: string,
) {
  return availabilityMutation(() =>
    transaction.execute<{ slot_id: string }>(sql`
      select app.withdraw_owned_coach_availability(
        ${slotId}::uuid
      ) as slot_id
    `),
  );
}
