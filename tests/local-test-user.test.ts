import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_TEST_USER,
  assertLocalTestUserDatabaseState,
  assertReusableLocalTestAuthUser,
} from "../scripts/lib/local-test-user";

test("the persistent local user accepts only its reserved Auth identity", () => {
  assert.doesNotThrow(() =>
    assertReusableLocalTestAuthUser({
      id: LOCAL_TEST_USER.authUserId,
      email: LOCAL_TEST_USER.email,
      email_confirmed_at: "2026-10-08T12:00:00.000Z",
      app_metadata: { movx_local_test_user: true },
    }),
  );
  assert.throws(() =>
    assertReusableLocalTestAuthUser({
      id: LOCAL_TEST_USER.authUserId,
      email: "other@users.movx.test",
      email_confirmed_at: "2026-10-08T12:00:00.000Z",
      app_metadata: { movx_local_test_user: true },
    }),
  );
  assert.throws(() =>
    assertReusableLocalTestAuthUser({
      id: LOCAL_TEST_USER.authUserId,
      email: LOCAL_TEST_USER.email,
      email_confirmed_at: "2026-10-08T12:00:00.000Z",
      app_metadata: {},
    }),
  );
});

test("the local user remains an ordinary client while preserving an avatar", () => {
  const state = {
    auth_user_id: LOCAL_TEST_USER.authUserId,
    profile_id: "10000000-0000-4000-8000-000000000001",
    profile_slug: "hoang-905000000000",
    display_name: LOCAL_TEST_USER.displayName,
    record_source: "user",
    claimed_at: "2026-10-08T12:00:00.000Z",
    avatar_storage_path:
      "10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.webp",
    participant_role: "member",
    participant_status: "active",
    run_status: "active",
    run_catalogue_visibility: "public",
    coach_profile_count: "0",
    coach_application_count: "0",
  } as const;
  assert.equal(
    assertLocalTestUserDatabaseState([state]).avatar_storage_path,
    state.avatar_storage_path,
  );
  assert.throws(() =>
    assertLocalTestUserDatabaseState([
      { ...state, coach_application_count: "1" },
    ]),
  );
});
