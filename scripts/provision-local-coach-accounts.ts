import { spawnSync } from "node:child_process";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import postgres from "postgres";
import {
  SEEDED_COACH_ACCOUNTS,
  assertLoopbackSupabaseTargets,
  assertReusableCoachAuthUser,
  assertSeededCoachDatabaseState,
  parseLocalSupabaseStatus,
  type SeededCoachDatabaseState,
} from "./lib/local-coach-accounts";

function readLocalSupabaseStatus() {
  const result = spawnSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      "The local Supabase stack is unavailable. Start it with `npm run auth:start`.",
    );
  }
  return parseLocalSupabaseStatus(result.stdout);
}

async function listAllAuthUsers(client: SupabaseClient) {
  const users: User[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    users.push(...data.users);
    if (page >= data.lastPage || data.users.length < 1000) return users;
  }
  throw new Error(
    "The local Auth user inventory exceeded the safe page limit.",
  );
}

async function readCoachStates(
  connection: postgres.Sql | postgres.TransactionSql,
  lockRows: boolean,
): Promise<SeededCoachDatabaseState[]> {
  const profileIds = SEEDED_COACH_ACCOUNTS.map((coach) => coach.profileId);
  const rows = await connection<SeededCoachDatabaseState[]>`
    select
      profile.id::text as profile_id,
      profile.slug as profile_slug,
      profile.display_name as profile_display_name,
      profile.record_source as profile_record_source,
      profile.auth_user_id::text as auth_user_id,
      profile.claimed_at,
      profile.coaching_activated_at,
      participant.run_id::text as run_id,
      demo_run.slug as run_slug,
      demo_run.status as run_status,
      demo_run.catalogue_visibility as run_catalogue_visibility,
      participant.role as participant_role,
      participant.status as participant_status,
      coach.public_slug,
      coach.visibility as coach_visibility,
      coach.record_source as coach_record_source,
      coach.is_demo as coach_is_demo,
      (
        select count(*)
        from app.coach_profile_disciplines as discipline
        where discipline.run_id = coach.run_id
          and discipline.profile_id = coach.profile_id
      ) as discipline_count
    from app.profiles as profile
    join app.demo_run_participants as participant
      on participant.profile_id = profile.id
    join app.demo_runs as demo_run
      on demo_run.id = participant.run_id
    join app.coach_profiles as coach
      on coach.run_id = participant.run_id
      and coach.profile_id = participant.profile_id
    where profile.id in ${connection(profileIds)}
    order by profile.id
    ${lockRows ? connection`for update of profile, participant, coach` : connection``}
  `;
  return rows;
}

async function cleanupCreatedUsers(
  client: SupabaseClient,
  createdUserIds: readonly string[],
) {
  const failures: string[] = [];
  for (const userId of [...createdUserIds].reverse()) {
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) failures.push(userId);
  }
  return failures;
}

