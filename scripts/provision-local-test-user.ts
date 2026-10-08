import { spawnSync } from "node:child_process";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import postgres from "postgres";
import {
  assertLoopbackSupabaseTargets,
  parseLocalSupabaseStatus,
} from "./lib/local-coach-accounts";
import {
  LOCAL_TEST_USER,
  assertLocalTestUserDatabaseState,
  assertReusableLocalTestAuthUser,
  type LocalTestUserDatabaseState,
} from "./lib/local-test-user";

function localStatus() {
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

async function allAuthUsers(client: SupabaseClient): Promise<User[]> {
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

async function databaseState(connection: postgres.Sql) {
  return connection<LocalTestUserDatabaseState[]>`
    select
      profile.auth_user_id::text,
      profile.id::text as profile_id,
      profile.slug as profile_slug,
      profile.display_name,
      profile.record_source,
      profile.claimed_at,
      profile.avatar_storage_path,
      participant.role as participant_role,
      participant.status as participant_status,
      run.status as run_status,
      run.catalogue_visibility as run_catalogue_visibility,
      (
        select count(*)
        from app.coach_profiles as coach
        where coach.profile_id = profile.id
      ) as coach_profile_count,
      (
        select count(*)
        from app.coach_applications as application
        where application.profile_id = profile.id
      ) as coach_application_count
    from app.profiles as profile
    join app.demo_run_participants as participant
      on participant.profile_id = profile.id
    join app.demo_runs as run
      on run.id = participant.run_id
    where profile.auth_user_id = ${LOCAL_TEST_USER.authUserId}::uuid
  `;
}

async function main() {
  const status = localStatus();
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
  let createdAuthUser = false;

  try {
    const users = await allAuthUsers(auth);
    const byId = users.find((user) => user.id === LOCAL_TEST_USER.authUserId);
    const byEmail = users.find(
      (user) => user.email?.toLowerCase() === LOCAL_TEST_USER.email,
    );
    if (byId || byEmail) {
      if (!byId || !byEmail || byId.id !== byEmail.id) {
        throw new Error(
          "The ID or email reserved for the local Hoang test user is already in use.",
        );
      }
      assertReusableLocalTestAuthUser(byId);
    } else {
      const { data, error } = await auth.auth.admin.createUser({
        id: LOCAL_TEST_USER.authUserId,
        email: LOCAL_TEST_USER.email,
        email_confirm: true,
        app_metadata: { movx_local_test_user: true },
        user_metadata: { display_name: LOCAL_TEST_USER.displayName },
      });
      if (error || !data.user) {
        throw error ?? new Error("Could not create the local Hoang test user.");
      }
      assertReusableLocalTestAuthUser(data.user);
      createdAuthUser = true;
    }

    let rows = await databaseState(database);
    if (rows.length === 0) {
      await database`
        select *
        from app.enroll_application_identity(
          ${LOCAL_TEST_USER.authUserId}::uuid,
          ${LOCAL_TEST_USER.displayName}::text
        )
      `;
      rows = await databaseState(database);
    }
    const state = assertLocalTestUserDatabaseState(rows);
    console.log(`Provisioned local ordinary user: ${LOCAL_TEST_USER.email}`);
    console.log(`- Profile: ${state.profile_slug} (${state.profile_id})`);
    console.log(
      state.avatar_storage_path
        ? "- Existing private avatar preserved."
        : "- No private avatar yet; upload one from the Profile page.",
    );
    console.log(
      "Request a sign-in code in the app and read it from http://127.0.0.1:55324.",
    );
  } catch (error) {
    if (createdAuthUser) {
      await auth.auth.admin.deleteUser(LOCAL_TEST_USER.authUserId);
    }
    const raw = error instanceof Error ? error.message : "Unknown error";
    const message = raw
      .replaceAll(status.serviceRoleKey, "[redacted]")
      .replaceAll(status.databaseUrl, "[redacted]");
    throw new Error(`Local test-user provisioning failed: ${message}`);
  } finally {
    await database.end({ timeout: 5 });
  }
}

await main();
