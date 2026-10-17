import "server-only";
import { profileImageStorage } from "@/server/storage/profile-images";

import { sql } from "drizzle-orm";
import {
  isCoachBookingRequestStatus,
  type ClientCoachBookingRequestProjection,
  type CoachBookingRequestMutationProjection,
  type CoachBookingRequestPage,
  type CoachBookingRequestPageCursor,
  type OwnedCoachBookingRequestProjection,
} from "@/domain/coach-booking-requests";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { isCoachPublicSlug } from "@/domain/coaches";
import {
  isOwnedProfileImageStoragePath,
  privateBookingRequestClientAvatarUrl,
  type CoachPortraitReference,
} from "@/profile-images/contracts";
import type { ActorDatabaseTransaction } from "@/server/db/authorization/repository";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const MAX_SLOT_SELECTION_SIZE = 200;

type BookingRequestRow = Readonly<{
  id: string;
  slot_id: string;
  coach_profile_id: string;
  coach_display_name: string;
  coach_slug: string;
  coach_portrait_source: string | null;
  coach_portrait_path: string | null;
  coach_portrait_updated_at: string | Date | null;
  client_profile_id: string;
  client_display_name: string;
  client_avatar_updated_at?: string | Date | null;
  status: string;
  scheduled_start_at: string | Date;
  scheduled_end_at: string | Date;
  coach_timezone: string;
  coach_training_location_id: string | null;
  training_location_name: string;
  location_kind: string;
  gym_name: string | null;
  public_location_label: string;
  decision_deadline_at: string | Date;
  decided_at: string | Date | null;
  accepted_booking_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}>;

type BookingRequestMutationRow = Readonly<{
  request_id: string;
  request_status: string;
  booking_id: string | null;
}>;

export class CoachBookingRequestConflictError extends Error {
  constructor(
    message = "The booking request conflicts with current state.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CoachBookingRequestConflictError";
  }
}

function isoTimestamp(value: string | Date | null) {
  if (value === null) return null;
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new CoachBookingRequestConflictError();
  }
  return timestamp.toISOString();
}

function normalizedPageSize(pageSize: number | undefined) {
  const value = pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new CoachBookingRequestConflictError();
  }
  return value;
}

function normalizedCursor(cursor: CoachBookingRequestPageCursor | null) {
  if (cursor === null) return null;
  const createdAt = isoTimestamp(cursor.createdAt);
  if (!createdAt || !isCanonicalUuid(cursor.id)) {
    throw new CoachBookingRequestConflictError();
  }
  return Object.freeze({ createdAt, id: cursor.id });
}

function normalizedSlotIds(slotIds: readonly string[]) {
  if (
    slotIds.length < 1 ||
    slotIds.length > MAX_SLOT_SELECTION_SIZE ||
    slotIds.some((slotId) => !isCanonicalUuid(slotId)) ||
    new Set(slotIds).size !== slotIds.length
  ) {
    throw new CoachBookingRequestConflictError();
  }
  return slotIds;
}

function commonRequestProjection(row: BookingRequestRow) {
  if (
    !isCanonicalUuid(row.id) ||
    !isCanonicalUuid(row.slot_id) ||
    !isCanonicalUuid(row.coach_profile_id) ||
    !isCanonicalUuid(row.client_profile_id) ||
    !isCoachBookingRequestStatus(row.status) ||
    (row.coach_training_location_id !== null &&
      !isCanonicalUuid(row.coach_training_location_id)) ||
    (row.accepted_booking_id !== null &&
      !isCanonicalUuid(row.accepted_booking_id)) ||
    (row.location_kind !== "gym" && row.location_kind !== "independent") ||
    row.training_location_name.length < 2 ||
    row.training_location_name.length > 240 ||
    row.public_location_label.length < 2 ||
    row.public_location_label.length > 240 ||
    (row.location_kind === "gym") !== (row.gym_name !== null)
  ) {
    throw new CoachBookingRequestConflictError();
  }

  const scheduledStartAt = isoTimestamp(row.scheduled_start_at);
  const scheduledEndAt = isoTimestamp(row.scheduled_end_at);
  const decisionDeadlineAt = isoTimestamp(row.decision_deadline_at);
  const decidedAt = isoTimestamp(row.decided_at);
  const createdAt = isoTimestamp(row.created_at);
  const updatedAt = isoTimestamp(row.updated_at);
  if (
    !scheduledStartAt ||
    !scheduledEndAt ||
    !decisionDeadlineAt ||
    !createdAt ||
    !updatedAt ||
    new Date(scheduledEndAt).getTime() -
      new Date(scheduledStartAt).getTime() !==
      60 * 60 * 1000 ||
    new Date(decisionDeadlineAt).getTime() >
      new Date(scheduledStartAt).getTime() ||
    (row.status === "pending") !== (decidedAt === null) ||
    (row.status === "accepted") !== (row.accepted_booking_id !== null)
  ) {
    throw new CoachBookingRequestConflictError();
  }

  return Object.freeze({
    id: row.id,
    slotId: row.slot_id,
    status: row.status,
    scheduledStartAt,
    scheduledEndAt,
    coachTimezone: row.coach_timezone,
    location: Object.freeze({
      trainingLocationId: row.coach_training_location_id,
      name: row.training_location_name,
      kind: row.location_kind,
      gymName: row.gym_name,
      publicLabel: row.public_location_label,
    }),
    decisionDeadlineAt,
    decidedAt,
    acceptedBookingId: row.accepted_booking_id,
    createdAt,
    updatedAt,
  });
}