async function main() {
  const status = readLocalSupabaseStatus();
  assertLoopbackSupabaseTargets(status);

  const auth = createClient(status.apiUrl, status.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const database = postgres(status.databaseUrl, {
    max: 1,
    prepare: false,
    ssl: false,
  });
  const createdUserIds: string[] = [];
  let databaseBound = false;

  try {
    assertSeededCoachDatabaseState(
      await readCoachStates(database, false),
      "seeded-or-provisioned",
    );

    const users = await listAllAuthUsers(auth);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const usersByEmail = new Map(
      users
        .filter((user) => user.email)
        .map((user) => [user.email!.toLowerCase(), user]),
    );

    for (const coach of SEEDED_COACH_ACCOUNTS) {
      const byId = usersById.get(coach.authUserId);
      const byEmail = usersByEmail.get(coach.email);
      if (byId || byEmail) {
        if (!byId || !byEmail || byId.id !== byEmail.id) {
          throw new Error(
            `The local Auth identity reserved for ${coach.displayName} conflicts with an existing ID or email.`,
          );
        }
        assertReusableCoachAuthUser(coach, byId);
      }
    }

    for (const coach of SEEDED_COACH_ACCOUNTS) {
      if (usersById.has(coach.authUserId)) continue;
      const { data, error } = await auth.auth.admin.createUser({
        id: coach.authUserId,
        email: coach.email,
        email_confirm: true,
        app_metadata: {
          movx_local_demo: true,
          movx_coach_profile_id: coach.profileId,
          movx_coach_slug: coach.slug,
        },
        user_metadata: { display_name: coach.displayName },
      });
      if (error || !data.user) {
        throw error ?? new Error(`Could not create ${coach.displayName}.`);
      }
      assertReusableCoachAuthUser(coach, data.user);
      createdUserIds.push(data.user.id);
    }

    await database.begin(async (transaction) => {
      assertSeededCoachDatabaseState(
        await readCoachStates(transaction, true),
        "seeded-or-provisioned",
      );

      for (const coach of SEEDED_COACH_ACCOUNTS) {
        await transaction`
          update app.profiles
          set
            auth_user_id = ${coach.authUserId}::uuid,
            record_source = 'user',
            claimed_at = coalesce(claimed_at, statement_timestamp()),
            updated_at = statement_timestamp()
          where id = ${coach.profileId}::uuid
            and (
              auth_user_id is null
              or auth_user_id = ${coach.authUserId}::uuid
            )
        `;
        await transaction`
          update app.demo_run_participants
          set role = 'member', updated_at = statement_timestamp()
          where profile_id = ${coach.profileId}::uuid
            and status = 'active'
        `;
        await transaction`
          update app.coach_profiles
          set record_source = 'user', updated_at = statement_timestamp()
          where profile_id = ${coach.profileId}::uuid
        `;
      }

      assertSeededCoachDatabaseState(
        await readCoachStates(transaction, false),
        "provisioned",
      );
    });
    databaseBound = true;

    const identityRows = await database<
      {
        auth_user_id: string;
        identity_profile_id: string;
        identity_role: string;
      }[]
    >`
      select
        expected.auth_user_id::text,
        identity.identity_profile_id::text,
        identity.identity_role
      from unnest(
        ${SEEDED_COACH_ACCOUNTS.map((coach) => coach.authUserId)}::uuid[]
      ) as expected(auth_user_id)
      cross join lateral app.current_application_identity(
        expected.auth_user_id
      ) as identity
      order by expected.auth_user_id
    `;
    if (identityRows.length !== SEEDED_COACH_ACCOUNTS.length) {
      throw new Error(
        "Not every local coach account resolves as an application identity.",
      );
    }
    for (const row of identityRows) {
      const coach = SEEDED_COACH_ACCOUNTS.find(
        (candidate) => candidate.authUserId === row.auth_user_id,
      );
      if (
        !coach ||
        row.identity_profile_id !== coach.profileId ||
        row.identity_role !== "member"
      ) {
        throw new Error(
          "A local coach account resolved to unexpected authority.",
        );
      }
    }

    console.log("Provisioned local email-code accounts for seeded coaches:");
    for (const coach of SEEDED_COACH_ACCOUNTS) {
      console.log(`- ${coach.displayName}: ${coach.email}`);
    }
    console.log(
      "Request a sign-in code in the app and read it from http://127.0.0.1:55324.",
    );
  } catch (error) {
    let cleanupFailures: string[] = [];
    if (!databaseBound && createdUserIds.length > 0) {
      cleanupFailures = await cleanupCreatedUsers(auth, createdUserIds);
    }
    const rawMessage = error instanceof Error ? error.message : "Unknown error";
    const message = rawMessage
      .replaceAll(status.serviceRoleKey, "[redacted]")
      .replaceAll(status.databaseUrl, "[redacted]");
    const cleanupNote =
      cleanupFailures.length === 0
        ? ""
        : " Cleanup was incomplete; run `npm run db:reset` before retrying.";
    throw new Error(
      `Local coach account provisioning failed: ${message}.${cleanupNote}`,
    );
  } finally {
    await database.end({ timeout: 5 });
  }
}

await main();
