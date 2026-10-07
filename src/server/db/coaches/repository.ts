import "server-only";

import { sql } from "drizzle-orm";
import type {
  CoachDirectoryFilters,
  CoachDiscipline,
  CoachProjection,
  CoachProfileInput,
} from "@/domain/coaches";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";
import { withDatabaseConnection } from "@/server/db/client";

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
  disciplines: string[];
}>;

type GymProjectionRow = Readonly<{
  id: string;
  name: string;
  public_location_label: string;
  timezone: string;
}>;

export class CoachProfileConflictError extends Error {
  constructor(message = "The coach profile conflicts with current state.") {
    super(message);
    this.name = "CoachProfileConflictError";
  }
}

function isoTimestamp(value: string | Date) {
  return new Date(value).toISOString();
}

function isDiscipline(value: string): value is CoachDiscipline {
  return (
    value === "Boxing" ||
    value === "Muay Thai" ||
    value === "Kickboxing" ||
    value === "Brazilian Jiu-Jitsu" ||
    value === "MMA" ||
    value === "Wrestling"
  );
}

function mapCoach(row: CoachProjectionRow): CoachProjection {
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (
    row.service_mode !== "private-training" ||
    (row.location_kind !== "gym" && row.location_kind !== "independent") ||
    (row.location_source !== "fixture" &&
      row.location_source !== "manual" &&
      row.location_source !== "permanent-geocoding") ||
    (row.visibility !== "visible" && row.visibility !== "hidden") ||
    (row.record_source !== "fixture" && row.record_source !== "user") ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    row.disciplines.length < 1 ||
    !row.disciplines.every(isDiscipline)
  ) {
    throw new CoachProfileConflictError();
  }

  return Object.freeze({
    profileId: row.profile_id,
    slug: row.public_slug,
    displayName: row.display_name,
    bio: row.bio,
    serviceMode: row.service_mode,
    timezone: row.timezone,
    selectedGymId: row.selected_gym_id,
    gymName: row.gym_name,
    location: Object.freeze({
      kind: row.location_kind,
      label: row.public_location_label,
      latitude,
      longitude,
      source: row.location_source,
      provider: row.location_provider,
      confirmedAt: isoTimestamp(row.location_confirmed_at),
    }),
    visibility: row.visibility,
    recordSource: row.record_source,
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
    array_agg(discipline.discipline order by discipline.sort_order)
      as disciplines
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
    return Object.freeze(rows.map(mapCoach));
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
