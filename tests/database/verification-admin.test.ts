import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { withNotificationWorker } from "@/server/db/notifications/worker";

const url = new URL(process.env.DATABASE_TEST_URL ?? "http://invalid");
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55322" ||
  !/^\/mov176_[a-f0-9]+_(fresh|upgrade)$/.test(url.pathname)
)
  throw Error("Use the isolated MOV-176 rehearsal.");
type Actor = { auth: string; profile: string; run: string };
test("first email verification and staff Users authority", async (t) => {
  const db = postgres(url.href, { max: 5, prepare: false, onnotice() {} }),
    worker = postgres(process.env.NOTIFICATION_TEST_DATABASE_URL!, {
      max: 4,
      prepare: false,
      onnotice() {},
    });
  const create = async (
    verified = false,
    provider = "email",
    email?: string,
  ) => {
    const id = randomUUID(),
      address = email ?? `mov176-${id}@example.test`;
    await db`insert into auth.users(id,email,created_at,email_confirmed_at,is_anonymous,is_sso_user,raw_app_meta_data,raw_user_meta_data) values(${id}::uuid,${address},statement_timestamp(),${verified ? new Date() : null},false,false,${db.json({ provider })},'{"legal_name":"PRIVATE","token":"PRIVATE"}')`;
    return { id, email: address };
  };
  const job = async (id: string) =>
    (
      await db`select * from app.verification_emails where auth_user_id=${id}::uuid`
    )[0];
  const isolate = () =>
    db`update app.verification_emails set state='suppressed',lease_id=null,lease_until=null where state in('queued','claimed','sending')`;
  const claim = async (n = 1) =>
    (await worker`select app.claim_verification_emails(${n}) result`)[0]
      .result as { id: string; leaseId: string }[];
  const prepare = async (c: { id: string; leaseId: string }) =>
    (
      await worker`select app.prepare_verification_email(${c.id}::uuid,${c.leaseId}::uuid) result`
    )[0].result;
  const finish = async (c: { id: string; leaseId: string }, state: string) =>
    (
      await worker`select app.finish_verification_email(${c.id}::uuid,${c.leaseId}::uuid,${state},'scratch-receipt') result`
    )[0].result;
  const member = async (name: string, legacy = false): Promise<Actor> => {
    const a = await create(true);
    const [p] = legacy
      ? await db`select * from app.enroll_application_identity(${a.id}::uuid,${name})`
      : await db`select * from app.enroll_application_identity(${a.id}::uuid,${name},${name},${"v_" + a.id.replaceAll("-", "").slice(0, 14)})`;
    return {
      auth: a.id,
      profile: p.identity_profile_id,
      run: p.identity_run_id,
    };
  };
  const as = <T>(a: Actor, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    db.begin(async (tx) => {
      await tx`set local role app_runtime`;
      await tx`select set_config('app.current_auth_user_id',${a.auth},true),set_config('app.current_profile_id',${a.profile},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
      return fn(tx);
    }) as Promise<T>;
  const users = async (
    a: Actor,
    status = "all",
    q = "",
    before: { at: string; id: string } | null = null,
  ) =>
    (
      await as(
        a,
        (tx) =>
          tx`select app.staff_registration_accounts(${status},${q},${before?.at ?? null}::timestamptz,${before?.id ?? null}::uuid) result`,
      )
    )[0].result;
  try {
    await t.test(
      "unconfirmed signup alerts once, first verification alerts separately, updates and repeated proof stay quiet",
      async () => {
        const a = await create();
        assert.equal(await job(a.id), undefined);
        const [signup] =
          await db`select * from app.registration_emails where auth_user_id=${a.id}::uuid`;
        assert.ok(signup);
        await db`update auth.users set email_confirmed_at=statement_timestamp() where id=${a.id}::uuid`;
        const first = await job(a.id);
        assert.ok(first);
        assert.equal(first.verified_email, a.email);
        assert.notEqual(first.id, signup.id);
        for (let i = 0; i < 2; i++)
          await db`update auth.users set email_confirmed_at=statement_timestamp(),last_sign_in_at=statement_timestamp() where id=${a.id}::uuid`;
        await db`update auth.users set email=${`changed-${a.email}`} where id=${a.id}::uuid`;
        await db`update auth.users set email_confirmed_at=null where id=${a.id}::uuid`;
        await db`update auth.users set email_confirmed_at=statement_timestamp() where id=${a.id}::uuid`;
        assert.deepEqual(await job(a.id), first);
        assert.doesNotMatch(JSON.stringify(first), /PRIVATE/);
        const g = await create(true, "google");
        assert.ok(await job(g.id));
        assert.equal((await job(g.id)).provider, "google");
        assert.equal(
          Number(
            (
              await db`select count(*) n from app.registration_emails where auth_user_id=${g.id}::uuid`
            )[0].n,
          ),
          1,
        );
      },
    );
    await t.test(
      "verification rollback and concurrent confirmation preserve a single committed event",
      async () => {
        const a = await create();
        await assert.rejects(
          db.begin(async (tx) => {
            await tx`update auth.users set email_confirmed_at=statement_timestamp() where id=${a.id}::uuid`;
            throw Error("rollback verification");
          }),
          /rollback verification/,
        );
        assert.equal(await job(a.id), undefined);
        await Promise.all(
          [1, 2].map(
            () =>
              db`update auth.users set email_confirmed_at=statement_timestamp() where id=${a.id}::uuid`,
          ),
        );
        assert.ok(await job(a.id));
        assert.equal(
          Number(
            (
              await db`select count(*) n from app.verification_emails where auth_user_id=${a.id}::uuid`
            )[0].n,
          ),
          1,
        );
      },
    );
    await t.test(
      "old workers leave verification queued and the new restricted repository prepares the separate payload",
      async () => {
        await isolate();
        const a = await create(true);
        await withNotificationWorker(
          process.env.NOTIFICATION_TEST_DATABASE_URL,
          async (repo) => {
            assert.ok(
              (await repo.claim()).every((c) => c.kind !== "verification"),
            );
          },
          6,
        );
        assert.equal((await job(a.id)).state, "queued");
        await withNotificationWorker(
          process.env.NOTIFICATION_TEST_DATABASE_URL,
          async (repo) => {
            const claims = await repo.claim(),
              c = claims.find((c) => c.kind === "verification");
            assert.ok(c);
            assert.equal(claims[0].kind, "verification");
            assert.ok(claims.length <= 7);
            const p = await repo.prepare(c);
            assert.ok(p && "kind" in p && p.kind === "verification");
            assert.equal(p.email, "hello@movx.club");
            assert.equal(p.verifiedEmail, a.email);
            assert.equal(
              await repo.finish(c, {
                status: "accepted",
                providerId: "scratch-verification",
              }),
              true,
            );
          },
          7,
        );
      },
    );
    await t.test(
      "claims are disjoint, stale leases fail, retries back off and uncertain handoffs remain Unknown",
      async () => {
        await isolate();
        for (let i = 0; i < 4; i++) await create(true);
        const [a, b] = await Promise.all([claim(2), claim(2)]);
        assert.equal(new Set([...a, ...b].map((c) => c.id)).size, 4);
        const c = a[0];
        assert.equal(await prepare({ ...c, leaseId: randomUUID() }), null);
        await prepare(c);
        assert.equal(
          await finish({ ...c, leaseId: randomUUID() }, "accepted"),
          false,
        );
        assert.equal(await finish(c, "retry"), true);
        assert.deepEqual(await claim(), []);
        await db`update app.verification_emails set due_at=statement_timestamp()-interval '1 second' where id=${c.id}::uuid`;
        const [again] = await claim();
        await prepare(again);
        assert.equal(await finish(c, "accepted"), false);
        await db`update app.verification_emails set lease_until=statement_timestamp()-interval '1 second' where id=${c.id}::uuid`;
        assert.deepEqual(await claim(), []);
        assert.equal(
          (
            await db`select state from app.verification_emails where id=${c.id}::uuid`
          )[0].state,
          "unknown",
        );
        assert.equal(await finish(again, "retry"), false);
        await db`update app.verification_emails set attempts=5,lease_until=statement_timestamp()-interval '1 second' where id=${b[0].id}::uuid`;
        await claim();
        assert.equal(
          (
            await db`select state from app.verification_emails where id=${b[0].id}::uuid`
          )[0].state,
          "failed",
        );
      },
    );
    await t.test(
      "source deletion, ban, removed verification and a changed address suppress pending mail",
      async () => {
        for (const change of ["delete", "ban", "unverify", "email"]) {
          await isolate();
          const a = await create(true),
            [c] = await claim();
          if (change === "delete")
            await db`delete from auth.users where id=${a.id}::uuid`;
          if (change === "ban")
            await db`update auth.users set banned_until=statement_timestamp()+interval '1 day' where id=${a.id}::uuid`;
          if (change === "unverify")
            await db`update auth.users set email_confirmed_at=null where id=${a.id}::uuid`;
          if (change === "email")
            await db`update auth.users set email=${`changed-${a.email}`} where id=${a.id}::uuid`;
          assert.equal(await prepare(c), null);
          assert.equal((await job(a.id)).state, "suppressed");
        }
      },
    );
    await t.test(
      "worker/browser/runtime roles cannot read staff queues or private lookup helpers",
      async () => {
        for (const role of [
          "anon",
          "authenticated",
          "service_role",
          "app_runtime",
          "app_notification_worker",
        ]) {
          assert.equal(
            (
              await db`select has_table_privilege(${role},'app.verification_emails','SELECT,INSERT,UPDATE,DELETE') allowed`
            )[0].allowed,
            false,
          );
          assert.equal(
            (
              await db`select has_function_privilege(${role},'app.verification_email_account_eligible(uuid)','EXECUTE') allowed`
            )[0].allowed,
            false,
          );
        }
        for (const role of [
          "anon",
          "authenticated",
          "service_role",
          "app_notification_worker",
          "app_media_worker",
        ])
          assert.equal(
            (
              await db`select has_function_privilege(${role},'app.staff_registration_accounts(text,text,timestamptz,uuid)','EXECUTE') allowed`
            )[0].allowed,
            false,
          );
        await assert.rejects(worker`select * from auth.users`);
        await assert.rejects(worker`select * from app.verification_emails`);
        for (const n of [0, 21]) await assert.rejects(claim(n));
        for (const n of [6, 21])
          await assert.rejects(
            worker`select app.claim_notification_emails_v7(${n})`,
          );
      },
    );
    const staff = await member("Monitoring staff"),
      ordinary = await member("Ordinary member");
    await db`select app.set_platform_staff(${staff.profile}::uuid,${staff.run}::uuid,0,'active','Assign isolated monitoring fixture','fixture-operator')`;
    await t.test(
      "only verified current active staff can read users; unenrolled and incomplete accounts are visible without private extras",
      async () => {
        const a = await create(
          false,
          "email",
          `directory-${randomUUID()}@example.test`,
        );
        const result = await users(staff, "unverified", a.email);
        assert.equal(result.items.length, 1);
        const item = result.items[0];
        assert.equal(item.email, a.email);
        assert.equal(item.verifiedAt, null);
        assert.equal(item.profileComplete, false);
        assert.equal(item.displayName, null);
        assert.equal(item.signupStatus, "queued");
        assert.equal(item.verificationStatus, null);
        assert.doesNotMatch(
          JSON.stringify(item),
          /PRIVATE|password|token|legal_name|birthdate|phone/i,
        );
        await assert.rejects(users(ordinary));
        await assert.rejects(users({ ...staff, auth: ordinary.auth }));
        const before = (
          await db`select md5(jsonb_agg(to_jsonb(j) order by id)::text) h from app.registration_emails j`
        )[0].h;
        await users(staff, "all", a.email);
        assert.equal(
          (
            await db`select md5(jsonb_agg(to_jsonb(j) order by id)::text) h from app.registration_emails j`
          )[0].h,
          before,
        );
        await db`update auth.users set email_confirmed_at=statement_timestamp() where id=${a.id}::uuid`;
        const verified = await users(staff, "verified", a.email);
        assert.equal(verified.items.length, 1);
        assert.ok(verified.items[0].verifiedAt);
        assert.equal(verified.items[0].verificationStatus, "queued");
        assert.equal(
          (await users(staff, "unverified", a.email)).items.length,
          0,
        );
      },
    );
    await t.test(
      "bounded search and stable timestamp-tied paging do not lose or duplicate accounts",
      async () => {
        const key = `page-${randomUUID()}`;
        for (let i = 0; i < 25; i++) {
          const a = await create(false, "email", `${key}-${i}@example.test`);
          await db`update auth.users set created_at='2026-11-01T10:00:00Z' where id=${a.id}::uuid`;
        }
        const first = await users(staff, "all", key);
        assert.equal(first.items.length, 20);
        assert.equal(first.hasMore, true);
        const last = first.items.at(-1),
          second = await users(staff, "all", key, {
            at: last.sortAt,
            id: last.authUserId,
          });
        assert.equal(second.items.length, 5);
        assert.equal(second.hasMore, false);
        assert.equal(
          new Set(
            [...first.items, ...second.items].map(
              (i: { authUserId: string }) => i.authUserId,
            ),
          ).size,
          25,
        );
        const literal = await create(
          false,
          "email",
          `literal%_${randomUUID()}@example.test`,
        );
        assert.equal(
          (await users(staff, "all", "literal%_")).items[0].email,
          literal.email,
        );
        await assert.rejects(users(staff, "invalid"));
        await assert.rejects(users(staff, "all", "x".repeat(255)));
        await assert.rejects(users(staff, "all", "bad\nquery"));
      },
    );
    await t.test(
      "revoked membership, cross-dataset records and revoked staff lose directory access",
      async () => {
        const other = await member("Revoked target", true);
        const [u] =
          await db`select email from auth.users where id=${other.auth}::uuid`;
        await db`update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp() where profile_id=${other.profile}::uuid`;
        assert.equal((await users(staff, "all", u.email)).items.length, 0);
        // A valid profile belonging only to another dataset cannot pass the explicit target boundary.
        await db`update app.demo_run_participants set status='active',revoked_at=null where profile_id=${other.profile}::uuid`;
        const foreign = randomUUID();
        await db`insert into app.demo_runs(id,slug,name,status,catalogue_visibility,schedule_anchor_date,starts_at,ends_at) select ${foreign}::uuid,${"foreign-" + foreign},'Foreign scratch dataset','prepared','private',schedule_anchor_date,starts_at,ends_at from app.demo_runs where id=${staff.run}::uuid`;
        await db`update app.demo_run_participants set run_id=${foreign}::uuid where profile_id=${other.profile}::uuid`;
        assert.equal((await users(staff, "all", u.email)).items.length, 0);
        await db`select app.set_platform_staff(${staff.profile}::uuid,${staff.run}::uuid,1,'revoked','Revoke isolated monitoring fixture','fixture-operator')`;
        await assert.rejects(users(staff));
      },
    );
  } finally {
    await worker.end({ timeout: 1 });
    await db.end({ timeout: 1 });
  }
});
