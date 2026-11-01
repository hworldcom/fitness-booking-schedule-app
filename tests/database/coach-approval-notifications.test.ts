import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { withNotificationWorker } from "@/server/db/notifications/worker";

autoTarget();

function autoTarget() {
  if (
    !process.env.DATABASE_TEST_URL ||
    !/^\/mov146_[a-f0-9]+_(fresh|upgrade|release_upgrade)$/.test(
      new URL(process.env.DATABASE_TEST_URL).pathname,
    )
  )
    throw Error("Use the isolated MOV-146 rehearsal.");
}
type Actor = { auth: string; profile: string; run: string };
test("approval capture, recipient privacy, versioning and durable delivery", async (t) => {
  const worker = postgres(process.env.NOTIFICATION_TEST_DATABASE_URL!, {
    max: 4,
    prepare: false,
    onnotice: () => {},
  });
  const admin = postgres(process.env.DATABASE_TEST_URL!, {
    max: 4,
    prepare: false,
    onnotice: () => {},
  });
  const url = new URL(process.env.DATABASE_TEST_URL!);
  url.username = "repx_runtime_login";
  url.password = "postgres";
  const runtime = postgres(url.toString(), {
    max: 4,
    prepare: false,
    onnotice: () => {},
  });
  const work = async <T>(
    a: Actor,
    fn: (tx: postgres.TransactionSql) => Promise<T>,
  ): Promise<T> =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_auth_user_id',${a.auth},true),set_config('app.current_profile_id',${a.profile},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
      return fn(tx);
    }) as Promise<T>;
  const enroll = async (name: string): Promise<Actor> => {
    const auth = randomUUID();
    await admin`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${auth},${`mov144-${auth}@example.test`},statement_timestamp(),false,false)`;
    const [r] =
      await admin`select * from app.enroll_application_identity(${auth}::uuid,${name},${name},${"qa_" + auth.replaceAll("-", "").slice(0, 12)})`;
    return { auth, profile: r.identity_profile_id, run: r.identity_run_id };
  };
  const apply = async (a: Actor) =>
    work(a, async (tx) => {
      await tx`select app.submit_owned_coach_application()`;
      await tx`select app.save_owned_coach_application_contact(0,'{"phoneNumber":"+4915123456789","instagramUrl":"https://instagram.com/_real__h","facebookUrl":null,"linkedinUrl":null}'::jsonb)`;
      await tx`select app.upsert_owned_coach_profile('QA applicant','Supportive strength and boxing coaching, with clear feedback and a practical approach to each individual goal.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
    });
  const deny = (e: unknown) =>
    e instanceof postgres.PostgresError && e.code === "42501";
  const approve = async (a: Actor) =>
    admin`select app.review_coach_application(${a.profile}::uuid,'pending','approved','Identity and completed application reviewed','fixture-operator','movx-identity-application-v1')`;
  const notice = async (a: Actor) =>
    (
      await admin`select * from app.coach_approval_notifications where profile_id=${a.profile}::uuid`
    )[0];
  const command = async (
    a: Actor,
    action: string,
    args: Record<string, unknown> = {},
    version = 4,
  ) =>
    work(a, (tx) =>
      tx.unsafe(
        `select app.notification_command${version === 1 ? "" : "_v" + version}($1::text,$2::text::jsonb) value`,
        [action, JSON.stringify(args)],
      ),
    );
  const claim = async () =>
    (await worker`select app.claim_coach_approval_emails(20) value`)[0].value;
  try {
    const coach = await enroll("QA approved coach"),
      other = await enroll("QA other member");
    await apply(coach);
    await t.test(
      "approval event and one receipt commit together; retries and rollbacks create no extras",
      async () => {
        await assert.rejects(
          admin.begin(async (tx) => {
            await tx`select app.review_coach_application(${coach.profile}::uuid,'pending','approved','Identity and completed application reviewed','fixture-operator','movx-identity-application-v1')`;
            throw Error("fixture rollback");
          }),
          /fixture rollback/,
        );
        assert.equal(await notice(coach), undefined);
        for (let i = 0; i < 2; i++) await approve(coach);
        assert.equal(
          Number(
            (
              await admin`select count(*) n from app.coach_approval_notifications where profile_id=${coach.profile}::uuid`
            )[0].n,
          ),
          1,
        );
        assert.equal((await notice(coach)).state, "queued");
        assert.equal(
          (
            await admin`select visibility from app.coach_profiles where profile_id=${coach.profile}::uuid`
          )[0].visibility,
          "hidden",
        );
      },
    );
    await t.test(
      "recipient-only v4 list, old versions leave approval unread, no private review leak",
      async () => {
        const j = await notice(coach);
        for (const version of [1, 2, 3]) {
          const snapshot = (await command(coach, "list", {}, version))[0].value;
          assert.equal(
            snapshot.items.some((x: { id: string }) => x.id === j.id),
            false,
          );
          await command(
            coach,
            "read-all",
            { throughAt: snapshot.snapshotAt },
            version,
          );
          await assert.rejects(command(coach, "read", { id: j.id }, version));
        }
        assert.equal((await notice(coach)).read_at, null);
        const page = (await command(coach, "list"))[0].value;
        const item = page.items.find((x: { id: string }) => x.id === j.id);
        assert.equal(item.kind, "coach-approval");
        assert.equal(item.event, "approved");
        assert.equal(page.unreadCount, 1);
        for (const field of [
          "reason",
          "reviewerReference",
          "email",
          "phoneNumber",
          "contact",
          "reviewEventId",
          "profileId",
        ])
          assert.equal(field in item, false, field);
        assert.equal(
          (await command(other, "list"))[0].value.items.some(
            (x: { id: string }) => x.id === j.id,
          ),
          false,
        );
        await assert.rejects(command(other, "read", { id: j.id }));
        assert.equal((await notice(coach)).read_at, null);
        await assert.rejects(
          work(
            coach,
            (tx) => tx`select * from app.coach_approval_notifications`,
          ),
          deny,
        );
        await assert.rejects(command({ ...coach, auth: other.auth }, "list"));
        await command(coach, "read", { id: j.id });
        assert.ok((await notice(coach)).read_at);
        assert.equal((await notice(coach)).state, "queued");
      },
    );
    await t.test(
      "old workers leave new jobs queued; latest restricted repository claims and fences leases",
      async () => {
        await withNotificationWorker(
          process.env.NOTIFICATION_TEST_DATABASE_URL,
          async (repo) => {
            const claims = await repo.claim();
            assert.ok(claims.every((x) => x.kind !== "coach-approval"));
          },
          4,
        );
        assert.equal((await notice(coach)).state, "queued");
        await withNotificationWorker(
          process.env.NOTIFICATION_TEST_DATABASE_URL,
          async (repo) => {
            const claims = await repo.claim(),
              j = await notice(coach);
            const c = claims.find((x) => x.id === j.id);
            assert.ok(c);
            assert.equal(c.kind, "coach-approval");
            assert.equal(
              await repo.prepare({ ...c, leaseId: randomUUID() }),
              null,
            );
            const payload = await repo.prepare(c);
            assert.ok(
              payload && "kind" in payload && payload.kind === "coach-approval",
            );
            assert.match(payload.email, /@example.test$/);
            assert.equal(payload.id, j.id);
            assert.equal("reason" in payload, false);
            assert.equal(
              await repo.finish(
                { ...c, leaseId: randomUUID() },
                { status: "accepted", providerId: "wrong" },
              ),
              false,
            );
            assert.equal(await repo.finish(c, { status: "retry" }), true);
            assert.equal(
              await repo.finish(c, { status: "accepted", providerId: "stale" }),
              false,
            );
          },
          5,
        );
        const j = await notice(coach);
        assert.equal(j.state, "queued");
        assert.equal(j.attempts, 1);
        assert.ok(new Date(j.due_at).getTime() > Date.now());
        await assert.rejects(
          worker`select * from app.coach_approval_notifications`,
          deny,
        );
        await assert.rejects(
          worker`select app.coach_approval_recipient_email(${j.id}::uuid)`,
          deny,
        );
        await assert.rejects(
          work(coach, (tx) => tx`select app.claim_coach_approval_emails(1)`),
          deny,
        );
      },
    );
    await t.test(
      "concurrent claims are disjoint, accepted sends are terminal, reads do not suppress email",
      async () => {
        const second = await enroll("QA second approval");
        await apply(second);
        await approve(second);
        await admin`update app.coach_approval_notifications set due_at=statement_timestamp() where profile_id=${coach.profile}::uuid`;
        const [left, right] = await Promise.all([claim(), claim()]);
        const claims = [...left, ...right];
        assert.equal(
          new Set(claims.map((x: { id: string }) => x.id)).size,
          claims.length,
        );
        assert.equal(claims.length, 2);
        const j = await notice(coach),
          c = claims.find((x: { id: string }) => x.id === j.id);
        assert.ok(c);
        assert.ok(
          (
            await worker`select app.prepare_coach_approval_email(${c.id}::uuid,${c.leaseId}::uuid) value`
          )[0].value,
        );
        assert.equal(
          (
            await worker`select app.finish_coach_approval_email(${c.id}::uuid,${c.leaseId}::uuid,'accepted','qa-provider-id') value`
          )[0].value,
          true,
        );
        assert.equal((await notice(coach)).state, "accepted");
        assert.equal((await notice(coach)).attempts, 2);
        await admin`update app.coach_approval_notifications set lease_until=statement_timestamp()-interval '1 second' where profile_id=${second.profile}::uuid`;
        const secondJob = await notice(second);
        const reclaimed = await claim();
        assert.equal(reclaimed.length, 1);
        assert.notEqual(
          reclaimed[0].leaseId,
          claims.find((x: { id: string }) => x.id === secondJob.id)?.leaseId,
        );
      },
    );
    await t.test(
      "a possible provider handoff becomes Unknown and is never blindly reclaimed",
      async () => {
        const a = await enroll("QA ambiguous approval");
        await apply(a);
        await approve(a);
        const j = await notice(a),
          c = (await claim()).find((x: { id: string }) => x.id === j.id);
        assert.ok(c);
        await worker`select app.prepare_coach_approval_email(${c.id}::uuid,${c.leaseId}::uuid)`;
        await admin`update app.coach_approval_notifications set lease_until=statement_timestamp()-interval '1 second' where id=${j.id}`;
        assert.equal(
          (await claim()).some((x: { id: string }) => x.id === j.id),
          false,
        );
        assert.equal((await notice(a)).state, "unknown");
        assert.equal(
          (
            await worker`select app.finish_coach_approval_email(${c.id}::uuid,${c.leaseId}::uuid,'accepted','late-result') value`
          )[0].value,
          false,
        );
        assert.equal(
          (await claim()).some((x: { id: string }) => x.id === j.id),
          false,
        );
      },
    );
    await t.test(
      "suspension suppresses unsent mail but keeps truthful recipient history; no rejection/suspension notices",
      async () => {
        const a = await enroll("QA suspended approval");
        await apply(a);
        await approve(a);
        const j = await notice(a);
        await admin`select app.review_coach_application(${a.profile}::uuid,'approved','suspended','Access suspended after review','fixture-operator','movx-identity-application-v1')`;
        const c = (await claim()).find((x: { id: string }) => x.id === j.id);
        assert.ok(c);
        assert.equal(
          (
            await worker`select app.prepare_coach_approval_email(${c.id}::uuid,${c.leaseId}::uuid) value`
          )[0].value,
          null,
        );
        assert.equal((await notice(a)).state, "suppressed");
        assert.equal(
          (await command(a, "list"))[0].value.items.filter(
            (x: { kind: string }) => x.kind === "coach-approval",
          ).length,
          1,
        );
        const b = await enroll("QA rejected applicant");
        await apply(b);
        await admin`select app.review_coach_application(${b.profile}::uuid,'pending','rejected','Please clarify the submitted application','fixture-operator','movx-identity-application-v1')`;
        assert.equal(await notice(b), undefined);
      },
    );
    await t.test(
      "fifth pre-send crash is terminal, deactivated/unverified recipients cannot send or read",
      async () => {
        const a = await enroll("QA expired approval");
        await apply(a);
        await approve(a);
        const j = await notice(a);
        await admin`update app.coach_approval_notifications set state='claimed',attempts=5,lease_id=gen_random_uuid(),lease_until=statement_timestamp()-interval '1 second' where id=${j.id}`;
        await claim();
        assert.equal((await notice(a)).state, "failed");
        const b = await enroll("QA unverified approval");
        await apply(b);
        await approve(b);
        const k = await notice(b);
        await admin`update auth.users set email_confirmed_at=null where id=${b.auth}`;
        await assert.rejects(command(b, "list"), deny);
        const c = (await claim()).find((x: { id: string }) => x.id === k.id);
        assert.ok(c);
        assert.equal(
          (
            await worker`select app.prepare_coach_approval_email(${c.id}::uuid,${c.leaseId}::uuid) value`
          )[0].value,
          null,
        );
      },
    );
  } finally {
    await worker.end();
    await runtime.end();
    await admin.end();
  }
});
