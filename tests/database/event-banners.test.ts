import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
  !/^dev0356_[a-z0-9_]+$/.test(new URL(url).pathname.slice(1))
)
  throw new Error(
    "Event banner proof requires its isolated loopback database.",
  );

test("event banners preserve terms and enforce owner, revision, publication, Storage and cleanup boundaries", async (t) => {
  const db = postgres(url, {
    max: 8,
    prepare: false,
    ssl: false,
    onnotice: () => {},
  });
  type Actor = { auth: string; profile: string; run: string };
  const asActor = <T>(
    a: Actor,
    fn: (tx: postgres.TransactionSql) => Promise<T>,
  ) =>
    db.begin(async (tx) => {
      await tx.unsafe("set local role app_runtime");
      await tx`select set_config('app.current_auth_user_id',${a.auth},true),set_config('app.current_profile_id',${a.profile},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
      return fn(tx);
    }) as Promise<T>;
  const storage = <T>(
    a: Actor | null,
    fn: (tx: postgres.TransactionSql) => Promise<T>,
  ) =>
    db.begin(async (tx) => {
      await tx.unsafe(
        a ? "set local role authenticated" : "set local role anon",
      );
      // Emulate the Storage API's own transaction in this disposable database.
      await tx`select set_config('storage.allow_delete_query','true',true)`;
      if (a)
        await tx`select set_config('request.jwt.claim.sub',${a.auth},true)`;
      return fn(tx);
    }) as Promise<T>;
  async function actor(name: string): Promise<Actor> {
    const auth = randomUUID();
    await db`insert into auth.users(id,is_sso_user,is_anonymous) values(${auth}::uuid,false,false)`;
    const [p] =
      await db`select * from app.enroll_application_identity(${auth}::uuid,${name})`;
    const a = {
      auth,
      profile: p.identity_profile_id as string,
      run: p.identity_run_id as string,
    };
    await asActor(a, async (tx) => {
      await tx`select app.submit_owned_coach_application()`;
      await tx`select app.upsert_owned_coach_profile(${name},'An isolated event banner authority fixture with a reviewed venue.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
    });
    await db`select app.review_coach_application(${a.profile}::uuid,'pending','approved','Isolated event banner proof.','database-test','movx-identity-application-v1')`;
    await db`update app.coach_profiles set visibility='visible' where profile_id=${a.profile}::uuid`;
    return a;
  }
  const command = (a: Actor, action: string, args: Record<string, unknown>) =>
    asActor(
      a,
      async (tx) =>
        (action === "publish"
          ? await tx`select app.publish_group_session(${String(args.id)}::uuid,${Number(args.expectedRevision)}) result`
          : await tx`select app.group_session_command(${action},${tx.json(args as postgres.JSONValue)}) result`)[0]
          .result,
    );
  const read = (a: Actor, id: string) =>
    asActor(
      a,
      async (tx) =>
        (
          await tx`select * from app.owned_group_session_banner(${id}::uuid)`
        )[0],
    );
  const mutate = (
    a: Actor,
    id: string,
    revision: number,
    paths: string[] | null,
  ) =>
    asActor(
      a,
      (tx) =>
        tx`select * from app.mutate_owned_group_session_banner(${id}::uuid,${revision},${paths?.[0] ?? null},${paths?.[1] ?? null})`,
    );
  const media = (id: string) =>
    db.begin(async (tx) => {
      await tx.unsafe("set local role app_runtime");
      return tx`select * from app.public_group_event_media(array[${id}::uuid])`;
    });
  const objects = async (a: Actor) => {
    const paths = [1, 2].map(() => `${a.profile}/${randomUUID()}.webp`);
    for (const path of paths)
      await db`insert into storage.objects(bucket_id,name,metadata) values('event-banners',${path},'{"mimetype":"image/webp","size":100}')`;
    return paths;
  };
  try {
    const owner = await actor("Event Banner Owner " + randomUUID().slice(0, 6));
    const other = await actor("Event Banner Other " + randomUUID().slice(0, 6));
    async function draft(offset = 3, near = false) {
      const id = randomUUID();
      const [venue] =
        await db`select id from app.coach_training_locations where profile_id=${owner.profile}::uuid and is_primary`;
      const [instants] = near
        ? await db`select clock_timestamp()+interval '3 seconds' starts,clock_timestamp()+interval '2 seconds' deadline`
        : await db`select ((date_trunc('day',clock_timestamp() at time zone 'Europe/Berlin')+make_interval(days=>${offset})+interval '10 hours') at time zone 'Europe/Berlin') starts,((date_trunc('day',clock_timestamp() at time zone 'Europe/Berlin')+make_interval(days=>${offset - 1})+interval '10 hours') at time zone 'Europe/Berlin') deadline`;
      await command(owner, "save-draft", {
        id,
        expectedRevision: null,
        title: "Event banner fixture",
        description: "Actual isolated event.",
        discipline: "Boxing",
        intendedLevel: "All levels",
        locationId: venue.id,
        startsAt: new Date(instants.starts).toISOString(),
        endsAt: new Date(
          new Date(instants.starts).getTime() + 3600000,
        ).toISOString(),
        decisionDeadlineAt: new Date(instants.deadline).toISOString(),
        minimumParticipants: 2,
        maximumParticipants: 8,
        priceCents: 0,
      });
      return id;
    }
    const id = await draft();
    const first = await objects(owner);
    const terms = (await command(owner, "detail", { id })).session;
    await t.test(
      "empty media and exact-owner/dataset authorization",
      async () => {
        assert.equal((await read(owner, id)).revision, 0);
        assert.equal((await read(owner, id)).editable, true);
        assert.equal((await media(id)).length, 0);
        for (const a of [
          other,
          { ...owner, run: randomUUID() },
          { ...owner, auth: other.auth },
        ])
          await assert.rejects(read(a, id));
        await assert.rejects(
          asActor(owner, (tx) => tx`select * from app.group_session_banners`),
          (e: unknown) => (e as { code: string }).code === "42501",
        );
      },
    );
    await t.test(
      "draft attachment stays private and leaves all scheduling terms unchanged",
      async () => {
        await mutate(owner, id, 0, first);
        assert.equal((await read(owner, id)).revision, 1);
        assert.deepEqual(
          (await command(owner, "detail", { id })).session,
          terms,
        );
        assert.equal((await media(id)).length, 0);
        assert.equal(
          (
            await storage(
              null,
              (tx) =>
                tx`select name from storage.objects where bucket_id='event-banners'`,
            )
          ).length,
          0,
        );
        assert.equal(
          (
            await storage(
              owner,
              (tx) =>
                tx`select name from storage.objects where bucket_id='event-banners'`,
            )
          ).length,
          2,
        );
        assert.equal(
          (
            await storage(
              other,
              (tx) =>
                tx`select name from storage.objects where bucket_id='event-banners'`,
            )
          ).length,
          0,
        );
        await assert.rejects(mutate(owner, id, 0, first));
        await assert.rejects(mutate(other, id, 1, await objects(other)));
      },
    );
    await command(owner, "publish", { id, expectedRevision: 1 });
    await t.test(
      "published current references are public; replacements revoke old bytes and stale writes",
      async () => {
        const current = await media(id);
        assert.equal(current.length, 1);
        assert.equal(current[0].event_card_path, first[0]);
        assert.equal(
          (
            await storage(
              null,
              (tx) =>
                tx`select name from storage.objects where bucket_id='event-banners'`,
            )
          ).length,
          2,
        );
        const next = await objects(owner);
        await mutate(owner, id, 1, next);
        assert.equal(
          (
            await storage(
              null,
              (tx) =>
                tx`select name from storage.objects where name=${first[0]}`,
            )
          ).length,
          0,
        );
        const races = await Promise.allSettled([
          mutate(owner, id, 2, await objects(owner)),
          mutate(owner, id, 2, await objects(owner)),
        ]);
        assert.equal(races.filter((x) => x.status === "fulfilled").length, 1);
        assert.equal((await read(owner, id)).revision, 3);
        await assert.rejects(mutate(owner, id, 1, next));
        const [deleted] = await storage(
          owner,
          (tx) =>
            tx`with removed as(delete from storage.objects where name=${next[0]} returning name) select count(*)::int n from removed`,
        );
        assert.equal(deleted.n, 1); // No longer current after the winning revision-2 write.
        const active = await read(owner, id);
        const [kept] = await storage(
          owner,
          (tx) =>
            tx`with removed as(delete from storage.objects where name=${active.card_path} returning name) select count(*)::int n from removed`,
        );
        assert.equal(kept.n, 0);
      },
    );
    await t.test(
      "public coach banner/portrait fallback excludes private account avatar references",
      async () => {
        const coachPaths = [1, 2].map(
          () => `${owner.profile}/${randomUUID()}.webp`,
        );
        for (const path of coachPaths)
          await db`insert into storage.objects(bucket_id,name,metadata) values('coach-banners',${path},'{"mimetype":"image/webp","size":100}')`;
        await asActor(
          owner,
          (tx) =>
            tx`select * from app.mutate_owned_coach_website(0,null,${coachPaths[0]},${coachPaths[1]},true)`,
        );
        const portrait = `${owner.profile}/${randomUUID()}.webp`,
          privateAvatar = `${owner.profile}/${randomUUID()}.webp`;
        await db`update app.coach_profiles set portrait_source='storage',portrait_path=${portrait},portrait_updated_at=clock_timestamp() where profile_id=${owner.profile}::uuid`;
        await db`update app.profiles set avatar_storage_path=${privateAvatar},avatar_updated_at=clock_timestamp() where id=${owner.profile}::uuid`;
        const row = (await media(id))[0];
        assert.equal(row.coach_card_path, coachPaths[0]);
        assert.equal(row.portrait_path, portrait);
        assert.equal(JSON.stringify(row).includes(privateAvatar), false);
        assert.equal(
          Object.keys(row).some((key) => key.includes("avatar")),
          false,
        );
      },
    );
    await t.test(
      "attachment and Storage cleanup serialize, including a fresh post-lock reference check",
      async () => {
        const raceId = await draft(6),
          paths = await objects(owner);
        let reached!: () => void,
          release!: () => void,
          deletePid!: (pid: number) => void;
        const staged = new Promise<void>((resolve) => {
            reached = resolve;
          }),
          hold = new Promise<void>((resolve) => {
            release = resolve;
          }),
          pidReady = new Promise<number>((resolve) => {
            deletePid = resolve;
          });
        const attaching = asActor(owner, async (tx) => {
          await tx`select * from app.mutate_owned_group_session_banner(${raceId}::uuid,0,${paths[0]},${paths[1]})`;
          reached();
          await hold;
        });
        let deletion: Promise<postgres.RowList<postgres.Row[]>> | undefined;
        try {
          await Promise.race([staged, attaching]);
          deletion = storage(owner, async (tx) => {
            const [connection] = await tx`select pg_backend_pid() pid`;
            deletePid(connection.pid);
            return tx`delete from storage.objects where bucket_id='event-banners' and name in (${paths[0]},${paths[1]}) returning name`;
          });
          const pid = await pidReady;
          let waiting = false;
          for (let i = 0; i < 50; i++) {
            const [state] =
              await db`select wait_event from pg_stat_activity where pid=${pid}`;
            if (state?.wait_event === "advisory") {
              waiting = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          assert.equal(
            waiting,
            true,
            "Cleanup must wait for the pending attachment lock.",
          );
        } finally {
          release();
        }
        await attaching;
        assert.equal((await deletion!).length, 0);
        const removedFirst = await objects(owner);
        await storage(
          owner,
          (tx) =>
            tx`delete from storage.objects where name in (${removedFirst[0]},${removedFirst[1]}) returning name`,
        );
        await assert.rejects(mutate(owner, raceId, 1, removedFirst));
        assert.equal((await read(owner, raceId)).card_path, paths[0]);
      },
    );
    await t.test(
      "hidden coaches revoke application/Storage publicity, removal and terminal edits",
      async () => {
        await db`update app.coach_profiles set visibility='hidden' where profile_id=${owner.profile}::uuid`;
        assert.equal((await media(id)).length, 0);
        assert.equal(
          (
            await storage(
              null,
              (tx) =>
                tx`select name from storage.objects where bucket_id='event-banners'`,
            )
          ).length,
          0,
        );
        assert.equal((await read(owner, id)).editable, true);
        await db`update app.coach_profiles set visibility='visible' where profile_id=${owner.profile}::uuid`;
        await mutate(owner, id, 3, null);
        assert.equal((await read(owner, id)).card_path, null);
        await command(owner, "cancel", { id });
        assert.equal((await read(owner, id)).editable, false);
        await assert.rejects(mutate(owner, id, 4, await objects(owner)));
      },
    );
    await t.test(
      "past starts and expired decision windows deny presentation edits",
      async () => {
        const near = await draft(9, true);
        await command(owner, "publish", { id: near, expectedRevision: 1 });
        await db`select pg_sleep(3.1)`;
        assert.equal((await read(owner, near)).editable, false);
        await assert.rejects(mutate(owner, near, 0, await objects(owner)));
      },
    );
    await t.test(
      "draft deletion removes media references without making obsolete files public",
      async () => {
        const draftId = await draft(8);
        await mutate(owner, draftId, 0, await objects(owner));
        await command(owner, "delete-draft", {
          id: draftId,
          expectedRevision: 1,
        });
        assert.equal(
          (
            await db`select * from app.group_session_banners where session_id=${draftId}::uuid`
          ).length,
          0,
        );
        await assert.rejects(read(owner, draftId));
        assert.equal((await media(draftId)).length, 0);
      },
    );
  } finally {
    await db.end({ timeout: 1 });
  }
});
