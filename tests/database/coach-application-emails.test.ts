import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { runNotificationWorker } from "@/server/notifications/worker";
import type { CoachApplicationContactDetails } from "@/domain/coach-application-contact";

const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  !/^\/mov108_[a-f0-9]+_(fresh|upgrade)$/.test(new URL(url).pathname) ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw Error("An owned MOV-108 scratch database is required.");

test("transactional coach application staff alerts and restricted delivery", async (t) => {
  const workerUrl = process.env.NOTIFICATION_TEST_WORKER_URL!;
  const runtimeUrl = process.env.NOTIFICATION_TEST_RUNTIME_URL!;
  for (const target of [workerUrl, runtimeUrl]) {
    assert.equal(new URL(target).pathname, new URL(url).pathname);
    assert.equal(new URL(target).host, new URL(url).host);
  }
  const db = postgres(url, { max: 6, prepare: false, onnotice: () => {} });
  const runtime = postgres(runtimeUrl, {
    max: 4,
    prepare: false,
    onnotice: () => {},
  });
  const worker = postgres(workerUrl, {
    max: 2,
    prepare: false,
    onnotice: () => {},
  });
  const captures: string[] = [];
  type Actor = { auth: string; id: string; run: string; email: string };
  const as = <T>(a: Actor, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    runtime.begin(async (tx) => {
      await tx`select set_config('app.current_auth_user_id',${a.auth},true),set_config('app.current_profile_id',${a.id},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
      return fn(tx);
    });
  async function actor() {
    const auth = randomUUID(),
      email = `mov108-${auth}@example.test`;
    await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${auth}::uuid,${email},statement_timestamp(),false,false)`;
    const [p] =
      await db`select * from app.enroll_application_identity(${auth}::uuid,'Application tester')`;
    return {
      auth,
      email,
      id: p.identity_profile_id,
      run: p.identity_run_id,
    } as Actor;
  }
  const intent = (a: Actor) =>
    as(a, async (tx) => tx`select app.submit_owned_coach_application()`);
  const saveIn = (
    tx: postgres.TransactionSql,
    name = "Submitted <Coach> & Team",
  ) =>
    tx`select app.upsert_owned_coach_profile(${name},'A uniquely tagged application submitted for isolated staff notification testing.',array['Boxing'],'Europe/Berlin','hidden','40000000-0000-4000-8000-000000000001'::uuid,null,null,null,null,null)`;
  const contact: CoachApplicationContactDetails = {
    phoneNumber: "+4915123456789",
    instagramUrl: "https://www.instagram.com/movx_test",
    facebookUrl: null,
    linkedinUrl: null,
  };
  const contactIn = async (
    tx: postgres.TransactionSql,
    details = contact,
    revision = 0,
  ) =>
    (
      await tx`select app.save_owned_coach_application_contact(${revision},${tx.json(details)}) revision`
    )[0].revision as number;
  const save = (a: Actor, name?: string) =>
    as(a, async (tx) => {
      await contactIn(tx);
      return saveIn(tx, name);
    });
  const jobs = (a: Actor) =>
    db`select * from app.coach_application_emails where profile_id=${a.id}::uuid order by application_revision`;
  const claim = async () =>
    (await worker`select app.claim_coach_application_emails(20) result`)[0]
      .result as { id: string; leaseId: string }[];
  const prepare = async (j: { id: string; leaseId: string }) =>
    (
      await worker`select app.prepare_coach_application_email(${j.id}::uuid,${j.leaseId}::uuid) result`
    )[0].result;
  const finish = async (
    j: { id: string; leaseId: string },
    outcome = "accepted",
  ) =>
    (
      await worker`select app.finish_coach_application_email(${j.id}::uuid,${j.leaseId}::uuid,${outcome},'fixture-provider') result`
    )[0].result;
  async function submitted() {
    const a = await actor();
    await intent(a);
    await save(a);
    return a;
  }
  let first: Actor;
  try {
    await t.test(
      "pre-contact historical jobs still deliver without invented phone/social data",
      async () => {
        const legacy =
          await db`select * from app.coach_application_emails where contact_details is null and state='queued'`;
        const result = await runNotificationWorker({
          NOTIFICATION_DELIVERY_ENABLED: "true",
          NOTIFICATION_TRANSPORT: "mailpit",
          NOTIFICATION_MAILPIT_URL: "http://127.0.0.1:55324",
          NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
          NOTIFICATION_DATABASE_URL: workerUrl,
        });
        assert.equal(result.accepted, legacy.length);
        for (const job of legacy) {
          const [done] =
            await db`select * from app.coach_application_emails where id=${job.id}::uuid`;
          captures.push(done.provider_id);
          const mail = await (
            await fetch(
              "http://127.0.0.1:55324/api/v1/message/" + done.provider_id,
            )
          ).json();
          assert.deepEqual(
            mail.To.map((x: { Address: string }) => x.Address),
            ["hello@movx.club"],
          );
          assert.equal(mail.Text.includes("Phone number:"), false);
        }
      },
    );
    await t.test(
      "intent, normal edits and concurrent pending retries do not create extra alerts; explicit resubmission does",
      async () => {
        first = await actor();
        await intent(first);
        assert.equal((await jobs(first)).length, 0);
        await as(first, async (tx) => {
          await tx`select set_config('app.coach_application_email_capture','previous-context',true)`;
          await contactIn(tx);
          await saveIn(tx);
          const [state] =
            await tx`select current_setting('app.coach_application_email_capture',true) value`;
          assert.equal(state.value, "previous-context");
        });
        assert.equal((await jobs(first)).length, 1);
        await Promise.all([
          intent(first),
          intent(first),
          save(first, "Edited coach"),
        ]);
        let rows = await jobs(first);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].display_name, "Submitted <Coach> & Team");
        await db`select app.review_coach_application(${first.id}::uuid,'pending','rejected','Provide more detail.','mov108','movx-identity-application-v1')`;
        await Promise.all([intent(first), intent(first)]);
        rows = await jobs(first);
        assert.equal(rows.length, 2);
        assert.deepEqual(
          rows.map((r) => r.application_revision),
          [1, 2],
        );
        assert.equal(rows[1].display_name, "Edited coach");
        const listed = await as(
          first,
          async (tx) =>
            (
              await tx`select app.notification_command_v3('list','{}') result`
            )[0].result,
        );
        assert.equal(listed.unreadCount, 0);
        assert.deepEqual(listed.items, []);
      },
    );
    await t.test(
      "rolled-back detail submission and invalid actor contexts leave no alert",
      async () => {
        const a = await actor();
        await assert.rejects(
          as(a, async (tx) => {
            await tx`select app.submit_owned_coach_application()`;
            await contactIn(tx);
            await saveIn(tx);
            throw Error("rollback submission");
          }),
          /rollback submission/,
        );
        assert.equal((await jobs(a)).length, 0);
        const [row] =
          await db`select count(*)::int n from app.coach_applications where profile_id=${a.id}::uuid`;
        assert.equal(row.n, 0);
        await assert.rejects(intent({ ...a, id: first.id }));
        await assert.rejects(save(a));
        assert.equal((await jobs(a)).length, 0);
      },
    );
    await t.test(
      "runtime and worker cannot read/write staff queue or resolve arbitrary Auth email; old claims leave staff jobs queued",
      async () => {
        for (const connection of [runtime, worker]) {
          await assert.rejects(
            connection`select * from app.coach_application_emails`,
            /permission denied/,
          );
          await assert.rejects(
            connection`update app.coach_application_emails set state='accepted'`,
            /permission denied/,
          );
          await assert.rejects(
            connection`select app.coach_application_applicant_email(${randomUUID()}::uuid)`,
            /permission denied/,
          );
        }
        await assert.rejects(
          runtime`select app.claim_coach_application_emails(5)`,
          /permission denied/,
        );
        await assert.rejects(
          worker`select email from auth.users`,
          /permission denied/,
        );
        const [legacy] =
          await worker`select app.claim_notification_emails_v3(5) result`;
        assert.deepEqual(legacy.result, []);
        assert.ok((await jobs(first)).every((r) => r.state === "queued"));
        const [flags] =
          await db`select relrowsecurity,relforcerowsecurity from pg_class where oid='app.coach_application_emails'::regclass`;
        assert.equal(flags.relrowsecurity, true);
        assert.equal(flags.relforcerowsecurity, true);
        for (const n of [0, 3, 21])
          await assert.rejects(
            worker`select app.claim_notification_emails_v4(${n})`,
            /invalid notification batch/,
          );
      },
    );
    await t.test(
      "four-kind batch contracts remain bounded and reserve each kind under saturated child queues",
      async () => {
        // Controlled child claimers exercise the real SQL batch coordinator without
        // consuming fixture jobs. All function replacements roll back together.
        await assert.rejects(
          db.begin(async (tx) => {
            await tx.unsafe(`create or replace function app.claim_coach_application_emails(batch_size integer default 10) returns jsonb
          language sql security definer set search_path='' as $$
          select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'leaseId',gen_random_uuid())) from generate_series(1,batch_size) $$`);
            await tx.unsafe(`create or replace function app.claim_notification_emails_v3(batch_size integer default 5) returns jsonb
          language plpgsql security definer set search_path='' as $$ begin
          if batch_size<3 or batch_size>20 then raise exception 'legacy batch out of bounds';end if;
          return (select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'leaseId',gen_random_uuid(),'kind',(array['message','booking','group'])[(n-1)%3+1])) from generate_series(1,batch_size) n);
          end $$`);
            for (let size = 4; size <= 20; size++) {
              const [row] =
                await tx`select app.claim_notification_emails_v4(${size}) result`;
              assert.equal(row.result.length, size);
              assert.deepEqual(
                new Set(row.result.map((j: { kind: string }) => j.kind)),
                new Set(["message", "booking", "group", "coach-application"]),
              );
            }
            throw Error("rollback controlled claimers");
          }),
          /rollback controlled claimers/,
        );
      },
    );
    await t.test(
      "concurrent claims are distinct; foreign/stale leases cannot prepare or finish",
      async () => {
        const sets = await Promise.all([claim(), claim()]);
        const all = sets.flat();
        assert.equal(all.length, 2);
        assert.equal(new Set(all.map((j) => j.id)).size, 2);
        for (const j of all) {
          assert.equal(await prepare({ ...j, leaseId: randomUUID() }), null);
          const payload = await prepare(j);
          assert.equal(payload.email, "hello@movx.club");
          assert.equal(payload.applicantEmail, first.email);
          assert.equal(payload.profileId, first.id);
          assert.equal(await finish({ ...j, leaseId: randomUUID() }), false);
          assert.equal(await finish(j), true);
          assert.equal(await finish(j), false);
        }
      },
    );
    await t.test(
      "rejected handoff backs off; expired possible sends become Unknown and never automatically resend",
      async () => {
        const a = await submitted();
        let [j] = await claim();
        assert.ok(await prepare(j));
        assert.equal(await finish(j, "retry"), true);
        const [r] = await jobs(a);
        assert.equal(r.state, "queued");
        assert.equal(r.attempts, 1);
        assert.ok(new Date(r.due_at) > new Date());
        await db`update app.coach_application_emails set due_at=statement_timestamp()-interval '1 second' where id=${j.id}::uuid`;
        [j] = await claim();
        assert.ok(await prepare(j));
        await db`update app.coach_application_emails set lease_until=statement_timestamp()-interval '1 second' where id=${j.id}::uuid`;
        assert.deepEqual(await claim(), []);
        assert.equal((await jobs(a))[0].state, "unknown");
        assert.equal(await finish(j), false);
      },
    );
    await t.test(
      "expired claims can be reclaimed with a new fence, and the fifth expired claim terminates",
      async () => {
        const a = await submitted();
        const [old] = await claim();
        await db`update app.coach_application_emails set lease_until=statement_timestamp()-interval '1 second' where id=${old.id}::uuid`;
        const [next] = await claim();
        assert.equal(next.id, old.id);
        assert.notEqual(next.leaseId, old.leaseId);
        assert.equal(await prepare(old), null);
        await db`update app.coach_application_emails set attempts=5,lease_until=statement_timestamp()-interval '1 second' where id=${next.id}::uuid`;
        assert.deepEqual(await claim(), []);
        assert.equal((await jobs(a))[0].state, "failed");
      },
    );
    await t.test(
      "revoked, banned and unverified applicants are suppressed before handoff",
      async () => {
        for (const mode of ["revoked", "banned", "unverified"]) {
          const a = await submitted();
          const [j] = await claim();
          if (mode === "revoked")
            await db`update app.demo_run_participants set status='revoked',revoked_at=statement_timestamp() where profile_id=${a.id}::uuid`;
          else if (mode === "banned")
            await db`update auth.users set banned_until=statement_timestamp()+interval '1 day' where id=${a.auth}::uuid`;
          else
            await db`update auth.users set email_confirmed_at=null where id=${a.auth}::uuid`;
          assert.equal(await prepare(j), null);
          assert.equal((await jobs(a))[0].state, "suppressed");
        }
      },
    );
    await t.test(
      "actual shared worker delivers one staff-only Mailpit receipt and does not resend a lost successful response",
      async () => {
        const a = await submitted();
        const env = {
          NOTIFICATION_DELIVERY_ENABLED: "true",
          NOTIFICATION_TRANSPORT: "mailpit",
          NOTIFICATION_MAILPIT_URL: "http://127.0.0.1:55324",
          NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
          NOTIFICATION_DATABASE_URL: workerUrl,
        };
        const result = await runNotificationWorker(env);
        assert.equal(result.accepted, 1);
        assert.equal(result.claimed, 1);
        const [job] = await jobs(a);
        assert.equal(job.state, "accepted");
        assert.equal(typeof job.provider_id, "string");
        captures.push(job.provider_id);
        const response = await fetch(
          "http://127.0.0.1:55324/api/v1/message/" + job.provider_id,
        );
        assert.equal(response.status, 200);
        const mail = await response.json();
        assert.deepEqual(
          mail.To.map((x: { Address: string }) => x.Address),
          ["hello@movx.club"],
        );
        assert.equal(mail.From.Address, "notification@movx.club");
        for (const text of [a.email, a.id, "Submitted <Coach> & Team"])
          assert.ok(mail.Text.includes(text));
        assert.match(mail.HTML, /Submitted &lt;Coach&gt; &amp; Team/);
        await intent(a);
        await save(a);
        assert.equal((await runNotificationWorker(env)).claimed, 0);
        assert.equal((await jobs(a)).length, 1);
        await assert.rejects(
          runNotificationWorker({
            ...env,
            NOTIFICATION_DATABASE_URL: runtimeUrl,
          }),
          /restricted worker role/,
        );
      },
    );
    await t.test(
      "private contacts validate at SQL boundaries, require completion, and remain owner/dataset scoped",
      async () => {
        const a = await actor();
        await intent(a);
        await assert.rejects(
          as(a, (tx) => saveIn(tx)),
          /requires a saved contact phone/,
        );
        assert.equal((await jobs(a)).length, 0);
        assert.equal(
          (
            await db`select * from app.coach_profiles where profile_id=${a.id}::uuid`
          ).length,
          0,
        );
        for (const details of [
          { ...contact, phoneNumber: "015123456789" },
          { ...contact, phoneNumber: "+49151\r\nBcc: attacker" },
          { ...contact, instagramUrl: "https://instagram.com.evil.test/coach" },
          { ...contact, facebookUrl: "http://facebook.com/coach" },
          { ...contact, linkedinUrl: "javascript:alert(1)" },
          {
            ...contact,
            instagramUrl: "https://instagram.com/" + "a".repeat(501),
          },
          { ...contact, extra: "not allowed" },
          { phoneNumber: contact.phoneNumber },
        ])
          await assert.rejects(
            as(
              a,
              (tx) =>
                tx`select app.save_owned_coach_application_contact(0,${tx.json(details)})`,
            ),
            /invalid/,
          );
        assert.equal(
          await as(
            a,
            async (tx) =>
              (
                await tx`select app.current_owned_coach_application_contact() v`
              )[0].v,
          ),
          null,
        );
        await assert.rejects(
          as(a, async (tx) => {
            await contactIn(tx);
            await saveIn(tx, "x");
          }),
          /coach profile/,
        );
        assert.equal(
          (
            await db`select * from app.coach_application_contacts where profile_id=${a.id}::uuid`
          ).length,
          0,
          "contact must roll back when coaching details fail",
        );
        await save(a);
        const own = await as(
          a,
          async (tx) =>
            (
              await tx`select app.current_owned_coach_application_contact() v`
            )[0].v,
        );
        assert.deepEqual(own, { ...contact, revision: 1 });
        const other = await actor();
        assert.equal(
          await as(
            other,
            async (tx) =>
              (
                await tx`select app.current_owned_coach_application_contact() v`
              )[0].v,
          ),
          null,
        );
        await assert.rejects(
          as(
            { ...other, id: a.id },
            async (tx) =>
              tx`select app.current_owned_coach_application_contact()`,
          ),
          /invalid/,
        );
        await assert.rejects(
          as(
            { ...a, run: randomUUID() },
            async (tx) =>
              tx`select app.current_owned_coach_application_contact()`,
          ),
          /invalid/,
        );
        for (const connection of [runtime, worker]) {
          await assert.rejects(
            connection`select * from app.coach_application_contacts`,
            /permission denied/,
          );
          await assert.rejects(
            connection`update app.coach_application_contacts set revision=2`,
            /permission denied/,
          );
        }
        await assert.rejects(
          worker`select app.current_owned_coach_application_contact()`,
          /permission denied/,
        );
        const [flags] =
          await db`select relrowsecurity,relforcerowsecurity from pg_class where oid='app.coach_application_contacts'::regclass`;
        assert.equal(flags.relrowsecurity, true);
        assert.equal(flags.relforcerowsecurity, true);
        await assert.rejects(
          db`update app.coach_application_contacts set details='{}' where profile_id=${a.id}::uuid`,
          /check constraint/,
        );
      },
    );
    await t.test(
      "contact revisions fence concurrent edits, recover exact retries and capture per-submission snapshots",
      async () => {
        const a = await submitted();
        const edited = {
          ...contact,
          phoneNumber: "+4915111111111",
          instagramUrl: null,
        };
        const another = { ...contact, phoneNumber: "+4915222222222" };
        const outcomes = await Promise.allSettled([
          as(a, (tx) => contactIn(tx, edited, 1)),
          as(a, (tx) => contactIn(tx, another, 1)),
        ]);
        assert.equal(
          outcomes.filter((r) => r.status === "fulfilled").length,
          1,
        );
        const rejected = outcomes.find(
          (r) => r.status === "rejected",
        ) as PromiseRejectedResult;
        assert.equal(rejected.reason.code, "40001");
        const current = await as(
          a,
          async (tx) =>
            (
              await tx`select app.current_owned_coach_application_contact() v`
            )[0].v,
        );
        assert.equal(current.revision, 2);
        const winning = {
          phoneNumber: current.phoneNumber,
          instagramUrl: current.instagramUrl,
          facebookUrl: current.facebookUrl,
          linkedinUrl: current.linkedinUrl,
        };
        assert.equal(
          await as(a, (tx) => contactIn(tx, winning, 1)),
          2,
          "lost-response exact retry is idempotent",
        );
        assert.deepEqual(
          (await jobs(a))[0].contact_details,
          contact,
          "ordinary edits cannot rewrite submission snapshot",
        );
        await db`select app.review_coach_application(${a.id}::uuid,'pending','rejected','Review contact changes.','mov109','movx-identity-application-v1')`;
        await Promise.all([intent(a), intent(a)]);
        const records = await jobs(a);
        assert.equal(records.length, 2);
        assert.deepEqual(records[1].contact_details, winning);
        // A legacy rejected account cannot bypass completeness through the old API/SQL.
        await db`select app.review_coach_application(${a.id}::uuid,'pending','rejected','Supply a contact phone.','mov109','movx-identity-application-v1')`;
        await db`delete from app.coach_application_contacts where profile_id=${a.id}::uuid`;
        await assert.rejects(intent(a), /requires a saved contact phone/);
        assert.equal((await jobs(a)).length, 2);
        const [application] =
          await db`select status,revision from app.coach_applications where profile_id=${a.id}::uuid`;
        assert.deepEqual(
          { status: application.status, revision: application.revision },
          { status: "rejected", revision: 2 },
        );
        await as(a, (tx) => contactIn(tx, { ...contact, instagramUrl: null }));
        await intent(a);
        assert.equal((await jobs(a)).length, 3);
        assert.equal((await jobs(a))[2].contact_details.instagramUrl, null);
      },
    );
  } finally {
    for (const id of captures) {
      const r = await fetch("http://127.0.0.1:55324/api/v1/messages", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ IDs: [id] }),
      });
      assert.ok(r.ok);
    }
    await Promise.all([runtime.end(), worker.end(), db.end()]);
  }
});