function mapClientRequest(
  row: BookingRequestRow,
): ClientCoachBookingRequestProjection {
  if (!isCoachPublicSlug(row.coach_slug)) {
    throw new CoachBookingRequestConflictError();
  }
  return Object.freeze({
    ...commonRequestProjection(row),
    coachProfileId: row.coach_profile_id,
    coachDisplayName: row.coach_display_name,
    coachSlug: row.coach_slug,
    coachPortraitUrl: clientCoachPortraitUrl(row),
  });
}

function clientCoachPortraitUrl(row: BookingRequestRow) {
  if (
    row.coach_portrait_source === null &&
    row.coach_portrait_path === null &&
    row.coach_portrait_updated_at === null
  ) {
    return null;
  }

  const updatedAt = isoTimestamp(row.coach_portrait_updated_at);
  if (
    (row.coach_portrait_source !== "fixture" &&
      row.coach_portrait_source !== "storage") ||
    row.coach_portrait_path === null ||
    updatedAt === null ||
    (row.coach_portrait_source === "fixture" &&
      row.coach_portrait_path !== `/images/coaches/${row.coach_slug}.webp`) ||
    (row.coach_portrait_source === "storage" &&
      !isOwnedProfileImageStoragePath(
        row.coach_portrait_path,
        row.coach_profile_id,
      ))
  ) {
    throw new CoachBookingRequestConflictError();
  }

  const reference: CoachPortraitReference = Object.freeze({
    source: row.coach_portrait_source,
    path: row.coach_portrait_path,
    updatedAt,
  });
  const portraitUrl = profileImageStorage.publicPortraitUrl(reference);
  if (!portraitUrl) throw new CoachBookingRequestConflictError();
  return portraitUrl;
}

function mapCoachRequest(
  row: BookingRequestRow,
): OwnedCoachBookingRequestProjection {
  return Object.freeze({
    ...commonRequestProjection(row),
    clientProfileId: row.client_profile_id,
    clientDisplayName: row.client_display_name,
    clientAvatarUrl: privateBookingRequestClientAvatarUrl(
      row.id,
      isoTimestamp(row.client_avatar_updated_at ?? null),
    ),
  });
}

function requestPage<T extends { id: string; createdAt: string }>(
  items: readonly T[],
  pageSize: number,
): CoachBookingRequestPage<T> {
  const last = items.at(-1);
  return Object.freeze({
    items: Object.freeze(items),
    nextCursor:
      items.length === pageSize && last
        ? Object.freeze({ createdAt: last.createdAt, id: last.id })
        : null,
  });
}

function isPostgresBookingRequestError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      (current.code === "23505" ||
        current.code === "40001" ||
        current.code === "23514" ||
        current.code === "23503" ||
        (current.code === "P0001" &&
          "message" in current &&
          typeof current.message === "string" &&
          (current.message.includes("message unavailable: blocked") ||
            current.message.includes("coach booking request"))))
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

async function requestOperation<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof CoachBookingRequestConflictError) throw error;
    if (isPostgresBookingRequestError(error)) {
      throw new CoachBookingRequestConflictError(undefined, { cause: error });
    }
    throw error;
  }
}

