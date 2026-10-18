import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import { createMissingDemoAccounts } from "../scripts/lib/provision-demo-coaches";
import {
  DEMO_COACH_FIXTURES,
  demoCoachDefaultsStatements,
} from "../scripts/lib/demo-coach-fixtures";

test("existing demo accounts never enter the write path, regardless of old/missing/future initialization markers or missing private journal", async () => {
  for (const metadata of [
    {},
    { movx_demo_password_version: 0 },
    { movx_demo_password_version: 1 },
    { movx_demo_password_version: 999 },
    { movx_demo_password_version: "invalid" },
  ]) {
    const users = DEMO_COACH_FIXTURES.map(
      (coach) => ({ id: coach.authUserId, app_metadata: metadata }) as User,
    );
    const forbidden = async () => {
      throw new Error("Existing data was about to be rewritten");
    };
    const result = await createMissingDemoAccounts({
      users,
      environment: "local",
      auth: {
        auth: { admin: { createUser: forbidden, updateUserById: forbidden } },
      } as unknown as Parameters<typeof createMissingDemoAccounts>[0]["auth"],
      query: forbidden,
      openStore: forbidden,
    });
    assert.deepEqual(result, { created: 0 });
  }
  assert.equal(
    demoCoachDefaultsStatements([], [], []),
    "select true as preserved;",
  );
});

test("mixed setup writes and initializes only the newly created account, preserving existing credential entries", async () => {
  const missing = DEMO_COACH_FIXTURES.at(-1)!;
  const existing = DEMO_COACH_FIXTURES.slice(0, -1);
  const mutations: string[] = [];
  const credentials = {
    environment: "local" as const,
    target: "movx-club-local",
    note: "private",
    coaches: Object.fromEntries(
      existing.map((coach) => [
        coach.slug,
        {
          email: coach.email,
          authUserId: coach.authUserId,
          password: "already-changed-by-owner",
          initializedAt: "2026-10-01",
        },
      ]),
    ),
  };
  const original = JSON.stringify(credentials.coaches);
  const auth = {
    auth: {
      admin: {
        async createUser(input: {
          id: string;
          email: string;
          app_metadata: Record<string, unknown>;
        }) {
          assert.equal(input.id, missing.authUserId);
          mutations.push("create:" + input.id);
          return {
            error: null,
            data: {
              user: {
                id: input.id,
                email: input.email,
                email_confirmed_at: "2026-10-18",
                app_metadata: input.app_metadata,
              },
            },
          };
        },
        async updateUserById(id: string) {
          assert.equal(id, missing.authUserId);
          mutations.push("mark:" + id);
          return { error: null };
        },
      },
    },
  } as unknown as Parameters<typeof createMissingDemoAccounts>[0]["auth"];
  const result = await createMissingDemoAccounts({
    users: existing.map((coach) => ({ id: coach.authUserId }) as User),
    environment: "local",
    auth,
    query: async (sql) => {
      assert.ok(sql.includes(missing.profileId));
      assert.ok(sql.includes(missing.username));
      assert.doesNotMatch(
        sql,
        /set bio|set portrait|insert into app\.coach_website_content/,
      );
      for (const coach of existing) {
        assert.ok(!sql.includes(coach.profileId));
        assert.ok(!sql.includes(coach.authUserId));
      }
      mutations.push("bind-new");
      return [];
    },
    openStore: async () => ({
      credentials,
      file: "unused-private-file",
      save: async () => {},
      close: async () => {
        mutations.push("close");
      },
    }),
  });
  assert.deepEqual(result, { created: 1 });
  assert.equal(
    (credentials.coaches[missing.slug] as { publicUrl?: string }).publicUrl,
    `http://localhost:3100/@${missing.username}`,
  );
  assert.deepEqual(mutations, [
    "create:" + missing.authUserId,
    "bind-new",
    "mark:" + missing.authUserId,
    "close",
  ]);
  assert.equal(
    JSON.stringify(
      Object.fromEntries(
        existing.map((coach) => [coach.slug, credentials.coaches[coach.slug]]),
      ),
    ),
    original,
  );
});
