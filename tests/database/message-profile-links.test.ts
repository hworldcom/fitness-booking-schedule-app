import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  !/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/mov115_[a-z0-9_]+$/.test(
    url,
  )
)
  throw Error("Use the MOV-115 owned scratch database rehearsal.");
class Rollback extends Error {}

test("message profile links retain exact public and accepted-pair authority", async (t) => {
  const db = postgres(url, { max: 1, ssl: false, onnotice: () => {} });
  try {
    await db.begin(async (tx) => {
      const actors = [];
      for (let i = 0; i < 3; i++) {
        const authId = randomUUID();
        await tx`insert into auth.users(id,is_sso_user,is_anonymous) values(${authId}::uuid,false,false)`;
        const [p] =
          await tx`select * from app.enroll_application_identity(${authId}::uuid,${"Profile link fixture " + i})`;
        actors.push({
          authId,
          id: String(p.identity_profile_id),
          run: String(p.identity_run_id),
        });
      }
      const [coach, athlete, outsider] = actors;
      async function source(
        a: typeof coach,
        query: string,
        args: postgres.JSONValue[] = [],
      ) {
        return tx.savepoint(async (s) => {
          await s.unsafe("set local role app_runtime");
          await s`select set_config('app.current_auth_user_id',${a.authId},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
          return s.unsafe(query, args);
        });
      }
      async function command(
        a: typeof coach,
        action: string,
        args: object = {},
      ) {
        return (
          await source(a, "select app.message_command($1,$2::jsonb) result", [
            action,
            args as postgres.JSONValue,
          ])
        )[0].result;
      }
      await source(coach, "select app.submit_owned_coach_application()");
      await source(
        coach,
        "select app.save_owned_coach_application_contact(0,$1::jsonb)",
        [
          {
            phoneNumber: "+4915112345678",
            instagramUrl: null,
            facebookUrl: null,
            linkedinUrl: null,
          },
        ],
      );
      await source(
        coach,
        "select app.upsert_owned_coach_profile('Profile link coach','Focused private boxing practice with clear session preparation for every athlete.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)",
      );
      await tx.unsafe("reset role");
      await tx`select app.review_coach_application(${coach.id}::uuid,'pending','approved','Isolated MOV-115 fixture approval.','database-test','movx-identity-application-v1')`;
      await tx`update app.coach_profiles set visibility='visible' where profile_id=${coach.id}::uuid`;
      const [profile] =
        await tx`select public_slug from app.coach_profiles where profile_id=${coach.id}::uuid`;
      const saved = await command(athlete, "inquire", {
        coachId: coach.id,
        body: "Fixture profile navigation inquiry",
        submissionId: randomUUID(),
      });
      const conversationId = saved.conversationId;
      const thread = (a: typeof coach) =>
        command(a, "thread", { conversationId });
      await t.test(
        "visible approved coach links by public slug; plain inquiry grants no athlete profile",
        async () => {
          assert.equal(
            (await thread(athlete)).conversation.counterpartProfileHref,
            `/coaches/${profile.public_slug}`,
          );
          assert.equal(
            (await thread(coach)).conversation.counterpartProfileHref,
            null,
          );
          const inbox = await command(athlete, "inbox");
          assert.equal(
            inbox.items[0].counterpartProfileHref,
            `/coaches/${profile.public_slug}`,
          );
        },
      );
      await t.test(
        "hidden or unapproved coach removes the link without removing retained chat",
        async () => {
          await tx.unsafe("reset role");
          await tx`update app.coach_profiles set visibility='hidden' where profile_id=${coach.id}::uuid`;
          assert.equal(
            (await thread(athlete)).conversation.counterpartProfileHref,
            null,
          );
          await tx.unsafe("reset role");
          await tx`update app.coach_profiles set visibility='visible' where profile_id=${coach.id}::uuid`;
          await tx`update app.coach_applications set status='rejected' where profile_id=${coach.id}::uuid`;
          assert.equal(
            (await thread(athlete)).conversation.counterpartProfileHref,
            null,
          );
          await tx.unsafe("reset role");
          await tx`update app.coach_applications set status='approved' where profile_id=${coach.id}::uuid`;
          assert.equal(
            (await thread(athlete)).entries[0].body,
            "Fixture profile navigation inquiry",
          );
        },
      );
      const [slot] = await source(
        coach,
        "select app.create_owned_coach_availability((date_trunc('day',statement_timestamp())+interval '4 days 14 hours') at time zone 'Europe/Berlin',60) id",
      );
      const [request] = await source(
        athlete,
        "select * from app.create_coach_booking_request($1::uuid)",
        [slot.id],
      );
      const [booking] = await source(
        coach,
        "select * from app.accept_coach_booking_request($1::uuid)",
        [request.request_id],
      );
      const connectionId = randomUUID();
      await source(
        coach,
        "select app.send_coach_athlete_connection($1::uuid,$2::uuid,null)",
        [booking.booking_id, connectionId],
      );
      await t.test(
        "booking and pending connection do not grant a private athlete page",
        async () => {
          assert.equal(
            (await thread(coach)).conversation.counterpartProfileHref,
            null,
          );
        },
      );
      const [accepted] = await source(
        athlete,
        "select app.decide_coach_athlete_connection($1::uuid,'accept') result",
        [connectionId],
      );
      const pairId = accepted.result.pairId;
      await t.test(
        "accepted exact pair links without requiring an avatar; destination has actual shared bookings",
        async () => {
          assert.match(pairId, /^[a-f0-9-]{36}$/);
          const c = (await thread(coach)).conversation;
          assert.equal(c.counterpartMedia, null);
          assert.equal(c.counterpartProfileHref, `/coach/athletes/${pairId}`);
          assert.equal(
            (await command(coach, "inbox")).items[0].counterpartProfileHref,
            c.counterpartProfileHref,
          );
          const rows = await source(
            coach,
            "select * from app.current_direct_private_bookings() where client_profile_id=$1::uuid",
            [athlete.id],
          );
          assert.equal(rows.length, 1);
          assert.equal(rows[0].id, booking.booking_id);
        },
      );
      await t.test(
        "outsiders and another dataset gain no conversation or direct private helper authority",
        async () => {
          await assert.rejects(thread(outsider));
          await assert.rejects(thread({ ...coach, run: randomUUID() }));
          await tx.unsafe("reset role");
          assert.equal(
            (
              await tx`select has_function_privilege('app_runtime','app.mail_conversation_projection(app.message_conversations,uuid)','execute') allowed`
            )[0].allowed,
            false,
          );
        },
      );
      await t.test(
        "disconnect removes the profile destination and preserves conversation and booking",
        async () => {
          const before = await thread(coach);
          await source(
            athlete,
            "select app.decide_coach_athlete_connection($1::uuid,'disconnect')",
            [connectionId],
          );
          const after = await thread(coach);
          assert.equal(after.conversation.counterpartProfileHref, null);
          assert.deepEqual(after.entries, before.entries);
          assert.deepEqual(after.contexts, before.contexts);
          assert.equal(after.readThrough, before.readThrough);
          assert.equal(
            (
              await source(
                coach,
                "select * from app.current_direct_private_bookings() where id=$1::uuid",
                [booking.booking_id],
              )
            ).length,
            1,
          );
        },
      );
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  } finally {
    await db.end();
  }
});