function mapMutation(
  rows: readonly BookingRequestMutationRow[],
  expectedRequestId?: string,
): CoachBookingRequestMutationProjection {
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row ||
    !isCanonicalUuid(row.request_id) ||
    (expectedRequestId !== undefined && row.request_id !== expectedRequestId) ||
    !isCoachBookingRequestStatus(row.request_status) ||
    (row.booking_id !== null && !isCanonicalUuid(row.booking_id)) ||
    (row.request_status === "accepted") !== (row.booking_id !== null)
  ) {
    throw new CoachBookingRequestConflictError();
  }
  return Object.freeze({
    requestId: row.request_id,
    status: row.request_status,
    bookingId: row.booking_id,
  });
}

export async function createCoachBookingRequestRecord(
  transaction: ActorDatabaseTransaction,
  slotId: string,
) {
  if (!isCanonicalUuid(slotId)) throw new CoachBookingRequestConflictError();
  return requestOperation(async () =>
    mapMutation(
      await transaction.execute<BookingRequestMutationRow>(sql`
        select request_id, request_status, booking_id
        from app.create_coach_booking_request(${slotId}::uuid)
      `),
    ),
  );
}

export async function withdrawCoachBookingRequestRecord(
  transaction: ActorDatabaseTransaction,
  requestId: string,
) {
  if (!isCanonicalUuid(requestId)) {
    throw new CoachBookingRequestConflictError();
  }
  return requestOperation(async () =>
    mapMutation(
      await transaction.execute<BookingRequestMutationRow>(sql`
        select request_id, request_status, booking_id
        from app.withdraw_coach_booking_request(${requestId}::uuid)
      `),
      requestId,
    ),
  );
}

export async function declineCoachBookingRequestRecord(
  transaction: ActorDatabaseTransaction,
  requestId: string,
) {
  if (!isCanonicalUuid(requestId)) {
    throw new CoachBookingRequestConflictError();
  }
  return requestOperation(async () =>
    mapMutation(
      await transaction.execute<BookingRequestMutationRow>(sql`
        select request_id, request_status, booking_id
        from app.decline_coach_booking_request(${requestId}::uuid)
      `),
      requestId,
    ),
  );
}

export async function acceptCoachBookingRequestRecord(
  transaction: ActorDatabaseTransaction,
  requestId: string,
) {
  if (!isCanonicalUuid(requestId)) {
    throw new CoachBookingRequestConflictError();
  }
  return requestOperation(async () =>
    mapMutation(
      await transaction.execute<BookingRequestMutationRow>(sql`
        select request_id, request_status, booking_id
        from app.accept_coach_booking_request(${requestId}::uuid)
      `),
      requestId,
    ),
  );
}

export async function closeCoachBookingRequestOccurrenceRecord(
  transaction: ActorDatabaseTransaction,
  slotId: string,
) {
  if (!isCanonicalUuid(slotId)) throw new CoachBookingRequestConflictError();
  return requestOperation(async () => {
    const rows = await transaction.execute<{ occurrence_status: string }>(sql`
      select app.close_coach_booking_request_occurrence(
        ${slotId}::uuid
      ) as occurrence_status
    `);
    const status = rows[0]?.occurrence_status;
    if (
      rows.length !== 1 ||
      (status !== "open" &&
        status !== "held" &&
        status !== "booked" &&
        status !== "withdrawn")
    ) {
      throw new CoachBookingRequestConflictError();
    }
    return status;
  });
}

export async function currentClientCoachBookingRequestRecords(
  transaction: ActorDatabaseTransaction,
  options?: Readonly<{
    pageSize?: number;
    cursor?: CoachBookingRequestPageCursor | null;
  }>,
) {
  const pageSize = normalizedPageSize(options?.pageSize);
  const cursor = normalizedCursor(options?.cursor ?? null);
  return requestOperation(async () => {
    const rows = await transaction.execute<BookingRequestRow>(sql`
      select
        request.id,
        request.slot_id,
        request.coach_profile_id,
        request.coach_display_name,
        request.coach_slug,
        coach.portrait_source as coach_portrait_source,
        coach.portrait_path as coach_portrait_path,
        coach.portrait_updated_at as coach_portrait_updated_at,
        request.client_profile_id,
        request.client_display_name,
        request.status,
        request.scheduled_start_at,
        request.scheduled_end_at,
        request.coach_timezone,
        request.coach_training_location_id,
        request.training_location_name,
        request.location_kind,
        request.gym_name,
        request.public_location_label,
        request.decision_deadline_at,
        request.decided_at,
        request.accepted_booking_id,
        request.created_at,
        request.updated_at
      from app.current_client_coach_booking_requests(
        ${pageSize}::integer,
        ${cursor?.createdAt ?? null}::timestamptz,
        ${cursor?.id ?? null}::uuid
      ) as request
      left join app.coach_profiles as coach
        on coach.run_id = request.run_id
        and coach.profile_id = request.coach_profile_id
    `);
    return requestPage(rows.map(mapClientRequest), pageSize);
  });
}

