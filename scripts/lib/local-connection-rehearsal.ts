import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import {
  assertLoopbackSupabaseTargets,
  parseLocalSupabaseStatus,
} from "./local-coach-accounts";
import { localDevelopmentEnvironment } from "./local-development";
import type {
  ConnectionProjection,
  ConnectionDecision,
} from "../../src/domain/coach-athlete-connections";
import type { ActorDatabaseTransaction } from "../../src/server/db/authorization/repository";
import type { AuthorizedActor } from "../../src/server/authorization/contracts";

export type LocalPerson = {
  id: string;
  actor: AuthorizedActor;
  cookies: { name: string; value: string }[];
  name: string;
};

type LocalConnectionRehearsal = {
  base: string;
  database: ReturnType<typeof postgres>;
  person: (name: string) => Promise<LocalPerson>;
  work: <T>(
    person: LocalPerson,
    fn: (tx: ActorDatabaseTransaction) => Promise<T>,
  ) => Promise<T>;
  booking: (
    coach: LocalPerson,
    athlete: LocalPerson,
  ) => Promise<{ slotId: string; bookingId: string }>;
  requestFixture: (
    coach: LocalPerson,
    athlete: LocalPerson,
    slotId: string,
    requestStatus: string,
    bookingId?: string | null,
  ) => Promise<string>;
  send: (
    person: LocalPerson,
    bookingId: string,
  ) => Promise<ConnectionProjection>;
  decide: (
    person: LocalPerson,
    id: string,
    action: ConnectionDecision,
  ) => Promise<ConnectionProjection>;
  cookieHeader: (person: LocalPerson) => string;
  cleanup: (recoveryAuthIds?: readonly string[]) => Promise<void>;
  approveCoach: (person: LocalPerson) => Promise<void>;
  cancelDirectPrivateBookingRecord: typeof import("../../src/server/db/coaches/booking-repository").cancelDirectPrivateBookingRecord;
  bookingConnectionContextRecord: typeof import("../../src/server/db/connections/repository").bookingConnectionContextRecord;
  connectionHistoryRecord: typeof import("../../src/server/db/connections/repository").connectionHistoryRecord;
};

