export const LOCAL_TEST_USER = Object.freeze({
  authUserId: "90500000-0000-4000-8000-000000000001",
  email: "hoang@users.movx.test",
  displayName: "Hoang",
});

export type LocalTestAuthUser = Readonly<{
  id: string;
  email?: string;
  email_confirmed_at?: string;
  app_metadata?: Record<string, unknown>;
}>;

export function assertReusableLocalTestAuthUser(user: LocalTestAuthUser) {
  if (
    user.id !== LOCAL_TEST_USER.authUserId ||
    user.email?.toLowerCase() !== LOCAL_TEST_USER.email ||
    !user.email_confirmed_at ||
    user.app_metadata?.movx_local_test_user !== true
  ) {
    throw new Error(
      "The Auth identity reserved for the local Hoang test user conflicts with existing state.",
    );
  }
}

export type LocalTestUserDatabaseState = Readonly<{
  auth_user_id: string;
  profile_id: string;
  profile_slug: string;
  display_name: string;
  record_source: string;
  claimed_at: Date | string | null;
  avatar_storage_path: string | null;
  participant_role: string;
  participant_status: string;
  run_status: string;
  run_catalogue_visibility: string;
  coach_profile_count: string | number;
  coach_application_count: string | number;
}>;

export function assertLocalTestUserDatabaseState(
  rows: readonly LocalTestUserDatabaseState[],
) {
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row ||
    row.auth_user_id !== LOCAL_TEST_USER.authUserId ||
    row.display_name !== LOCAL_TEST_USER.displayName ||
    row.record_source !== "user" ||
    row.claimed_at === null ||
    row.participant_role !== "member" ||
    row.participant_status !== "active" ||
    row.run_status !== "active" ||
    row.run_catalogue_visibility !== "public" ||
    Number(row.coach_profile_count) !== 0 ||
    Number(row.coach_application_count) !== 0
  ) {
    throw new Error(
      "The local Hoang test user does not resolve to one ordinary active client profile.",
    );
  }
  return Object.freeze({ ...row });
}
