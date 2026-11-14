import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const target = process.env.DATABASE_TEST_URL;
test(
  "Calendar SQL: actor authority, single-use callbacks, serialized bootstrap, disconnect and uncertain/replayed operations",
  {
    skip:
      !target ||
      !/^\/mov(?:225|226|230)_[a-f0-9]+_(fresh|upgrade)$/.test(
        new URL(target).pathname,
      ),
  },
  async () => {
    const url = new URL(target!);
    assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
    assert.equal(url.port, "55322");
    const db = postgres(target!, {
      max: 4,
      prepare: false,
      onnotice: () => {},
    });
    type Actor = { subject: string; profile: string; run: string };
    async function actor(name: string): Promise<Actor> {
      const subject = randomUUID();
      await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous) values(${subject}::uuid,${`calendar-${subject}@example.test`},statement_timestamp(),false,false)`;
      const [p] =
        await db`select * from app.enroll_application_identity(${subject}::uuid,${name})`;
      return {
        subject,
        profile: p.identity_profile_id,
        run: p.identity_run_id,
      };
    }
    function as<T>(
      a: Actor,
      work: (tx: postgres.TransactionSql) => Promise<T>,
    ) {
      return db.begin(async (tx) => {
        await tx`select set_config('app.current_auth_user_id',${a.subject},true),set_config('app.current_profile_id',${a.profile},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
        await tx`set local role app_runtime`;
        return work(tx);
      });
    }
    const status = (a: Actor) =>
      as(
        a,
        async (tx) =>
          (await tx`select app.google_calendar_connection_status() result`)[0]
            .result,
      );
    const command = (
      a: Actor,
      action: string,
      gen: string | null,
      input: Record<string, unknown> = {},
    ) =>
      as(
        a,
        async (tx) =>
          (
            await tx`select app.google_calendar_connection_command(${action},${gen}::uuid,${tx.json(input as postgres.JSONValue)}) result`
          )[0].result,
      );
    const hash = (s: string) => createHash("sha256").update(s).digest("hex");
    const clientHash = hash("fixture-client"),
      session = randomUUID();
    const initial = "00000000-0000-0000-0000-000000000000";
    const input = {
      stateHash: hash("state"),
      browserHash: hash("browser"),
      sessionId: session,
      verifier: "fixture-encrypted-pkce",
    };
    async function begin(a: Actor) {
      return command(a, "begin", (await status(a)).generation, input);
    }
    async function claim(a: Actor) {
      return command(a, "claim-callback", null, {
        ...input,
        operationId: randomUUID(),
      });
    }
    async function credentials(
      a: Actor,
      c: Record<string, string>,
      sub = "google-1",
    ) {
      return command(a, "credentials", c.generation, {
        operationId: c.operation_id,
        sub,
        email: "calendar@example.test",
        clientHash,
        credential: "fixture-encrypted-refresh",
      });
    }
    async function finish(a: Actor, c: Record<string, string>, state: string) {
      return command(a, "finish", c.generation, {
        operationId: c.operation_id,
        state,
        verified: state === "connected",
      });
    }
    try {
      const a = await actor("Calendar Owner"),
        other = await actor("Calendar Other");
      assert.deepEqual(await status(a), {
        state: "disconnected",
        generation: initial,
        email: null,
        calendarId: null,
        checkedAt: null,
      });
      await assert.rejects(
        as(a, (tx) => tx`select * from app.google_calendar_connections`),
        /permission denied/,
      );
      await assert.rejects(
        as(a, (tx) => tx`select * from app.google_calendar_accounts`),
        /permission denied/,
      );
      await assert.rejects(status({ ...a, subject: other.subject }), /invalid/);
      await assert.rejects(status({ ...a, run: randomUUID() }), /invalid/);
      for (const role of ["anon", "authenticated", "service_role"]) {
        const [r] =
          await db`select has_function_privilege(${role},'app.google_calendar_connection_command(text,uuid,jsonb)','execute') allowed`;
        assert.equal(r.allowed, false);
      }
      assert.equal((await begin(a)).kind, "ok");
      assert.equal(
        (await begin(a)).kind,
        "conflict",
        "parallel pending flow cannot supersede a live continuation",
      );
      assert.equal(
        (
          await command(a, "claim-callback", null, {
            ...input,
            browserHash: hash("wrong"),
            operationId: randomUUID(),
          })
        ).kind,
        "conflict",
      );
      assert.equal(
        (
          await command(a, "claim-callback", null, {
            ...input,
            sessionId: randomUUID(),
            operationId: randomUUID(),
          })
        ).kind,
        "conflict",
      );
      assert.equal(
        (await claim(other)).kind,
        "conflict",
        "other profile cannot claim callback",
      );
      const claims = await Promise.all([claim(a), claim(a)]);
      assert.deepEqual(claims.map((x) => x.kind).sort(), ["conflict", "ok"]);
      let c = claims.find((x) => x.kind === "ok").record;
      assert.equal((await credentials(a, c)).kind, "ok");
      const create = await command(a, "bootstrap", c.generation, {
        operationId: c.operation_id,
      });
      assert.equal(create.mode, "create");
      assert.equal(
        (
          await command(a, "bootstrap", c.generation, {
            operationId: c.operation_id,
          })
        ).kind,
        "recovery-required",
        "uncertain create is never automatically retried",
      );
      // Simulate a create response arriving after the user disconnected.
      const oldGen = c.generation;
      assert.equal((await command(a, "disconnect", oldGen)).kind, "ok");
      assert.equal(
        (
          await command(a, "record-calendar", oldGen, {
            operationId: c.operation_id,
            sub: "google-1",
            clientHash,
            calendarId: "movx-fixture@group.calendar.google.com",
          })
        ).kind,
        "ok",
      );
      assert.equal((await finish(a, c, "connected")).kind, "conflict");
      assert.equal((await status(a)).state, "disconnected");
      assert.equal(
        (await command(a, "disconnect", oldGen)).kind,
        "ok",
        "same disconnect replay is safe when still disconnected",
      );
      const [cleared] =
        await db`select credential_ciphertext,pending_verifier_ciphertext from app.google_calendar_connections where profile_id=${a.profile}::uuid`;
      assert.deepEqual(cleared, {
        credential_ciphertext: null,
        pending_verifier_ciphertext: null,
      });
      // Reconnect same Google account: reuses the known mapping, including late result.
      await begin(a);
      c = (await claim(a)).record;
      await credentials(a, c);
      assert.equal(
        (
          await command(a, "bootstrap", c.generation, {
            operationId: c.operation_id,
          })
        ).mode,
        "verify",
      );
      await finish(a, c, "connected");
      let safe = await status(a);
      assert.equal(safe.state, "connected");
      assert.ok(safe.checkedAt);
      assert.deepEqual(Object.keys(safe).sort(), [
        "calendarId",
        "checkedAt",
        "email",
        "generation",
        "state",
      ]);
      assert.equal((await status(other)).state, "disconnected");
      // Connected-account changes require explicit disconnect.
      await begin(a);
      c = (await claim(a)).record;
      assert.equal(
        (await credentials(a, c, "google-other")).kind,
        "account-mismatch",
      );
      await finish(a, c, "connected");
      safe = await status(a);
      // Calendar loss/replacement is explicit, and the replacement command cannot replay.
      let op = randomUUID();
      c = (
        await command(a, "claim-check", safe.generation, { operationId: op })
      ).record;
      await finish(a, c, "recovery-required");
      op = randomUUID();
      c = (
        await command(a, "claim-check", safe.generation, { operationId: op })
      ).record;
      assert.equal(
        (
          await command(a, "bootstrap", c.generation, {
            operationId: op,
            replace: true,
          })
        ).mode,
        "create",
      );
      await finish(a, c, "recovery-required");
      assert.equal(
        (await command(a, "claim-check", safe.generation, { operationId: op }))
          .kind,
        "conflict",
        "replaying replacement cannot create another calendar",
      );
      assert.equal(
        (await command(a, "disconnect", oldGen)).kind,
        "conflict",
        "old disconnect cannot remove a newer connection",
      );
      // Expired continuations cannot be exchanged and expose no credential data.
      const newer = await actor("Expired Calendar");
      await begin(newer);
      await db`update app.google_calendar_connections set expires_at=statement_timestamp()-interval '1 minute' where profile_id=${newer.profile}::uuid`;
      assert.equal((await status(newer)).state, "reconnect-required");
      assert.equal((await claim(newer)).kind, "conflict");
      // An already-issued request may finish after approved privacy cleanup,
      // but it cannot recreate a deleted connection/mapping record.
      await db`delete from app.google_calendar_connections where profile_id=${a.profile}::uuid`;
      assert.equal(
        (
          await command(a, "record-calendar", c.generation, {
            operationId: op,
            sub: "google-1",
            clientHash,
            calendarId: "late@group.calendar.google.com",
          })
        ).kind,
        "conflict",
      );
      const [remaining] =
        await db`select count(*)::int n from app.google_calendar_connections where profile_id=${a.profile}::uuid`;
      assert.equal(remaining.n, 0);
      console.log(
        "PASS authority/single-use/parallel callbacks/uncertain bootstrap/late response/disconnect/reconnect/account change/replacement replay/expiry",
      );
    } finally {
      await db.end({ timeout: 1 });
    }
  },
);
