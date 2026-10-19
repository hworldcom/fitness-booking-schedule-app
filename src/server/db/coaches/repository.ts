import "server-only";
import { profileImageStorage } from "@/server/storage/profile-images";

import { sql } from "drizzle-orm";
import type {
  CoachDirectoryEntry,
  CoachDirectoryFilters,
  CoachDiscipline,
  CoachProjection,
  CoachProfileInput,
  CoachTrainingLocation,
  CoachTrainingLocationInput,
} from "@/domain/coaches";
import {
  COACH_DISCIPLINES,
  MAX_COACH_DIRECTORY_TODAY_SLOTS,
  resolveCoachPrimaryLocation,
} from "@/domain/coaches";
import {
  isOwnedProfileImageStoragePath,
  type CoachPortraitReference,
} from "@/profile-images/contracts";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { withDatabaseConnection } from "@/server/db/client";
import {
  mapPublicAvailability,
  publicAvailabilitySelect,
  type PublicAvailabilityRow,
} from "./availability-repository";

type CoachProjectionRow = Readonly<{
  profile_id: string;
  public_slug: string;
  display_name: string;
  bio: string;
  service_mode: string;
  timezone: string;
  selected_gym_id: string | null;
  gym_name: string | null;
  location_kind: string;
  public_location_label: string;
  latitude: string;
  longitude: string;
  location_source: string;
  location_provider: string | null;
  location_confirmed_at: string | Date;
  visibility: string;
  record_source: string;
  trust_kind: string | null;
  portrait_source: string | null;
  portrait_path: string | null;
  portrait_updated_at: string | Date | null;
  disciplines: string[];
  locations: unknown;
}>;

type GymProjectionRow = Readonly<{
  id: string;
  name: string;
  public_location_label: string;
  timezone: string;
}>;

type DirectoryAvailabilityRow = PublicAvailabilityRow &
  Readonly<{
    profile_id: string;
    occurrence_rank: string | number;
  }>;

export class CoachProfileConflictError extends Error {
  constructor(message = "The coach profile conflicts with current state.") {
    super(message);
    this.name = "CoachProfileConflictError";
  }
}

export class CoachTrainingLocationConflictError extends Error {
  constructor(message = "The training location conflicts with current state.") {
    super(message);
    this.name = "CoachTrainingLocationConflictError";
  }
}

function isoTimestamp(value: string | Date) {
  return new Date(value).toISOString();
}