export async function currentClientCoachBookingRequestRecord(
  transaction: ActorDatabaseTransaction,
  requestId: string,
) {
  if (!isCanonicalUuid(requestId)) {
    throw new CoachBookingRequestConflictError();
  }
  return requestOperation(async () => {
    const rows = await transaction.execute<BookingRequestRow>(sql`
      select
        request.id,
        request.slot_id,
        request.coach_profile_id,
        request.coach_display_name,
        request.coach_slug,
        coach.portrait_source as coach_portrait_source,
        coach.portrait_path as coach_portrait_path,
        coach.portrait_updated_at as coach_portrait_updated_at,
        request.client_profile_id,
        request.client_display_name,
        request.status,
        request.scheduled_start_at,
        request.scheduled_end_at,
        request.coach_timezone,
        request.coach_training_location_id,
        request.training_location_name,
        request.location_kind,
        request.gym_name,
        request.public_location_label,
        request.decision_deadline_at,
        request.decided_at,
        request.accepted_booking_id,
        request.created_at,
        request.updated_at
      from app.current_client_coach_booking_request(${requestId}::uuid)
        as request
      left join app.coach_profiles as coach
        on coach.run_id = request.run_id
        and coach.profile_id = request.coach_profile_id
    `);
    if (rows.length > 1) throw new CoachBookingRequestConflictError();
    return rows[0] ? mapClientRequest(rows[0]) : null;
  });
}

export async function currentClientPendingCoachBookingRequestRecords(
  transaction: ActorDatabaseTransaction,
  slotIds: readonly string[],
) {
  const selection = normalizedSlotIds(slotIds);
  return requestOperation(async () => {
    const rows = await transaction.execute<BookingRequestRow>(sql`
      select
        request.id,
        request.slot_id,
        request.coach_profile_id,
        request.coach_display_name,
        request.coach_slug,
        coach.portrait_source as coach_portrait_source,
        coach.portrait_path as coach_portrait_path,
        coach.portrait_updated_at as coach_portrait_updated_at,
        request.client_profile_id,
        request.client_display_name,
        request.status,
        request.scheduled_start_at,
        request.scheduled_end_at,
        request.coach_timezone,
        request.coach_training_location_id,
        request.training_location_name,
        request.location_kind,
        request.gym_name,
        request.public_location_label,
        request.decision_deadline_at,
        request.decided_at,
        request.accepted_booking_id,
        request.created_at,
        request.updated_at
      from app.current_client_pending_coach_booking_requests(
        array[${sql.join(
          selection.map((slotId) => sql`${slotId}::uuid`),
          sql`, `,
        )}]::uuid[]
      ) as request
      left join app.coach_profiles as coach
        on coach.run_id = request.run_id
        and coach.profile_id = request.coach_profile_id
    `);
    return Object.freeze(rows.map(mapClientRequest));
  });
}

export async function currentOwnedCoachBookingRequestRecords(
  transaction: ActorDatabaseTransaction,
  options?: Readonly<{
    pageSize?: number;
    cursor?: CoachBookingRequestPageCursor | null;
  }>,
) {
  const pageSize = normalizedPageSize(options?.pageSize);
  const cursor = normalizedCursor(options?.cursor ?? null);
  return requestOperation(async () => {
    const rows = await transaction.execute<BookingRequestRow>(sql`
      select
        id,
        slot_id,
        coach_profile_id,
        coach_display_name,
        coach_slug,
        client_profile_id,
        client_display_name,
        client_avatar_updated_at,
        status,
        scheduled_start_at,
        scheduled_end_at,
        coach_timezone,
        coach_training_location_id,
        training_location_name,
        location_kind,
        gym_name,
        public_location_label,
        decision_deadline_at,
        decided_at,
        accepted_booking_id,
        created_at,
        updated_at
      from app.current_owned_coach_booking_requests(
        ${pageSize}::integer,
        ${cursor?.createdAt ?? null}::timestamptz,
        ${cursor?.id ?? null}::uuid
      )
    `);
    return requestPage(rows.map(mapCoachRequest), pageSize);
  });
}
