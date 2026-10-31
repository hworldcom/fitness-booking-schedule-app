import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { execFileSync } from "node:child_process";

autoTarget();
function autoTarget() {
  if (
    !process.env.DATABASE_TEST_URL ||
    !/^\/mov144_[a-f0-9]+_(fresh|upgrade|release_upgrade)$/.test(
      new URL(process.env.DATABASE_TEST_URL).pathname,
    )
  )
    throw Error("Use the isolated MOV-144 rehearsal.");
}
type Actor = { auth: string; profile: string; run: string };
test("staff review authority, lifecycle, stale fencing and recovery", async (t) => {
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
  const detail = async (a: Actor, p: Actor) =>
    (
      await work(
        a,
        (tx) =>
          tx`select app.staff_coach_review_detail(${p.profile}::uuid) value`,
      )
    )[0].value;
  const decide = async (
    a: Actor,
    p: Actor,
    d: Record<string, unknown>,
    decision = "approved",
    command = randomUUID(),
    reason = "Identity and completed application reviewed",
  ) =>
    (
      await work(
        a,
        (tx) =>
          tx`select app.staff_review_coach_application(${p.profile}::uuid,${Number(d.revision)},${String(d.reviewToken)},${decision},${reason},${command}::uuid) value`,
      )
    )[0].value;
  const deny = (error: unknown) =>
    error instanceof postgres.PostgresError && error.code === "42501";
  const conflict = (error: unknown) =>
    error instanceof postgres.PostgresError && error.code === "40001";
  try {
    const staff = await enroll("QA reviewer"),
      other = await enroll("QA member"),
      coach = await enroll("QA applicant");
    await apply(coach);
    await t.test(
      "no self-assignment, owner function or raw private data grants",
      async () => {
        await assert.rejects(
          work(other, (tx) => tx`select app.current_platform_staff()`),
          deny,
        );
        for (const query of [
          "select * from app.platform_staff",
          "select * from app.platform_staff_events",
          "select * from app.staff_coach_review_commands",
          "select * from app.coach_application_contacts",
          "select * from auth.users",
          "select app.set_platform_staff(null,null,0,'active','invalid assignment','test')",
          "select app.apply_coach_application_review(null,null,null,null,null,null,null)",
          "select app.review_coach_application(null,null,null,null,null,null)",
          "select app.staff_applicant_email(null)",
        ])
          await assert.rejects(
            work(other, (tx) => tx.unsafe(query)),
            deny,
          );
        await assert.rejects(
          work(other, async (tx) => {
            await tx`select set_config('app.platform_staff_read','on',true)`;
            return tx`select app.staff_coach_review_detail(${coach.profile}::uuid)`;
          }),
          deny,
        );
      },
    );
    await t.test(
      "owner assignment requires current revision and records one immutable exact retry",
      async () => {
        assert.equal(
          (
            await admin`select app.set_platform_staff(${staff.profile}::uuid,${staff.run}::uuid,0,'active','Approved QA staff access','fixture-operator') revision`
          )[0].revision,
          1,
        );
        assert.equal(
          (
            await admin`select app.set_platform_staff(${staff.profile}::uuid,${staff.run}::uuid,0,'active','Approved QA staff access','fixture-operator') revision`
          )[0].revision,
          1,
        );
        await assert.rejects(
          admin`select app.set_platform_staff(${staff.profile}::uuid,${staff.run}::uuid,0,'revoked','Revoking QA staff access','fixture-operator')`,
          conflict,
        );
        assert.equal(
          Number(
            (
              await admin`select count(*) n from app.platform_staff_events where profile_id=${staff.profile}`
            )[0].n,
          ),
          1,
        );
        await assert.rejects(
          admin`update app.platform_staff_events set reason='Rewritten audit reason' where profile_id=${staff.profile}`,
          /immutable/,
        );
      },
    );
    await t.test(
      "bounded staff queue/detail, verified email/private contacts and stable token",
      async () => {
        const queue = (
          await work(
            staff,
            (tx) => tx`select app.staff_coach_review_queue() value`,
          )
        )[0].value;
        assert.ok(
          queue.items.some(
            (r: { profileId: string }) => r.profileId === coach.profile,
          ),
        );
        assert.ok(queue.items.length <= 20);
        const d = await detail(staff, coach);
        assert.equal(d.contact.instagramUrl, "https://instagram.com/_real__h");
        assert.match(d.email, /@example.test$/);
        assert.equal(d.status, "pending");
        assert.equal(d.isSelf, false);
        assert.deepEqual(d.disciplines, ["Boxing"]);
        assert.deepEqual(await detail(staff, coach), d);
        await assert.rejects(detail(other, coach), deny);
        await assert.rejects(
          detail({ ...staff, auth: other.auth }, coach),
          deny,
        );
        await assert.rejects(
          detail({ ...staff, run: randomUUID() }, coach),
          deny,
        );
      },
    );
    let original: Record<string, unknown>;
    await t.test(
      "owner edit fences the previous detail even without an application revision change",
      async () => {
        original = await detail(staff, coach);
        await work(
          coach,
          (tx) =>
            tx`select app.save_owned_coach_application_contact(1,'{"phoneNumber":"+4915123456790","instagramUrl":"https://instagram.com/_real__h","facebookUrl":null,"linkedinUrl":null}'::jsonb)`,
        );
        await assert.rejects(decide(staff, coach, original), conflict);
        assert.equal((await detail(staff, coach)).status, "pending");
      },
    );
    let accepted: Record<string, unknown>;
    await t.test(
      "concurrent exact command retries make one decision with a truthful staff identity",
      async () => {
        const d = await detail(staff, coach),
          command = randomUUID();
        const results = await Promise.all([
          decide(staff, coach, d, "approved", command),
          decide(staff, coach, d, "approved", command),
        ]);
        assert.equal(results.filter((r) => r.replayed === false).length, 1);
        assert.equal(results.filter((r) => r.replayed === true).length, 1);
        accepted = results[0];
        const after = await detail(staff, coach);
        assert.equal(after.status, "approved");
        assert.equal(after.visibility, "hidden");
        assert.equal(
          after.history[0].reviewerReference,
          `staff:${staff.profile}`,
        );
        assert.equal(after.history[0].reviewSource, "staff-panel");
        assert.equal(after.history.length, 1);
        assert.equal(
          (await decide(staff, coach, d, "approved", command)).reviewEventId,
          accepted.reviewEventId,
        );
        await assert.rejects(
          decide(staff, coach, d, "rejected", command),
          conflict,
        );
        await assert.rejects(decide(staff, coach, d, "approved"), conflict);
        await assert.rejects(
          admin`update app.staff_coach_review_commands set decision='rejected' where application_profile_id=${coach.profile}`,
          /immutable/,
        );
      },
    );
    await t.test(
      "suspension preserves review history and the existing publication boundary",
      async () => {
        const d = await detail(staff, coach);
        await decide(staff, coach, d, "suspended");
        const after = await detail(staff, coach);
        assert.equal(after.status, "suspended");
        assert.equal(after.visibility, "hidden");
        assert.equal(after.history.length, 2);
      },
    );
    await t.test(
      "staff cannot review themselves; rejection and changed resubmission fence old review",
      async () => {
        await apply(staff);
        const own = await detail(staff, staff);
        assert.equal(own.isSelf, true);
        await assert.rejects(
          decide(staff, staff, own),
          /staff review is invalid/,
        );
        const rejected = await enroll("QA resubmission");
        await apply(rejected);
        const old = await detail(staff, rejected);
        await decide(staff, rejected, old, "rejected");
        await work(
          rejected,
          (tx) => tx`select app.submit_owned_coach_application()`,
        );
        const fresh = await detail(staff, rejected);
        assert.equal(fresh.revision, Number(old.revision) + 1);
        await assert.rejects(decide(staff, rejected, old), conflict);
        await decide(staff, rejected, fresh);
      },
    );
    await t.test(
      "owner review CLI contract remains private, audited and idempotent",
      async () => {
        const a = await enroll("QA owner reviewed");
        await apply(a);
        for (let i = 0; i < 2; i++)
          assert.equal(
            (
              await admin`select app.review_coach_application(${a.profile}::uuid,'pending','approved','Identity and completed application reviewed','owner-qa','movx-identity-application-v1') value`
            )[0].value,
            "approved",
          );
        assert.equal(
          (await detail(staff, a)).history[0].reviewSource,
          "owner-command",
        );
        assert.equal((await detail(staff, a)).history.length, 1);
      },
    );
    await t.test(
      "queue is bounded and keyset pagination does not duplicate applications",
      async () => {
        for (let i = 0; i < 21; i++) {
          const a = await enroll(`QA queue ${i}`);
          await apply(a);
        }
        const first = (
          await work(
            staff,
            (tx) => tx`select app.staff_coach_review_queue() value`,
          )
        )[0].value;
        assert.equal(first.items.length, 20);
        assert.equal(first.hasMore, true);
        const last = first.items.at(-1);
        const second = (
          await work(
            staff,
            (tx) =>
              tx`select app.staff_coach_review_queue('pending',${last.submittedAt}::timestamptz,${last.profileId}::uuid) value`,
          )
        )[0].value;
        assert.ok(second.items.length > 0);
        assert.equal(
          second.items.some((x: { profileId: string }) =>
            first.items.some(
              (y: { profileId: string }) => x.profileId === y.profileId,
            ),
          ),
          false,
        );
      },
    );
    await t.test(
      "competing decisions have one winner; revocation waits for an already-authorized review transaction",
      async () => {
        const a = await enroll("QA competing decisions");
        await apply(a);
        const d = await detail(staff, a);
        const results = await Promise.allSettled([
          decide(staff, a, d, "approved"),
          decide(staff, a, d, "rejected"),
        ]);
        assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
        assert.equal((await detail(staff, a)).history.length, 1);
        let unblock!: () => void, locked!: () => void;
        const gate = new Promise<void>((r) => (unblock = r)),
          ready = new Promise<void>((r) => (locked = r));
        const held = work(staff, async (tx) => {
          await tx`select app.current_platform_staff()`;
          locked();
          await gate;
        });
        await ready;
        let finished = false;
        const revoke =
          admin`select app.set_platform_staff(${staff.profile}::uuid,${staff.run}::uuid,1,'revoked','Serializing staff revocation','fixture-operator')`.then(
            () => {
              finished = true;
            },
          );
        await new Promise((r) => setTimeout(r, 100));
        assert.equal(finished, false);
        unblock();
        await held;
        await revoke;
        await assert.rejects(detail(staff, a), deny);
        await admin`select app.set_platform_staff(${staff.profile}::uuid,${staff.run}::uuid,2,'active','Restore fixture staff access','fixture-operator')`;
      },
    );
    await t.test(
      "operator CLI defaults to dry-run and fences exact target/account/dataset/status/revision",
      async () => {
        const targetUrl = new URL(process.env.DATABASE_TEST_URL!);
        const args = [
          "scripts/manage-platform-staff.mjs",
          "--target",
          `${targetUrl.hostname}:${targetUrl.port}${targetUrl.pathname}`,
          "--profile-id",
          other.profile,
          "--run-id",
          other.run,
          "--expected-revision",
          "0",
          "--status",
          "active",
          "--reason",
          "Assign CLI fixture staff access",
          "--operator",
          "fixture-operator",
        ];
        const invoke = (
          extra: string[] = [],
          url = process.env.DATABASE_TEST_URL,
        ) =>
          execFileSync(process.execPath, [...args, ...extra], {
            env: { ...process.env, COACH_REVIEW_DATABASE_URL: url },
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
          });
        assert.equal(JSON.parse(invoke()).mode, "dry-run");
        assert.equal(
          Number(
            (
              await admin`select count(*) n from app.platform_staff where profile_id=${other.profile}`
            )[0].n,
          ),
          0,
        );
        assert.throws(() => invoke(["--apply", "--confirm", staff.profile]));
        assert.throws(() => invoke([], runtimeUrlForCli()));
        const confirmation = `${other.profile}:${other.run}:active:0`;
        for (let i = 0; i < 2; i++)
          assert.match(
            invoke(["--apply", "--confirm", confirmation]),
            /"status":"saved","revision":1/,
          );
        assert.equal(
          Number(
            (
              await admin`select count(*) n from app.platform_staff_events where profile_id=${other.profile}`
            )[0].n,
          ),
          1,
        );
        await admin`select app.set_platform_staff(${other.profile}::uuid,${other.run}::uuid,1,'revoked','Revoke CLI fixture staff access','fixture-operator')`;
        function runtimeUrlForCli() {
          const value = new URL(process.env.DATABASE_TEST_URL!);
          value.username = "repx_runtime_login";
          value.password = "postgres";
          return value.href;
        }
      },
    );
    await t.test(
      "revocation, deactivation and unverified Auth fail closed on every access",
      async () => {
        await admin`update auth.users set banned_until=statement_timestamp()+interval '1 day' where id=${staff.auth}`;
        await assert.rejects(detail(staff, coach), deny);
        await admin`update auth.users set banned_until=null,email_confirmed_at=null where id=${staff.auth}`;
        await assert.rejects(detail(staff, coach), deny);
        await admin`update auth.users set email_confirmed_at=statement_timestamp() where id=${staff.auth}`;
        await admin`select app.set_platform_staff(${staff.profile}::uuid,${staff.run}::uuid,3,'revoked','Revoking QA staff access','fixture-operator')`;
        await assert.rejects(detail(staff, coach), deny);
        await assert.rejects(
          work(staff, (tx) => tx`select app.staff_coach_review_queue()`),
          deny,
        );
      },
    );
  } finally {
    await runtime.end();
    await admin.end();
  }
});