function isDiscipline(value: string): value is CoachDiscipline {
  return COACH_DISCIPLINES.some((discipline) => discipline === value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function parseLocationRows(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new CoachProfileConflictError();
  }
}

function mapTrainingLocation(value: unknown): CoachTrainingLocation {
  if (typeof value !== "object" || value === null) {
    throw new CoachProfileConflictError();
  }
  const row = value as Record<string, unknown>;
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  const source = row.location_source;
  const kind = row.location_kind;
  const status = row.status;
  const recordSource = row.record_source;
  const selectedGymId = row.selected_gym_id;
  const gymName = row.gym_name;
  const provider = row.location_provider;
  const deactivatedAt = row.deactivated_at;
  const sortOrder = row.sort_order;
  if (
    !isUuid(row.id) ||
    typeof row.public_name !== "string" ||
    typeof row.timezone !== "string" ||
    (selectedGymId !== null && !isUuid(selectedGymId)) ||
    (gymName !== null && typeof gymName !== "string") ||
    (kind !== "gym" && kind !== "independent") ||
    (kind === "gym" && selectedGymId === null) ||
    (kind === "independent" && selectedGymId !== null) ||
    typeof row.public_location_label !== "string" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    (source !== "fixture" &&
      source !== "manual" &&
      source !== "permanent-geocoding") ||
    (provider !== null && typeof provider !== "string") ||
    typeof row.location_confirmed_at !== "string" ||
    (status !== "active" && status !== "inactive") ||
    typeof row.is_primary !== "boolean" ||
    typeof sortOrder !== "number" ||
    !Number.isInteger(sortOrder) ||
    (deactivatedAt !== null && typeof deactivatedAt !== "string") ||
    (recordSource !== "fixture" && recordSource !== "user") ||
    typeof row.updated_at !== "string"
  ) {
    throw new CoachProfileConflictError();
  }

  return Object.freeze({
    id: row.id,
    publicName: row.public_name,
    timezone: row.timezone,
    selectedGymId,
    gymName,
    location: Object.freeze({
      kind,
      label: row.public_location_label,
      latitude,
      longitude,
      source,
      provider,
      confirmedAt: isoTimestamp(row.location_confirmed_at),
    }),
    status,
    isPrimary: row.is_primary,
    sortOrder,
    deactivatedAt: deactivatedAt === null ? null : isoTimestamp(deactivatedAt),
    recordSource,
    updatedAt: row.updated_at,
  });
}

function mapCoach(row: CoachProjectionRow): CoachProjection {
  const rawLocations = parseLocationRows(row.locations);
  if (!Array.isArray(rawLocations)) throw new CoachProfileConflictError();
  const locations = rawLocations.map(mapTrainingLocation);
  const primaryLocations = locations.filter(
    (location) => location.status === "active" && location.isPrimary,
  );
  const primaryLocation = primaryLocations[0];
  if (
    row.service_mode !== "private-training" ||
    (row.visibility !== "visible" && row.visibility !== "hidden") ||
    (row.record_source !== "fixture" && row.record_source !== "user") ||
    (row.trust_kind !== null &&
      row.trust_kind !== "demo" &&
      row.trust_kind !== "verified") ||
    primaryLocations.length !== 1 ||
    primaryLocation === undefined ||
    primaryLocation.timezone !== row.timezone ||
    row.disciplines.length < 1 ||
    !row.disciplines.every(isDiscipline)
  ) {
    throw new CoachProfileConflictError();
  }

  let portrait: CoachPortraitReference | null = null;
  if (
    row.portrait_source !== null ||
    row.portrait_path !== null ||
    row.portrait_updated_at !== null
  ) {
    if (
      (row.portrait_source !== "fixture" &&
        row.portrait_source !== "storage" &&
        row.portrait_source !== "account") ||
      (row.portrait_source === "account" &&
        row.portrait_path !== row.profile_id) ||
      row.portrait_path === null ||
      row.portrait_updated_at === null ||
      (row.portrait_source === "fixture" &&
        row.portrait_path !== `/images/coaches/${row.public_slug}.webp`) ||
      (row.portrait_source === "storage" &&
        !isOwnedProfileImageStoragePath(row.portrait_path, row.profile_id))
    ) {
      throw new CoachProfileConflictError();
    }
    portrait = Object.freeze({
      source: row.portrait_source,
      path: row.portrait_path,
      updatedAt: isoTimestamp(row.portrait_updated_at),
    });
  }
  const portraitUrl = profileImageStorage.publicPortraitUrl(portrait);
  if (portrait?.source === "storage" && !portraitUrl) {
    throw new CoachProfileConflictError();
  }

  return Object.freeze({
    profileId: row.profile_id,
    slug: row.public_slug,
    displayName: row.display_name,
    bio: row.bio,
    serviceMode: row.service_mode,
    timezone: row.timezone,
    primaryLocationId: primaryLocation.id,
    locations: Object.freeze(locations),
    selectedGymId: primaryLocation.selectedGymId,
    gymName: primaryLocation.gymName,
    location: primaryLocation.location,
    visibility: row.visibility,
    recordSource: row.record_source,
    trustKind: row.trust_kind,
    portraitUrl,
    disciplines: Object.freeze([...row.disciplines]),
  });
}

function projectionSelect() {
  return sql.raw(`
    coach.profile_id,
    coach.public_slug,
    coach.display_name,
    coach.bio,
    coach.service_mode,
    coach.timezone,
    coach.selected_gym_id,
    gym.name as gym_name,
    coach.location_kind,
    coach.public_location_label,
    coach.latitude,
    coach.longitude,
    coach.location_source,
    coach.location_provider,
    coach.location_confirmed_at,
    coach.visibility,
    coach.record_source,
    app.coach_trust_kind(coach.profile_id, coach.is_demo) as trust_kind,
    coach.portrait_source,
    coach.portrait_path,
    coach.portrait_updated_at,
    array_agg(discipline.discipline order by discipline.sort_order)
      as disciplines,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', location.id,
            'public_name', location.public_name,
            'timezone', location.timezone,
            'selected_gym_id', location.selected_gym_id,
            'gym_name', location_gym.name,
            'location_kind', location.location_kind,
            'public_location_label', location.public_location_label,
            'latitude', location.latitude,
            'longitude', location.longitude,
            'location_source', location.location_source,
            'location_provider', location.location_provider,
            'location_confirmed_at', location.location_confirmed_at,
            'status', location.status,
            'is_primary', location.is_primary,
            'sort_order', location.sort_order,
            'deactivated_at', location.deactivated_at,
            'record_source', location.record_source,
            'updated_at', location.updated_at
          )
          order by location.sort_order, location.id
        )
        from app.coach_training_locations as location
        left join app.gyms as location_gym
          on location_gym.run_id = location.run_id
          and location_gym.id = location.selected_gym_id
        where location.run_id = coach.run_id
          and location.profile_id = coach.profile_id
      ),
      '[]'::jsonb
    ) as locations
  `);
}

export async function publicCoachDirectoryRecords(
  filters: CoachDirectoryFilters,
) {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<CoachProjectionRow>(sql`
      select ${projectionSelect()}
      from app.coach_profiles as coach
      join app.coach_profile_disciplines as discipline
        on discipline.run_id = coach.run_id
        and discipline.profile_id = coach.profile_id
      left join app.gyms as gym
        on gym.run_id = coach.run_id
        and gym.id = coach.selected_gym_id
      where coach.visibility = 'visible'
        and (
          ${filters.query} = ''
          or pg_catalog.strpos(
            pg_catalog.lower(
              pg_catalog.concat_ws(' ', coach.display_name, coach.bio)
            ),
            pg_catalog.lower(${filters.query})
          ) > 0
        )
        and (
          ${filters.discipline}::text is null
          or exists (
            select 1
            from app.coach_profile_disciplines as matching_discipline
            where matching_discipline.run_id = coach.run_id
              and matching_discipline.profile_id = coach.profile_id
              and matching_discipline.discipline = ${filters.discipline}
          )
        )
        and (
          ${filters.location} = ''
          or pg_catalog.strpos(
            pg_catalog.lower(
              pg_catalog.concat_ws(
                ' ',
                coach.public_location_label,
                gym.name
              )
            ),
            pg_catalog.lower(${filters.location})
          ) > 0
        )
        and (
          ${filters.serviceMode}::text is null
          or coach.service_mode = ${filters.serviceMode}
        )
      group by
        coach.run_id,
        coach.profile_id,
        gym.name
      order by coach.display_name, coach.profile_id
    `);
    const coaches = rows.map(mapCoach);
    if (coaches.length === 0) {
      return Object.freeze([]) as readonly CoachDirectoryEntry[];
    }
    if (
      new Set(coaches.map((coach) => coach.profileId)).size !==
        coaches.length ||
      coaches.some((coach) => coach.trustKind === null)
    ) {
      throw new CoachProfileConflictError();
    }

    const matchedProfiles = sql.join(
      coaches.map((coach) => sql`(${coach.profileId}::uuid)`),
      sql`, `,
    );
    const availabilityRows = await db.execute<DirectoryAvailabilityRow>(sql`
      with matched (profile_id) as (
        values ${matchedProfiles}
      ),
      synchronized as materialized (
        select
          matched.profile_id,
          app.synchronize_public_coach_availability(matched.profile_id)
            as synchronized_count
        from matched
      ),
      ranked as (
        select
          slot.*,
          pg_catalog.row_number() over (
            partition by slot.profile_id
            order by slot.starts_at, slot.id
          ) as occurrence_rank
        from synchronized
        join app.coach_profiles as coach
          on coach.profile_id = synchronized.profile_id
        join app.coach_availability_slots as slot
          on slot.run_id = coach.run_id
          and slot.profile_id = coach.profile_id
        where synchronized.synchronized_count >= 0
          and slot.status = 'open'
          and slot.starts_at > pg_catalog.statement_timestamp()
          and (
            slot.starts_at at time zone coach.timezone
          )::date = (
            pg_catalog.statement_timestamp() at time zone coach.timezone
          )::date
      )
      select
        slot.profile_id,
        slot.occurrence_rank,
        ${publicAvailabilitySelect()}
      from ranked as slot
      where slot.occurrence_rank
        <= ${MAX_COACH_DIRECTORY_TODAY_SLOTS + 1}
      order by slot.profile_id, slot.starts_at, slot.id
    `);

    const coachesById = new Map(
      coaches.map((coach) => [coach.profileId, coach] as const),
    );
    const todaySlotsByCoach = new Map<
      string,
      ReturnType<typeof mapPublicAvailability>[]
    >();
    for (const row of availabilityRows) {
      const coach = coachesById.get(row.profile_id);
      const occurrenceRank = Number(row.occurrence_rank);
      if (
        !coach ||
        !Number.isInteger(occurrenceRank) ||
        occurrenceRank < 1 ||
        occurrenceRank > MAX_COACH_DIRECTORY_TODAY_SLOTS + 1
      ) {
        throw new CoachProfileConflictError();
      }
      const slots = todaySlotsByCoach.get(coach.profileId) ?? [];
      slots.push(mapPublicAvailability(row));
      todaySlotsByCoach.set(coach.profileId, slots);
    }

    return Object.freeze(
      coaches.map((coach) => {
        const primaryLocation = resolveCoachPrimaryLocation(coach);
        const todaySlots = todaySlotsByCoach.get(coach.profileId) ?? [];
        if (
          !primaryLocation ||
          todaySlots.length > MAX_COACH_DIRECTORY_TODAY_SLOTS
        ) {
          throw new CoachProfileConflictError();
        }
        return Object.freeze({
          coach,
          primaryLocation,
          todaySlots: Object.freeze(todaySlots),
        });
      }),
    );
  });
}