export async function localConnectionRehearsal(
  ticket:
    | "DEV0222"
    | "DEV0223"
    | "DEV0247"
    | "DEV0248"
    | "DEV0250"
    | "DEV0292"
    | "DEV0313"
    | "DEV0317"
    | "DEV0315"
    | "DEV0321"
    | "DEV0331"
    | "DEV0358"
    | "DEV0366"
    | "DEV0367",
): Promise<LocalConnectionRehearsal> {
  if (
    ticket !== "DEV0222" &&
    ticket !== "DEV0223" &&
    ticket !== "DEV0247" &&
    ticket !== "DEV0248" &&
    ticket !== "DEV0250" &&
    ticket !== "DEV0292" &&
    ticket !== "DEV0313" &&
    ticket !== "DEV0317" &&
    ticket !== "DEV0315" &&
    ticket !== "DEV0321" &&
    ticket !== "DEV0331" &&
    ticket !== "DEV0358" &&
    ticket !== "DEV0366" &&
    ticket !== "DEV0367"
  )
    throw new Error("Unsupported local connection rehearsal marker.");
  // Private CLI values stay in memory; this script can only use the repository's
  // loopback Auth/Storage/PostgreSQL and newly tagged local .test identities.
  const status = parseLocalSupabaseStatus(
    execFileSync("node_modules/.bin/supabase", ["status", "-o", "env"], {
      stdio: ["ignore", "pipe", "pipe"],
    }).toString(),
  );
  assertLoopbackSupabaseTargets(status);
  const base = process.env.CONNECTION_TEST_SITE_URL ?? "http://localhost:3100";
  if (
    base !== "http://localhost:3100" &&
    base !== "http://localhost:3113" &&
    !(ticket === "DEV0317" && base === "http://localhost:3117") &&
    !(ticket === "DEV0358" && base === "http://localhost:3158") &&
    !(ticket === "DEV0366" && base === "http://localhost:3166")
  )
    throw new Error(
      "Connection rehearsals require an approved loopback preview.",
    );
  Object.assign(process.env, {
    ...localDevelopmentEnvironment(status),
    NEXT_PUBLIC_SITE_URL: base,
  });
  const auth = createClient(status.apiUrl, status.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const database = postgres(status.databaseUrl, {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  });
  const { withActorDatabaseContext } =
    await import("../../src/server/db/authorization/repository");
  const { enrollApplicationProfile } =
    await import("../../src/server/db/identity/repository");
  const { submitOwnedCoachApplicationRecord } =
    await import("../../src/server/db/coaches/application-repository");
  const { upsertOwnedCoachProfileRecord } =
    await import("../../src/server/db/coaches/repository");
  const {
    sendConnectionRecord,
    decideConnectionRecord,
    bookingConnectionContextRecord,
    connectionHistoryRecord,
  } = await import("../../src/server/db/connections/repository");
  const { cancelDirectPrivateBookingRecord } =
    await import("../../src/server/db/coaches/booking-repository");

  const people: LocalPerson[] = [];
  let offset = 4;
  const work = <T>(
    person: LocalPerson,
    fn: Parameters<typeof withActorDatabaseContext<T>>[1],
  ) => withActorDatabaseContext(person.actor, fn);

  async function person(name: string): Promise<LocalPerson> {
    const email = `${ticket.toLowerCase()}-connections-${randomUUID()}@users.movx.test`,
      password = randomUUID();
    const result = await auth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { movx_test_ticket: ticket, temporary: true },
    });
    if (result.error || !result.data.user)
      throw new Error("Cannot create a local connection rehearsal identity.");
    const id = result.data.user.id;
    // Track the exact account immediately so failures before enrolment can clean it.
    const entry = {
      id,
      actor: null as unknown as AuthorizedActor,
      cookies: [],
      name,
    } as LocalPerson;
    people.push(entry);
    const enrolled = await enrollApplicationProfile(id, name);
    assert.ok(enrolled);
    entry.actor = {
      authUserId: id,
      profileId: enrolled.profileId,
      runId: enrolled.runId,
      runRole: "member",
    };
    const signed = await fetch(base + "/api/auth/operations", {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({ action: "sign-in", email, password }),
    });
    const authentication: unknown = await signed.json();
    if (
      !signed.ok ||
      !authentication ||
      typeof authentication !== "object" ||
      !("status" in authentication) ||
      authentication.status !== "success"
    )
      throw new Error(
        "Cannot authenticate a local connection rehearsal identity through application Auth.",
      );
    entry.cookies = signed.headers.getSetCookie().map((cookie) => {
      const pair = cookie.split(";", 1)[0],
        separator = pair.indexOf("=");
      return {
        name: pair.slice(0, separator),
        value: pair.slice(separator + 1),
      };
    });
    return entry;
  }
  async function booking(coach: LocalPerson, athlete: LocalPerson) {
    const slotId = randomUUID(),
      bookingId = randomUUID();
    const start = new Date(
      Math.ceil((Date.now() + offset * 3600000) / 900000) * 900000,
    ).toISOString();
    offset += 2;
    await database.begin(async (tx) => {
      await tx`insert into app.coach_availability_slots(id,run_id,profile_id,starts_at,ends_at,coach_timezone,status,location_kind,selected_gym_id,gym_name,public_location_label,latitude,longitude,location_source,location_provider,location_confirmed_at,coach_training_location_id,training_location_name)
      select ${slotId}::uuid,l.run_id,l.profile_id,${start}::timestamptz,${start}::timestamptz+interval '1 hour',l.timezone,'booked',l.location_kind,l.selected_gym_id,g.name,l.public_location_label,l.latitude,l.longitude,l.location_source,l.location_provider,l.location_confirmed_at,l.id,l.public_name
      from app.coach_training_locations l left join app.gyms g on g.id=l.selected_gym_id and g.run_id=l.run_id where l.profile_id=${coach.actor.profileId}::uuid and l.is_primary and l.status='active'`;
      await tx`insert into app.coach_private_bookings(id,run_id,slot_id,coach_profile_id,client_profile_id,credit_projection_id,status,scheduled_start_at,scheduled_end_at,early_return_until,hold_expires_at)
      values(${bookingId}::uuid,${coach.actor.runId}::uuid,${slotId}::uuid,${coach.actor.profileId}::uuid,${athlete.actor.profileId}::uuid,null,'confirmed',${start}::timestamptz,${start}::timestamptz+interval '1 hour',${start}::timestamptz,${start}::timestamptz)`;
    });
    return { slotId, bookingId };
  }
  async function requestFixture(
    coach: LocalPerson,
    athlete: LocalPerson,
    slotId: string,
    requestStatus: string,
    bookingId: string | null = null,
  ) {
    const id = randomUUID();
    const decider =
      requestStatus === "withdrawn"
        ? athlete.actor.profileId
        : requestStatus === "expired" || requestStatus === "pending"
          ? null
          : coach.actor.profileId;
    await database`insert into app.coach_booking_requests(id,run_id,slot_id,coach_profile_id,client_profile_id,status,scheduled_start_at,scheduled_end_at,coach_timezone,coach_training_location_id,training_location_name,location_kind,gym_name,public_location_label,created_at,decision_deadline_at,decided_by_profile_id,decided_at,accepted_booking_id)
    select ${id}::uuid,s.run_id,s.id,s.profile_id,${athlete.actor.profileId}::uuid,${requestStatus},s.starts_at,s.ends_at,s.coach_timezone,s.coach_training_location_id,s.training_location_name,s.location_kind,s.gym_name,s.public_location_label,
      case when ${requestStatus}='expired' then statement_timestamp()-interval '13 hours' else date_trunc('second',statement_timestamp())-interval '2 minutes'+interval '123456 microseconds' end,
      case when ${requestStatus}='expired' then statement_timestamp()-interval '1 hour' else least(s.starts_at,statement_timestamp()+interval '12 hours') end,
      ${decider}::uuid,case when ${requestStatus}='pending' then null else statement_timestamp() end,${bookingId}::uuid from app.coach_availability_slots s where s.id=${slotId}::uuid`;
    return id;
  }
  async function send(person: LocalPerson, bookingId: string) {
    return work(person, async (tx) => {
      const current = await bookingConnectionContextRecord(tx, bookingId);
      return sendConnectionRecord(
        tx,
        bookingId,
        randomUUID(),
        current.connection?.id ?? null,
      );
    });
  }
  async function decide(
    person: LocalPerson,
    id: string,
    action: "accept" | "decline" | "withdraw" | "disconnect",
  ) {
    return work(person, (tx) => decideConnectionRecord(tx, id, action));
  }
  function cookieHeader(person: LocalPerson) {
    return person.cookies
      .map(({ name, value }) => name + "=" + value)
      .join("; ");
  }
  async function cleanup(recoveryAuthIds?: readonly string[]) {
    if (recoveryAuthIds) {
      assert.equal(
        ticket,
        "DEV0367",
        "Recovery is limited to the full QA audit.",
      );
      assert.ok(recoveryAuthIds.length > 0 && recoveryAuthIds.length <= 16);
      assert.equal(new Set(recoveryAuthIds).size, recoveryAuthIds.length);
      assert.ok(recoveryAuthIds.every((id) => /^[a-f0-9-]{36}$/i.test(id)));
    }
    const cleanupIds = recoveryAuthIds ?? people.map((entry) => entry.id);
    const owned = await database<
      {
        id: string;
        profile_id: string | null;
        avatar_storage_path: string | null;
        coach_portrait_path: string | null;
      }[]
    >`select u.id,p.id as profile_id,p.avatar_storage_path,case when c.portrait_source='storage' then c.portrait_path else null end as coach_portrait_path from auth.users u left join app.profiles p on p.auth_user_id=u.id left join app.coach_profiles c on c.profile_id=p.id
    where u.raw_app_meta_data->>'movx_test_ticket'=${ticket} and u.raw_app_meta_data->>'temporary'='true' and u.email like ${ticket.toLowerCase() + "-connections-%@users.movx.test"}
      and (${ticket} not in ('DEV0313','DEV0315','DEV0317','DEV0321','DEV0331','DEV0358','DEV0366','DEV0367') or u.id=any(${cleanupIds}::uuid[]))`;
    if (recoveryAuthIds)
      assert.equal(
        owned.length,
        recoveryAuthIds.length,
        "Every recovery identity must still be an exact tagged QA account.",
      );
    for (const row of owned)
      if (row.avatar_storage_path) {
        assert.ok(
          row.profile_id &&
            row.avatar_storage_path.startsWith(row.profile_id + "/"),
        );
        const removed = await auth.storage
          .from("account-avatars")
          .remove([row.avatar_storage_path]);
        if (removed.error)
          throw new Error("Cannot remove an exact local rehearsal image.");
      }
    for (const row of owned)
      if (row.coach_portrait_path) {
        assert.ok(
          row.profile_id &&
            row.coach_portrait_path.startsWith(row.profile_id + "/"),
        );
        const removed = await auth.storage
          .from("coach-portraits")
          .remove([row.coach_portrait_path]);
        if (removed.error)
          throw new Error("Cannot remove an exact local rehearsal portrait.");
      }
    const ids = owned.flatMap((row) =>
      row.profile_id ? [row.profile_id] : [],
    );
    if (
      (ticket === "DEV0321" ||
        ticket === "DEV0315" ||
        ticket === "DEV0317" ||
        ticket === "DEV0358" ||
        ticket === "DEV0367") &&
      ids.length
    ) {
      // Admin cleanup is confined to exact tagged temporary owners, including
      // unattached test-orphan objects; never delete object metadata directly.
      const banners = await database<
        { name: string }[]
      >`select name from storage.objects where bucket_id='coach-banners' and split_part(name,'/',1)=any(${ids}::text[])`;
      if (banners.length) {
        const removed = await auth.storage
          .from("coach-banners")
          .remove(banners.map((entry) => entry.name));
        if (removed.error)
          throw new Error("Cannot remove exact local rehearsal banners.");
      }
    }
    if (ids.length)
      await database.begin(async (tx) => {
        await tx`update app.coach_profiles set visibility='hidden' where profile_id=any(${ids}::uuid[]) and visibility='visible'`;
        if (
          (await tx`select to_regclass('app.message_conversations') present`)[0]
            .present
        ) {
          await tx`delete from app.message_blocks where low_profile_id=any(${ids}::uuid[]) or high_profile_id=any(${ids}::uuid[])`;
          await tx`delete from app.message_conversations where coach_profile_id=any(${ids}::uuid[]) or athlete_profile_id=any(${ids}::uuid[])`;
        }
        await tx`delete from app.coach_athlete_connection_attempts where pair_id in(select id from app.coach_athlete_connection_pairs where coach_profile_id=any(${ids}::uuid[]) or athlete_profile_id=any(${ids}::uuid[]))`;
        await tx`delete from app.coach_athlete_connection_pairs where coach_profile_id=any(${ids}::uuid[]) or athlete_profile_id=any(${ids}::uuid[])`;
        if (ticket === "DEV0367") {
          await tx`delete from app.session_booking_changes where booking_id in (select id from app.coach_private_bookings where coach_profile_id=any(${ids}::uuid[]) or client_profile_id=any(${ids}::uuid[]))`;
          await tx`delete from app.session_booking_commands where actor_profile_id=any(${ids}::uuid[])`;
        }
        await tx`delete from app.coach_booking_requests where coach_profile_id=any(${ids}::uuid[]) or client_profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.coach_private_bookings where coach_profile_id=any(${ids}::uuid[]) or client_profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.coach_availability_slots where profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.coach_availability_rules where profile_id=any(${ids}::uuid[])`;
        if (
          ticket === "DEV0358" ||
          ticket === "DEV0317" ||
          ticket === "DEV0366" ||
          ticket === "DEV0367"
        ) {
          await tx`select app.group_session_flags(true)`;
          if (ticket === "DEV0367")
            // A cascading delete runs as app_owner and intentionally cannot
            // erase registration history. Delete exact test children directly
            // as the local administrator before deleting their test sessions.
            await tx`delete from app.coach_group_registrations where session_id in (select id from app.coach_group_sessions where coach_profile_id=any(${ids}::uuid[]))`;
          await tx`delete from app.coach_group_sessions where coach_profile_id=any(${ids}::uuid[])`;
          await tx`select app.group_session_flags(false)`;
        }
        if (
          ticket === "DEV0317" ||
          ticket === "DEV0366" ||
          ticket === "DEV0367"
        ) {
          await tx`delete from app.coach_session_type_commands where coach_profile_id=any(${ids}::uuid[])`;
          await tx`delete from app.coach_session_types where coach_profile_id=any(${ids}::uuid[])`;
        }
        await tx`delete from app.coach_training_locations where profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.coach_profile_disciplines where profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.coach_profiles where profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.coach_application_review_events where profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.coach_applications where profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.demo_run_participants where profile_id=any(${ids}::uuid[])`;
        await tx`delete from app.profiles where id=any(${ids}::uuid[])`;
      });
    for (const row of owned) {
      const deleted = await auth.auth.admin.deleteUser(row.id);
      if (deleted.error)
        throw new Error("Cannot remove an exact local rehearsal account.");
    }
  }

  async function approveCoach(coach: LocalPerson) {
    await work(coach, submitOwnedCoachApplicationRecord);
    await work(coach, (tx) =>
      upsertOwnedCoachProfileRecord(tx, {
        displayName: coach.name,
        bio: "An isolated local test coach for private connection consent and retained history validation.",
        disciplines: ["Boxing"],
        timezone: "Europe/Berlin",
        visibility: "hidden",
        selectedGymId: "40000000-0000-4000-8000-000000000001",
        independentLocation: null,
      }),
    );
    await database`select app.review_coach_application(${coach.actor.profileId}::uuid,'pending','approved',${"Local-only " + ticket + " coach UI rehearsal."},'local-test','movx-identity-application-v1')`;
  }
  return {
    base,
    database,
    person,
    work,
    booking,
    requestFixture,
    send,
    decide,
    cookieHeader,
    cleanup,
    approveCoach,
    cancelDirectPrivateBookingRecord,
    bookingConnectionContextRecord,
    connectionHistoryRecord,
  };
}
