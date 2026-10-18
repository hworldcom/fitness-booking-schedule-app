import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

test("registration atomically reserves canonical usernames and preserves private identity", async (t) => {
  const adminUrl = process.env.DATABASE_TEST_URL;
  assert.ok(adminUrl);
  const runtimeUrl = new URL(adminUrl);
  runtimeUrl.username = "repx_runtime_login";
  runtimeUrl.password = "postgres";
  const admin = postgres(adminUrl, {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  });
  const runtime = postgres(runtimeUrl.toString(), {
    max: 3,
    prepare: false,
    ssl: false,
  });
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const handle = "reg_" + randomUUID().replaceAll("-", "").slice(0, 20);
  const enroll = (
    id: string,
    username: string,
    name = "Chosen Display",
  ) => runtime`
    select * from app.enroll_application_identity(${id}::uuid,${name},'Private Full Name',${username})`;
  try {
    for (const id of ids)
      await admin`insert into auth.users(id,is_sso_user,is_anonymous) values (${id}::uuid,false,false)`;
    await t.test(
      "simultaneous canonical claims have one winner and no partial loser",
      async () => {
        const results = await Promise.allSettled([
          enroll(ids[0], " @" + handle.toUpperCase() + " "),
          enroll(ids[1], handle),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const rejected = results.find(
          (r) => r.status === "rejected",
        ) as PromiseRejectedResult;
        assert.equal(rejected.reason.code, "23505");
        assert.equal(
          rejected.reason.constraint_name,
          "account_username_unique",
        );
        const rows =
          await admin`select p.auth_user_id,p.display_name,p.chat_first_name,d.legal_name,d.username from app.profiles p join app.account_personal_details d on d.profile_id=p.id where p.auth_user_id in (${ids[0]}::uuid,${ids[1]}::uuid)`;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].username, handle);
        assert.equal(rows[0].display_name, "Chosen Display");
        assert.equal(rows[0].chat_first_name, "Chosen Display");
        assert.equal(rows[0].legal_name, "Private Full Name");
        const counts =
          await admin`select count(*)::int n from app.profiles where auth_user_id in (${ids[0]}::uuid,${ids[1]}::uuid)`;
        assert.equal(counts[0].n, 1);
        const loser = ids[rows[0].auth_user_id === ids[0] ? 1 : 0];
        await enroll(loser, handle + "_2");
      },
    );
    await t.test(
      "same-account concurrent retries preserve one profile and stored values",
      async () => {
        const results = await Promise.all([
          enroll(ids[2], handle + "_3"),
          enroll(ids[2], handle + "_4", "Other Display"),
        ]);
        assert.equal(
          results[0][0].identity_profile_id,
          results[1][0].identity_profile_id,
        );
        const [before] =
          await admin`select to_jsonb(p) p,to_jsonb(d) d from app.profiles p join app.account_personal_details d on d.profile_id=p.id where p.auth_user_id=${ids[2]}::uuid`;
        await enroll(ids[2], handle, "Replacement");
        const [after] =
          await admin`select to_jsonb(p) p,to_jsonb(d) d from app.profiles p join app.account_personal_details d on d.profile_id=p.id where p.auth_user_id=${ids[2]}::uuid`;
        assert.deepEqual(after, before);
      },
    );
    await t.test(
      "invalid input and direct writes cannot bypass bounds or private reads",
      async () => {
        await assert.rejects(
          enroll(ids[3], "ab"),
          (error: { code?: string }) => error.code === "22023",
        );
        assert.equal(
          (
            await admin`select id from app.profiles where auth_user_id=${ids[3]}::uuid`
          ).length,
          0,
        );
        await assert.rejects(
          runtime`insert into app.account_personal_details(profile_id,username) values (${randomUUID()}::uuid,'forged')`,
          /permission denied/,
        );
        assert.equal(
          (await runtime`select * from app.account_personal_details`).length,
          0,
        );
        const [context] =
          await runtime`select nullif(current_setting('app.current_profile_id',true),'') profile, current_setting('app.account_settings_management',true) flag`;
        assert.equal(context.profile, null);
        assert.notEqual(context.flag, "on");
        const [privilege] =
          await admin`select has_function_privilege('anon','app.enroll_application_identity(uuid,text,text,text)','execute') allowed`;
        assert.equal(privilege.allowed, false);
      },
    );
    await t.test(
      "ordinary Account claims and registration share the same uniqueness constraint",
      async () => {
        const [existing] =
          await admin`select identity_profile_id id from app.enroll_application_identity(${ids[4]}::uuid,'Existing account')`;
        await admin`insert into app.account_personal_details(profile_id,username) values (${existing.id}::uuid,${handle + "_old"})`;
        await assert.rejects(
          enroll(ids[3], handle + "_old"),
          (error: { constraint_name?: string }) =>
            error.constraint_name === "account_username_unique",
        );
        assert.equal(
          (
            await admin`select id from app.profiles where auth_user_id=${ids[3]}::uuid`
          ).length,
          0,
        );
      },
    );
  } finally {
    for (const id of ids) {
      await admin`delete from app.demo_run_participants where profile_id in (select id from app.profiles where auth_user_id=${id}::uuid)`;
      await admin`delete from app.profiles where auth_user_id=${id}::uuid`;
      await admin`delete from auth.users where id=${id}::uuid`;
    }
    await runtime.end();
    await admin.end();
  }
});