export async function publicCoachProfileRecord(slug: string) {
  return withDatabaseConnection(async ({ db }) => {
    const rows = await db.execute<CoachProjectionRow>(sql`
      select ${projectionSelect()}
      from app.coach_profiles as coach
      join app.coach_profile_disciplines as discipline
        on discipline.run_id = coach.run_id
        and discipline.profile_id = coach.profile_id
      left join app.gyms as gym
        on gym.run_id = coach.run_id
        and gym.id = coach.selected_gym_id
      where coach.public_slug = ${slug}
        and coach.visibility = 'visible'
      group by
        coach.run_id,
        coach.profile_id,
        gym.name
    `);
    if (rows.length > 1) throw new CoachProfileConflictError();
    return rows[0] ? mapCoach(rows[0]) : null;
  });
}

export async function currentOwnedCoachProfileRecord(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
) {
  const rows = await transaction.execute<CoachProjectionRow>(sql`
    select ${projectionSelect()}
    from app.coach_profiles as coach
    join app.coach_profile_disciplines as discipline
      on discipline.run_id = coach.run_id
      and discipline.profile_id = coach.profile_id
    left join app.gyms as gym
      on gym.run_id = coach.run_id
      and gym.id = coach.selected_gym_id
    where coach.run_id = ${actor.runId}::uuid
      and coach.profile_id = ${actor.profileId}::uuid
    group by
      coach.run_id,
      coach.profile_id,
      gym.name
  `);
  if (rows.length > 1) throw new CoachProfileConflictError();
  return rows[0] ? mapCoach(rows[0]) : null;
}

