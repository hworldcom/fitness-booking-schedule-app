import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
import { sql, type SQL } from "drizzle-orm";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import { saveOwnedEffectiveAvailabilityRecord } from "@/server/db/coaches/effective-availability-repository";
import {
  parseNotificationPage,
  type NotificationPage,
} from "@/notifications/contracts";
const url = process.env.DATABASE_TEST_URL;
const allowed =
  url &&
  /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:55322\/mov(?:253|255|257|288)_[a-f0-9]{12}_(fresh|upgrade)$/.test(
    url,
  );
type Fixture = {
  coach: AuthorizedActor;
  athlete: AuthorizedActor;
  outsider: AuthorizedActor;
  bookingId: string;
  oldRequest: string;
};
test(
  "connection request recipients receive one private bell notice and independent read state",
  { skip: !allowed },
  async (t) => {
    const admin = postgres(url!, { max: 6, prepare: false, onnotice() {} });
    assert.ok(process.env.CONNECTION_NOTICE_RUNTIME_URL);
    process.env.DATABASE_URL = process.env.CONNECTION_NOTICE_RUNTIME_URL;
    const run = (actor: AuthorizedActor, query: SQL) =>
      withActorDatabaseContext(actor, (tx) => tx.execute(query));
    const send = async (
      actor: AuthorizedActor,
      bookingId: string,
      id = randomUUID(),
      previous: string | null = null,
    ) =>
      (
        await run(
          actor,
          sql`select app.send_coach_athlete_connection(${bookingId}::uuid,${id}::uuid,${previous}::uuid) result`,
        )
      )[0].result as { id: string; status: string };
    const decide = async (actor: AuthorizedActor, id: string, action: string) =>
      run(
        actor,
        sql`select app.decide_coach_athlete_connection(${id}::uuid,${action}) result`,
      );
    const command = async (
      actor: AuthorizedActor,
      action: string,
      args: object = {},
      version = 6,
    ) =>
      (
        await run(
          actor,
          sql`select ${sql.raw("app.notification_command" + (version === 1 ? "" : "_v" + version))}(${action},${JSON.stringify(args)}::jsonb) result`,
        )
      )[0].result;
    const list = async (
      actor: AuthorizedActor,
      args: object = {},
      version = 6,
    ) => parseNotificationPage(await command(actor, "list", args, version));
    const notices = (page: NotificationPage) =>
      page.items.filter((i) => i.kind === "connection-request");
    async function person(
      name: string,
      isCoach = false,
    ): Promise<AuthorizedActor> {
      const authUserId = randomUUID();
      await admin`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${authUserId}::uuid,${authUserId + "@example.test"},statement_timestamp(),false,false)`;
      const [p] =
        await admin`select * from app.enroll_application_identity(${authUserId}::uuid,${name})`;
      const actor: AuthorizedActor = {
        authUserId,
        profileId: p.identity_profile_id,
        runId: p.identity_run_id,
        runRole: "member",
      };
      if (isCoach) {
        await run(actor, sql`select app.submit_owned_coach_application()`);
        await run(
          actor,
          sql`select app.save_owned_coach_application_contact(0,'{"phoneNumber":"+4915123456789","instagramUrl":null,"facebookUrl":null,"linkedinUrl":null}'::jsonb)`,
        );
        await run(
          actor,
          sql`select app.upsert_owned_coach_profile(${name},'Disposable connection notification fixture coach.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`,
        );
        await admin`select app.review_coach_application(${actor.profileId}::uuid,'pending','approved','MOV-253 disposable fixture','mov253','movx-identity-application-v1')`;
        await admin`update app.coach_profiles set visibility='visible' where profile_id=${actor.profileId}::uuid`;
      }
      return actor;
    }
    async function fixture(): Promise<Fixture> {
      const coach = await person("Notice Coach", true),
        athlete = await person("Notice Athlete"),
        outsider = await person("Notice Outsider");
      const [venue] =
        await admin`select id,to_jsonb(updated_at)#>>'{}' stamp from app.coach_training_locations where profile_id=${coach.profileId}::uuid and is_primary`;
      const [date] =
        await admin`select ((clock_timestamp() at time zone 'Europe/Berlin')::date+3)::text target_date`;
      await withActorDatabaseContext(coach, (tx) =>
        saveOwnedEffectiveAvailabilityRecord(tx, {
          kind: "dates",
          operationId: randomUUID(),
          expectedRevision: 0,
          dates: [
            {
              date: date.target_date,
              mode: "custom",
              hours: [
                {
                  localStartTime: "10:00",
                  locationId: venue.id,
                  locationUpdatedAt: venue.stamp,
                },
              ],
            },
          ],
        }),
      );
      const [type] =
        await admin`select id,revision from app.coach_session_types where coach_profile_id=${coach.profileId}::uuid and format='private'`;
      const [time] =
        await admin`select ((${date.target_date}::date+time '10:00')at time zone'Europe/Berlin')::text starts`;
      const request = (
        await run(
          athlete,
          sql`select app.request_session_type(${randomUUID()}::uuid,${JSON.stringify({ typeId: type.id, typeRevision: type.revision, locationId: venue.id, startsAt: time.starts })}::jsonb) result`,
        )
      )[0].result as { requestId: string };
      const accepted = (
        await run(
          coach,
          sql`select * from app.accept_coach_booking_request(${request.requestId}::uuid)`,
        )
      )[0];
      const bookingId = String(accepted.booking_id);
      const oldRequest = (await send(coach, bookingId)).id;
      return { coach, athlete, outsider, bookingId, oldRequest };
    }
    try {
      const manifest = process.env.CONNECTION_NOTICE_MANIFEST;
      const reuse = process.env.CONNECTION_NOTICE_REUSE === "1";
      const f: Fixture =
        reuse && manifest
          ? JSON.parse(readFileSync(manifest, "utf8"))
          : await fixture();
      if (process.env.CONNECTION_NOTICE_PREPARE === "1") {
        assert.ok(manifest);
        writeFileSync(manifest, JSON.stringify(f), { mode: 0o600 });
        return;
      }
      const { coach, athlete, outsider, bookingId, oldRequest } = f;
      const rawNotices = async () =>
        admin`select request_id,recipient_profile_id,read_at from app.connection_request_notifications where run_id=${coach.runId}::uuid and recipient_profile_id in(${coach.profileId}::uuid,${athlete.profileId}::uuid)`;
      const old =
        await admin`select count(*)::int n from app.connection_request_notifications where request_id=${oldRequest}::uuid`;
      assert.equal(
        old[0].n,
        reuse ? 0 : 1,
        "upgrade must not backfill a preexisting request",
      );
      await decide(coach, oldRequest, "withdraw");
      for (const actor of [coach, athlete])
        await command(actor, "read-all", {
          throughAt: (await list(actor)).snapshotAt,
        });
      const emailQueues = async () =>
        (
          await admin`select (select count(*) from app.notification_emails)::int messages,(select count(*) from app.booking_notification_receipts)::int bookings,(select count(*) from app.group_notification_receipts)::int groups,(select count(*) from app.coach_approval_notifications)::int approvals`
        )[0];
      const emailBaseline = await emailQueues();
      let previous = oldRequest;
      let current: string;
      let receiptId: string;
      await t.test(
        "coach-to-athlete send, exact/concurrent retry and sender isolation",
        async () => {
          const id = randomUUID();
          const beforeLegacy = await list(athlete, {}, 5);
          const results = await Promise.all([
            send(coach, bookingId, id, previous),
            send(coach, bookingId, id, previous),
          ]);
          assert.deepEqual(results[0], results[1]);
          current = results[0].id;
          previous = current;
          const raw = (await command(athlete, "list")) as {
            items: Record<string, unknown>[];
          };
          const dto = raw.items.find(
            (i) => i.kind === "connection-request" && i.requestId === current,
          )!;
          assert.deepEqual(
            Object.keys(dto).sort(),
            [
              "kind",
              "id",
              "requestId",
              "createdAt",
              "readAt",
              "senderName",
              "recipientRole",
            ].sort(),
          );
          const recipient = await list(athlete);
          const found = notices(recipient).filter(
            (i) => i.kind === "connection-request" && i.requestId === current,
          );
          assert.equal(found.length, 1);
          assert.equal(found[0].recipientRole, "athlete");
          assert.equal(found[0].senderName, "Notice Coach");
          receiptId = found[0].id;
          assert.equal(notices(await list(coach)).length, 0);
          assert.equal(recipient.unreadCount, beforeLegacy.unreadCount + 1);
          assert.equal(
            (await rawNotices()).filter((n) => n.request_id === current).length,
            1,
          );
          const initial = (await rawNotices()).find(
            (n) => n.request_id === current,
          )!.read_at;
          assert.equal(initial, null);
          assert.equal(
            (await list(athlete)).unreadCount,
            recipient.unreadCount,
            "opening/listing does not mark read",
          );
        },
      );
      await t.test(
        "old versions cannot read/count/mark new notices; recipient read does not decide the request",
        async () => {
          for (const version of [1, 2, 3, 4, 5]) {
            assert.equal(notices(await list(athlete, {}, version)).length, 0);
            await command(
              athlete,
              "read-all",
              { throughAt: (await list(athlete, {}, version)).snapshotAt },
              version,
            );
            await assert.rejects(
              command(athlete, "read", { id: receiptId }, version),
            );
            assert.equal(
              (await rawNotices()).find((n) => n.request_id === current)!
                .read_at,
              null,
            );
          }
          await assert.rejects(command(outsider, "read", { id: receiptId }));
          await assert.rejects(command(coach, "read", { id: receiptId }));
          assert.equal(
            (await rawNotices()).find((n) => n.request_id === current)!.read_at,
            null,
          );
          await command(athlete, "read", { id: receiptId });
          assert.ok(
            (await rawNotices()).find((n) => n.request_id === current)!.read_at,
          );
          assert.equal(
            notices(await list(athlete, { filter: "unread" })).length,
            0,
          );
          const [a] =
            await admin`select status from app.coach_athlete_connection_attempts where id=${current}::uuid`;
          assert.equal(a.status, "pending");
          await decide(athlete, current, "accept");
          assert.equal(
            (await rawNotices()).filter((n) => n.request_id === current).length,
            1,
          );
          assert.equal(notices(await list(athlete)).length, reuse ? 1 : 2);
          await decide(coach, current, "disconnect");
        },
      );
      await t.test(
        "athlete-to-coach request and retained past-tense notification after decline",
        async () => {
          current = (await send(athlete, bookingId, randomUUID(), previous)).id;
          previous = current;
          const before = await list(coach);
          const found = notices(before).find(
            (i) => i.kind === "connection-request" && i.requestId === current,
          );
          assert.ok(found && found.kind === "connection-request");
          assert.equal(found.recipientRole, "coach");
          assert.equal(found.senderName, "Notice Athlete");
          await decide(coach, current, "decline");
          assert.equal(
            notices(await list(coach)).filter(
              (i) => i.kind === "connection-request" && i.requestId === current,
            ).length,
            1,
          );
          assert.equal(
            (await rawNotices()).filter((n) => n.request_id === current).length,
            1,
          );
        },
      );
      await t.test(
        "rollback and rejected/altered/unauthorized sends create no false alert",
        async () => {
          const count = (await rawNotices()).length;
          await assert.rejects(
            withActorDatabaseContext(coach, async (tx) => {
              await tx.execute(
                sql`select app.send_coach_athlete_connection(${bookingId}::uuid,${randomUUID()}::uuid,${previous}::uuid)`,
              );
              throw Error("force whole transaction rollback");
            }),
            /force whole transaction rollback/,
          );
          await assert.rejects(
            send(outsider, bookingId, randomUUID(), previous),
          );
          await assert.rejects(
            send(coach, randomUUID(), randomUUID(), previous),
          );
          assert.equal((await rawNotices()).length, count);
          await assert.rejects(
            run(
              athlete,
              sql`select * from app.connection_request_notifications`,
            ),
          );
          await assert.rejects(
            run(
              athlete,
              sql`select app.connection_request_notification_data(${receiptId}::uuid,${athlete.profileId}::uuid)`,
            ),
          );
          await assert.rejects(list({ ...athlete, runId: randomUUID() }));
        },
      );
      await t.test(
        "snapshot mark-all, stable mixed paging and no connection/read side effects",
        async () => {
          const snapshot = (await list(athlete)).snapshotAt;
          for (let i = 0; i < 25; i++) {
            const request = await send(
              coach,
              bookingId,
              randomUUID(),
              previous,
            );
            previous = request.id;
            await decide(coach, request.id, "withdraw");
          }
          await command(athlete, "read-all", { throughAt: snapshot });
          const unread = await list(athlete, { filter: "unread" });
          assert.equal(unread.unreadCount, 25);
          assert.equal(unread.items.length, 20);
          assert.equal(unread.hasMore, true);
          const tail = unread.items.at(-1)!;
          const next = await list(athlete, {
            filter: "unread",
            beforeAt: tail.createdAt,
            beforeId: tail.id,
          });
          assert.equal(next.items.length, 5);
          assert.equal(next.hasMore, false);
          assert.equal(
            new Set([...unread.items, ...next.items].map((i) => i.id)).size,
            25,
          );
          await command(athlete, "read-all", {
            throughAt: (await list(athlete)).snapshotAt,
          });
          assert.equal((await list(athlete)).unreadCount, 0);
          assert.equal(
            notices(await list(athlete, { filter: "unread" })).length,
            0,
          );
        },
      );
      await t.test(
        "blocking and sender revocation conceal private history and prevent a new request",
        async () => {
          const before = notices(await list(coach)).length;
          assert.ok(before > 0);
          const [conversation] =
            await admin`select id from app.message_conversations where run_id=${coach.runId}::uuid and coach_profile_id=${coach.profileId}::uuid and athlete_profile_id=${athlete.profileId}::uuid`;
          await run(
            athlete,
            sql`select app.message_command('block',${JSON.stringify({ conversationId: conversation.id })}::jsonb)`,
          );
          assert.equal(notices(await list(coach)).length, 0);
          assert.equal(notices(await list(athlete)).length, 0);
          await assert.rejects(send(coach, bookingId, randomUUID(), previous));
          await run(
            athlete,
            sql`select app.message_command('unblock',${JSON.stringify({ conversationId: conversation.id })}::jsonb)`,
          );
          assert.equal(notices(await list(coach)).length, before);
          await admin`update auth.users set banned_until=statement_timestamp()+interval '1 hour' where id=${athlete.authUserId}::uuid`;
          assert.equal(notices(await list(coach)).length, 0);
          await admin`update auth.users set banned_until=null where id=${athlete.authUserId}::uuid`;
          assert.equal(notices(await list(coach)).length, before);
        },
      );
      await t.test(
        "inserting an already accepted relationship does not emit a pending-request alert",
        async () => {
          const [pair] =
            await admin`select pair_id,max(attempt_number)::int n from app.coach_athlete_connection_attempts where id in(select id from app.coach_athlete_connection_attempts where pair_id=(select pair_id from app.coach_athlete_connection_attempts where id=${previous}::uuid))group by pair_id`;
          const id = randomUUID();
          await admin.begin(async (tx) => {
            await tx`select app.connection_access_flags(true)`;
            await tx`insert into app.coach_athlete_connection_attempts(id,run_id,pair_id,attempt_number,sender_profile_id,recipient_profile_id,status,decided_by_profile_id,decided_at)values(${id}::uuid,${coach.runId}::uuid,${pair.pair_id}::uuid,${pair.n + 1},${coach.profileId}::uuid,${athlete.profileId}::uuid,'accepted',${athlete.profileId}::uuid,statement_timestamp())`;
          });
          const [n] =
            await admin`select count(*)::int n from app.connection_request_notifications where request_id=${id}::uuid`;
          assert.equal(n.n, 0);
        },
      );
      assert.deepEqual(
        await emailQueues(),
        emailBaseline,
        "connection requests and their read/decision history must enqueue no emails",
      );
    } finally {
      await admin.end({ timeout: 2 });
    }
  },
);
