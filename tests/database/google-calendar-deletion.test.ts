import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const target = process.env.DATABASE_TEST_URL;
test(
  "Calendar deletion SQL: pinned targets, authority, replay, cancellation, retired-ID recovery and late completions",
  {
    skip:
      !target ||
      !/^\/mov230_[a-f0-9]+_(fresh|upgrade)$/.test(new URL(target).pathname),
  },
  async () => {
    const url = new URL(target!);
    assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
    assert.equal(url.port, "55322");
    const db = postgres(target!, {
        max: 4,
        prepare: false,
        onnotice: () => {},
      }),
      clientHash = createHash("sha256")
        .update("deletion-fixture-client")
        .digest("hex");
    type Actor = { subject: string; profile: string; run: string };
    async function actor(name: string): Promise<Actor> {
      const subject = randomUUID();
      await db`insert into auth.users(id,email,email_confirmed_at,is_sso_user,is_anonymous)values(${subject}::uuid,${`delete-${subject}@example.test`},statement_timestamp(),false,false)`;
      const [p] =
        await db`select *from app.enroll_application_identity(${subject}::uuid,${name})`;
      return {
        subject,
        profile: p.identity_profile_id,
        run: p.identity_run_id,
      };
    }
    const as = <T>(
      a: Actor,
      work: (tx: postgres.TransactionSql) => Promise<T>,
    ) =>
      db.begin(async (tx) => {
        await tx`select set_config('app.current_auth_user_id',${a.subject},true),set_config('app.current_profile_id',${a.profile},true),set_config('app.current_run_id',${a.run},true),set_config('app.current_run_role','member',true)`;
        await tx`set local role app_runtime`;
        return work(tx);
      });
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
            await tx`select app.google_calendar_connection_command(${action},${gen}::uuid,${tx.json(input as postgres.JSONValue)})result`
          )[0].result,
      );
    const status = (a: Actor) =>
      as(
        a,
        async (tx) =>
          (await tx`select app.google_calendar_connection_status()result`)[0]
            .result,
      );
    const proof = {
      stateHash: "a".repeat(64),
      browserHash: "b".repeat(64),
      sessionId: randomUUID(),
      verifier: "fixture-encrypted-proof",
    };
    const operation = (c: Record<string, string>) => ({
      operationId: c.operation_id,
    });
    async function connect(a: Actor, id: string) {
      assert.equal(
        (await command(a, "begin", (await status(a)).generation, proof)).kind,
        "ok",
      );
      const c = (
        await command(a, "claim-callback", null, {
          ...proof,
          operationId: randomUUID(),
        })
      ).record;
      await command(a, "credentials", c.generation, {
        ...operation(c),
        sub: "fixture-google",
        email: "fixture@example.test",
        clientHash,
        credential: "fixture-encrypted-refresh",
      });
      const boot = await command(a, "bootstrap", c.generation, operation(c));
      if (boot.kind === "recovery-required") {
        await command(a, "finish", c.generation, {
          ...operation(c),
          state: "recovery-required",
        });
        return c;
      }
      assert.equal(boot.kind, "ok");
      if (boot.mode === "create")
        await command(a, "record-calendar", c.generation, {
          ...operation(c),
          sub: "fixture-google",
          clientHash,
          calendarId: id,
        });
      await command(a, "finish", c.generation, {
        ...operation(c),
        state: "connected",
        verified: true,
      });
      return c;
    }
    const claimDelete = (a: Actor, commandId = randomUUID()) =>
      command(a, "delete-claim", null, {}).then(async (denied) => {
        assert.equal(denied.kind, "conflict");
        return command(a, "delete-claim", (await status(a)).generation, {
          operationId: commandId,
          clientHash,
        });
      });
    try {
      const a = await actor("Delete Owner"),
        other = await actor("Delete Other");
      await connect(a, "old-calendar");
      await connect(other, "other-calendar");
      await assert.rejects(
        as(a, (tx) => tx`select *from app.google_calendar_retirements`),
      );
      await assert.rejects(
        as(
          a,
          (tx) =>
            tx`select app.google_calendar_connection_command_v1('disconnect',null,'{}')`,
        ),
      );
      const beforeOther = await status(other),
        prepared = await claimDelete(a);
      assert.equal(prepared.calendarId, "old-calendar");
      assert.equal(
        (
          await command(
            other,
            "delete-dispatch",
            prepared.record.generation,
            operation(prepared.record),
          )
        ).kind,
        "conflict",
      );
      assert.equal(
        (
          await command(
            a,
            "delete-confirm",
            prepared.record.generation,
            operation(prepared.record),
          )
        ).kind,
        "conflict",
        "confirmation before dispatch is invalid",
      );
      await command(a, "disconnect", prepared.record.generation);
      assert.equal(
        (
          await command(
            a,
            "delete-dispatch",
            prepared.record.generation,
            operation(prepared.record),
          )
        ).kind,
        "conflict",
        "disconnect fences a prepared request",
      );
      assert.equal((await status(a)).calendarId, "old-calendar");
      assert.deepEqual(await status(other), beforeOther);

      await connect(a, "unused");
      const sent = await claimDelete(a);
      assert.equal(
        (
          await command(
            a,
            "delete-dispatch",
            sent.record.generation,
            operation(sent.record),
          )
        ).kind,
        "ok",
      );
      assert.equal(
        (
          await command(
            a,
            "delete-dispatch",
            sent.record.generation,
            operation(sent.record),
          )
        ).kind,
        "conflict",
        "same attempt dispatches only once",
      );
      assert.equal(
        (
          await command(a, "delete-claim", sent.record.generation, {
            operationId: randomUUID(),
            clientHash,
          })
        ).kind,
        "conflict",
        "active deletion is serialized",
      );
      await command(
        a,
        "delete-fail",
        sent.record.generation,
        operation(sent.record),
      );
      assert.equal((await status(a)).state, "recovery-required");
      const [privateRow] =
        await db`select credential_ciphertext,pending_verifier_ciphertext from app.google_calendar_connections where profile_id=${a.profile}::uuid`;
      assert.equal(privateRow.credential_ciphertext, null);
      assert.equal(privateRow.pending_verifier_ciphertext, null);
      await connect(a, "unused");
      assert.equal(
        (await status(a)).state,
        "recovery-required",
        "retired target cannot be automatically reused",
      );
      let c = (
        await command(a, "claim-check", (await status(a)).generation, {
          operationId: randomUUID(),
        })
      ).record;
      assert.equal(
        (
          await command(a, "bootstrap", c.generation, {
            ...operation(c),
            recoverId: "old-calendar",
          })
        ).kind,
        "recovery-required",
        "even explicit recovery cannot reactivate a target with a pending DELETE",
      );
      await command(a, "finish", c.generation, {
        ...operation(c),
        state: "recovery-required",
      });
      c = (
        await command(a, "claim-check", (await status(a)).generation, {
          operationId: randomUUID(),
        })
      ).record;
      assert.equal(
        (
          await command(a, "bootstrap", c.generation, {
            ...operation(c),
            replace: true,
          })
        ).mode,
        "create",
      );
      await command(a, "record-calendar", c.generation, {
        ...operation(c),
        sub: "fixture-google",
        clientHash,
        calendarId: "replacement-calendar",
      });
      await command(a, "finish", c.generation, {
        ...operation(c),
        state: "connected",
        verified: true,
      });
      const replacement = await status(a);
      await command(
        a,
        "delete-confirm",
        sent.record.generation,
        operation(sent.record),
      );
      assert.deepEqual(
        await status(a),
        replacement,
        "late confirmed deletion does not disconnect/delete a replacement",
      );

      const successful = await claimDelete(a);
      await command(
        a,
        "delete-dispatch",
        successful.record.generation,
        operation(successful.record),
      );
      await command(
        a,
        "delete-confirm",
        successful.record.generation,
        operation(successful.record),
      );
      assert.equal((await status(a)).state, "disconnected");
      assert.equal((await status(a)).calendarId, null);
      await connect(a, "fresh-calendar");
      assert.equal((await status(a)).state, "connected");
      assert.equal(
        (
          await command(a, "delete-claim", (await status(a)).generation, {
            operationId: successful.record.operation_id,
            clientHash,
          })
        ).kind,
        "conflict",
        "replayed confirmation cannot target a later calendar",
      );
      assert.deepEqual(await status(other), beforeOther);
    } finally {
      await db.end({ timeout: 2 });
    }
  },
);