export async function activeCoachGymOptions(
  transaction: ActorDatabaseTransaction,
  actor: AuthorizedActor,
) {
  const rows = await transaction.execute<GymProjectionRow>(sql`
    select id, name, public_location_label, timezone
    from app.gyms
    where run_id = ${actor.runId}::uuid
      and status = 'active'
    order by name, id
  `);
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        id: row.id,
        name: row.name,
        locationLabel: row.public_location_label,
        timezone: row.timezone,
      }),
    ),
  );
}

function isPostgresProfileError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      current.code === "P0001" &&
      "message" in current &&
      typeof current.message === "string" &&
      current.message.includes("coach profile")
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

function isPostgresTrainingLocationError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      (current.code === "P0001" ||
        current.code === "23503" ||
        current.code === "23505" ||
        current.code === "23514" ||
        current.code === "22007" ||
        current.code === "22P02")
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

function locationMutationValues(input: CoachTrainingLocationInput) {
  if (input.kind === "gym") {
    return Object.freeze({
      publicName: null,
      selectedGymId: input.selectedGymId,
      label: null,
      latitude: null,
      longitude: null,
      source: null,
      provider: null,
    });
  }
  return Object.freeze({
    publicName: input.publicName,
    selectedGymId: null,
    label: input.label,
    latitude: input.latitude,
    longitude: input.longitude,
    source: input.source,
    provider: input.provider,
  });
}

async function trainingLocationMutation<T>(mutation: () => Promise<T>) {
  try {
    return await mutation();
  } catch (error) {
    if (error instanceof CoachTrainingLocationConflictError) throw error;
    if (isPostgresTrainingLocationError(error)) {
      throw new CoachTrainingLocationConflictError();
    }
    throw error;
  }
}

