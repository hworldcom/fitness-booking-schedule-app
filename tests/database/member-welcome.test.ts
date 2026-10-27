import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_TEST_URL;
assert.ok(
  url && /^\/mov131_[a-z0-9_]+$/.test(new URL(url).pathname),
  "Use the isolated MOV-131 database rehearsal.",
);

test("new enrollment and private read-only welcome remain atomic and actor scoped", async (t) => {
  const admin = postgres(url!, { max: 2, prepare: false, onnotice() {} });
  const runtimeUrl = new URL(url!);
  runtimeUrl.username = "repx_runtime_login";
  runtimeUrl.password = "postgres";
  const runtime = postgres(runtimeUrl.toString(), { max: 4, prepare: false });
  const ids = Array.from({ length: 6 }, () => randomUUID());
  const prefix = "welcome_" + randomUUID().replaceAll("-", "").slice(0, 12);
  const enroll = (id: string, handle: string) =>
    runtime`select * from app.enroll_application_identity(${id}::uuid,'Welcome Member','Private Registration Name',${handle})`;
  type Actor = { authId: string; id: string; run: string };
  const command = (
    actor: Actor,
    action: string,
    args: Record<string, unknown> = {},
    legacy = false,
  ) =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_auth_user_id',${actor.authId},true),set_config('app.current_profile_id',${actor.id},true),set_config('app.current_run_id',${actor.run},true),set_config('app.current_run_role','member',true)`;
      const [row] = legacy
        ? await tx`select app.message_command(${action},${tx.json(args as postgres.JSONValue)}) value`
        : await tx`select app.message_command_v2(${action},${tx.json(args as postgres.JSONValue)}) value`;
      return row.value;
    });
  try {
    for (const id of ids)
      await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${id}::uuid,false,false)`;
    const rows = await Promise.all([
      enroll(ids[0], prefix),
      enroll(ids[0], prefix + "_retry"),
    ]);
    const actor = {
      authId: ids[0],
      id: rows[0][0].identity_profile_id as string,
      run: rows[0][0].identity_run_id as string,
    };
    let welcomeId = "";
    await t.test(
      "same-account concurrent enrollment creates one original unread welcome",
      async () => {
        assert.equal(
          rows[0][0].identity_profile_id,
          rows[1][0].identity_profile_id,
        );
        const welcomes =
          await admin`select * from app.member_welcomes where profile_id=${actor.id}::uuid`;
        assert.equal(welcomes.length, 1);
        welcomeId = welcomes[0].id;
        assert.equal(welcomes[0].read_at, null);
        assert.match(welcomes[0].body, /beta/);
        assert.match(welcomes[0].body, /optimizing/);
        const before = JSON.stringify(welcomes);
        await enroll(ids[0], prefix + "_again");
        assert.equal(
          JSON.stringify(
            await admin`select * from app.member_welcomes where profile_id=${actor.id}::uuid`,
          ),
          before,
        );
      },
    );
    await t.test(
      "taken username/invalid enrollment rolls back profile, membership and welcome",
      async () => {
        const [saved] =
          await admin`select username from app.account_personal_details where profile_id=${actor.id}::uuid`;
        await assert.rejects(
          enroll(ids[1], saved.username),
          (e) => (e as { code: string }).code === "23505",
        );
        assert.equal(
          (
            await admin`select id from app.profiles where auth_user_id=${ids[1]}::uuid`
          ).length,
          0,
        );
        await assert.rejects(
          enroll(ids[1], "bad!"),
          (e) => (e as { code: string }).code === "22023",
        );
        const second = await enroll(ids[1], prefix + "_second");
        assert.ok(second[0].identity_profile_id);
        assert.equal(
          (
            await admin`select id from app.member_welcomes where profile_id=${second[0].identity_profile_id}::uuid`
          ).length,
          1,
        );
      },
    );
    await t.test(
      "old identities and legacy fixture enrollment receive no backfill",
      async () => {
        const [old] =
          await runtime`select * from app.enroll_application_identity(${ids[2]}::uuid,'Legacy Member')`;
        await enroll(ids[2], prefix + "_legacy");
        assert.equal(
          (
            await admin`select id from app.member_welcomes where profile_id=${old.identity_profile_id}::uuid`
          ).length,
          0,
        );
      },
    );
    await t.test(
      "v2 inbox/thread expose official sender without coach/media/contact authority; v1 stays unchanged",
      async () => {
        const inbox = await command(actor, "inbox");
        assert.equal(inbox.unreadCount, 1);
        assert.equal(inbox.items.length, 1);
        const official = inbox.items[0];
        assert.equal(official.id, welcomeId);
        assert.equal(official.role, "movx");
        assert.equal(official.counterpartName, "MovX");
        assert.equal(official.coachProfileId, null);
        assert.equal(official.counterpartProfileHref, null);
        assert.equal(official.canSendGeneral, false);
        assert.equal(official.canRequestGeneral, false);
        const thread = await command(actor, "thread", {
          conversationId: welcomeId,
        });
        assert.equal(thread.entries.length, 1);
        assert.equal(thread.entries[0].senderProfileId, null);
        assert.equal(thread.contexts.length, 0);
        assert.equal(thread.readThrough, 0);
        assert.equal((await command(actor, "inbox", {}, true)).items.length, 0);
        assert.equal(
          (await command(actor, "inbox", { filter: "unread" })).items.length,
          1,
        );
        assert.equal(
          (
            await command(actor, "thread", {
              conversationId: welcomeId,
              after: 1,
            })
          ).entries.length,
          0,
        );
        assert.equal(
          (
            await command(actor, "thread", {
              conversationId: welcomeId,
              before: 1,
            })
          ).entries.length,
          0,
        );
      },
    );
    await t.test(
      "foreign/missing/forged actor and reply/block/session/context mutations are denied",
      async () => {
        const [other] = await enroll(ids[3], prefix + "_other");
        const outsider = {
          authId: ids[3],
          id: other.identity_profile_id as string,
          run: other.identity_run_id as string,
        };
        await assert.rejects(
          command(outsider, "thread", { conversationId: welcomeId }),
        );
        await assert.rejects(
          command(outsider, "read", { conversationId: welcomeId, through: 1 }),
        );
        await assert.rejects(
          runtime`select app.message_command_v2('inbox','{}'::jsonb)`,
        );
        await assert.rejects(
          command({ ...actor, authId: ids[4] }, "thread", {
            conversationId: welcomeId,
          }),
        );
        await assert.rejects(command({ ...actor, run: randomUUID() }, "inbox"));
        for (const action of [
          "send",
          "block",
          "unblock",
          "open",
          "inquire",
          "session-title",
        ])
          await assert.rejects(
            command(actor, action, {
              conversationId: welcomeId,
              submissionId: randomUUID(),
              body: "Forged reply",
              coachId: randomUUID(),
            }),
          );
        await assert.rejects(
          command(actor, "thread", {
            conversationId: welcomeId,
            contextId: randomUUID(),
          }),
        );
        await assert.rejects(
          command(actor, "read", { conversationId: welcomeId, through: -1 }),
        );
        assert.equal(
          (
            await admin`select read_at from app.member_welcomes where id=${welcomeId}::uuid`
          )[0].read_at,
          null,
        );
      },
    );
    await t.test(
      "acknowledgement retries persist exactly once and clear own unread state",
      async () => {
        await command(actor, "read", { conversationId: welcomeId, through: 0 });
        assert.equal((await command(actor, "inbox")).unreadCount, 1);
        await Promise.all([
          command(actor, "read", { conversationId: welcomeId, through: 1 }),
          command(actor, "read", { conversationId: welcomeId, through: 1 }),
        ]);
        const [before] =
          await admin`select read_at,body,created_at from app.member_welcomes where id=${welcomeId}::uuid`;
        assert.ok(before.read_at);
        await command(actor, "read", { conversationId: welcomeId, through: 1 });
        assert.deepEqual(
          (
            await admin`select read_at,body,created_at from app.member_welcomes where id=${welcomeId}::uuid`
          )[0],
          before,
        );
        assert.equal((await command(actor, "inbox")).unreadCount, 0);
        assert.equal(
          (await command(actor, "inbox", { filter: "unread" })).items.length,
          0,
        );
        assert.equal(
          (await command(actor, "thread", { conversationId: welcomeId }))
            .readThrough,
          1,
        );
      },
    );
    await t.test(
      "welcome merges with ordinary conversations using stable bounded cursor pages",
      async () => {
        await runtime.begin(async (tx) => {
          await tx`select set_config('app.current_auth_user_id',${actor.authId},true),set_config('app.current_profile_id',${actor.id},true),set_config('app.current_run_id',${actor.run},true),set_config('app.current_run_role','member',true)`;
          await tx`select app.submit_owned_coach_application()`;
          await tx`select app.save_owned_coach_application_contact(0,'{"phoneNumber":"+4915123456789","instagramUrl":null,"facebookUrl":null,"linkedinUrl":null}'::jsonb)`;
          await tx`select app.upsert_owned_coach_profile('Welcome Coach','An isolated coaching profile to verify ordinary conversation paging.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
        });
        const [welcome] =
          await admin`select created_at from app.member_welcomes where id=${welcomeId}::uuid`;
        for (let index = 0; index < 23; index++) {
          const authId = randomUUID();
          await admin`insert into auth.users(id,is_sso_user,is_anonymous)values(${authId}::uuid,false,false)`;
          const [peer] =
            await runtime`select * from app.enroll_application_identity(${authId}::uuid,${"Paging Member " + index})`;
          const at = new Date(
            new Date(welcome.created_at).getTime() +
              (index < 21 ? (index + 1) * 1000 : 0),
          );
          await admin.begin(async (tx) => {
            await tx`select app.mail_flags(true)`;
            const [conversation] =
              await tx`insert into app.message_conversations(run_id,coach_profile_id,athlete_profile_id,activity_at)values(${actor.run}::uuid,${actor.id}::uuid,${peer.identity_profile_id}::uuid,${at})returning id`;
            await tx`select app.mail_append(c,null,${peer.identity_profile_id}::uuid,'text','Isolated paging history',${randomUUID()}::uuid,null,null,${at})from app.message_conversations c where c.id=${conversation.id}::uuid`;
          });
        }
        const first = await command(actor, "inbox");
        assert.equal(first.items.length, 20);
        assert.ok(!first.items.some((v: { id: string }) => v.id === welcomeId));
        const cursor = first.items.at(-1);
        const next = await command(actor, "inbox", {
          beforeAt: cursor.activityAt,
          beforeId: cursor.id,
        });
        assert.equal(next.items.length, 4);
        const all = [...first.items, ...next.items];
        assert.equal(new Set(all.map((v: { id: string }) => v.id)).size, 24);
        assert.equal(
          all.filter((v: { id: string }) => v.id === welcomeId).length,
          1,
        );
        assert.equal(
          (await command(actor, "inbox", { filter: "unread" })).unreadCount,
          23,
        );
        const last = next.items.at(-1);
        assert.equal(
          (
            await command(actor, "inbox", {
              beforeAt: last.activityAt,
              beforeId: last.id,
            })
          ).items.length,
          0,
        );
        assert.equal((await command(actor, "inbox", {}, true)).unreadCount, 23);
      },
    );
    await t.test(
      "revocation conceals welcome; raw runtime/browser/worker access and private hooks stay closed",
      async () => {
        await admin`select app.mail_flags(true)`;
        await admin`update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp() where profile_id=${actor.id}::uuid and run_id=${actor.run}::uuid`;
        await assert.rejects(command(actor, "inbox"));
        await assert.rejects(runtime`select * from app.member_welcomes`);
        await assert.rejects(
          runtime`select app.create_member_welcome(${actor.run}::uuid,${actor.id}::uuid)`,
        );
        for (const role of [
          "anon",
          "authenticated",
          "service_role",
          "app_runtime",
          "app_notification_worker",
        ]) {
          const [p] =
            await admin`select has_table_privilege(${role},'app.member_welcomes','select,insert,update,delete') raw`;
          assert.equal(p.raw, false);
          const [functions] =
            await admin`select has_function_privilege(${role},'app.message_command_v2(text,jsonb)','execute') command,has_function_privilege(${role},'app.create_member_welcome(uuid,uuid)','execute') create_welcome,has_function_privilege(${role},'app.welcome_conversation(app.member_welcomes)','execute') projection`;
          assert.equal(functions.command, role === "app_runtime");
          assert.equal(functions.create_welcome, false);
          assert.equal(functions.projection, false);
        }
        assert.equal(
          (
            await admin`select count(*)::int n from app.notification_emails where conversation_id=${welcomeId}::uuid`
          )[0].n,
          0,
        );
      },
    );
  } finally {
    await runtime.end();
    // The whole owned scratch DB is removed by the rehearsal even after assertion failure.
    await admin.end();
  }
});