export function createOwnedCoachTrainingLocationRecord(
  transaction: ActorDatabaseTransaction,
  input: CoachTrainingLocationInput,
) {
  const values = locationMutationValues(input);
  return trainingLocationMutation(async () => {
    const rows = await transaction.execute<{ location_id: string }>(sql`
      select app.create_owned_coach_training_location(
        ${values.publicName}::text,
        ${values.selectedGymId}::uuid,
        ${values.label}::text,
        ${values.latitude}::numeric,
        ${values.longitude}::numeric,
        ${values.source}::text,
        ${values.provider}::text
      ) as location_id
    `);
    const locationId = rows[0]?.location_id;
    if (!locationId || rows.length !== 1) {
      throw new CoachTrainingLocationConflictError();
    }
    return locationId;
  });
}

export function updateOwnedCoachTrainingLocationRecord(
  transaction: ActorDatabaseTransaction,
  locationId: string,
  expectedUpdatedAt: string,
  input: CoachTrainingLocationInput,
) {
  const values = locationMutationValues(input);
  return trainingLocationMutation(async () => {
    const rows = await transaction.execute<{ updated_at: string }>(sql`
      select app.update_owned_coach_training_location(
        ${locationId}::uuid,
        ${expectedUpdatedAt}::timestamptz,
        ${values.publicName}::text,
        ${values.selectedGymId}::uuid,
        ${values.label}::text,
        ${values.latitude}::numeric,
        ${values.longitude}::numeric,
        ${values.source}::text,
        ${values.provider}::text
      )::text as updated_at
    `);
    const updatedAt = rows[0]?.updated_at;
    if (!updatedAt || rows.length !== 1) {
      throw new CoachTrainingLocationConflictError();
    }
    return updatedAt;
  });
}

export function setOwnedCoachPrimaryLocationRecord(
  transaction: ActorDatabaseTransaction,
  locationId: string,
  expectedLocationUpdatedAt: string,
  expectedPrimaryLocationId: string,
  expectedPrimaryUpdatedAt: string,
) {
  return trainingLocationMutation(async () => {
    const rows = await transaction.execute<{ updated_at: string }>(sql`
      select app.set_owned_coach_primary_location(
        ${locationId}::uuid,
        ${expectedLocationUpdatedAt}::timestamptz,
        ${expectedPrimaryLocationId}::uuid,
        ${expectedPrimaryUpdatedAt}::timestamptz
      )::text as updated_at
    `);
    const updatedAt = rows[0]?.updated_at;
    if (!updatedAt || rows.length !== 1) {
      throw new CoachTrainingLocationConflictError();
    }
    return updatedAt;
  });
}

export function deactivateOwnedCoachTrainingLocationRecord(
  transaction: ActorDatabaseTransaction,
  locationId: string,
  expectedLocationUpdatedAt: string,
  replacement: Readonly<{
    id: string;
    expectedUpdatedAt: string;
  }> | null = null,
) {
  return trainingLocationMutation(async () => {
    const rows = await transaction.execute<{ location_id: string }>(sql`
      select app.deactivate_owned_coach_training_location(
        ${locationId}::uuid,
        ${expectedLocationUpdatedAt}::timestamptz,
        ${replacement?.id ?? null}::uuid,
        ${replacement?.expectedUpdatedAt ?? null}::timestamptz
      ) as location_id
    `);
    const deactivatedId = rows[0]?.location_id;
    if (!deactivatedId || rows.length !== 1) {
      throw new CoachTrainingLocationConflictError();
    }
    return deactivatedId;
  });
}

export async function upsertOwnedCoachProfileRecord(
  transaction: ActorDatabaseTransaction,
  input: CoachProfileInput,
) {
  const disciplines = sql.join(
    input.disciplines.map((discipline) => sql`${discipline}::text`),
    sql`, `,
  );
  const independent = input.independentLocation;
  try {
    const rows = await transaction.execute<{ public_slug: string }>(sql`
      select app.upsert_owned_coach_profile(
        ${input.displayName}::text,
        ${input.bio}::text,
        array[${disciplines}]::text[],
        ${input.timezone}::text,
        ${input.visibility}::text,
        ${input.selectedGymId}::uuid,
        ${independent?.label ?? null}::text,
        ${independent?.latitude ?? null}::numeric,
        ${independent?.longitude ?? null}::numeric,
        ${independent?.source ?? null}::text,
        ${independent?.provider ?? null}::text
      ) as public_slug
    `);
    const slug = rows[0]?.public_slug;
    if (!slug || rows.length !== 1) throw new CoachProfileConflictError();
    return slug;
  } catch (error) {
    if (error instanceof CoachProfileConflictError) throw error;
    if (isPostgresProfileError(error)) {
      throw new CoachProfileConflictError();
    }
    throw error;
  }
}
